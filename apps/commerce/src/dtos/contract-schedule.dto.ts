import { IsUUID, IsDateString, IsEnum, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProposedBy } from '../enums/proposed-by.enum';
import { ContractScheduleVersionStatus } from '../enums/contract-schedule-version-status.enum';

export class ContractScheduleItemDto {
  @IsUUID()
  product_id: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsOptional()
  requirements_json?: any;
}

export class ProposeScheduleChangeDto {
  @IsUUID()
  contract_schedule_id: string;

  @IsEnum(ProposedBy)
  proposed_by: ProposedBy;

  @IsOptional()
  @IsString()
  change_reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractScheduleItemDto)
  items: ContractScheduleItemDto[];
}

export class ContractScheduleVersionResponseDto {
  contract_schedule_version_id: string;
  contract_schedule_id: string;
  version_number: number;
  proposed_by: ProposedBy;
  change_reason?: string;
  status: ContractScheduleVersionStatus;
  items: ContractScheduleItemDto[];
  created_at: Date;
}

export class ContractScheduleVersionHistoryDto {
  schedule_id: string;
  scheduled_delivery_date: Date;
  current_status: string;
  versions: ContractScheduleVersionResponseDto[];
  active_version?: ContractScheduleVersionResponseDto;
}

export class ContractScheduleVersionComparisonDto {
  version_a: ContractScheduleVersionResponseDto;
  version_b: ContractScheduleVersionResponseDto;
  differences: any;
}