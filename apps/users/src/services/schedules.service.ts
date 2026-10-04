import { Injectable } from "@nestjs/common";
import { CarrierProfileService } from "./carrierprofile.service";
import { KioskProfileService } from "./kioskprofile.service";
import { DayOfWeek } from "../enums/day_of_week.enum";
import { ProfileSchedules } from "../entities/profile_schedule.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { DomainException } from "../common/exceptions/domain.exception";
import { CreateScheduleDto, UpdateScheduleDto } from "../dtos/schedules.dto";
import { KioskAvailability } from "../protos/users";

@Injectable()
export class SchedulesService {
    constructor(
        private readonly kioskService: KioskProfileService,
        private readonly carrierService: CarrierProfileService,
        @InjectRepository(ProfileSchedules)
        private readonly repo: Repository<ProfileSchedules>,
    ) { }


    // crud

    async createSchedule(profileType: 'carrier' | 'kiosk', profileId: string, dto: CreateScheduleDto): Promise<ProfileSchedules> {
        await this.validateProfileExists(profileType, profileId);
        this.validateTimeRange(dto.startTime, dto.endTime);
        await this.validateNoOverlap(profileType, profileId, dto.dayOfWeek, dto.startTime, dto.endTime);

        const schedule = this.repo.create({
            profileType,
            profileId,
            dayOfWeek: dto.dayOfWeek as DayOfWeek,
            startTime: dto.startTime,
            endTime: dto.endTime,
            isActive: dto.isActive ?? true,
        });

        return await this.repo.save(schedule);
    }

    async updateSchedule(id: string, dto: UpdateScheduleDto): Promise<ProfileSchedules> {
        const schedule = await this.getScheduleById(id);

        const dayOfWeek = dto.dayOfWeek ?? schedule.dayOfWeek;
        const startTime = dto.startTime ?? schedule.startTime;
        const endTime = dto.endTime ?? schedule.endTime;

        this.validateTimeRange(startTime, endTime);

        await this.validateNoOverlap(
            schedule.profileType,
            schedule.profileId,
            dayOfWeek,
            startTime,
            endTime,
            id
        );

        if (dto.dayOfWeek !== undefined) schedule.dayOfWeek = dto.dayOfWeek;
        if (dto.startTime !== undefined) schedule.startTime = dto.startTime;
        if (dto.endTime !== undefined) schedule.endTime = dto.endTime;
        if (dto.isActive !== undefined) schedule.isActive = dto.isActive;

        return await this.repo.save(schedule);
    }

    async getSchedulesByProfile(profileType: 'carrier' | 'kiosk', profileId: string): Promise<ProfileSchedules[]> {
        await this.validateProfileExists(profileType, profileId);

        return await this.repo.find({
            where: {
                profileType,
                profileId,
            },
            order: {
                dayOfWeek: 'ASC',
                startTime: 'ASC',
            },
        });
    }

    async getScheduleById(id: string): Promise<ProfileSchedules> {
        const schedule = await this.repo.findOneBy({ id });
        if (!schedule) {
            throw new DomainException('Schedule not found', 'SCHEDULE_NOT_FOUND', 404);
        }
        return schedule;
    }

    async getActiveSchedulesByProfile(profileType: 'carrier' | 'kiosk', profileId: string): Promise<ProfileSchedules[]> {
        await this.validateProfileExists(profileType, profileId);

        return await this.repo.find({
            where: {
                profileType,
                profileId,
                isActive: true,
            },
            order: {
                dayOfWeek: 'ASC',
                startTime: 'ASC',
            },
        });
    }

    async deleteSchedule(id: string): Promise<void> {
        const schedule = await this.getScheduleById(id);
        await this.repo.remove(schedule);
    }

    // validations

    async validateProfileExists(profileType: 'carrier' | 'kiosk', profileId: string): Promise<void> {
        try {
            if (profileType === 'carrier') {
                await this.carrierService.getProfile(profileId);
            } else if (profileType === 'kiosk') {
                await this.kioskService.getProfileByUserId(profileId);
            } else {
                throw new DomainException('profileType debe ser "carrier" o "kiosk"', 'PROFILE_NOT_FOUND', 400);
            }
        } catch (error) {
            throw error;
        }
    }

    async validateNoOverlap(profileType: string, profileId: string, dayOfWeek: DayOfWeek, startTime: string, endTime: string, excludeId?: string): Promise<void> {
        const existing = await this.repo
            .createQueryBuilder('schedule')
            .where('schedule.profileType = :profileType', { profileType })
            .andWhere('schedule.profileId = :profileId', { profileId })
            .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek })
            .andWhere('schedule.isActive = :isActive', { isActive: true })
            .andWhere(
                '(schedule.startTime < :endTime AND schedule.endTime > :startTime)',
                { startTime, endTime }
            )
            .getMany();

        if (existing.length > 0) {
            throw new DomainException('Ya existe un horario que se solapa con este', 'OVERLAPPING TIME', 409);
        }
    }

    validateTimeRange(startTime: string, endTime: string): void {
        const start = new Date(`1970-01-01T${startTime}:00`);
        const end = new Date(`1970-01-01T${endTime}:00`);

        if (start >= end) {
            throw new DomainException('startTime debe ser anterior a endTime', 'INVALID_TIME_RANGE', 400);
        }
    }

    // verify availability

    async getKiosksAvailability(kioskIds: string[]): Promise<KioskAvailability[]> {
        const profiles = await this.kioskService.getProfilesByUserIds(kioskIds);

        const schedules = await this.repo.find({
            where: { profileId: In(kioskIds), profileType: 'kiosk' },
        });

        return kioskIds.map(kioskId => {
            const profile = profiles.find(p => p.userId === kioskId);

            if (!profile) {
                return {
                    kioskId,
                    isAvailable: false,
                    reason: 'profile_not_found',
                };
            }
            const kioskSchedules = schedules.filter(s => s.profileId === kioskId);

            return {
                kioskId,
                isAvailable: this.calculateAvailability(kioskSchedules),
                reason: '',
            };
        });
    }

    private calculateAvailability(schedules: ProfileSchedules[]): boolean {

        const today = this.getCurrentDayOfWeek();

        const todaySchedules = schedules.filter(
            s => s.dayOfWeek === today && s.isActive
        );

        if (todaySchedules.length === 0) {
            return false;
        }
        const now = this.getCurrentTime();
        return todaySchedules.some(
            s => now >= s.startTime && now < s.endTime
        );
    }

    private getCurrentDayOfWeek(): DayOfWeek {
        const dayIndex = new Date().getDay();
        const days: DayOfWeek[] = [
            DayOfWeek.SUNDAY,
            DayOfWeek.MONDAY,
            DayOfWeek.TUESDAY,
            DayOfWeek.WEDNESDAY,
            DayOfWeek.THURSDAY,
            DayOfWeek.FRIDAY,
            DayOfWeek.SATURDAY,
        ];
        return days[dayIndex];
    }

    private getCurrentTime(): string {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
}