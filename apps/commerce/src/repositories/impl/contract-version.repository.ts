import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IContractVersionRepository } from '../../repositories/icontract-version.repository';
import { ContractVersion } from '../../entities/contract-version.entity';

@Injectable()
export class ContractVersionRepository extends IContractVersionRepository {

    constructor(
        @InjectRepository(ContractVersion)
        private readonly repo: Repository<ContractVersion>,
    ) {
        super();
    }

    async create(version: Partial<ContractVersion>): Promise<ContractVersion> {
        const newVersion = this.repo.create(version);
        return await this.repo.save(newVersion);
    }

    async findById(versionId: number): Promise<ContractVersion | null> {
        return await this.repo.findOne({
            where: { contract_version_id: versionId }
        });
    }

    async findByContractId(contractId: string): Promise<ContractVersion[]> {
        return await this.repo.find({
            where: { contract_id: contractId },
            order: { version_number: 'DESC' }
        });
    }

    async findLatestVersion(contractId: string): Promise<ContractVersion | null> {
        return await this.repo.findOne({
            where: { contract_id: contractId },
            order: { version_number: 'DESC' }
        });
    }

    async findVersionByNumber(contractId: string, versionNumber: number): Promise<ContractVersion | null> {
        return await this.repo.findOne({
            where: { 
                contract_id: contractId,
                version_number: versionNumber 
            }
        });
    }

    async getNextVersionNumber(contractId: string): Promise<number> {
        const latestVersion = await this.findLatestVersion(contractId);
        return latestVersion ? latestVersion.version_number + 1 : 1;
    }

    async getVersionHistory(contractId: string): Promise<ContractVersion[]> {
        return await this.repo.find({
            where: { contract_id: contractId },
            order: { version_number: 'ASC' }
        });
    }
}