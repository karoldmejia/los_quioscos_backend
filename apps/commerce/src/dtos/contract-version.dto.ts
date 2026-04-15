import { IsUUID, IsString, IsEnum, IsOptional, IsObject, MinLength } from 'class-validator';
import { ProposedBy } from '../enums/proposed-by.enum';
import { ProposalStatus } from '../enums/proposal-status.enum';

export class ProposeVersionDto {
    @IsUUID()
    contract_id: string;

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
    contract_id: string;
    version_number: number;
    proposed_by: ProposedBy;
    terms_json_snapshot: any;
    created_at: Date;
    status: ProposalStatus;
}

export class VersionHistoryResponseDto {
    contract_id: string;
    current_version: number;
    versions: ContractVersionResponseDto[];
}

export class VersionComparisonDto {
    version_a: ContractVersionResponseDto;
    version_b: ContractVersionResponseDto;
    differences: any;
}