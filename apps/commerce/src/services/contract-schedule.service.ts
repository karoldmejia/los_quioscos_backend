import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RpcException } from '@nestjs/microservices';
import { ContractScheduleStatus } from '../enums/contract-schedule-status.enum';
import { ContractScheduleVersionStatus } from '../enums/contract-schedule-version-status.enum';
import { ContractStatus } from '../enums/contract-status.enum';
import { ProposedBy } from '../enums/proposed-by.enum';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ContractScheduleItemRepository } from '../repositories/impl/contract-schedule-item.repository';
import { ContractScheduleVersionRepository } from '../repositories/impl/contract-schedule-version.repository';
import { ContractScheduleRepository } from '../repositories/impl/contract-schedule.repository';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { OrderGenerationResultDto, ScheduleGenerationSummaryDto } from '../dtos/order-generation.dto';
import { OrderService } from './order.service';
import { ExpiringContractDto, RenewalNotificationDto, RenewalResultDto } from '../dtos/contract-renewal.dto';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';

@Injectable()
export class ContractScheduleService {
    private readonly logger = new Logger(ContractScheduleService.name);
    private readonly WEEKS_TO_GENERATE = 6;
    private readonly RENEWAL_NOTIFICATION_DAYS = 14;
    private readonly EXPIRY_CHECK_INTERVALS = [14, 7, 3, 1];

    constructor(
        // Repositories
        private readonly contractRepository: ContractRepository,
        private readonly contractItemRepository: ContractItemRepository,
        private readonly contractVersionRepository: ContractVersionRepository,
        private readonly contractScheduleRepository: ContractScheduleRepository,
        private readonly contractScheduleVersionRepository: ContractScheduleVersionRepository,
        private readonly contractScheduleItemRepository: ContractScheduleItemRepository,
        // Services
        private readonly ordersService: OrderService,
    ) { }

    // cron jobs
    @Cron('0 2 * * *')
    async generateSchedulesDaily() {
        this.logger.log('Running daily schedule generation');

        try {
            const result = await this.runFullGenerationProcess();
            this.logger.log(`Daily schedule generation completed:`, result);
        } catch (error: any) {
            this.logger.error(`Daily schedule generation failed: ${error.message}`);
        }
    }

    @Cron('0 * * * *')
    async checkUpcomingSchedules() {
        this.logger.log('Checking for upcoming schedules');

        try {
            const results = await this.generateOrdersForUpcomingSchedules();
            const successful = results.filter(r => r.success).length;
            this.logger.log(`Generated ${successful} orders from ${results.length} schedules`);
        } catch (error: any) {
            this.logger.error(`Failed to check upcoming schedules: ${error.message}`);
        }
    }

