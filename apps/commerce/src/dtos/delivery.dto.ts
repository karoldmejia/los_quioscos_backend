import { IsUUID, IsDateString, IsEnum, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProposedBy } from '../enums/proposed-by.enum';
import { VersionStatus } from '../enums/version-status.enum';

export class DeliveryItemDto {
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

export class ProposeDeliveryChangeDto {
  @IsUUID()
  delivery_id: string;

  @IsEnum(ProposedBy)
  proposed_by: ProposedBy;

  @IsOptional()
  @IsString()
  change_reason?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemDto)
  items: DeliveryItemDto[];
}

export class DeliveryVersionResponseDto {
  delivery_version_id: string;
  delivery_id: string;
  version_number: number;
  proposed_by: ProposedBy;
  change_reason?: string;
  status: VersionStatus;
  items: DeliveryItemDto[];
  created_at: Date;
}

export class DeliveryVersionHistoryDto {
  delivery_id: string;
  scheduled_delivery_date: Date;
  current_status: string;
  versions: DeliveryVersionResponseDto[];
  active_version?: DeliveryVersionResponseDto;
}

export class DeliveryVersionComparisonDto {
  version_a: DeliveryVersionResponseDto;
  version_b: DeliveryVersionResponseDto;
  differences: any;
}