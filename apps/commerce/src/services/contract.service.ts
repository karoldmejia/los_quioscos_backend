import { Injectable, Logger } from '@nestjs/common';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';
import { Contract } from '../entities/contract.entity';
import { ContractItem } from '../entities/contract-item.entity';
import { ContractStatus } from '../enums/contract-status.enum';
import { ContractResponseDto, CreateContractDto } from '../dtos/contract.dto';
import { RpcException } from '@nestjs/microservices';
import { ContractFilterDto } from '../dtos/contract-filter.dto';
import { ContractItemResponseDto, CreateContractItemDto } from '../dtos/contract-item.dto';
import { ContractActionDto } from '../dtos/contract-action.dto';
import { ExpiringContractDto, RenewalNotificationDto, RenewalResultDto } from '../dtos/contract-renewal.dto';

@Injectable()
export class ContractService {
    private readonly logger = new Logger(ContractService.name);
    private readonly RENEWAL_NOTIFICATION_DAYS = 14;
    private readonly EXPIRY_CHECK_INTERVALS = [14, 7, 3, 1];

    constructor(
        private readonly contractRepository: ContractRepository,
        private readonly contractItemRepository: ContractItemRepository,
        private readonly contractVersionRepository: ContractVersionRepository,
    ) { }

    // crud operations
    async createContract(createContractDto: CreateContractDto): Promise<ContractResponseDto> {
        this.validateContractDates(createContractDto.start_date, createContractDto.end_date);

        if (!createContractDto.items || createContractDto.items.length === 0) {
            throw new RpcException({
                status: 400,
                message: 'Contract must have at least one item'
            });
        }

        const contract = await this.contractRepository.createContract({
            business_id: createContractDto.business_id,
            kiosk_id: createContractDto.kiosk_id,
            transporter_id: createContractDto.transporter_id,
            start_date: createContractDto.start_date,
            end_date: createContractDto.end_date,
            frequency: createContractDto.frequency,
            change_deadline_days: createContractDto.change_deadline_days,
            cancellation_deadline_days: createContractDto.cancellation_deadline_days,
            logistics_mode: createContractDto.logistics_mode,
        });

        const contractItems = await this.createContractItems(contract.contract_id, createContractDto.items);
        const contractWithItems = await this.contractRepository.findById(contract.contract_id);

        return this.mapToResponseDto(contractWithItems, contractItems);
    }

    async getContract(contractId: string): Promise<ContractResponseDto> {
        const contract = await this.contractRepository.findById(contractId);

        if (!contract) {
            throw new RpcException({
                message: `Contract not found: ${contractId}`,
                status: 404,
            });
        }

        const items = await this.contractItemRepository.findByContractId(contractId);

        return this.mapToResponseDto(contract, items);
    }

    async getContracts(filterDto: ContractFilterDto): Promise<ContractResponseDto[]> {
        let contracts: Contract[] = [];

        if (filterDto.business_id) {
            contracts = await this.contractRepository.findContractsByBusiness(filterDto.business_id);
        } else if (filterDto.kiosk_id) {
            contracts = await this.contractRepository.findContractsByKiosk(filterDto.kiosk_id);
        } else if (filterDto.status) {
            contracts = await this.contractRepository.findByStatus(filterDto.status);
        } else {
            contracts = await this.contractRepository.findActiveContracts();
        }

        if (filterDto.start_date_from || filterDto.start_date_to || filterDto.end_date_from || filterDto.end_date_to) {
            contracts = this.filterContractsByDate(contracts, filterDto);
        }

        const contractsWithItems = await Promise.all(
            contracts.map(async (contract) => {
                const items = await this.contractItemRepository.findByContractId(contract.contract_id);
                return this.mapToResponseDto(contract, items);
            })
        );

        return contractsWithItems;
    }

