import { PackageType } from '@/enums/package_type.enum';
import { VehicleType } from '../enums/type_vehicle.enum';
import { ArrayMinSize, ArrayNotEmpty, IsArray, IsEnum, IsNotEmpty, IsNumber, IsString, Length, Matches, Max, Min } from 'class-validator'; 

export class CreateVehicleDto{
    @IsNotEmpty()
    @IsNumber()
    carrierProfileId: string;

    @IsNotEmpty()
    @IsEnum(VehicleType)
    type: VehicleType;

    @IsNotEmpty()
    @Length(2, 100)
    @Matches(/^[\p{L}\p{N}\s]+$/u, {message: 'Solo se permiten letras, números y espacios'})
    brand: string;

    @IsNotEmpty()
    @Length(1, 50)
    @Matches(/^[\p{L}\p{N}\s-]+$/u, {message: 'Solo se permiten letras, números, guiones y espacios'})
    model: string;

    @IsNotEmpty()
    @Length(6, 10)
    @Matches(/^[\p{L}\p{N}-]+$/u, {message: 'Solo se permiten letras, números y guiones'})
    plate: string;

    @IsNotEmpty()
    @Min(5)
    @Max(5000)
    maxWeightKg: number;

    @IsArray()
    @ArrayNotEmpty({message:'Debe aceptar al menos un tipo de paquete'})
    @IsEnum(PackageType, {each: true, message: 'Cada tipo debe ser un valor válido'})
    acceptedPackageTypes: PackageType[]
}

export class UpdateVehicleDto{
    @IsNotEmpty()
    @IsNumber()
    carrierProfileId: string;

    @IsEnum(VehicleType)
    type?:  VehicleType;

    @Length(2, 100)
    @Matches(/^[\p{L}\p{N}\s]+$/u, {message: 'Solo se permiten letras, números y espacios'})
    brand?: string;

    @Length(1, 50)
    @Matches(/^[\p{L}\p{N}\s-]+$/u, {message: 'Solo se permiten letras, números, guiones y espacios'})
    model?: string;

    @Length(6, 10)
    @Matches(/^[\p{L}\p{N}-]+$/u, {message: 'Solo se permiten letras, números y guiones'})
    plate?: string;

    @Min(5)
    @Max(5000)
    maxWeightKg?: number;

    @IsArray()
    @IsEnum(PackageType, {each: true, message: 'Cada tipo debe ser un valor válido'})
    acceptedPackageTypes: PackageType[]
}

export class UploadVehiclePhotosDto {
    @IsString()
    vehicleId: string;

    @IsArray()
    @ArrayMinSize(1)
    photos: Buffer[];
}
