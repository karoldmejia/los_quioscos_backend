import { IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { PenaltyType } from '../enums/penalty-type.enum';
import { ProposedBy } from '../enums/proposed-by.enum';


export class CancelScheduleDto {
    @IsUUID()
    schedule_id: string;

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

export class PenaltyCalculationDto {
    penalty_type: PenaltyType;
    penalty_amount: number;
    order_value?: number;
    schedule_id?: string;
    contract_id?: string;
    reason: string;
}

export class CancellationResultDto {
    success: boolean;
    contract_id: string;
    schedule_id?: string;
    new_status: string;
    penalty?: PenaltyCalculationDto;
    error?: string;
}

export class SuspensionResultDto {
    account_suspended: boolean;
    suspension_reason: string;
    suspension_date: Date;
    grace_period_days: number;
}