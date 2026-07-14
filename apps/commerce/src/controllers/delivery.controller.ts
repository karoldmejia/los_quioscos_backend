import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ExpiringContractDto, RenewalNotificationDto, RenewalResultDto } from '../dtos/contract-renewal.dto';
import { DeliveryService } from 'src/services/delivery.service';
import { DeliveryGenerationSummaryDto, OrderGenerationResultDto } from 'src/dtos/order-generation.dto';

@Controller()
export class ContractScheduleController {
    constructor(private readonly deliveryService: DeliveryService) { }

    // schedule generation
    @MessagePattern({ cmd: 'generate_all_schedules' })
    async generateAllDeliveries(): Promise<{ contracts_processed: number; deliveries_created: number }> {
        return await this.deliveryService.generateDeliveriesForAllContracts();
    }

    @MessagePattern({ cmd: 'generate_contract_schedules' })
    async generateContractDeliveries(@Payload() contractId: string): Promise<number> {
        return await this.deliveryService.generateDeliveriesForContract(contractId);
    }

    @MessagePattern({ cmd: 'get_schedule_items' })
    async getDeliveryItems(@Payload() scheduleId: string): Promise<{
        items: any[];
        version_number: number;
        source: 'contract' | 'delivery_version';
    }> {
        return await this.deliveryService.getItemsForDelivery(scheduleId);
    }

    // order generation
    @MessagePattern({ cmd: 'generate_upcoming_orders' })
    async generateUpcomingOrders(): Promise<OrderGenerationResultDto[]> {
        return await this.deliveryService.generateOrdersForUpcomingDeliveries();
    }

    @MessagePattern({ cmd: 'generate_order_for_schedule' })
    async generateOrderForSchedule(@Payload() scheduleId: string): Promise<OrderGenerationResultDto> {
        return await this.deliveryService.generateOrderForDeliveryId(scheduleId);
    }

    @MessagePattern({ cmd: 'run_full_generation' })
    async runFullGeneration(): Promise<DeliveryGenerationSummaryDto> {
        return await this.deliveryService.runFullGenerationProcess();
    }

    // Schedule Management
    @MessagePattern({ cmd: 'mark_schedules_as_skipped' })
    async markDeliveriesAsSkipped(@Payload() payload: { contractId: string; startDate: Date; endDate: Date }): Promise<number> {
        const { contractId, startDate, endDate } = payload;
        return await this.deliveryService.markDeliveriesAsSkipped(contractId, startDate, endDate);
    }

    // Renewal Operations
    @MessagePattern({ cmd: 'find_expiring_contracts' })
    async findExpiringContracts(@Payload() days: number = 14): Promise<ExpiringContractDto[]> {
        return await this.deliveryService.findExpiringContracts(days);
    }

    @MessagePattern({ cmd: 'process_expiring_contracts' })
    async processExpiringContracts(): Promise<RenewalNotificationDto[]> {
        return await this.deliveryService.processExpiringContracts();
    }

    @MessagePattern({ cmd: 'auto_renew_contract' })
    async autoRenewContract(@Payload() contractId: string): Promise<RenewalResultDto> {
        return await this.deliveryService.autoRenewContract(contractId);
    }

    @MessagePattern({ cmd: 'renew_multiple_contracts' })
    async renewMultipleContracts(@Payload() contractIds: string[]): Promise<RenewalResultDto[]> {
        return await this.deliveryService.renewMultipleContracts(contractIds);
    }

    @MessagePattern({ cmd: 'renew_all_expired_contracts' })
    async renewAllExpiredContracts(): Promise<RenewalResultDto[]> {
        return await this.deliveryService.renewAllExpiredContracts();
    }
}