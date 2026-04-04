import { IsUUID, IsDateString, IsString, IsEnum, IsInt, Min, IsOptional, ValidateNested, IsArray, IsNumber, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { LogisticsMode } from '../enums/logistics-mode.enum';
import { ContractItemResponseDto, CreateContractItemDto } from './contract-item.dto';
import { ContractStatus } from '../enums/contract-status.enum';

export class CreateContractDto {
  @IsUUID()
  business_id: string;

  @IsUUID()
  kiosk_id: string;

  @IsOptional()
  @IsUUID()
  transporter_id?: string;

  @IsDateString()
  start_date: Date;

  @IsDateString()
  end_date: Date;

  @IsString()
  @MinLength(1)
  frequency: string;

  @IsInt()
  @Min(0)
  change_deadline_days: number;

  @IsInt()
  @Min(0)
  cancellation_deadline_days: number;

  @IsEnum(LogisticsMode)
  logistics_mode: LogisticsMode;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContractItemDto)
  items: CreateContractItemDto[];
}

export class ContractResponseDto {
  contract_id: string;
  business_id: string;
  kiosk_id: string;
  transporter_id?: string;
  status: ContractStatus;
  start_date: Date;
  end_date: Date;
  pause_start_date?: Date | null;
  pause_end_date?: Date | null;
  frequency: string;
  change_deadline_days: number;
  cancellation_deadline_days: number;
  logistics_mode: LogisticsMode;
  version: number;
  parent_contract_id?: string | null;
  created_at: Date;
  updated_at: Date;
  items: ContractItemResponseDto[];
  total_value: number;
}