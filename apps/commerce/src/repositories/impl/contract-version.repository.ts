import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IContractVersionRepository } from '../../repositories/icontract-version.repository';
import { ContractVersion } from '../../entities/contract-version.entity';
import { VersionStatus } from '../../enums/version-status.enum';
import { TargetType } from '../../enums/target-type.enum';

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

    async findByTarget(targetType: TargetType, targetId: string): Promise<ContractVersion[]> {
        return await this.repo.find({
            where: {
                target_type: targetType,
                target_id: targetId
            },
            order: { version_number: 'DESC' }
        });
    }

    async findLatestVersion(targetType: TargetType, targetId: string): Promise<ContractVersion | null> {
        return await this.repo.findOne({
            where: {
                target_type: targetType,
                target_id: targetId
            },            
            order: { version_number: 'DESC' }
        });
    }

    async findVersionByNumber(targetType: TargetType, targetId: string, versionNumber: number): Promise<ContractVersion | null> {
        return await this.repo.findOne({
            where: {
                target_type: targetType,
                target_id: targetId,
                version_number: versionNumber
            }
        });
    }
    async findAcceptedVersion(targetType: TargetType, targetId: string): Promise<ContractVersion | null> {
        return await this.repo.findOne({
            where: {
                target_type: targetType,
                target_id: targetId,
                status: VersionStatus.ACCEPTED
            },
            order: { version_number: 'DESC' }
        });
    }

    async updateStatus(targetType: TargetType, targetId: string, versionId: number, status: VersionStatus): Promise<ContractVersion | null> {
        await this.repo.update(
            { target_type: targetType,
                target_id: targetId,
                contract_version_id: versionId },
            { status }
        );
        return await this.repo.findOne(
            {where: {contract_version_id: versionId }}
        )
    }

    async getNextVersionNumber(targetType: TargetType, targetId: string): Promise<number> {
        const latestVersion = await this.findLatestVersion(targetType, targetId);
        return latestVersion ? latestVersion.version_number + 1 : 1;
    }

    async getVersionHistory(targetType: TargetType, targetId: string): Promise<ContractVersion[]> {
        return await this.repo.find({
            where: { 
                target_type: targetType,
                target_id: targetId,
            },
            order: { version_number: 'ASC' }
        });
    }

    async hasPendingProposal(targetType: TargetType, targetId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: {
                target_type: targetType,
                target_id: targetId,
                status: VersionStatus.PROPOSED
            }
        });
        return count > 0;
    }
}