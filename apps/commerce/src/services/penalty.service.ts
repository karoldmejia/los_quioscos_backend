import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContractScheduleRepository } from '../repositories/impl/contract-schedule.repository';
import { ContractScheduleItemRepository } from '../repositories/impl/contract-schedule-item.repository';
import { PenaltyCalculationDto, SuspensionResultDto } from '../dtos/contract-cancellation.dto';
import { ContractScheduleStatus } from '../enums/contract-schedule-status.enum';
import { PenaltyType } from '../enums/penalty-type.enum';
import { ContractScheduleVersionRepository } from '../repositories/impl/contract-schedule-version.repository';
import { ContractRepository } from '../repositories/impl/contract.repository';

@Injectable()
export class PenaltyService {
    private readonly logger = new Logger(PenaltyService.name);

    private readonly FIFTY_PERCENT_RATE = 0.5;
    private readonly ONE_HUNDRED_PERCENT_RATE = 1.0;
    private readonly GRACE_PERIOD_DAYS = 3;

    constructor(
        private readonly contractScheduleRepository: ContractScheduleRepository,
        private readonly contractScheduleItemRepository: ContractScheduleItemRepository,
        private readonly contractScheduleVersionRepository: ContractScheduleVersionRepository,
        private readonly contractRepository: ContractRepository

    ) { }

    async calculateScheduleCancellationPenalty(scheduleId: string, cancellationDate: Date = new Date()): Promise<PenaltyCalculationDto> {
        const schedule = await this.contractScheduleRepository.findById(scheduleId);
        if (!schedule) {
            throw new RpcException({
                status: 404,
                message: `Schedule not found: ${scheduleId}`
            });
        }
        const contract = await this.getContractById(schedule.contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found for schedule: ${scheduleId}`
            });
        }

        const isWithinDeadline = this.isWithinChangeDeadline(
            schedule.scheduled_delivery_date,
            cancellationDate,
            contract.change_deadline_days
        );

        const hasOrderGenerated = schedule.status === ContractScheduleStatus.ORDER_GENERATED;

        if (isWithinDeadline && schedule.status === ContractScheduleStatus.SCHEDULED) {
            return {
                penalty_type: PenaltyType.NONE,
                penalty_amount: 0,
                schedule_id: scheduleId,
                reason: 'Cancellation within deadline, no penalty applied'
            };
        }

        if (!isWithinDeadline || hasOrderGenerated) {
            const orderValue = await this.calculateScheduleValue(scheduleId);

            return {
                penalty_type: PenaltyType.FIFTY_PERCENT,
                penalty_amount: orderValue * this.FIFTY_PERCENT_RATE,
                order_value: orderValue,
                schedule_id: scheduleId,
                reason: hasOrderGenerated
                    ? 'Order already generated, 50% penalty applied'
                    : 'Cancellation outside deadline, 50% penalty applied'
            };
        }

        return {
            penalty_type: PenaltyType.NONE,
            penalty_amount: 0,
            schedule_id: scheduleId,
            reason: 'No penalty applicable'
        };
    }

    async calculateContractCancellationPenalty(contractId: string, cancellationDate: Date = new Date()): Promise<PenaltyCalculationDto> {
        const contract = await this.getContractById(contractId);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contractId}`
            });
        }

        const nextSchedule = await this.getNextScheduledSchedule(contractId);

        if (!nextSchedule) {
            return {
                penalty_type: PenaltyType.NONE,
                penalty_amount: 0,
                contract_id: contractId,
                reason: 'No upcoming schedules, no penalty applied'
            };
        }

        const isWithinDeadline = this.isWithinCancellationDeadline(
            nextSchedule.scheduled_delivery_date,
            cancellationDate,
            contract.cancellation_deadline_days
        );

        if (isWithinDeadline) {
            return {
                penalty_type: PenaltyType.NONE,
                penalty_amount: 0,
                contract_id: contractId,
                reason: 'Cancellation within deadline, no penalty applied'
            };
        }

        const nextOrderValue = await this.calculateScheduleValue(nextSchedule.contract_schedule_id);

        return {
            penalty_type: PenaltyType.ONE_HUNDRED_PERCENT,
            penalty_amount: nextOrderValue * this.ONE_HUNDRED_PERCENT_RATE,
            order_value: nextOrderValue,
            contract_id: contractId,
            schedule_id: nextSchedule.contract_schedule_id,
            reason: 'Cancellation outside deadline, 100% of next order penalty applied'
        };
    }


    shouldSuspendAccount(penalty: PenaltyCalculationDto): boolean {
        return penalty.penalty_type !== PenaltyType.NONE && penalty.penalty_amount > 0;
    }

    getSuspensionResult(penalty: PenaltyCalculationDto): SuspensionResultDto {
        return {
            account_suspended: this.shouldSuspendAccount(penalty),
            suspension_reason: `Unpaid penalty of $${penalty.penalty_amount}`,
            suspension_date: new Date(),
            grace_period_days: this.GRACE_PERIOD_DAYS
        };
    }

    // helper methods

    private isWithinChangeDeadline(
        deliveryDate: Date,
        cancellationDate: Date,
        changeDeadlineDays: number
    ): boolean {
        const deadline = new Date(deliveryDate);
        deadline.setDate(deadline.getDate() - changeDeadlineDays);

        return cancellationDate <= deadline;
    }

    private isWithinCancellationDeadline(
        deliveryDate: Date,
        cancellationDate: Date,
        cancellationDeadlineDays: number
    ): boolean {
        const deadline = new Date(deliveryDate);
        deadline.setDate(deadline.getDate() - cancellationDeadlineDays);

        return cancellationDate <= deadline;
    }

    private async calculateScheduleValue(scheduleId: string): Promise<number> {
        const versions = await this.contractScheduleVersionRepository.findByScheduleId(scheduleId);

        let activeVersion = versions.find(v => v.status === 'ACCEPTED');

        if (!activeVersion) {
            activeVersion = versions.find(v => v.status === 'AUTO_APPLIED');
        }

        if (!activeVersion) {
            return 0;
        }

        const items = await this.contractScheduleItemRepository.findByVersionId(
            activeVersion.contract_schedule_version_id
        );

        return items.reduce((sum, item) =>
            sum + (Number(item.quantity) * Number(item.unit_price)), 0
        );
    }

    private async getNextScheduledSchedule(contractId: string): Promise<any> {
        const schedules = await this.contractScheduleRepository.findByContractId(contractId);
        const now = new Date();

        const upcomingSchedules = schedules
            .filter(s =>
                s.status === 'SCHEDULED' &&
                new Date(s.scheduled_delivery_date) > now
            )
            .sort((a, b) =>
                new Date(a.scheduled_delivery_date).getTime() -
                new Date(b.scheduled_delivery_date).getTime()
            );

        return upcomingSchedules[0] || null;
    }

    private async getContractById(contractId: string): Promise<any> {
        return await this.contractRepository.findById(contractId);
    }
}