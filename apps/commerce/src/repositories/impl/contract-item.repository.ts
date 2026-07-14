import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IContractItemRepository } from '../icontract-item.repository';
import { ContractItem } from '../../entities/contract-item.entity';
import { TargetType } from '../../enums/target-type.enum';

@Injectable()
export class ContractItemRepository extends IContractItemRepository {

    constructor(
        @InjectRepository(ContractItem)
        private readonly repo: Repository<ContractItem>,
    ) {
        super();
    }

    async createMany(items: Partial<ContractItem>[]): Promise<ContractItem[]> {
        const newItems = this.repo.create(items);
        return await this.repo.save(newItems);
    }

    async findByTargetId(targetType: TargetType, targetId: string): Promise<ContractItem[]> {
        return await this.repo.find({
            where: {
                target_type: targetType,
                target_id: targetId,
            },
            order: { contract_item_id: 'ASC' }
        });
    }

    async findByProductAndTarget(productId: string, targetType: TargetType, targetId: string): Promise<ContractItem | null> {
        return await this.repo.findOne({
            where: {
                product_id: productId,
                target_type: targetType,
                target_id: targetId,
            }
        });
    }

    async deleteByTargetId(targetType: TargetType, targetId: string): Promise<void> {
        const items = await this.findByTargetId(targetType, targetId);
        await this.repo.remove(items);
    }

    async cloneItems(sourceTargetType: TargetType, sourceTargetId: string, targetTargetType: TargetType, targetTargetId: string,): Promise<ContractItem[]> {
        const sourceItems = await this.findByTargetId(sourceTargetType, sourceTargetId);

        const newItems = sourceItems.map(item => ({
            target_type: targetTargetType,
            target_id: targetTargetId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            requirements_json: item.requirements_json
        }));

        return await this.createMany(newItems);
    }

    async findByVersionId(targetType: TargetType, targetId: string, versionId: number): Promise<ContractItem[]> {
        return await this.repo.find({
            where: { 
                target_type: targetType,
                target_id: targetId,
                version_id: versionId }
        });
    }
}