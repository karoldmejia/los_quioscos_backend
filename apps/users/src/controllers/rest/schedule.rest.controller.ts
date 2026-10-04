import { CreateScheduleDto, UpdateScheduleDto } from '../../dtos/schedules.dto';
import { HttpDomainExceptionFilter } from '../../common/exceptions/http-domain-exception.filter';
import { SchedulesService } from '../../services/schedules.service';
import { Controller, Post, Get, Put, Delete, Body, Param, Query, UseFilters } from '@nestjs/common';

@Controller('schedules')
@UseFilters(HttpDomainExceptionFilter)
export class ScheduleController {
    constructor(private readonly scheduleService: SchedulesService) {}

    @Post(':profileType/:profileId')
    async createSchedule(
        @Param('profileType') profileType: 'carrier' | 'kiosk',
        @Param('profileId') profileId: string,
        @Body() dto: CreateScheduleDto
    ) {
        return await this.scheduleService.createSchedule(
            profileType,
            profileId,
            dto
        );
    }

    @Get(':profileType/:profileId')
    async getSchedulesByProfile(@Param('profileType') profileType: 'carrier' | 'kiosk', @Param('profileId') profileId: string) {
        return await this.scheduleService.getSchedulesByProfile(
            profileType,
            profileId
        );
    }

    @Get(':profileType/:profileId/active')
    async getActiveSchedules(@Param('profileType') profileType: 'carrier' | 'kiosk', @Param('profileId') profileId: string) {
        return await this.scheduleService.getActiveSchedulesByProfile(
            profileType,
            profileId
        );
    }

    // Obtener un horario por ID
    @Get('detail/:id')
    async getScheduleById(@Param('id') id: string) {
        return await this.scheduleService.getScheduleById(id);
    }

    @Put(':id')
    async updateSchedule(@Param('id') id: string, @Body() dto: UpdateScheduleDto) {
        return await this.scheduleService.updateSchedule(id, dto);
    }

    @Delete(':id')
    async deleteSchedule(@Param('id') id: string) {
        await this.scheduleService.deleteSchedule(id);
        return { message: 'Schedule deleted successfully' };
    }
}