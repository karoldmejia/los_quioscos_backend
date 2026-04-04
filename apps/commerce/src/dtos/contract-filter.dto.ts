import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { ContractStatus } from '../enums/contract-status.enum';

export class ContractFilterDto {
  @IsOptional()
  @IsUUID()
  business_id?: string;

  @IsOptional()
  @IsUUID()
  kiosk_id?: string;

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsDateString()
  start_date_from?: Date;

  @IsOptional()
  @IsDateString()
  start_date_to?: Date;

  @IsOptional()
  @IsDateString()
  end_date_from?: Date;

  @IsOptional()
  @IsDateString()
  end_date_to?: Date;
}