import { IsBoolean, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min } from "class-validator";
import { PartialType, OmitType } from '@nestjs/mapped-types';

export class CreateAddressDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    alias?: string; // casa u oficina o lo que quiera el user

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reference?: string; // referencia personal del lugar

    @IsOptional()
    @IsBoolean()
    isDefault?: boolean; // checkbox

    @IsOptional()
    @IsString()
    @MaxLength(255)
    addressLine?: string | null; // properties.name (address/poi)

    @IsOptional()
    @IsString()
    @MaxLength(100)
    neighborhood?: string | null; // context.neighborhood.text

    @IsString()
    @MaxLength(100)
    municipality: string; // context.place.text

    @IsString()
    @MaxLength(100)
    department: string; // context.region.text

    @IsString()
    @MaxLength(100)
    country: string; // context.country.text

    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number; // geometry.coordinates[1]

    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number; // geometry.coordinates[0]

    @IsOptional()
    @IsString()
    mapboxId?: string | null; // properties.mapbox_id
}

export class UpdateAddressDto extends PartialType(
    OmitType(CreateAddressDto, ['country'] as const)
) { }