import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContractStatus } from '../enums/contract-status.enum';
import { ContractVersionResponseDto, ProposeVersionDto, VersionComparisonDto, VersionHistoryResponseDto } from '../dtos/contract-version.dto';
import { ProposalStatus } from '../enums/proposal-status.enum';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { Contract } from '../entities/contract.entity';
import { ContractVersion } from '../entities/contract-version.entity';
import { ProposedBy } from '../enums/proposed-by.enum';

@Injectable()
export class ContractVersionService {
    constructor(
        private readonly contractRepository: ContractRepository,
        private readonly contractVersionRepository: ContractVersionRepository,
        private readonly contractItemRepository: ContractItemRepository,
    ) { }

    // propose new version
    async proposeVersion(proposeDto: ProposeVersionDto): Promise<ContractVersionResponseDto> {
        const { contract_id, proposed_by, terms_json_snapshot } = proposeDto;

        const contract = await this.contractRepository.findById(contract_id);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contract_id}`
            });
        }

        // Validate that contract is in a state that allows proposing a new version
        this.validateContractForVersioning(contract);
        const nextVersionNumber = await this.contractVersionRepository.getNextVersionNumber(contract_id);

        // Create new version entry
        const newVersion = await this.contractVersionRepository.create({
            contract_id,
            version_number: nextVersionNumber,
            proposed_by,
            terms_json_snapshot
        });

        // update contract status to negotiation if it was draft
        if (contract.status === ContractStatus.DRAFT) {
            await this.contractRepository.updateStatus(contract_id, ContractStatus.NEGOTIATION);
        }

        // Increment the contract's version
        await this.incrementContractVersion(contract_id, contract.version);

        return this.mapToVersionResponseDto(newVersion, ProposalStatus.PROPOSED);
    }

    // accept version
    async acceptVersion(contractId: string, versionNumber: number): Promise<ContractVersionResponseDto> {
        const contract = await this.contractRepository.findById(contractId);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contractId}`
            });
        }
        const version = await this.contractVersionRepository.findVersionByNumber(contractId, versionNumber);
        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version ${versionNumber} not found for contract ${contractId}`
            });
        }

        const latestVersion = await this.contractVersionRepository.findLatestVersion(contractId);
        if (!latestVersion || latestVersion.version_number !== versionNumber) {
            throw new RpcException({
                status: 400,
                message: `Only the latest version (${latestVersion?.version_number}) can be accepted/rejected`
            });
        }

        await this.updateContractStatusAfterAcceptance(contract, version);
        await this.applyVersionChanges(contractId, version.terms_json_snapshot);

        return this.mapToVersionResponseDto(version, ProposalStatus.ACCEPTED);
    }

    // reject version
    async rejectVersion(contractId: string, versionNumber: number): Promise<ContractVersionResponseDto> {
        const contract = await this.contractRepository.findById(contractId);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contractId}`
            });
        }

        const version = await this.contractVersionRepository.findVersionByNumber(contractId, versionNumber);
        if (!version) {
            throw new RpcException({
                status: 404,
                message: `Version ${versionNumber} not found for contract ${contractId}`
            });
        }

        const latestVersion = await this.contractVersionRepository.findLatestVersion(contractId);
        if (!latestVersion || latestVersion.version_number !== versionNumber) {
            throw new RpcException({
                status: 400,
                message: `Only the latest version (${latestVersion?.version_number}) can be accepted/rejected`
            });
        }

        if (versionNumber > 1) {
            const previousVersion = await this.contractVersionRepository.findVersionByNumber(contractId, versionNumber - 1);
            if (previousVersion) {
                await this.applyVersionChanges(contractId, previousVersion.terms_json_snapshot);
            }
        }

        if (contract.status === ContractStatus.NEGOTIATION && versionNumber === 1) {
            await this.contractRepository.updateStatus(contractId, ContractStatus.DRAFT);
        }

        return this.mapToVersionResponseDto(version, ProposalStatus.REJECTED);
    }

    // get version history
    async getVersionHistory(contractId: string): Promise<VersionHistoryResponseDto> {
        const contract = await this.contractRepository.findById(contractId);
        if (!contract) {
            throw new RpcException({
                status: 404,
                message: `Contract not found: ${contractId}`
            });
        }

        const versions = await this.contractVersionRepository.getVersionHistory(contractId);

        const latestVersion = await this.contractVersionRepository.findLatestVersion(contractId);

        const versionsWithStatus = versions.map(version => {
            let status = ProposalStatus.PROPOSED;
            if (latestVersion && version.version_number === latestVersion.version_number) {
                if (contract.status === ContractStatus.ACTIVE || contract.status === ContractStatus.PENDING_SIGNATURE) {
                    status = ProposalStatus.ACCEPTED;
                }
            } else if (version.version_number < (latestVersion?.version_number || 0)) {
                status = ProposalStatus.ACCEPTED;
            }

            return this.mapToVersionResponseDto(version, status);
        });

        return {
            contract_id: contractId,
            current_version: contract.version,
            versions: versionsWithStatus
        };
    }

    // compare versions
    async compareVersions(contractId: string, versionA: number, versionB: number): Promise<VersionComparisonDto> {
        const version1 = await this.contractVersionRepository.findVersionByNumber(contractId, versionA);
        const version2 = await this.contractVersionRepository.findVersionByNumber(contractId, versionB);

        if (!version1 || !version2) {
            throw new RpcException({
                status: 404,
                message: `One or both versions not found`
            });
        }

        const differences = this.calculateDifferences(version1.terms_json_snapshot, version2.terms_json_snapshot);

        return {
            version_a: this.mapToVersionResponseDto(version1, ProposalStatus.PROPOSED),
            version_b: this.mapToVersionResponseDto(version2, ProposalStatus.PROPOSED),
            differences
        };
    }

    // helper methods

    private async incrementContractVersion(contractId: string, currentVersion: number): Promise<void> {
    await this.contractRepository.updateContract(contractId, {
        version: currentVersion + 1
    });
}

    private validateContractForVersioning(contract: Contract): void {
        const validStatuses = [ContractStatus.DRAFT, ContractStatus.NEGOTIATION];

        if (!validStatuses.includes(contract.status)) {
            throw new RpcException({
                status: 400,
                message: `Contract cannot be modified in ${contract.status} status. Only DRAFT or NEGOTIATION allowed.`
            });
        }
    }

    private async updateContractStatusAfterAcceptance(contract: Contract, version: ContractVersion): Promise<void> {
        // if it was proposed by business and is being accepted
        if (version.proposed_by === ProposedBy.BUSINESS) {
            await this.contractRepository.updateStatus(contract.contract_id, ContractStatus.PENDING_SIGNATURE);
        }
        // if it was proposed by kiosk and is being accepted
        else if (version.proposed_by === ProposedBy.KIOSK) {
            await this.contractRepository.updateStatus(contract.contract_id, ContractStatus.PENDING_SIGNATURE);
        }
        // if its the first version and is accepted, it goes directly to signin
        else if (version.version_number === 1) {
            await this.contractRepository.updateStatus(contract.contract_id, ContractStatus.PENDING_SIGNATURE);
        }
    }

    private async applyVersionChanges(contractId: string, snapshot: any): Promise<void> {
        if (snapshot) {
            const updates: any = {};

            if (snapshot.start_date) updates.start_date = snapshot.start_date;
            if (snapshot.end_date) updates.end_date = snapshot.end_date;
            if (snapshot.frequency) updates.frequency = snapshot.frequency;
            if (snapshot.change_deadline_days) updates.change_deadline_days = snapshot.change_deadline_days;
            if (snapshot.cancellation_deadline_days) updates.cancellation_deadline_days = snapshot.cancellation_deadline_days;
            if (snapshot.logistics_mode) updates.logistics_mode = snapshot.logistics_mode;

            if (Object.keys(updates).length > 0) {
                await this.contractRepository.updateContract(contractId, updates);
            }

            if (snapshot.items && Array.isArray(snapshot.items)) {
                await this.contractItemRepository.deleteByContractId(contractId);
                await this.contractItemRepository.createMany(
                    snapshot.items.map((item: any) => ({
                        contract_id: contractId,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        requirements_json: item.requirements_json
                    }))
                );
            }
        }
    }

    private calculateDifferences(snapshotA: any, snapshotB: any): any {
        const differences: any = {};

        const fieldsToCompare = ['start_date', 'end_date', 'frequency', 'change_deadline_days',
            'cancellation_deadline_days', 'logistics_mode'];

        fieldsToCompare.forEach(field => {
            if (JSON.stringify(snapshotA?.[field]) !== JSON.stringify(snapshotB?.[field])) {
                differences[field] = {
                    old: snapshotA?.[field],
                    new: snapshotB?.[field]
                };
            }
        });

        if (snapshotA?.items || snapshotB?.items) {
            differences.items = this.compareItems(snapshotA?.items || [], snapshotB?.items || []);
        }

        return differences;
    }

