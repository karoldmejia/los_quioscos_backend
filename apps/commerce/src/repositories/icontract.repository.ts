import { ContractStatus } from "../enums/contract-status.enum";
import { Contract } from "../entities/contract.entity";

export abstract class IContractRepository {

  abstract createContract(data: Partial<Contract>): Promise<Contract>;

  abstract findById(contractId: string): Promise<Contract | null>;
  abstract findByStatus(status: ContractStatus): Promise<Contract[]>;
  abstract findActiveContracts(): Promise<Contract[]>;
  abstract findContractsExpiringSoon(days: number): Promise<Contract[]>;
  abstract findContractsByBusiness(businessId: string): Promise<Contract[]>;
  abstract findContractsByKiosk(kioskId: string): Promise<Contract[]>;

  abstract updateStatus(contractId: string, status: ContractStatus): Promise<void>;
  abstract updateContract(contractId: string, data: Partial<Contract>): Promise<void>;
  abstract exists(contractId: string): Promise<boolean>;
  abstract findContractsForRenewalNotification(daysBeforeExpiry: number): Promise<Contract[]>;

  abstract findRenewalsByParent(contractId: string): Promise<Contract[]>;
}