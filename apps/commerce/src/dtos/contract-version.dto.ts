import { IsUUID, IsString, IsEnum, IsOptional, IsObject, MinLength } from 'class-validator';
import { ProposedBy } from '../enums/proposed-by.enum';
import { ProposalStatus } from '../enums/proposal-status.enum';
import { TargetType } from '../enums/target-type.enum';

export class ProposeVersionDto {
    @IsEnum([TargetType])
    target_type: TargetType;

    @IsUUID()
    target_id: string;

    @IsEnum(ProposedBy)
    proposed_by: ProposedBy;

    @IsObject()
    terms_json_snapshot: any;

    @IsOptional()
    @IsString()
    @MinLength(1)
    change_reason?: string;
}

export class ContractVersionResponseDto {
    contract_version_id: number;
    target_type: string;
    target_id: string;
    version_number: number;
    proposed_by: ProposedBy;
    terms_json_snapshot: any;
    created_at: Date;
    status: ProposalStatus;
}

export class VersionHistoryResponseDto {
    target_type: string;
    target_id: string;
    current_version: number;
    versions: ContractVersionResponseDto[];
}

export class VersionComparisonDto {
    version_a: ContractVersionResponseDto;
    version_b: ContractVersionResponseDto;
    differences: any;
}