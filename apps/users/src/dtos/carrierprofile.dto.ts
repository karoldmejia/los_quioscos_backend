import { CarrierProfile } from '../entities/carrier_profile.entity';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateCarrierProfileDto {
    @IsNotEmpty()
    @IsString()
    userId: string;

    @IsNotEmpty()
    @IsString()
    @Length(1, 100)
    fullLegalName: string;

    @IsNotEmpty()
    @IsString()
    @Length(3, 10)
    idNumber: string;
}

export class UpdateCarrierProfileDto {
    @IsNotEmpty()
    @IsUUID()
    userId: string;

    @IsOptional()
    @IsString()
    @Length(1, 100)
    fullLegalName?: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    serviceRadiusKm?: number;

    @IsOptional()
    @IsBoolean()
    isAcceptingRoutes?: boolean;
}

export class CarrierActivatedEventDto {
    userId: string;
    serviceRadiusKm: number;
    baseLatitude: number;
    baseLongitude: number;
    isAcceptingRoutes: boolean;
    activatedAt: string;
}

export class CarrierUpdatedEventDto {
    userId: string;
    serviceRadiusKm?: number;
    isAcceptingRoutes?: boolean;
    updatedAt: string;
}