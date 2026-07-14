import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { CancelContractDto, CancelDeliveryDto, CancellationResultDto, PauseContractDto } from '../dtos/contract-cancellation.dto';
import { ContractStatus } from '../enums/contract-status.enum';
import { ProposedBy } from '../enums/proposed-by.enum';
import { DeliveryRepository } from '../repositories/impl/delivery.repository';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { TargetType } from '../enums/target-type.enum';
import { VersionStatus } from '../enums/version-status.enum';

@Injectable()
export class ContractCancellationService {
    private readonly logger = new Logger(ContractCancellationService.name);

    constructor(
        private readonly contractRepository: ContractRepository,
        private readonly deliveryRepository: DeliveryRepository,
        private readonly contractVersionRepository: ContractVersionRepository,
        private readonly contractItemRepository: ContractItemRepository,
    ) { }

    // Cancellation of a single delivery
    async cancelDelivery(cancelDto: CancelDeliveryDto): Promise<CancellationResultDto> {
        const { delivery_id, cancelled_by, cancellation_date = new Date() } = cancelDto;

        const delivery = await this.deliveryRepository.findById(delivery_id);
        if (!delivery) {
            throw new RpcException({
                status: 404,
                message: `Delivery not found: ${delivery_id}`
            });
        }

        const contract = await this.contractRepository.findById(delivery.contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found for delivery: ${delivery_id}`
            });
        }

        this.validateDeliveryForCancellation(delivery, contract);

        await this.deliveryRepository.updateStatus(
            delivery_id,
            DeliveryStatus.CANCELLED
        );
        await this.createCancellationVersion(delivery_id, cancelled_by);

        return {
            success: true,
            contract_id: contract.contract_id,
            delivery_id: delivery_id,
            new_status: DeliveryStatus.CANCELLED,
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

        const deliveriesInRange = await this.deliveryRepository.findDeliveriesForDateRange(
            contract_id,
            new Date(pause_start_date),
            new Date(pause_end_date)
        );

        let skippedCount = 0;
        for (const delivery of deliveriesInRange) {
            if (delivery.status === DeliveryStatus.SCHEDULED) {
                await this.deliveryRepository.updateStatus(
                    delivery.delivery_id,
                    DeliveryStatus.SKIPPED
                );
                skippedCount++;
            }
        }
        await this.contractRepository.updateContract(contract_id, {
            pause_start_date: new Date(pause_start_date),
            pause_end_date: new Date(pause_end_date),
            status: ContractStatus.PAUSED
        });

        this.logger.log(`Contract ${contract_id} paused from ${pause_start_date} to ${pause_end_date}. ${skippedCount} deliveries skipped`);

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
        const nextDelivery = await this.getNextScheduledDelivery(contract_id);

        // cancel all future schedules
        const schedules = await this.deliveryRepository.findByContractId(contract_id);
        const today = new Date();

        for (const delivery of schedules) {
            if (new Date(delivery.scheduled_delivery_date) >= today) {
                await this.deliveryRepository.updateStatus(
                    delivery.delivery_id,
                    DeliveryStatus.CANCELLED
                );
            }
        }

        await this.contractRepository.updateStatus(contract_id, ContractStatus.CANCELLED);
        this.logger.log(`Contract ${contract_id} cancelled by ${cancelled_by}`);

        return {
            success: true,
            contract_id: contract_id,
            new_status: ContractStatus.CANCELLED,
        };
    }

    // helper methods

    private validateDeliveryForCancellation(delivery: any, contract: any): void {
        if (contract.status !== ContractStatus.ACTIVE) {
            throw new RpcException({
                status: 400,
                message: `Contract is not active. Current status: ${contract.status}`
            });
        }

        const cancellableStatuses = [
            DeliveryStatus.SCHEDULED,
            DeliveryStatus.ORDER_GENERATED
        ];

        if (!cancellableStatuses.includes(delivery.status)) {
            throw new RpcException({
                status: 400,
                message: `Delivery cannot be cancelled. Current status: ${delivery.status}`
            });
        }

        if (delivery.status === DeliveryStatus.ORDER_GENERATED) {
            this.logger.warn(`Delivery ${delivery.contract_delivery_id} has order generated. Cancellation will incur penalty.`);
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
        const schedules = await this.deliveryRepository.findByContractId(contractId);
        const today = new Date();

        const futureDeliveries = schedules
            .filter(s =>
                new Date(s.scheduled_delivery_date) > today &&
                s.status === DeliveryStatus.SCHEDULED
            )
            .sort((a, b) =>
                new Date(a.scheduled_delivery_date).getTime() - new Date(b.scheduled_delivery_date).getTime()
            );

        return futureDeliveries[0] || null;
    }

    private async createCancellationVersion(deliveryId: string, cancelledBy: ProposedBy): Promise<void> {
        const nextVersion = await this.contractVersionRepository.getNextVersionNumber(TargetType.DELIVERY, deliveryId);

        await this.contractVersionRepository.create({
            target_type: TargetType.DELIVERY,
            target_id: deliveryId,
            version_number: nextVersion,
            proposed_by: cancelledBy,
            change_reason: `Delivery cancelled`,
            status: VersionStatus.AUTO_APPLIED
        });
    }
}