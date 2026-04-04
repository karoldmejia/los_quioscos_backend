import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContractScheduleVersionService } from '../services/contract-schedule-version.service';
import { ProposeScheduleChangeDto, ContractScheduleVersionResponseDto, ContractScheduleVersionHistoryDto,ContractScheduleVersionComparisonDto } from '../dtos/contract-schedule.dto';

@Controller()
export class ContractScheduleVersionController {
    constructor(private readonly versionService: ContractScheduleVersionService) { }

    @MessagePattern({ cmd: 'propose_schedule_change' })
    async proposeScheduleChange(@Payload() proposeDto: ProposeScheduleChangeDto): Promise<ContractScheduleVersionResponseDto> {
        return await this.versionService.proposeScheduleChange(proposeDto);
    }

    @MessagePattern({ cmd: 'accept_schedule_change' })
    async acceptScheduleChange(@Payload() payload: { scheduleId: string; versionNumber: number }): Promise<ContractScheduleVersionResponseDto> {
        const { scheduleId, versionNumber } = payload;
        return await this.versionService.acceptScheduleChange(scheduleId, versionNumber);
    }

    @MessagePattern({ cmd: 'reject_schedule_change' })
    async rejectScheduleChange(@Payload() payload: { scheduleId: string; versionNumber: number }): Promise<ContractScheduleVersionResponseDto> {
        const { scheduleId, versionNumber } = payload;
        return await this.versionService.rejectScheduleChange(scheduleId, versionNumber);
    }

    @MessagePattern({ cmd: 'get_schedule_modification_history' })
    async getScheduleModificationHistory(@Payload() scheduleId: string): Promise<ContractScheduleVersionHistoryDto> {
        return await this.versionService.getScheduleModificationHistory(scheduleId);
    }

    @MessagePattern({ cmd: 'compare_schedule_versions' })
    async compareScheduleVersions(@Payload() payload: { scheduleId: string; versionNumberA: number; versionNumberB: number }): Promise<ContractScheduleVersionComparisonDto> {
        const { scheduleId, versionNumberA, versionNumberB } = payload;
        return await this.versionService.compareScheduleVersions(scheduleId, versionNumberA, versionNumberB);
    }

    @MessagePattern({ cmd: 'get_active_schedule_version' })
    async getActiveScheduleVersion(@Payload() scheduleId: string): Promise<ContractScheduleVersionResponseDto | null> {
        return await this.versionService.getActiveVersionForOrderGeneration(scheduleId);
    }
}