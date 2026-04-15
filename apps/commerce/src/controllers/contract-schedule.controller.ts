import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContractScheduleService } from '../services/contract-schedule.service';
import { OrderGenerationResultDto, ScheduleGenerationSummaryDto } from '../dtos/order-generation.dto';
import { ExpiringContractDto, RenewalNotificationDto, RenewalResultDto } from '../dtos/contract-renewal.dto';

@Controller()
export class ContractScheduleController {
    constructor(private readonly scheduleService: ContractScheduleService) { }

    // schedule generation
    @MessagePattern({ cmd: 'generate_all_schedules' })
    async generateAllSchedules(): Promise<{ contracts_processed: number; schedules_created: number }> {
        return await this.scheduleService.generateSchedulesForAllContracts();
    }

    @MessagePattern({ cmd: 'generate_contract_schedules' })
    async generateContractSchedules(@Payload() contractId: string): Promise<number> {
        return await this.scheduleService.generateSchedulesForContract(contractId);
    }

    @MessagePattern({ cmd: 'get_schedule_items' })
    async getScheduleItems(@Payload() scheduleId: string): Promise<{
        items: any[];
        version_number: number;
        source: 'contract' | 'schedule_version';
    }> {
        return await this.scheduleService.getItemsForSchedule(scheduleId);
    }

    // order generation
    @MessagePattern({ cmd: 'generate_upcoming_orders' })
    async generateUpcomingOrders(): Promise<OrderGenerationResultDto[]> {
        return await this.scheduleService.generateOrdersForUpcomingSchedules();
    }

    @MessagePattern({ cmd: 'generate_order_for_schedule' })
    async generateOrderForSchedule(@Payload() scheduleId: string): Promise<OrderGenerationResultDto> {
        return await this.scheduleService.generateOrderForScheduleId(scheduleId);
    }

    @MessagePattern({ cmd: 'run_full_generation' })
    async runFullGeneration(): Promise<ScheduleGenerationSummaryDto> {
        return await this.scheduleService.runFullGenerationProcess();
    }

    // Schedule Management
    @MessagePattern({ cmd: 'mark_schedules_as_skipped' })
    async markSchedulesAsSkipped(@Payload() payload: { contractId: string; startDate: Date; endDate: Date }): Promise<number> {
        const { contractId, startDate, endDate } = payload;
        return await this.scheduleService.markSchedulesAsSkipped(contractId, startDate, endDate);
    }

    // Renewal Operations
    @MessagePattern({ cmd: 'find_expiring_contracts' })
    async findExpiringContracts(@Payload() days: number = 14): Promise<ExpiringContractDto[]> {
        return await this.scheduleService.findExpiringContracts(days);
    }

    @MessagePattern({ cmd: 'process_expiring_contracts' })
    async processExpiringContracts(): Promise<RenewalNotificationDto[]> {
        return await this.scheduleService.processExpiringContracts();
    }

    @MessagePattern({ cmd: 'auto_renew_contract' })
    async autoRenewContract(@Payload() contractId: string): Promise<RenewalResultDto> {
        return await this.scheduleService.autoRenewContract(contractId);
    }

    @MessagePattern({ cmd: 'renew_multiple_contracts' })
    async renewMultipleContracts(@Payload() contractIds: string[]): Promise<RenewalResultDto[]> {
        return await this.scheduleService.renewMultipleContracts(contractIds);
    }

    @MessagePattern({ cmd: 'renew_all_expired_contracts' })
    async renewAllExpiredContracts(): Promise<RenewalResultDto[]> {
        return await this.scheduleService.renewAllExpiredContracts();
    }
}