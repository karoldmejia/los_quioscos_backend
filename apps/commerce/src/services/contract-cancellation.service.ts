import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ContractScheduleVersionRepository } from '../repositories/impl/contract-schedule-version.repository';
import { ContractScheduleRepository } from '../repositories/impl/contract-schedule.repository';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { PenaltyService } from './penalty.service';
import { CancelContractDto, CancellationResultDto, CancelScheduleDto, PauseContractDto } from '../dtos/contract-cancellation.dto';
import { ContractScheduleStatus } from '../enums/contract-schedule-status.enum';
import { ContractStatus } from '../enums/contract-status.enum';
import { ContractScheduleVersionStatus } from '../enums/contract-schedule-version-status.enum';
import { ProposedBy } from '../enums/proposed-by.enum';

@Injectable()
export class ContractCancellationService {
    private readonly logger = new Logger(ContractCancellationService.name);

    constructor(
        private readonly contractRepository: ContractRepository,
        private readonly contractScheduleRepository: ContractScheduleRepository,
        private readonly contractScheduleVersionRepository: ContractScheduleVersionRepository,
        private readonly contractItemRepository: ContractItemRepository,
        private readonly penaltyService: PenaltyService,
    ) { }

    // Cancellation of a single schedule
    async cancelSchedule(cancelDto: CancelScheduleDto): Promise<CancellationResultDto> {
        const { schedule_id, cancelled_by, cancellation_date = new Date() } = cancelDto;

        const schedule = await this.contractScheduleRepository.findById(schedule_id);
        if (!schedule) {
            throw new RpcException({
                status: 404,
                message: `Schedule not found: ${schedule_id}`
            });
        }

        const contract = await this.contractRepository.findById(schedule.contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found for schedule: ${schedule_id}`
            });
        }

        this.validateScheduleForCancellation(schedule, contract);

        const penalty = await this.penaltyService.calculateScheduleCancellationPenalty(schedule_id, cancellation_date);

        if ((await penalty).penalty_amount > 0) {
            this.logger.warn(`Penalty applied for schedule ${schedule_id}: $${(await penalty).penalty_amount}`);

            if (this.penaltyService.shouldSuspendAccount((await penalty))) {
                await this.handleAccountSuspension(contract, await penalty);
            }
        }
        await this.contractScheduleRepository.updateStatus(
            schedule_id,
            ContractScheduleStatus.CANCELLED
        );
        await this.createCancellationVersion(schedule_id, cancelled_by, penalty);

        return {
            success: true,
            contract_id: contract.contract_id,
            schedule_id: schedule_id,
            new_status: ContractScheduleStatus.CANCELLED,
            penalty: penalty
        };
    }

    // contract pause
    async pauseContract(pauseDto: PauseContractDto): Promise<CancellationResultDto> {
        const { contract_id, pause_start_date, pause_end_date, requested_by } = pauseDto;

        const contract = await this.contractRepository.findById(contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contract_id}`
            });
        }

        this.validateContractForPause(contract, pause_start_date);
        this.validatePauseDates(contract, pause_start_date);

        const schedulesInRange = await this.contractScheduleRepository.findSchedulesForDateRange(
            contract_id,
            new Date(pause_start_date),
            new Date(pause_end_date)
        );

        let skippedCount = 0;
        for (const schedule of schedulesInRange) {
            if (schedule.status === ContractScheduleStatus.SCHEDULED) {
                await this.contractScheduleRepository.updateStatus(
                    schedule.contract_schedule_id,
                    ContractScheduleStatus.SKIPPED
                );
                skippedCount++;
            }
        }
        await this.contractRepository.updateContract(contract_id, {
            pause_start_date: new Date(pause_start_date),
            pause_end_date: new Date(pause_end_date),
            status: ContractStatus.PAUSED
        });

        this.logger.log(`Contract ${contract_id} paused from ${pause_start_date} to ${pause_end_date}. ${skippedCount} schedules skipped`);

        return {
            success: true,
            contract_id: contract_id,
            new_status: ContractStatus.PAUSED
        };
    }

    // resume contract from pause
    async resumeContract(contractId: string): Promise<CancellationResultDto> {
        const contract = await this.contractRepository.findById(contractId);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contractId}`
            });
        }

        if (contract.status !== ContractStatus.PAUSED) {
            throw new RpcException({
                status: 400,
                message: `Contract is not paused. Current status: ${contract.status}`
            });
        }

        await this.contractRepository.updateContract(contractId, {
            pause_start_date: undefined,
            pause_end_date: undefined,
            status: ContractStatus.ACTIVE
        });

        this.logger.log(`Contract ${contractId} resumed`);

        return {
            success: true,
            contract_id: contractId,
            new_status: ContractStatus.ACTIVE
        };
    }

    // total contract cancellation
    async cancelContract(cancelDto: CancelContractDto): Promise<CancellationResultDto> {
        const { contract_id, cancelled_by, cancellation_date = new Date() } = cancelDto;

        const contract = await this.contractRepository.findById(contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contract_id}`
            });
        }

        this.validateContractForCancellation(contract);
        const nextSchedule = await this.getNextScheduledDelivery(contract_id);
        const penalty = await this.penaltyService.calculateContractCancellationPenalty(contract_id, cancellation_date);

        // if there is a penalty, log it and check if account suspension is needed
        if ((await penalty).penalty_amount > 0) {
            this.logger.warn(`Penalty applied for contract ${contract_id} cancellation: $${(await penalty).penalty_amount}`);

            if (this.penaltyService.shouldSuspendAccount((await penalty))) {
                await this.handleAccountSuspension(contract, await penalty);
            }
        }

        // cancel all future schedules
        const schedules = await this.contractScheduleRepository.findByContractId(contract_id);
        const today = new Date();

        for (const schedule of schedules) {
            if (new Date(schedule.scheduled_delivery_date) >= today) {
                await this.contractScheduleRepository.updateStatus(
                    schedule.contract_schedule_id,
                    ContractScheduleStatus.CANCELLED
                );
            }
        }

        await this.contractRepository.updateStatus(contract_id, ContractStatus.CANCELLED);
        this.logger.log(`Contract ${contract_id} cancelled by ${cancelled_by}`);

        return {
            success: true,
            contract_id: contract_id,
            new_status: ContractStatus.CANCELLED,
            penalty: penalty
        };
    }

    // helper methods

    private validateScheduleForCancellation(schedule: any, contract: any): void {
        if (contract.status !== ContractStatus.ACTIVE) {
            throw new RpcException({
                status: 400,
                message: `Contract is not active. Current status: ${contract.status}`
            });
        }

        const cancellableStatuses = [
            ContractScheduleStatus.SCHEDULED,
            ContractScheduleStatus.ORDER_GENERATED
        ];

        if (!cancellableStatuses.includes(schedule.status)) {
            throw new RpcException({
                status: 400,
                message: `Schedule cannot be cancelled. Current status: ${schedule.status}`
            });
        }

        if (schedule.status === ContractScheduleStatus.ORDER_GENERATED) {
            this.logger.warn(`Schedule ${schedule.contract_schedule_id} has order generated. Cancellation will incur penalty.`);
        }
    }

    private validateContractForPause(contract: any, pauseStartDate: Date): void {
        if (contract.status !== ContractStatus.ACTIVE) {
            throw new RpcException({
                status: 400,
                message: `Only active contracts can be paused. Current status: ${contract.status}`
            });
        }
        if (contract.pause_start_date && contract.pause_end_date) {
            const now = new Date();
            if (now >= contract.pause_start_date && now <= contract.pause_end_date) {
                throw new RpcException({
                    status: 400,
                    message: 'Contract is already paused'
                });
            }
        }
    }

    private validatePauseDates(contract: any, pauseStartDate: Date): void {
        const today = new Date();
        const startDate = new Date(pauseStartDate);

        const minPauseDate = new Date();
        minPauseDate.setDate(minPauseDate.getDate() + contract.change_deadline_days);

        if (startDate < minPauseDate) {
            throw new RpcException({
                status: 400,
                message: `Pause cannot start before ${minPauseDate.toISOString()}. Must respect ${contract.change_deadline_days} days change deadline.`
            });
        }
    }

    private validateContractForCancellation(contract: any): void {
        const cancellableStatuses = [ContractStatus.ACTIVE, ContractStatus.PAUSED];

        if (!cancellableStatuses.includes(contract.status)) {
            throw new RpcException({
                status: 400,
                message: `Contract cannot be cancelled. Current status: ${contract.status}`
            });
        }
    }

    private async getNextScheduledDelivery(contractId: string): Promise<any | null> {
        const schedules = await this.contractScheduleRepository.findByContractId(contractId);
        const today = new Date();

        const futureSchedules = schedules
            .filter(s =>
                new Date(s.scheduled_delivery_date) > today &&
                s.status === ContractScheduleStatus.SCHEDULED
            )
            .sort((a, b) =>
                new Date(a.scheduled_delivery_date).getTime() - new Date(b.scheduled_delivery_date).getTime()
            );

        return futureSchedules[0] || null;
    }

    private async createCancellationVersion(scheduleId: string, cancelledBy: ProposedBy, penalty: any): Promise<void> {
        const nextVersion = await this.contractScheduleVersionRepository.getNextVersionNumber(scheduleId);

        await this.contractScheduleVersionRepository.create({
            contract_schedule_id: scheduleId,
            version_number: nextVersion,
            proposed_by: cancelledBy,
            change_reason: `Schedule cancelled. Penalty: $${penalty.penalty_amount}`,
            status: ContractScheduleVersionStatus.AUTO_APPLIED
        });
    }

    private async handleAccountSuspension(contract: any, penalty: any): Promise<void> {


        this.logger.warn(
            `Account for contract ${contract.contract_id} should be suspended `);

        // TODO: implement suspension logic
    }
}