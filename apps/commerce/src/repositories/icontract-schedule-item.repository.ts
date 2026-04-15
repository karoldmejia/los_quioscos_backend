import { ContractScheduleItem } from "../entities/contract-schedule-item.entity";

export abstract class IContractScheduleItemRepository {

    abstract createMany(items: Partial<ContractScheduleItem>[]): Promise<ContractScheduleItem[]>;
    abstract findByVersionId(versionId: string): Promise<ContractScheduleItem[]>;
    abstract cloneItemsFromVersion(sourceVersionId: string, targetVersionId: string): Promise<ContractScheduleItem[]>;

}