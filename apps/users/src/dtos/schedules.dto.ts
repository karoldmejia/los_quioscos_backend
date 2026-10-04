import { DayOfWeek } from '../enums/day_of_week.enum';
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Matches } from 'class-validator'; 

export class CreateScheduleDto {
    @IsNotEmpty()
    @IsNumber()
    profileId: string;

    @IsNotEmpty()
    @IsEnum(DayOfWeek)
    dayOfWeek: DayOfWeek;

    @IsNotEmpty()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    startTime: string;

    @IsNotEmpty()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    endTime: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateScheduleDto {
    @IsNotEmpty()
    @IsNumber()
    profileId: string;

    @IsOptional()
    @IsEnum(DayOfWeek)
    dayOfWeek: DayOfWeek;

    @IsOptional()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    startTime: string;

    @IsOptional()
    @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    endTime: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}