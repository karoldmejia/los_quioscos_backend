import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { ContractScheduleRepository } from '../repositories/impl/contract-schedule.repository';
import { ContractScheduleVersionRepository } from '../repositories/impl/contract-schedule-version.repository';
import { ContractScheduleItemRepository } from '../repositories/impl/contract-schedule-item.repository';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ProposeScheduleChangeDto, ContractScheduleVersionResponseDto, ContractScheduleVersionHistoryDto, ContractScheduleItemDto, ContractScheduleVersionComparisonDto } from '../dtos/contract-schedule.dto';
import { ContractScheduleVersionStatus } from '../enums/contract-schedule-version-status.enum';
import { ProposedBy } from '../enums/proposed-by.enum';
import { ContractStatus } from '../enums/contract-status.enum';
import { ContractScheduleStatus } from '../enums/contract-schedule-status.enum';

@Injectable()
export class ContractScheduleVersionService {
    constructor(
        private readonly contractRepository: ContractRepository,
        private readonly contractScheduleRepository: ContractScheduleRepository,
        private readonly contractScheduleVersionRepository: ContractScheduleVersionRepository,
        private readonly contractScheduleItemRepository: ContractScheduleItemRepository,
        private readonly contractItemRepository: ContractItemRepository,
    ) { }

