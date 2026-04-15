import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IContractScheduleVersionRepository } from '../../repositories/icontract-schedule-version.repository';
import { ContractScheduleVersion } from '../../entities/contract-schedule-version.entity';
import { ContractScheduleVersionStatus } from '../../enums/contract-schedule-version-status.enum';
import { ContractScheduleItem } from '../../entities/contract-schedule-item.entity';

@Injectable()
export class ContractScheduleVersionRepository extends IContractScheduleVersionRepository {

    constructor(
        @InjectRepository(ContractScheduleVersion)
        private readonly repo: Repository<ContractScheduleVersion>,
        @InjectRepository(ContractScheduleItem)
        private readonly itemRepo: Repository<ContractScheduleItem>,
    ) {
        super();
    }

    async create(version: Partial<ContractScheduleVersion>): Promise<ContractScheduleVersion> {
        const newVersion = this.repo.create(version);
        return await this.repo.save(newVersion);
    }

    async findByScheduleId(scheduleId: string): Promise<ContractScheduleVersion[]> {
        return await this.repo.find({
            where: { contract_schedule_id: scheduleId },
            order: { version_number: 'DESC' }
        });
    }

    async findLatestVersion(scheduleId: string): Promise<ContractScheduleVersion | null> {
        return await this.repo.findOne({
            where: { contract_schedule_id: scheduleId },
            order: { version_number: 'DESC' }
        });
    }

    async findAcceptedVersion(scheduleId: string): Promise<ContractScheduleVersion | null> {
        return await this.repo.findOne({
            where: {
                contract_schedule_id: scheduleId,
                status: ContractScheduleVersionStatus.ACCEPTED
            },
            order: { version_number: 'DESC' }
        });
    }

    async updateStatus(versionId: string, status: ContractScheduleVersionStatus): Promise<void> {
        await this.repo.update(
            { contract_schedule_version_id: versionId },
            { status }
        );
    }

    async hasPendingProposal(scheduleId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: {
                contract_schedule_id: scheduleId,
                status: ContractScheduleVersionStatus.PROPOSED
            }
        });
        return count > 0;
    }

    async getNextVersionNumber(scheduleId: string): Promise<number> {
        const latestVersion = await this.findLatestVersion(scheduleId);
        return latestVersion ? latestVersion.version_number + 1 : 1;
    }
}