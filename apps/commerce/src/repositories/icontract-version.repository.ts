import { ContractVersion } from "../entities/contract-version.entity";

export abstract class IContractVersionRepository {

    abstract create(version: Partial<ContractVersion>): Promise<ContractVersion>;
    abstract findByContractId(contractId: string): Promise<ContractVersion[]>;
    abstract findLatestVersion(contractId: string): Promise<ContractVersion | null>;
    abstract getNextVersionNumber(contractId: string): Promise<number>;

}