private compareItems(itemsA: any[], itemsB: any[]): any[] {
    const differences: any[] = [];

    const mapA = new Map(itemsA.map(i => [i.product_id, i]));
    const mapB = new Map(itemsB.map(i => [i.product_id, i]));

    const allProductIds = new Set([...mapA.keys(), ...mapB.keys()]);

    allProductIds.forEach(productId => {
        const itemA = mapA.get(productId);
        const itemB = mapB.get(productId);

        if (!itemA && itemB) {
            differences.push({product_id: productId, type: 'ADDED', new_values: { ...itemB }});
        } else if (!itemB && itemA) {
            differences.push({product_id: productId, type: 'REMOVED', old_values: { ...itemA }});
        } else if (itemA && itemB) {
            const changes: Record<string, any> = {};

            if (itemA.quantity !== itemB.quantity) {
                changes.quantity = { old: itemA.quantity, new: itemB.quantity };
            }

            if (Number(itemA.unit_price) !== Number(itemB.unit_price)) {
                changes.unit_price = { old: itemA.unit_price, new: itemB.unit_price };
            }

            if (JSON.stringify(itemA.requirements_json) !== JSON.stringify(itemB.requirements_json)) {
                changes.requirements_json = { old: itemA.requirements_json ?? null, new: itemB.requirements_json ?? null };
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

    private mapToVersionResponseDto(version: ContractVersion, status: ProposalStatus): ContractVersionResponseDto {
        return {
            contract_version_id: version.contract_version_id,
            contract_id: version.contract_id,
            version_number: version.version_number,
            proposed_by: version.proposed_by as ProposedBy,
            terms_json_snapshot: version.terms_json_snapshot,
            created_at: version.created_at,
            status
        };
    }
}