    // propose change on specific schedule
    async proposeScheduleChange(proposeDto: ProposeScheduleChangeDto): Promise<ContractScheduleVersionResponseDto> {
        const { contract_schedule_id, proposed_by, change_reason, items } = proposeDto;

        const schedule = await this.contractScheduleRepository.findById(contract_schedule_id);
        if (!schedule) {
            throw new RpcException({
                status: 404,
                message: `Contract schedule not found: ${contract_schedule_id}`
            });
        }
        const contract = await this.contractRepository.findById(schedule.contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found for schedule: ${contract_schedule_id}`
            });
        }
        await this.validateScheduleForModification(schedule, contract, proposed_by);
        const hasPending = await this.contractScheduleVersionRepository.hasPendingProposal(contract_schedule_id);
        if (hasPending) {
            throw new RpcException({
                status: 400,
                message: `There is already a pending proposal for this schedule`
            });
        }

        const nextVersionNumber = await this.contractScheduleVersionRepository.getNextVersionNumber(contract_schedule_id);

        const newVersion = await this.contractScheduleVersionRepository.create({
            contract_schedule_id,
            version_number: nextVersionNumber,
            proposed_by,
            change_reason,
            status: ContractScheduleVersionStatus.PROPOSED
        });

        if (items && items.length > 0) {
            const versionItems = items.map(item => ({
                contract_schedule_version_id: newVersion.contract_schedule_version_id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                requirements_json: item.requirements_json
            }));
            await this.contractScheduleItemRepository.createMany(versionItems);
        }

        return await this.getScheduleVersionWithItems(newVersion.contract_schedule_version_id);
    }

    // accept proposed change
    async acceptScheduleChange(scheduleId: string, versionNumber: number): Promise<ContractScheduleVersionResponseDto> {
        const schedule = await this.contractScheduleRepository.findById(scheduleId);
        if (!schedule) {
            throw new RpcException({
                status: 404,
                message: `Contract schedule not found: ${scheduleId}`
            });
        }

        const versions = await this.contractScheduleVersionRepository.findByScheduleId(scheduleId);
        const version = versions.find(v => v.version_number === versionNumber);

        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version ${versionNumber} not found for schedule ${scheduleId}`
            });
        }
        const latestVersion = await this.contractScheduleVersionRepository.findLatestVersion(scheduleId);
        if (!latestVersion || latestVersion.version_number !== versionNumber) {
            throw new RpcException({
                status: 400,
                message: `Only the latest version (${latestVersion?.version_number}) can be accepted/rejected`
            });
        }
        if (version.status !== ContractScheduleVersionStatus.PROPOSED) {
            throw new RpcException({
                status: 400,
                message: `Version is already ${version.status}`
            });
        }
        await this.contractScheduleVersionRepository.updateStatus(
            version.contract_schedule_version_id,
            ContractScheduleVersionStatus.ACCEPTED
        );

        return await this.getScheduleVersionWithItems(version.contract_schedule_version_id);
    }

    // reject change proposal
    async rejectScheduleChange(scheduleId: string, versionNumber: number): Promise<ContractScheduleVersionResponseDto> {
        const schedule = await this.contractScheduleRepository.findById(scheduleId);
        if (!schedule) {
            throw new RpcException({
                status: 404,
                message: `Contract schedule not found: ${scheduleId}`
            });
        }
        const versions = await this.contractScheduleVersionRepository.findByScheduleId(scheduleId);
        const version = versions.find(v => v.version_number === versionNumber);

        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version ${versionNumber} not found for schedule ${scheduleId}`
            });
        }
        const latestVersion = await this.contractScheduleVersionRepository.findLatestVersion(scheduleId);
        if (!latestVersion || latestVersion.version_number !== versionNumber) {
            throw new RpcException({
                status: 400,
                message: `Only the latest version (${latestVersion?.version_number}) can be accepted/rejected`
            });
        }
        if (version.status !== ContractScheduleVersionStatus.PROPOSED) {
            throw new RpcException({
                status: 400,
                message: `Version is already ${version.status}`
            });
        }
        await this.contractScheduleVersionRepository.updateStatus(
            version.contract_schedule_version_id,
            ContractScheduleVersionStatus.REJECTED
        );

        return await this.getScheduleVersionWithItems(version.contract_schedule_version_id);
    }

    // get modification history for a schedule
    async getScheduleModificationHistory(scheduleId: string): Promise<ContractScheduleVersionHistoryDto> {
        const schedule = await this.contractScheduleRepository.findById(scheduleId);
        if (!schedule) {
            throw new RpcException({
                status: 404,
                message: `Contract schedule not found: ${scheduleId}`
            });
        }

        const versions = await this.contractScheduleVersionRepository.findByScheduleId(scheduleId);
        const acceptedVersion = await this.contractScheduleVersionRepository.findAcceptedVersion(scheduleId);

        const versionsWithItems = await Promise.all(
            versions.map(async (version) => {
                const items = await this.contractScheduleItemRepository.findByVersionId(version.contract_schedule_version_id);
                return this.mapToVersionResponseDto(version, items);
            })
        );

        let activeVersionDto: ContractScheduleVersionResponseDto | undefined = undefined;
        if (acceptedVersion) {
            const activeItems = await this.contractScheduleItemRepository.findByVersionId(acceptedVersion.contract_schedule_version_id);
            activeVersionDto = this.mapToVersionResponseDto(acceptedVersion, activeItems);
        }

        return {
            schedule_id: scheduleId,
            scheduled_delivery_date: schedule.scheduled_delivery_date,
            current_status: schedule.status,
            versions: versionsWithItems,
            active_version: activeVersionDto
        };
    }

    // compare two versions of a schedule
    async compareScheduleVersions(scheduleId: string, versionNumberA: number, versionNumberB: number): Promise<ContractScheduleVersionComparisonDto> {
        const versions = await this.contractScheduleVersionRepository.findByScheduleId(scheduleId);

        const versionA = versions.find(v => v.version_number === versionNumberA);
        const versionB = versions.find(v => v.version_number === versionNumberB);

        if (!versionA || !versionB) {
            throw new RpcException({
                status: 404,
                message: `One or both versions not found`
            });
        }
        const itemsA = await this.contractScheduleItemRepository.findByVersionId(versionA.contract_schedule_version_id);
        const itemsB = await this.contractScheduleItemRepository.findByVersionId(versionB.contract_schedule_version_id);

        const differences = this.calculateScheduleVersionDifferences(
            this.mapToVersionResponseDto(versionA, itemsA),
            this.mapToVersionResponseDto(versionB, itemsB)
        );

        return {
            version_a: this.mapToVersionResponseDto(versionA, itemsA),
            version_b: this.mapToVersionResponseDto(versionB, itemsB),
            differences
        };
    }

    // get active version for order generation (only accepted version can be active)
    async getActiveVersionForOrderGeneration(scheduleId: string): Promise<ContractScheduleVersionResponseDto | null> {
        const acceptedVersion = await this.contractScheduleVersionRepository.findAcceptedVersion(scheduleId);

        if (acceptedVersion) {
            const items = await this.contractScheduleItemRepository.findByVersionId(acceptedVersion.contract_schedule_version_id);
            return this.mapToVersionResponseDto(acceptedVersion, items);
        }

        return null;
    }

    // helper methods

    private async validateScheduleForModification(schedule: any, contract: any, proposedBy: ProposedBy): Promise<void> {
        if (contract.status !== ContractStatus.ACTIVE) {
            throw new RpcException({
                status: 400,
                message: `Contract is not active. Current status: ${contract.status}`
            });
        }

        if (schedule.status !== ContractScheduleStatus.SCHEDULED) {
            throw new RpcException({
                status: 400,
                message: `Schedule cannot be modified. Current status: ${schedule.status}`
            });
        }

        const today = new Date();
        const deliveryDate = new Date(schedule.scheduled_delivery_date);
        const deadlineDate = new Date(deliveryDate);
        deadlineDate.setDate(deadlineDate.getDate() - contract.change_deadline_days);

        if (today > deadlineDate) {
            throw new RpcException({
                status: 400,
                message: `Cannot modify schedule after the change deadline. Deadline was: ${deadlineDate.toISOString()}`
            });
        }
        if (proposedBy === ProposedBy.SYSTEM) {
            throw new RpcException({
                status: 400,
                message: `System cannot propose manual modifications`
            });
        }
    }

    private async getScheduleVersionWithItems(versionId: string): Promise<ContractScheduleVersionResponseDto> {
        const versions = await this.contractScheduleVersionRepository.findByScheduleId(versionId);
        const version = versions.find(v => v.contract_schedule_version_id === versionId);

        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version not found: ${versionId}`
            });
        }

        const items = await this.contractScheduleItemRepository.findByVersionId(versionId);
        return this.mapToVersionResponseDto(version, items);
    }

    private mapToVersionResponseDto(version: any, items: any[]): ContractScheduleVersionResponseDto {
        const itemsDto: ContractScheduleItemDto[] = items.map(item => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            requirements_json: item.requirements_json
        }));

        return {
            contract_schedule_version_id: version.contract_schedule_version_id,
            contract_schedule_id: version.contract_schedule_id,
            version_number: version.version_number,
            proposed_by: version.proposed_by,
            change_reason: version.change_reason,
            status: version.status,
            items: itemsDto,
            created_at: version.created_at
        };
    }

    private calculateScheduleVersionDifferences(versionA: ContractScheduleVersionResponseDto, versionB: ContractScheduleVersionResponseDto): any {
        const differences: any = {
            metadata: {}
        };

        if (versionA.proposed_by !== versionB.proposed_by) {
            differences.metadata.proposed_by = {
                old: versionA.proposed_by,
                new: versionB.proposed_by
            };
        }

        if (versionA.change_reason !== versionB.change_reason) {
            differences.metadata.change_reason = {
                old: versionA.change_reason,
                new: versionB.change_reason
            };
        }

        differences.items = this.compareScheduleItems(versionA.items, versionB.items);

        return differences;
    }

    private compareScheduleItems(itemsA: ContractScheduleItemDto[], itemsB: ContractScheduleItemDto[]): any[] {
        const differences: any[] = [];

        const mapA = new Map(itemsA.map(i => [i.product_id, i]));
        const mapB = new Map(itemsB.map(i => [i.product_id, i]));

        const allProductIds = new Set([...mapA.keys(), ...mapB.keys()]);

        allProductIds.forEach(productId => {
            const itemA = mapA.get(productId);
            const itemB = mapB.get(productId);

            if (!itemA && itemB) {
                differences.push({ product_id: productId, type: 'ADDED', new_values: { ...itemB } });
            } else if (!itemB && itemA) {
                differences.push({ product_id: productId, type: 'REMOVED', old_values: { ...itemA } });
            } else if (itemA && itemB) {
                const changes: Record<string, any> = {};

                if (itemA.quantity !== itemB.quantity) {
                    changes.quantity = { old: itemA.quantity, new: itemB.quantity };
                }

                if (itemA.unit_price !== itemB.unit_price) {
                    changes.unit_price = { old: itemA.unit_price, new: itemB.unit_price };
                }

                if (JSON.stringify(itemA.requirements_json) !== JSON.stringify(itemB.requirements_json)) {
                    changes.requirements_json = {
                        old: itemA.requirements_json ?? null,
                        new: itemB.requirements_json ?? null
                    };
                }

                if (Object.keys(changes).length > 0) {
                    differences.push({
                        product_id: productId,
                        type: 'MODIFIED',
                        changes
                    });
                }
            }
        });

        return differences;
    }
}