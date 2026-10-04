import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Length } from 'class-validator'; 
import { DocumentType } from '../enums/document_type.enum';

export class CreateCarrierDocumentDto{
    @IsNotEmpty()
    @IsNumber()
    carrierProfileId: string;

    @IsNotEmpty()
    @IsEnum(DocumentType)
    type: string;

    @IsNotEmpty()
    file: Buffer;

    @IsOptional()
    @IsNotEmpty()
    selfie?: Buffer;
}