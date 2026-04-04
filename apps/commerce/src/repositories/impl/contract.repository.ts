import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, Between } from 'typeorm';
import { IContractRepository } from '../icontract.repository';
import { Contract } from '../../entities/contract.entity';
import { ContractStatus } from '../../enums/contract-status.enum';

@Injectable()
export class ContractRepository extends IContractRepository {

    constructor(
        @InjectRepository(Contract)
        private readonly repo: Repository<Contract>,
    ) {
        super();
    }

    async createContract(data: Partial<Contract>): Promise<Contract> {
        const contract = this.repo.create({
            ...data,
            status: ContractStatus.DRAFT,
            version: 1
        });
        return await this.repo.save(contract);
    }


    async findById(contractId: string): Promise<Contract | null> {
        return await this.repo.findOne({
            where: { contract_id: contractId }
        });
    }

    async findActiveContracts(): Promise<Contract[]> {
        return await this.repo.find({
            where: { status: ContractStatus.ACTIVE },
            order: { created_at: 'DESC' }
        });
    }

    async findContractsExpiringSoon(days: number): Promise<Contract[]> {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        return await this.repo.find({
            where: {
                status: ContractStatus.ACTIVE,
                end_date: LessThanOrEqual(futureDate)
            },
            order: { end_date: 'ASC' }
        });
    }

    async findByStatus(status: ContractStatus): Promise<Contract[]> {
        return await this.repo.find({
            where: { status },
            order: { created_at: 'DESC' }
        });
    }


    async findContractsByBusiness(businessId: string): Promise<Contract[]> {
        return await this.repo.find({
            where: { business_id: businessId },
            order: { created_at: 'DESC' }
        });
    }

    async findContractsByKiosk(kioskId: string): Promise<Contract[]> {
        return await this.repo.find({
            where: { kiosk_id: kioskId },
            order: { created_at: 'DESC' }
        });
    }
    async updateStatus(contractId: string, status: ContractStatus): Promise<void> {
        await this.repo.update(
            { contract_id: contractId },
            {
                status,
                updated_at: new Date()
            }
        );
    }

    async updateContract(contractId: string, data: Partial<Contract>): Promise<void> {
        await this.repo.update(
            { contract_id: contractId },
            {
                ...data,
                updated_at: new Date()
            }
        );
    }

    async exists(contractId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: { contract_id: contractId }
        });
        return count > 0;
    }

    async findContractsForRenewalNotification(daysBeforeExpiry: number): Promise<Contract[]> {
        const today = new Date();
        const notificationDate = new Date();
        notificationDate.setDate(today.getDate() + daysBeforeExpiry);

        return await this.repo.find({
            where: {
                status: ContractStatus.ACTIVE,
                end_date: Between(today, notificationDate)
            },
            order: { end_date: 'ASC' }
        });
    }

    async findRenewalsByParent(contractId: string): Promise<Contract[]> {
        return this.repo.find({
            where: { parent_contract_id: contractId }
        });
    }
}