import { TargetType } from "../enums/target-type.enum";
import { ContractItem } from "../entities/contract-item.entity";

export abstract class IContractItemRepository {

    abstract createMany(items: Partial<ContractItem>[]): Promise<ContractItem[]>;

    abstract findByTargetId(targetType: TargetType, targetId: string): Promise<ContractItem[]>;

    abstract cloneItems(sourceTargetType: TargetType, sourceTargetId: string, targetTargetType: TargetType, targetTargetId: string,): Promise<ContractItem[]>;

    abstract deleteByTargetId(targetType: TargetType, targetId: string): Promise<void>;

    abstract findByProductAndTarget(productId: string, targetType: TargetType, targetId: string): Promise<ContractItem | null>;
    abstract findByVersionId(targetType: TargetType, targetId: string, versionId: number): Promise<ContractItem[]>

}