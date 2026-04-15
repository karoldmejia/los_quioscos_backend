import { ContractScheduleVersionStatus } from "../enums/contract-schedule-version-status.enum";
import { ContractScheduleVersion } from "../entities/contract-schedule-version.entity";

export abstract class IContractScheduleVersionRepository {

    abstract create(version: Partial<ContractScheduleVersion>): Promise<ContractScheduleVersion>;
    abstract findLatestVersion(scheduleId: string): Promise<ContractScheduleVersion | null>;
    abstract findAcceptedVersion(scheduleId: string): Promise<ContractScheduleVersion | null>;
    abstract hasPendingProposal(scheduleId: string): Promise<boolean>;
    abstract updateStatus(versionId: string, status: ContractScheduleVersionStatus): Promise<void>;
    abstract getNextVersionNumber(scheduleId: string): Promise<number>;
    abstract findByScheduleId(scheduleId: string): Promise<ContractScheduleVersion[]>;

}