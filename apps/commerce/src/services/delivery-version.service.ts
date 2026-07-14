import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ProposedBy } from '../enums/proposed-by.enum';
import { ContractStatus } from '../enums/contract-status.enum';
import { DeliveryRepository } from '../repositories/impl/delivery.repository';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';
import { DeliveryItemDto, DeliveryVersionComparisonDto, DeliveryVersionHistoryDto, DeliveryVersionResponseDto, ProposeDeliveryChangeDto } from '../dtos/delivery.dto';
import { VersionStatus } from '../enums/version-status.enum';
import { TargetType } from '../enums/target-type.enum';
import { DeliveryStatus } from '../enums/delivery-status.enum';

@Injectable()
export class DeliveryVersionService {
    constructor(
        private readonly contractRepository: ContractRepository,
        private readonly deliveryRepository: DeliveryRepository,
        private readonly contractVersionRepository: ContractVersionRepository,
        private readonly contractItemRepository: ContractItemRepository,
    ) { }

    // propose change on specific delivery
    async proposeDeliveryChange(proposeDto: ProposeDeliveryChangeDto): Promise<DeliveryVersionResponseDto> {
        const { delivery_id, proposed_by, change_reason, items } = proposeDto;

        const delivery = await this.deliveryRepository.findById(delivery_id);
        if (!delivery) {
            throw new RpcException({
                status: 404,
                message: `Contract delivery not found: ${delivery_id}`
            });
        }
        const contract = await this.contractRepository.findById(delivery.contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found for delivery: ${delivery_id}`
            });
        }
        await this.validateDeliveryForModification(delivery, contract, proposed_by);
        const hasPending = await this.contractVersionRepository.hasPendingProposal(TargetType.DELIVERY, delivery_id);
        if (hasPending) {
            throw new RpcException({
                status: 400,
                message: `There is already a pending proposal for this delivery`
            });
        }

        const nextVersionNumber = await this.contractVersionRepository.getNextVersionNumber(TargetType.DELIVERY, delivery_id);

        const newVersion = await this.contractVersionRepository.create({
            target_type: TargetType.DELIVERY,
            target_id: delivery_id,
            version_number: nextVersionNumber,
            proposed_by,
            change_reason,
            status: VersionStatus.PROPOSED
        });

        if (items && items.length > 0) {
            const versionItems = items.map(item => ({
                version_id: newVersion.contract_version_id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                requirements_json: item.requirements_json
            }));
            await this.contractItemRepository.createMany(versionItems);
        }

        return await this.getDeliveryVersionWithItems(newVersion.contract_version_id);
    }

    // accept proposed change
    async acceptDeliveryChange(deliveryId: string, versionNumber: number): Promise<DeliveryVersionResponseDto> {
        const delivery = await this.deliveryRepository.findById(deliveryId);
        if (!delivery) {
            throw new RpcException({
                status: 404,
                message: `Contract delivery not found: ${deliveryId}`
            });
        }

        const versions = await this.contractVersionRepository.findByTarget(TargetType.DELIVERY, deliveryId);

        const version = versions.find(v => v.version_number === versionNumber);

        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version ${versionNumber} not found for delivery ${deliveryId}`
            });
        }
        const latestVersion = await this.contractVersionRepository.findLatestVersion(TargetType.DELIVERY, deliveryId);
        if (!latestVersion || latestVersion.version_number !== versionNumber) {
            throw new RpcException({
                status: 400,
                message: `Only the latest version (${latestVersion?.version_number}) can be accepted/rejected`
            });
        }
        if (version.status !== VersionStatus.PROPOSED) {
            throw new RpcException({
                status: 400,
                message: `Version is already ${version.status}`
            });
        }

        await this.contractVersionRepository.updateStatus(TargetType.DELIVERY, deliveryId, version.contract_version_id, VersionStatus.ACCEPTED);

        const updatedVersion = await this.contractVersionRepository.findById(version.contract_version_id);
        return await this.getDeliveryVersionWithItems(version.contract_version_id);
    }

    // reject change proposal
    async rejectDeliveryChange(deliveryId: string, versionNumber: number): Promise<DeliveryVersionResponseDto> {
        const delivery = await this.deliveryRepository.findById(deliveryId);
        if (!delivery) {
            throw new RpcException({
                status: 404,
                message: `Contract delivery not found: ${deliveryId}`
            });
        }
        const versions = await this.contractVersionRepository.findByTarget(TargetType.DELIVERY, deliveryId);
        const version = versions.find(v => v.version_number === versionNumber);

        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version ${versionNumber} not found for delivery ${deliveryId}`
            });
        }
        const latestVersion = await this.contractVersionRepository.findLatestVersion(TargetType.DELIVERY, deliveryId);
        if (!latestVersion || latestVersion.version_number !== versionNumber) {
            throw new RpcException({
                status: 400,
                message: `Only the latest version (${latestVersion?.version_number}) can be accepted/rejected`
            });
        }
        if (version.status !== VersionStatus.PROPOSED) {
            throw new RpcException({
                status: 400,
                message: `Version is already ${version.status}`
            });
        }
        await this.contractVersionRepository.updateStatus(TargetType.DELIVERY, deliveryId, version.contract_version_id, VersionStatus.REJECTED);
        const updatedVersion = await this.contractVersionRepository.findById(version.contract_version_id);

        return await this.getDeliveryVersionWithItems(version.contract_version_id);
    }

    // get modification history for a delivery
    async getDeliveryModificationHistory(deliveryId: string): Promise<DeliveryVersionHistoryDto> {
        const delivery = await this.deliveryRepository.findById(deliveryId);
        if (!delivery) {
            throw new RpcException({
                status: 404,
                message: `Contract delivery not found: ${deliveryId}`
            });
        }

        const versions = await this.contractVersionRepository.findByTarget(TargetType.DELIVERY, deliveryId);
        const acceptedVersion = await this.contractVersionRepository.findAcceptedVersion(TargetType.DELIVERY, deliveryId);

        const versionsWithItems = await Promise.all(
            versions.map(async (version) => {
                const items = await this.contractItemRepository.findByVersionId(TargetType.DELIVERY, deliveryId, version.contract_version_id);
                return this.mapToVersionResponseDto(version, items);
            })
        );

        let activeVersionDto: DeliveryVersionResponseDto | undefined = undefined;
        if (acceptedVersion) {
            const activeItems = await this.contractItemRepository.findByVersionId(TargetType.DELIVERY, deliveryId, acceptedVersion.contract_version_id);
            activeVersionDto = this.mapToVersionResponseDto(acceptedVersion, activeItems);
        }

        return {
            delivery_id: deliveryId,
            scheduled_delivery_date: delivery.scheduled_delivery_date,
            current_status: delivery.status,
            versions: versionsWithItems,
            active_version: activeVersionDto
        };
    }

    // compare two versions of a delivery
    async compareDeliveryVersions(deliveryId: string, versionNumberA: number, versionNumberB: number): Promise<DeliveryVersionComparisonDto> {
        const versions = await this.contractVersionRepository.findByTarget(TargetType.DELIVERY, deliveryId);

        const versionA = versions.find(v => v.version_number === versionNumberA);
        const versionB = versions.find(v => v.version_number === versionNumberB);

        if (!versionA || !versionB) {
            throw new RpcException({
                status: 404,
                message: `One or both versions not found`
            });
        }
        const itemsA = await this.contractItemRepository.findByVersionId(TargetType.DELIVERY, deliveryId, versionA.contract_version_id);
        const itemsB = await this.contractItemRepository.findByVersionId(TargetType.DELIVERY, deliveryId, versionB.contract_version_id);

        const differences = this.calculateDeliveryVersionDifferences(
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
    async getActiveVersionForOrderGeneration(deliveryId: string): Promise<DeliveryVersionResponseDto | null> {
        const acceptedVersion = await this.contractVersionRepository.findAcceptedVersion(TargetType.DELIVERY, deliveryId);

        if (acceptedVersion) {
            const items = await this.contractItemRepository.findByVersionId(TargetType.DELIVERY, deliveryId, acceptedVersion.contract_version_id);
            return this.mapToVersionResponseDto(acceptedVersion, items);
        }

        return null;
    }

    // helper methods

    private async validateDeliveryForModification(delivery: any, contract: any, proposedBy: ProposedBy): Promise<void> {
        if (contract.status !== ContractStatus.ACTIVE) {
            throw new RpcException({
                status: 400,
                message: `Contract is not active. Current status: ${contract.status}`
            });
        }

        if (delivery.status !== DeliveryStatus.SCHEDULED) {
            throw new RpcException({
                status: 400,
                message: `Delivery cannot be modified. Current status: ${delivery.status}`
            });
        }

        const today = new Date();
        const deliveryDate = new Date(delivery.scheduled_delivery_date);
        const deadlineDate = new Date(deliveryDate);
        deadlineDate.setDate(deadlineDate.getDate() - contract.change_deadline_days);

        if (today > deadlineDate) {
            throw new RpcException({
                status: 400,
                message: `Cannot modify delivery after the change deadline. Deadline was: ${deadlineDate.toISOString()}`
            });
        }
        if (proposedBy === ProposedBy.SYSTEM) {
            throw new RpcException({
                status: 400,
                message: `System cannot propose manual modifications`
            });
        }
    }

    private async getDeliveryVersionWithItems(versionId: number): Promise<DeliveryVersionResponseDto> {
        const version = await this.contractVersionRepository.findById(versionId);
        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version not found: ${versionId}`
            });
        }
        const deliveryId = version.target_id;

        const items = await this.contractItemRepository.findByVersionId(TargetType.DELIVERY, deliveryId, versionId);
        return this.mapToVersionResponseDto(version, items);
    }

    private mapToVersionResponseDto(version: any, items: any[]): DeliveryVersionResponseDto {
        const itemsDto: DeliveryItemDto[] = items.map(item => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            requirements_json: item.requirements_json
        }));

        return {
            delivery_version_id: version.contract_version_id,
            delivery_id: version.delivery_id,
            version_number: version.version_number,
            proposed_by: version.proposed_by,
            change_reason: version.change_reason,
            status: version.status,
            items: itemsDto,
            created_at: version.created_at
        };
    }

    private calculateDeliveryVersionDifferences(versionA: DeliveryVersionResponseDto, versionB: DeliveryVersionResponseDto): any {
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

        differences.items = this.compareDeliveryItems(versionA.items, versionB.items);

        return differences;
    }

    private compareDeliveryItems(itemsA: DeliveryItemDto[], itemsB: DeliveryItemDto[]): any[] {
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