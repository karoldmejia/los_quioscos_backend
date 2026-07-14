import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { DeliveryVersionComparisonDto, DeliveryVersionHistoryDto, DeliveryVersionResponseDto, ProposeDeliveryChangeDto } from 'src/dtos/delivery.dto';
import { DeliveryVersionService } from 'src/services/delivery-version.service';

@Controller()
export class DeliveryVersionController {
    constructor(private readonly versionService: DeliveryVersionService) { }

    @MessagePattern({ cmd: 'propose_schedule_change' })
    async proposeDeliveryChange(@Payload() proposeDto: ProposeDeliveryChangeDto): Promise<DeliveryVersionResponseDto> {
        return await this.versionService.proposeDeliveryChange(proposeDto);
    }

    @MessagePattern({ cmd: 'accept_schedule_change' })
    async acceptDeliveryChange(@Payload() payload: { scheduleId: string; versionNumber: number }): Promise<DeliveryVersionResponseDto> {
        const { scheduleId, versionNumber } = payload;
        return await this.versionService.acceptDeliveryChange(scheduleId, versionNumber);
    }

    @MessagePattern({ cmd: 'reject_schedule_change' })
    async rejectDeliveryChange(@Payload() payload: { scheduleId: string; versionNumber: number }): Promise<DeliveryVersionResponseDto> {
        const { scheduleId, versionNumber } = payload;
        return await this.versionService.rejectDeliveryChange(scheduleId, versionNumber);
    }

    @MessagePattern({ cmd: 'get_schedule_modification_history' })
    async getDeliveryModificationHistory(@Payload() scheduleId: string): Promise<DeliveryVersionHistoryDto> {
        return await this.versionService.getDeliveryModificationHistory(scheduleId);
    }

    @MessagePattern({ cmd: 'compare_schedule_versions' })
    async compareDeliveryVersions(@Payload() payload: { scheduleId: string; versionNumberA: number; versionNumberB: number }): Promise<DeliveryVersionComparisonDto> {
        const { scheduleId, versionNumberA, versionNumberB } = payload;
        return await this.versionService.compareDeliveryVersions(scheduleId, versionNumberA, versionNumberB);
    }

    @MessagePattern({ cmd: 'get_active_schedule_version' })
    async getActiveDeliveryVersion(@Payload() scheduleId: string): Promise<DeliveryVersionResponseDto | null> {
        return await this.versionService.getActiveVersionForOrderGeneration(scheduleId);
    }
}