    @Cron('0 9 * * *')
    async checkExpiringContracts() {
        this.logger.log('Checking for expiring contracts');

        try {
            const notifications = await this.processExpiringContracts();
            this.logger.log(`Processed ${notifications.length} expiring contracts`);

            const notificationCounts = notifications.reduce((acc, n) => {
                acc[n.notification_type] = (acc[n.notification_type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            this.logger.log('Notifications sent:', notificationCounts);

        } catch (error: any) {
            this.logger.error(`Failed to check expiring contracts: ${error.message}`);
        }
    }

    @Cron('0 10 * * 3')
    async followUpRenewalNotifications() {
        this.logger.log('Sending follow-up renewal notifications');

        try {
            const expiringSoon = await this.findExpiringContracts(7);

            this.logger.log(`Found ${expiringSoon.length} contracts expiring within 7 days`);

            for (const contract of expiringSoon) {
                this.logger.log(`Follow-up needed for contract ${contract.contract_id}`);
                // await this.sendFollowUpNotification(contract);
            }

        } catch (error: any) {
            this.logger.error(`Failed to send follow-up notifications: ${error.message}`);
        }
    }

    // full generation process
    async runFullGenerationProcess(): Promise<ScheduleGenerationSummaryDto> {
        this.logger.log('Starting full generation process');

        const scheduleResult = await this.generateSchedulesForAllContracts();
        const orderResult = await this.generateOrdersForUpcomingSchedules();

        return {
            contracts_processed: scheduleResult.contracts_processed,
            schedules_created: scheduleResult.schedules_created,
            orders_generated: orderResult.filter(r => r.success).length,
            errors: orderResult.filter(r => !r.success).map(r => ({
                schedule_id: r.schedule_id,
                error: r.error || 'Unknown error'
            }))
        };
    }

    // schedule generation
    async generateSchedulesForAllContracts(): Promise<{
        contracts_processed: number;
        schedules_created: number;
    }> {
        this.logger.log('Starting schedule generation for all active contracts');

        const activeContracts = await this.contractRepository.findActiveContracts();
        this.logger.log(`Found ${activeContracts.length} active contracts`);

        let totalSchedulesCreated = 0;

        for (const contract of activeContracts) {
            try {
                const schedulesCreated = await this.generateSchedulesForContract(contract.contract_id);
                totalSchedulesCreated += schedulesCreated;
            } catch (error: any) {
                this.logger.error(`Error generating schedules for contract ${contract.contract_id}: ${error.message}`);
            }
        }

        this.logger.log(`Schedule generation completed. Created ${totalSchedulesCreated} schedules`);

        return {
            contracts_processed: activeContracts.length,
            schedules_created: totalSchedulesCreated
        };
    }

    async generateSchedulesForContract(contractId: string): Promise<number> {
        const contract = await this.contractRepository.findById(contractId);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contractId}`
            });
        }

        if (contract.status !== ContractStatus.ACTIVE) {
            throw new RpcException({
                status: 400,
                message: `Contract is not active: ${contractId}`
            });
        }

        const existingSchedules = await this.contractScheduleRepository.findByContractId(contractId);
        const existingDates = new Set(
            existingSchedules.map(s =>
                new Date(s.scheduled_delivery_date).toISOString().split('T')[0]
            )
        );

        const requiredDates = this.calculateRequiredDates(
            contract.start_date,
            contract.end_date,
            contract.frequency
        );

        const datesToCreate = requiredDates.filter(date =>
            !existingDates.has(date.toISOString().split('T')[0])
        );

        if (datesToCreate.length === 0) {
            this.logger.log(`No new schedules needed for contract ${contractId}`);
            return 0;
        }

        this.logger.log(`Creating ${datesToCreate.length} new schedules for contract ${contractId}`);

        const schedulesToCreate = datesToCreate.map(date => ({
            contract_id: contractId,
            scheduled_delivery_date: date,
            status: ContractScheduleStatus.SCHEDULED
        }));

        const createdSchedules = await this.contractScheduleRepository.createMany(schedulesToCreate);

        for (const schedule of createdSchedules) {
            await this.createInitialScheduleVersion(schedule.contract_schedule_id, contractId);
        }

        this.logger.log(`Created ${createdSchedules.length} schedules for contract ${contractId}`);
        return createdSchedules.length;
    }

    async getItemsForSchedule(scheduleId: string): Promise<{
        items: any[];
        version_number: number;
        source: 'contract' | 'schedule_version';
    }> {
        const acceptedVersion = await this.contractScheduleVersionRepository.findAcceptedVersion(scheduleId);

        if (acceptedVersion) {
            const items = await this.contractScheduleItemRepository.findByVersionId(
                acceptedVersion.contract_schedule_version_id
            );
            return {
                items: items.map(item => ({
                    product_id: item.product_id,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    requirements_json: item.requirements_json
                })),
                version_number: acceptedVersion.version_number,
                source: 'schedule_version'
            };
        }

        const versions = await this.contractScheduleVersionRepository.findByScheduleId(scheduleId);
        const autoAppliedVersion = versions
            .filter(v => v.status === ContractScheduleVersionStatus.AUTO_APPLIED)
            .sort((a, b) => b.version_number - a.version_number)[0];

        if (autoAppliedVersion) {
            const items = await this.contractScheduleItemRepository.findByVersionId(
                autoAppliedVersion.contract_schedule_version_id
            );
            return {
                items: items.map(item => ({
                    product_id: item.product_id,
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                    requirements_json: item.requirements_json
                })),
                version_number: autoAppliedVersion.version_number,
                source: 'schedule_version'
            };
        }

        const schedule = await this.contractScheduleRepository.findById(scheduleId);
        if (!schedule) {
            throw new Error(`Schedule not found: ${scheduleId}`);
        }

        const contractItems = await this.contractItemRepository.findByContractId(schedule.contract_id);
        return {
            items: contractItems.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: Number(item.unit_price),
                requirements_json: item.requirements_json
            })),
            version_number: 0,
            source: 'contract'
        };
    }

    // order generation
    async generateOrdersForUpcomingSchedules(): Promise<OrderGenerationResultDto[]> {
        this.logger.log('Looking for schedules ready for order generation');

        const results: OrderGenerationResultDto[] = [];

        try {
            const schedules = await this.contractScheduleRepository.findSchedulesForOrderGeneration(3);
            this.logger.log(`Found ${schedules.length} schedules ready for order generation`);

            for (const schedule of schedules) {
                try {
                    const contract = await this.contractRepository.findById(schedule.contract_id);
                    if (!contract || contract.status !== ContractStatus.ACTIVE) {
                        this.logger.warn(`Contract ${schedule.contract_id} is not active for schedule ${schedule.contract_schedule_id}`);
                        await this.contractScheduleRepository.updateStatus(
                            schedule.contract_schedule_id,
                            ContractScheduleStatus.CANCELLED
                        );
                        results.push({
                            success: false,
                            schedule_id: schedule.contract_schedule_id,
                            error: 'Contract is not active'
                        });
                        continue;
                    }

                    const result = await this.generateOrderForSchedule(schedule);
                    results.push(result);

                    if (result.success) {
                        await this.contractScheduleRepository.updateStatus(
                            schedule.contract_schedule_id,
                            ContractScheduleStatus.ORDER_GENERATED
                        );
                        this.logger.log(`Order ${result.order_id} generated for schedule ${schedule.contract_schedule_id}`);
                    }
                } catch (error: any) {
                    this.logger.error(`Error processing schedule ${schedule.contract_schedule_id}: ${error.message}`);
                    results.push({
                        success: false,
                        schedule_id: schedule.contract_schedule_id,
                        error: error.message
                    });
                }
            }
        } catch (error: any) {
            this.logger.error(`Error in order generation process: ${error.message}`);
            throw new RpcException(`Failed to generate orders: ${error.message}`);
        }

        return results;
    }

    async generateOrderForScheduleId(scheduleId: string): Promise<OrderGenerationResultDto> {
        const schedule = await this.contractScheduleRepository.findById(scheduleId);
        if (!schedule) {
            return {
                success: false,
                schedule_id: scheduleId,
                error: 'Schedule not found'
            };
        }

        return await this.generateOrderForSchedule(schedule);
    }

    async markSchedulesAsSkipped(
        contractId: string,
        startDate: Date,
        endDate: Date
    ): Promise<number> {
        const schedules = await this.contractScheduleRepository.findSchedulesForDateRange(
            contractId,
            startDate,
            endDate
        );

        let skippedCount = 0;
        for (const schedule of schedules) {
            if (schedule.status === ContractScheduleStatus.SCHEDULED) {
                await this.contractScheduleRepository.updateStatus(
                    schedule.contract_schedule_id,
                    ContractScheduleStatus.SKIPPED
                );
                skippedCount++;
            }
        }

        return skippedCount;
    }

    // renewal operations
    async findExpiringContracts(days: number = 14): Promise<ExpiringContractDto[]> {
        const contracts = await this.contractRepository.findContractsExpiringSoon(days);

        return contracts.map(contract => ({
            contract_id: contract.contract_id,
            business_id: contract.business_id,
            kiosk_id: contract.kiosk_id,
            end_date: contract.end_date,
            days_until_expiry: this.calculateDaysUntilExpiry(contract.end_date)
        }));
    }

    async processExpiringContracts(): Promise<RenewalNotificationDto[]> {
        this.logger.log('Processing expiring contracts for notifications');

        const notifications: RenewalNotificationDto[] = [];

        for (const days of this.EXPIRY_CHECK_INTERVALS) {
            const expiringContracts = await this.contractRepository.findContractsExpiringSoon(days);

            for (const contract of expiringContracts) {
                const exactDays = this.calculateDaysUntilExpiry(contract.end_date);

                if (this.shouldNotifyAtInterval(exactDays, days)) {
                    const notification = await this.createRenewalNotification(contract, exactDays);
                    notifications.push(notification);

                    this.logger.log(
                        `Contract ${contract.contract_id} expires in ${exactDays} days. ` +
                        `Sending ${this.getNotificationType(exactDays)} notification.`
                    );

                    await this.sendRenewalNotification(notification);
                }
            }
        }

        await this.checkExpiredContracts();

        return notifications;
    }

    async autoRenewContract(contractId: string): Promise<RenewalResultDto> {
        this.logger.log(`Attempting to auto-renew contract ${contractId}`);

        try {
            const originalContract = await this.contractRepository.findById(contractId);
            if (!originalContract) {
                throw new RpcException({
                    status: 404,
                    message: `Contract not found: ${contractId}`
                });
            }

            if (!this.isEligibleForRenewal(originalContract)) {
                return {
                    success: false,
                    parent_contract_id: contractId,
                    status: 'NOT_ELIGIBLE',
                    message: 'Contract is not eligible for renewal'
                };
            }

            const originalItems = await this.contractItemRepository.findByContractId(contractId);

            const newStartDate = new Date(originalContract.end_date);
            newStartDate.setDate(newStartDate.getDate() + 1);

            const newEndDate = new Date(newStartDate);
            const duration = this.calculateContractDuration(
                originalContract.start_date,
                originalContract.end_date
            );
            newEndDate.setDate(newEndDate.getDate() + duration);

            const newContract = await this.contractRepository.createContract({
                business_id: originalContract.business_id,
                kiosk_id: originalContract.kiosk_id,
                transporter_id: originalContract.transporter_id,
                start_date: newStartDate,
                end_date: newEndDate,
                frequency: originalContract.frequency,
                change_deadline_days: originalContract.change_deadline_days,
                cancellation_deadline_days: originalContract.cancellation_deadline_days,
                logistics_mode: originalContract.logistics_mode,
                parent_contract_id: contractId,
                version: 1,
                status: ContractStatus.DRAFT
            });

            await this.contractItemRepository.cloneItemsFromContract(
                contractId,
                newContract.contract_id
            );

            await this.contractVersionRepository.create({
                contract_id: newContract.contract_id,
                version_number: 1,
                proposed_by: 'SYSTEM',
                terms_json_snapshot: {
                    ...newContract,
                    items: originalItems
                }
            });

            this.logger.log(`Contract ${contractId} auto-renewed as ${newContract.contract_id}`);

            return {
                success: true,
                parent_contract_id: contractId,
                new_contract_id: newContract.contract_id,
                status: 'RENEWED'
            };
        } catch (error: any) {
            this.logger.error(`Failed to auto-renew contract ${contractId}: ${error.message}`);
            return {
                success: false,
                parent_contract_id: contractId,
                status: 'FAILED',
                error: error.message
            };
        }
    }

    async renewMultipleContracts(contractIds: string[]): Promise<RenewalResultDto[]> {
        const results: RenewalResultDto[] = [];

        for (const contractId of contractIds) {
            try {
                const result = await this.autoRenewContract(contractId);
                results.push(result);
            } catch (error: any) {
                results.push({
                    success: false,
                    parent_contract_id: contractId,
                    status: 'ERROR',
                    error: error.message
                });
            }
        }

        return results;
    }

    async renewAllExpiredContracts(): Promise<RenewalResultDto[]> {
        const expiredContracts = await this.contractRepository.findByStatus(ContractStatus.EXPIRED);

        const contractsToRenew: string[] = [];

        for (const contract of expiredContracts) {
            const hasRenewal = await this.hasExistingRenewal(contract.contract_id);
            if (!hasRenewal) {
                contractsToRenew.push(contract.contract_id);
            }
        }

        return await this.renewMultipleContracts(contractsToRenew);
    }

    // private helper methods
    private async createInitialScheduleVersion(scheduleId: string, contractId: string): Promise<void> {
        const contractItems = await this.contractItemRepository.findByContractId(contractId);

        if (contractItems.length === 0) {
            this.logger.warn(`No contract items found for contract ${contractId} when creating schedule ${scheduleId}`);
            return;
        }

        const version = await this.contractScheduleVersionRepository.create({
            contract_schedule_id: scheduleId,
            version_number: 1,
            proposed_by: ProposedBy.SYSTEM,
            change_reason: 'Initial schedule creation',
            status: ContractScheduleVersionStatus.AUTO_APPLIED
        });

        const versionItems = contractItems.map(item => ({
            contract_schedule_version_id: version.contract_schedule_version_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            requirements_json: item.requirements_json
        }));

        await this.contractScheduleItemRepository.createMany(versionItems);
        this.logger.log(`Created initial version for schedule ${scheduleId} with ${versionItems.length} items`);
    }

    public async generateOrderForSchedule(schedule: any): Promise<OrderGenerationResultDto> {
        try {
            const itemsResult = await this.getItemsForSchedule(
                schedule.contract_schedule_id
            );

            if (itemsResult.items.length === 0) {
                return {
                    success: false,
                    schedule_id: schedule.contract_schedule_id,
                    error: 'No items found for schedule'
                };
            }

            const contract = await this.contractRepository.findById(schedule.contract_id);
            if (!contract) {
                return {
                    success: false,
                    schedule_id: schedule.contract_schedule_id,
                    error: 'Contract not found'
                };
            }

            const order = await this.ordersService.createOrderWithItemsAndReserveStock({
                orderData: {
                    userId: contract.business_id,
                    kioskUserId: contract.kiosk_id ? parseInt(contract.kiosk_id) : 0
                },
                itemsData: itemsResult.items.map(item => ({
                    productId: item.product_id,
                    quantity: item.quantity,
                    unitPrice: item.unit_price,
                    requirementsJson: item.requirements_json
                }))
            });

            return {
                success: true,
                schedule_id: schedule.contract_schedule_id,
                order_id: order.id
            };
        } catch (error: any) {
            this.logger.error(`Failed to generate order for schedule ${schedule.contract_schedule_id}: ${error.message}`);
            return {
                success: false,
                schedule_id: schedule.contract_schedule_id,
                error: error.message
            };
        }
    }

    private calculateRequiredDates(startDate: Date, endDate: Date, frequency: string): Date[] {
        const dates: Date[] = [];
        const today = new Date();
        const maxDate = new Date();
        maxDate.setDate(today.getDate() + (this.WEEKS_TO_GENERATE * 7));

        const contractStart = new Date(startDate);
        const contractEnd = new Date(endDate);

        const effectiveStart = today > contractStart ? today : contractStart;
        const effectiveEnd = maxDate < contractEnd ? maxDate : contractEnd;

        if (effectiveStart >= effectiveEnd) {
            return dates;
        }

        switch (frequency.toLowerCase()) {
            case 'daily':
                this.generateDailyDates(effectiveStart, effectiveEnd, dates);
                break;
            case 'weekly':
                this.generateWeeklyDates(effectiveStart, effectiveEnd, dates);
                break;
            case 'biweekly':
                this.generateBiweeklyDates(effectiveStart, effectiveEnd, dates);
                break;
            case 'monthly':
                this.generateMonthlyDates(effectiveStart, effectiveEnd, dates);
                break;
            default:
                this.generateCustomFrequencyDates(effectiveStart, effectiveEnd, frequency, dates);
        }

        return dates;
    }

    private generateDailyDates(start: Date, end: Date, dates: Date[]): void {
        const current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
    }

    private generateWeeklyDates(start: Date, end: Date, dates: Date[]): void {
        const current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 7);
        }
    }

    private generateBiweeklyDates(start: Date, end: Date, dates: Date[]): void {
        const current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 14);
        }
    }

    private generateMonthlyDates(start: Date, end: Date, dates: Date[]): void {
        const current = new Date(start);
        while (current <= end) {
            dates.push(new Date(current));
            current.setMonth(current.getMonth() + 1);
        }
    }

    private generateCustomFrequencyDates(start: Date, end: Date, frequency: string, dates: Date[]): void {
        const daysMap: { [key: string]: number } = {
            'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6
        };

        const days = frequency.split(',').map(d => d.trim().toUpperCase());
        const targetDays = days
            .map(d => daysMap[d])
            .filter(d => d !== undefined);

        if (targetDays.length === 0) {
            return;
        }

        const current = new Date(start);
        while (current <= end) {
            if (targetDays.includes(current.getDay())) {
                dates.push(new Date(current));
            }
            current.setDate(current.getDate() + 1);
        }
    }

    // renewal helper methods
    private calculateDaysUntilExpiry(endDate: Date): number {
        const today = new Date();
        const end = new Date(endDate);
        const diffTime = end.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    private shouldNotifyAtInterval(daysUntilExpiry: number, interval: number): boolean {
        return daysUntilExpiry === interval;
    }

    private getNotificationType(daysUntilExpiry: number): string {
        switch (daysUntilExpiry) {
            case 14: return 'TWO_WEEKS';
            case 7: return 'ONE_WEEK';
            case 3: return 'THREE_DAYS';
            case 1: return 'ONE_DAY';
            case 0: return 'EXPIRED';
            default: return 'GENERAL';
        }
    }

    private async createRenewalNotification(contract: any, daysUntilExpiry: number): Promise<RenewalNotificationDto> {
        return {
            contract_id: contract.contract_id,
            business_id: contract.business_id,
            kiosk_id: contract.kiosk_id,
            end_date: contract.end_date,
            days_notice: daysUntilExpiry,
            notification_type: this.getNotificationType(daysUntilExpiry) as any
        };
    }

    private async sendRenewalNotification(notification: RenewalNotificationDto): Promise<void> {
        // Integration with notification service
        this.logger.log(`Sending renewal notification for contract ${notification.contract_id}`);
    }

    private async checkExpiredContracts(): Promise<void> {
        const today = new Date();
        const expiredContracts = await this.contractRepository.findByStatus(ContractStatus.ACTIVE);

        for (const contract of expiredContracts) {
            if (new Date(contract.end_date) < today) {
                await this.contractRepository.updateStatus(
                    contract.contract_id,
                    ContractStatus.EXPIRED
                );

                this.logger.log(`Contract ${contract.contract_id} has expired`);

                await this.sendRenewalNotification({
                    contract_id: contract.contract_id,
                    business_id: contract.business_id,
                    kiosk_id: contract.kiosk_id,
                    end_date: contract.end_date,
                    days_notice: 0,
                    notification_type: 'EXPIRED'
                });
            }
        }
    }

    private isEligibleForRenewal(contract: any): boolean {
        const eligibleStatuses = [ContractStatus.ACTIVE, ContractStatus.EXPIRED];

        if (!eligibleStatuses.includes(contract.status)) {
            return false;
        }

        if (contract.status === ContractStatus.ACTIVE) {
            const daysUntilExpiry = this.calculateDaysUntilExpiry(contract.end_date);
            if (daysUntilExpiry > 30) {
                return false;
            }
        }
        return true;
    }

    private calculateContractDuration(startDate: Date, endDate: Date): number {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = end.getTime() - start.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    private async hasExistingRenewal(contractId: string): Promise<boolean> {
        const renewals = await this.contractRepository.findRenewalsByParent(contractId);

        const activeRenewalStatuses = [
            ContractStatus.DRAFT,
            ContractStatus.NEGOTIATION,
            ContractStatus.PENDING_SIGNATURE,
            ContractStatus.ACTIVE
        ];

        return renewals.some(r => activeRenewalStatuses.includes(r.status));
    }
}