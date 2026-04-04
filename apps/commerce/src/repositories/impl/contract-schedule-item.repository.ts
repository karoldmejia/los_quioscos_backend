import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IContractScheduleItemRepository } from '../../repositories/icontract-schedule-item.repository';
import { ContractScheduleItem } from '../../entities/contract-schedule-item.entity';

@Injectable()
export class ContractScheduleItemRepository extends IContractScheduleItemRepository {

    constructor(
        @InjectRepository(ContractScheduleItem)
        private readonly repo: Repository<ContractScheduleItem>,
    ) {
        super();
    }
    async createMany(items: Partial<ContractScheduleItem>[]): Promise<ContractScheduleItem[]> {
        const newItems = this.repo.create(items);
        return await this.repo.save(newItems);
    }

    async findByVersionId(versionId: string): Promise<ContractScheduleItem[]> {
        return await this.repo.find({
            where: { contract_schedule_version_id: versionId }
        });
    }
    async cloneItemsFromVersion(sourceVersionId: string, targetVersionId: string): Promise<ContractScheduleItem[]> {
        const sourceItems = await this.findByVersionId(sourceVersionId);

        const newItems = sourceItems.map(item => ({
            contract_schedule_version_id: targetVersionId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            requirements_json: item.requirements_json
        }));

        return await this.createMany(newItems);
    }
}