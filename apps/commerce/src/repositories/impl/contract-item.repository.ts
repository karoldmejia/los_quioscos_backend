import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IContractItemRepository } from '../icontract-item.repository';
import { ContractItem } from '../../entities/contract-item.entity';

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

    async findByContractId(contractId: string): Promise<ContractItem[]> {
        return await this.repo.find({
            where: { contract_id: contractId },
            order: { contract_item_id: 'ASC' }
        });
    }

    async findByProductAndContract(productId: string, contractId: string): Promise<ContractItem | null> {
        return await this.repo.findOne({
            where: {
                product_id: productId,
                contract_id: contractId
            }
        });
    }

    async deleteByContractId(contractId: string): Promise<void> {
        const items = await this.findByContractId(contractId);
        await this.repo.remove(items);
    }

    async cloneItemsFromContract(sourceContractId: string, targetContractId: string): Promise<ContractItem[]> {
        const sourceItems = await this.findByContractId(sourceContractId);

        const newItems = sourceItems.map(item => ({
            contract_id: targetContractId,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            requirements_json: item.requirements_json
        }));

        return await this.createMany(newItems);
    }
}