import { ContractItem } from "../entities/contract-item.entity";

export abstract class IContractItemRepository {

    abstract createMany(items: Partial<ContractItem>[]): Promise<ContractItem[]>;

    abstract findByContractId(contractId: string): Promise<ContractItem[]>;

    abstract cloneItemsFromContract(
        sourceContractId: string,
        targetContractId: string
    ): Promise<ContractItem[]>;

    abstract deleteByContractId(contractId: string): Promise<void>;

    abstract findByProductAndContract(
        productId: string,
        contractId: string
    ): Promise<ContractItem | null>;
}