    async activateContract(contractId: string, activateDto: ContractActionDto): Promise<ContractResponseDto> {
        const contract = await this.contractRepository.findById(contractId);

        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contractId}`
            });
        }

        this.validateContractForActivation(contract);
        this.validateActivationDates(contract);

        if (activateDto.transporter_id) {
            await this.contractRepository.updateContract(contractId, {
                transporter_id: activateDto.transporter_id
            });
        }

        await this.contractRepository.updateStatus(contractId, ContractStatus.ACTIVE);
        const updatedContract = await this.contractRepository.findById(contractId);
        const items = await this.contractItemRepository.findByContractId(contractId);

        return this.mapToResponseDto(updatedContract, items);
    }

    async expireContracts(): Promise<number> {
        const contracts = await this.contractRepository.findActiveContracts();
        const today = new Date();

        let expiredCount = 0;

        for (const contract of contracts) {
            if (new Date(contract.end_date) < today) {
                await this.contractRepository.updateStatus(contract.contract_id, ContractStatus.EXPIRED);
                expiredCount++;
            }
        }

        return expiredCount;
    }

    async expireContract(contractId: string): Promise<ContractResponseDto> {
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

        const today = new Date();
        if (new Date(contract.end_date) >= today) {
            throw new RpcException({
                status: 400,
                message: `Cannot expire contract ${contractId} because end date ${contract.end_date} is not in the past`
            });
        }

        await this.contractRepository.updateStatus(contractId, ContractStatus.EXPIRED);
        const updatedContract = await this.contractRepository.findById(contractId);
        const items = await this.contractItemRepository.findByContractId(contractId);

        return this.mapToResponseDto(updatedContract, items);
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

    // helper methods
    private async createContractItems(contractId: string, itemsDto: CreateContractItemDto[]): Promise<ContractItem[]> {
        const items = itemsDto.map(item => ({
            contract_id: contractId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            requirements_json: item.requirements_json
        }));
        return await this.contractItemRepository.createMany(items);
    }

    private validateContractDates(startDate: Date, endDate: Date): void {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (start >= end) {
            throw new RpcException({
                status: 400,
                message: 'Contract has invalid dates: start date must be before end date'
            });
        }

        if (start < today) {
            throw new RpcException({
                status: 400,
                message: 'Start date cannot be in the past'
            });
        }
    }

    private validateContractForActivation(contract: Contract): void {
        const validStatuses = [ContractStatus.DRAFT, ContractStatus.NEGOTIATION, ContractStatus.PENDING_SIGNATURE];

        if (!validStatuses.includes(contract.status)) {
            throw new RpcException({
                status: 400,
                message: 'Contract is not in a valid status for activation'
            });
        }
    }

    private validateActivationDates(contract: Contract): void {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(contract.start_date);
        const endDate = new Date(contract.end_date);

        if (startDate > endDate) {
            throw new RpcException({
                status: 400,
                message: 'Contract has invalid dates: start date after end date'
            });
        }

        if (startDate < today && endDate < today) {
            throw new RpcException({
                status: 400,
                message: 'Cannot activate contract that has already ended'
            });
        }
    }

    private filterContractsByDate(contracts: Contract[], filter: ContractFilterDto): Contract[] {
        return contracts.filter(contract => {
            let isValid = true;
            const startDate = new Date(contract.start_date);
            const endDate = new Date(contract.end_date);

            if (filter.start_date_from && startDate < new Date(filter.start_date_from)) {
                isValid = false;
            }
            if (filter.start_date_to && startDate > new Date(filter.start_date_to)) {
                isValid = false;
            }
            if (filter.end_date_from && endDate < new Date(filter.end_date_from)) {
                isValid = false;
            }
            if (filter.end_date_to && endDate > new Date(filter.end_date_to)) {
                isValid = false;
            }

            return isValid;
        });
    }

    private mapToResponseDto(contract: Contract | null, items: ContractItem[]): ContractResponseDto {
        if (!contract) {
            throw new RpcException({
                status: 400,
                message: 'Contract cannot be null'
            });
        }

        const itemsDto: ContractItemResponseDto[] = items.map(item => ({
            contract_item_id: item.contract_item_id,
            product_id: item.product_id,
            product_name: item.product?.name,
            quantity: item.quantity,
            unit_price: Number(item.unit_price),
            requirements_json: item.requirements_json,
            subtotal: item.quantity * Number(item.unit_price)
        }));

        const totalValue = itemsDto.reduce((sum, item) => sum + item.subtotal, 0);

        return {
            contract_id: contract.contract_id,
            business_id: contract.business_id,
            kiosk_id: contract.kiosk_id,
            transporter_id: contract.transporter_id,
            status: contract.status,
            start_date: contract.start_date,
            end_date: contract.end_date,
            pause_start_date: contract.pause_start_date,
            pause_end_date: contract.pause_end_date,
            frequency: contract.frequency,
            change_deadline_days: contract.change_deadline_days,
            cancellation_deadline_days: contract.cancellation_deadline_days,
            logistics_mode: contract.logistics_mode,
            version: contract.version,
            parent_contract_id: contract.parent_contract_id,
            created_at: contract.created_at,
            updated_at: contract.updated_at,
            items: itemsDto,
            total_value: totalValue
        };
    }

    // renewal helper methods
    private calculateDaysUntilExpiry(endDate: Date): number {
        const today = new Date();
        const end = new Date(endDate);
        const diffTime = end.getTime() - today.getTime();
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return Object.is(days, -0) ? 0 : days;
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
        // todo: Integration with notification service
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