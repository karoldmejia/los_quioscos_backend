import { IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { PenaltyType } from '../enums/penalty-type.enum';
import { ProposedBy } from '../enums/proposed-by.enum';


export class CancelDeliveryDto {
    @IsUUID()
    delivery_id: string;

    @IsEnum(ProposedBy)
    cancelled_by: ProposedBy;

    @IsOptional()
    @IsDateString()
    cancellation_date?: Date;
}


export class CancelContractDto {
    @IsUUID()
    contract_id: string;

    @IsEnum(ProposedBy)
    cancelled_by: ProposedBy;

    @IsOptional()
    @IsDateString()
    cancellation_date?: Date;
}

export class PauseContractDto {
    @IsUUID()
    contract_id: string;

    @IsDateString()
    pause_start_date: Date;

    @IsDateString()
    pause_end_date: Date;

    @IsEnum(ProposedBy)
    requested_by: ProposedBy;
}

export class CancellationResultDto {
    success: boolean;
    contract_id: string;
    delivery_id?: string;
    new_status: string;
    error?: string;
}

export class SuspensionResultDto {
    account_suspended: boolean;
    suspension_reason: string;
    suspension_date: Date;
    grace_period_days: number;
}