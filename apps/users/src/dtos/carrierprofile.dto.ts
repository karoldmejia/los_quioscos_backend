import { CarrierProfile } from '../entities/carrier_profile.entity';
import { IsNotEmpty, IsNumber, IsString, Length } from 'class-validator'; 

export class CreateCarrierProfileDto{
    @IsNotEmpty()
    @IsNumber()
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

export class UpdateCarrierProfileDto implements Partial<CarrierProfile>{
    @IsNotEmpty()
    @IsNumber()
    userId: string;

    @IsString()
    @Length(1, 100)
    fullLegalName?: string;
}