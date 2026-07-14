import { VersionStatus } from "../enums/version-status.enum";
import { ContractVersion } from "../entities/contract-version.entity";
import { TargetType } from "../enums/target-type.enum";

export abstract class IContractVersionRepository {

    abstract create(version: Partial<ContractVersion>): Promise<ContractVersion>;
    abstract findByTarget(targetType: TargetType, targetId: string)
    abstract findLatestVersion(targetType: TargetType, targetId: string): Promise<ContractVersion | null>;
    abstract getNextVersionNumber(targetType: TargetType, targetId: string): Promise<number>;
    abstract hasPendingProposal(targetType: TargetType, targetId: string): Promise<boolean>;
    abstract updateStatus(targetType: TargetType, targetId: string, versionId: number, status: VersionStatus): Promise<ContractVersion | null>;
    abstract findAcceptedVersion(targetType: TargetType, targetId: string): Promise<ContractVersion | null>;

}