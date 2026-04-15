import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ContractStatus } from '../enums/contract-status.enum';

export class ContractActionDto {
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @IsOptional()
  @IsUUID()
  transporter_id?: string;
}