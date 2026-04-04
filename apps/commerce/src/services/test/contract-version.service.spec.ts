import { Test, TestingModule } from '@nestjs/testing';
import { ContractVersionService } from '../contract-version.service';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractVersionRepository } from '../../repositories/impl/contract-version.repository';
import { ContractItemRepository } from '../../repositories/impl/contract-item.repository';
import { Contract } from '../../entities/contract.entity';
import { ContractStatus } from '../../enums/contract-status.enum';
import { ContractVersion } from '../../entities/contract-version.entity';
import { ProposedBy } from '../../enums/proposed-by.enum';
import { ProposalStatus } from '../../enums/proposal-status.enum';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { Product } from '../../entities/product.entity';
import { UnitMeasure } from '../../enums/unit-measure.enum';
import { ProductCategory } from '../../enums/product-category.enum';

describe('ContractVersionService', () => {
    let service: ContractVersionService;
    let contractRepository: jest.Mocked<ContractRepository>;
    let contractVersionRepository: jest.Mocked<ContractVersionRepository>;
    let contractItemRepository: jest.Mocked<ContractItemRepository>;

    const now = new Date();
    const start_date = new Date(now);
    start_date.setDate(start_date.getDate() + 1);
    const end_date = new Date(now);
    end_date.setMonth(end_date.getMonth() + 1);

        const mockProduct: Product = {
            id: 'product-123',
            kioskUserId: 1,
            name: 'Test Product',
            category: ProductCategory.FRUITS,
            unitMeasure: UnitMeasure.UNIT,
            customUnitMeasure: undefined,
            price: '100.50',
            durationDays: 30,
            description: 'Test description',
            photos: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            active: true,
            deletedAt: undefined,
            batches: [],
            contractItems: [],
        } as Product;
        
    const mockContract: Contract = {
        contract_id: 'contract-123',
        business_id: 'business-123',
        kiosk_id: 'kiosk-123',
        transporter_id: 'transporter-123',
        status: ContractStatus.DRAFT,
        start_date: start_date,
        end_date: end_date,
        pause_start_date: null,
        pause_end_date: null,
        frequency: 'weekly',
        change_deadline_days: 7,
        cancellation_deadline_days: 15,
        logistics_mode: LogisticsMode.SELF,
        version: 1,
        parent_contract_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        parent_contract: null,
        child_contracts: [],
        contractItems: [],
        versions: [],
        schedules: [],
    };

    const mockContractVersion: ContractVersion = {
        contract_version_id: 123,
        contract_id: 'contract-123',
        version_number: 2,
        proposed_by: ProposedBy.BUSINESS,
        terms_json_snapshot: {
            start_date: start_date,
            end_date: end_date,
            frequency: 'weekly',
            change_deadline_days: 7,
            cancellation_deadline_days: 15,
            logistics_mode: LogisticsMode.SELF,
            items: [
                {
                    product_id: 'product-123',
                    quantity: 10,
                    unit_price: 100.50,
                    requirements_json: { color: 'red' }
                }
            ]
        },
        created_at: new Date(),
        contract: mockContract as any,
    };

    const mockContractItems = [
        {
            contract_item_id: 'item-123',
            contract_id: 'contract-123',
            product_id: 'product-123',
            quantity: 10,
            unit_price: 100.50,
            requirements_json: { color: 'red' },
            created_at: new Date(),
            updated_at: new Date(),
            contract: mockContract as any,
            product: mockProduct as any,
        }
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContractVersionService,
                {
                    provide: ContractRepository,
                    useValue: {
                        findById: jest.fn(),
                        updateStatus: jest.fn(),
                        updateContract: jest.fn(),
                    },
                },
                {
                    provide: ContractVersionRepository,
                    useValue: {
                        getNextVersionNumber: jest.fn(),
                        create: jest.fn(),
                        findVersionByNumber: jest.fn(),
                        findLatestVersion: jest.fn(),
                        getVersionHistory: jest.fn(),
                    },
                },
                {
                    provide: ContractItemRepository,
                    useValue: {
                        deleteByContractId: jest.fn(),
                        createMany: jest.fn(),
                        findByContractId: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ContractVersionService>(ContractVersionService);
        contractRepository = module.get(ContractRepository);
        contractVersionRepository = module.get(ContractVersionRepository);
        contractItemRepository = module.get(ContractItemRepository);
    });

    describe('proposeVersion', () => {
        const proposeDto = {
            contract_id: 'contract-123',
            proposed_by: ProposedBy.BUSINESS,
            terms_json_snapshot: {
                start_date: start_date,
                end_date: end_date,
                frequency: 'weekly',
                change_deadline_days: 7,
                cancellation_deadline_days: 15,
                logistics_mode: LogisticsMode.SELF,
                items: []
            }
        };

        it('should propose a new version successfully', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractVersionRepository.create.mockResolvedValue(mockContractVersion);
            contractRepository.updateContract.mockResolvedValue(undefined);

            const result = await service.proposeVersion(proposeDto);

            expect(result).toHaveProperty('contract_version_id', 123);
            expect(result).toHaveProperty('version_number', 2);
            expect(result).toHaveProperty('status', ProposalStatus.PROPOSED);
            expect(contractVersionRepository.create).toHaveBeenCalled();
            expect(contractRepository.updateContract).toHaveBeenCalledWith('contract-123', { version: 2 });
        });

        it('should update contract status to NEGOTIATION when contract is DRAFT', async () => {
            const draftContract = { ...mockContract, status: ContractStatus.DRAFT };
            contractRepository.findById.mockResolvedValue(draftContract);
            contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractVersionRepository.create.mockResolvedValue(mockContractVersion);
            contractRepository.updateContract.mockResolvedValue(undefined);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            await service.proposeVersion(proposeDto);

            expect(contractRepository.updateStatus).toHaveBeenCalledWith('contract-123', ContractStatus.NEGOTIATION);
        });

        it('should not update contract status when contract is NEGOTIATION', async () => {
            const negotiationContract = { ...mockContract, status: ContractStatus.NEGOTIATION };
            contractRepository.findById.mockResolvedValue(negotiationContract);
            contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractVersionRepository.create.mockResolvedValue(mockContractVersion);
            contractRepository.updateContract.mockResolvedValue(undefined);

            await service.proposeVersion(proposeDto);

            expect(contractRepository.updateStatus).not.toHaveBeenCalled();
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.proposeVersion(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeVersion(proposeDto)).rejects.toMatchObject({
                message: 'Contract not found: contract-123',
            });
        });

        it('should throw error when contract is not in valid status', async () => {
            const activeContract = { ...mockContract, status: ContractStatus.ACTIVE };
            contractRepository.findById.mockResolvedValue(activeContract);

            await expect(service.proposeVersion(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeVersion(proposeDto)).rejects.toMatchObject({
                message: 'Contract cannot be modified in ACTIVE status. Only DRAFT or NEGOTIATION allowed.',
            });
        });
    });

    describe('acceptVersion', () => {
        const contractId = 'contract-123';
        const versionNumber = 2;

        it('should accept the latest version successfully', async () => {
            const negotiationContract = { ...mockContract, status: ContractStatus.NEGOTIATION };
            contractRepository.findById.mockResolvedValue(negotiationContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(mockContractVersion);
            contractVersionRepository.findLatestVersion.mockResolvedValue(mockContractVersion);
            contractRepository.updateStatus.mockResolvedValue(undefined);
            contractItemRepository.deleteByContractId.mockResolvedValue(undefined);
            contractItemRepository.createMany.mockResolvedValue(mockContractItems);

            const result = await service.acceptVersion(contractId, versionNumber);

            expect(result.status).toBe(ProposalStatus.ACCEPTED);
            expect(contractRepository.updateStatus).toHaveBeenCalled();
            expect(contractItemRepository.deleteByContractId).toHaveBeenCalled();
            expect(contractItemRepository.createMany).toHaveBeenCalled();
        });

        it('should set status to PENDING_SIGNATURE when version proposed by BUSINESS', async () => {
            const businessVersion = { ...mockContractVersion, proposed_by: ProposedBy.BUSINESS };
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(businessVersion);
            contractVersionRepository.findLatestVersion.mockResolvedValue(businessVersion);
            contractRepository.updateStatus.mockResolvedValue(undefined);
            contractItemRepository.deleteByContractId.mockResolvedValue(undefined);
            contractItemRepository.createMany.mockResolvedValue(mockContractItems);

            await service.acceptVersion(contractId, versionNumber);

            expect(contractRepository.updateStatus).toHaveBeenCalledWith(contractId, ContractStatus.PENDING_SIGNATURE);
        });

        it('should set status to PENDING_SIGNATURE when version proposed by KIOSK', async () => {
            const kioskVersion = { ...mockContractVersion, proposed_by: ProposedBy.KIOSK };
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(kioskVersion);
            contractVersionRepository.findLatestVersion.mockResolvedValue(kioskVersion);
            contractRepository.updateStatus.mockResolvedValue(undefined);
            contractItemRepository.deleteByContractId.mockResolvedValue(undefined);
            contractItemRepository.createMany.mockResolvedValue(mockContractItems);

            await service.acceptVersion(contractId, versionNumber);

            expect(contractRepository.updateStatus).toHaveBeenCalledWith(contractId, ContractStatus.PENDING_SIGNATURE);
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.acceptVersion(contractId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptVersion(contractId, versionNumber)).rejects.toMatchObject({
                message: `Contract not found: ${contractId}`,
            });
        });

        it('should throw error when version not found', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(null);

            await expect(service.acceptVersion(contractId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptVersion(contractId, versionNumber)).rejects.toMatchObject({
                message: `Version ${versionNumber} not found for contract ${contractId}`,
            });
        });

        it('should throw error when trying to accept non-latest version', async () => {
            const olderVersion = { ...mockContractVersion, version_number: 1 };
            const latestVersion = { ...mockContractVersion, version_number: 2 };
            
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(olderVersion);
            contractVersionRepository.findLatestVersion.mockResolvedValue(latestVersion);

            await expect(service.acceptVersion(contractId, 1)).rejects.toThrow(RpcException);
            await expect(service.acceptVersion(contractId, 1)).rejects.toMatchObject({
                message: `Only the latest version (2) can be accepted/rejected`,
            });
        });
    });

    describe('rejectVersion', () => {
        const contractId = 'contract-123';
        const versionNumber = 2;

        it('should reject the latest version successfully', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(mockContractVersion);
            contractVersionRepository.findLatestVersion.mockResolvedValue(mockContractVersion);

            const result = await service.rejectVersion(contractId, versionNumber);

            expect(result.status).toBe(ProposalStatus.REJECTED);
        });

        it('should restore previous version when rejecting version > 1', async () => {
            const previousVersion = { ...mockContractVersion, version_number: 1 };
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber
                .mockResolvedValueOnce(mockContractVersion) // for version 2
                .mockResolvedValueOnce(previousVersion); // for previous version
            contractVersionRepository.findLatestVersion.mockResolvedValue(mockContractVersion);
            contractItemRepository.deleteByContractId.mockResolvedValue(undefined);
            contractItemRepository.createMany.mockResolvedValue(mockContractItems);

            await service.rejectVersion(contractId, versionNumber);

            expect(contractItemRepository.deleteByContractId).toHaveBeenCalled();
            expect(contractItemRepository.createMany).toHaveBeenCalled();
        });

        it('should set status to DRAFT when rejecting version 1 in NEGOTIATION status', async () => {
            const negotiationContract = { ...mockContract, status: ContractStatus.NEGOTIATION };
            const version1 = { ...mockContractVersion, version_number: 1 };
            
            contractRepository.findById.mockResolvedValue(negotiationContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(version1);
            contractVersionRepository.findLatestVersion.mockResolvedValue(version1);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            await service.rejectVersion(contractId, 1);

            expect(contractRepository.updateStatus).toHaveBeenCalledWith(contractId, ContractStatus.DRAFT);
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.rejectVersion(contractId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.rejectVersion(contractId, versionNumber)).rejects.toMatchObject({
                message: `Contract not found: ${contractId}`,
            });
        });

        it('should throw error when version not found', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(null);

            await expect(service.rejectVersion(contractId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.rejectVersion(contractId, versionNumber)).rejects.toMatchObject({
                message: `Version ${versionNumber} not found for contract ${contractId}`,
            });
        });

        it('should throw error when trying to reject non-latest version', async () => {
            const olderVersion = { ...mockContractVersion, version_number: 1 };
            const latestVersion = { ...mockContractVersion, version_number: 2 };
            
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.findVersionByNumber.mockResolvedValue(olderVersion);
            contractVersionRepository.findLatestVersion.mockResolvedValue(latestVersion);

            await expect(service.rejectVersion(contractId, 1)).rejects.toThrow(RpcException);
            await expect(service.rejectVersion(contractId, 1)).rejects.toMatchObject({
                message: `Only the latest version (2) can be accepted/rejected`,
            });
        });
    });

    describe('getVersionHistory', () => {
        const contractId = 'contract-123';

        it('should return version history successfully', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.getVersionHistory.mockResolvedValue([mockContractVersion]);
            contractVersionRepository.findLatestVersion.mockResolvedValue(mockContractVersion);

            const result = await service.getVersionHistory(contractId);

            expect(result).toHaveProperty('contract_id', contractId);
            expect(result).toHaveProperty('current_version', 1);
            expect(result.versions).toHaveLength(1);
        });

        it('should mark latest version as ACCEPTED when contract is ACTIVE', async () => {
            const activeContract = { ...mockContract, status: ContractStatus.ACTIVE };
            contractRepository.findById.mockResolvedValue(activeContract);
            contractVersionRepository.getVersionHistory.mockResolvedValue([mockContractVersion]);
            contractVersionRepository.findLatestVersion.mockResolvedValue(mockContractVersion);

            const result = await service.getVersionHistory(contractId);

            expect(result.versions[0].status).toBe(ProposalStatus.ACCEPTED);
        });

        it('should mark older versions as ACCEPTED', async () => {
            const version1 = { ...mockContractVersion, version_number: 1 };
            const version2 = { ...mockContractVersion, version_number: 2 };
            
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.getVersionHistory.mockResolvedValue([version1, version2]);
            contractVersionRepository.findLatestVersion.mockResolvedValue(version2);

            const result = await service.getVersionHistory(contractId);

            expect(result.versions[0].status).toBe(ProposalStatus.ACCEPTED);
            expect(result.versions[1].status).toBe(ProposalStatus.PROPOSED);
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.getVersionHistory(contractId)).rejects.toThrow(RpcException);
            await expect(service.getVersionHistory(contractId)).rejects.toMatchObject({
                message: `Contract not found: ${contractId}`,
            });
        });
    });

    describe('compareVersions', () => {
        const contractId = 'contract-123';
        const versionA = 1;
        const versionB = 2;

        it('should compare versions successfully', async () => {
            const version1 = { ...mockContractVersion, version_number: 1, terms_json_snapshot: { start_date: '2024-01-01' } };
            const version2 = { ...mockContractVersion, version_number: 2, terms_json_snapshot: { start_date: '2024-02-01' } };
            
            contractVersionRepository.findVersionByNumber
                .mockResolvedValueOnce(version1)
                .mockResolvedValueOnce(version2);

            const result = await service.compareVersions(contractId, versionA, versionB);

            expect(result).toHaveProperty('version_a');
            expect(result).toHaveProperty('version_b');
            expect(result).toHaveProperty('differences');
        });

        it('should throw error when version not found', async () => {
            contractVersionRepository.findVersionByNumber.mockResolvedValue(null);

            await expect(service.compareVersions(contractId, versionA, versionB)).rejects.toThrow(RpcException);
            await expect(service.compareVersions(contractId, versionA, versionB)).rejects.toMatchObject({
                message: `One or both versions not found`,
            });
        });
    });

    describe('Helper Methods - applyVersionChanges', () => {
        it('should update contract fields from snapshot', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractRepository.updateContract.mockResolvedValue(undefined);
            
            const snapshot = {
                start_date: new Date('2025-01-01'),
                end_date: new Date('2025-12-31'),
                frequency: 'monthly',
                change_deadline_days: 14,
                cancellation_deadline_days: 30,
                logistics_mode: LogisticsMode.SELF,
                items: []
            };

            await service['applyVersionChanges']('contract-123', snapshot);

            expect(contractRepository.updateContract).toHaveBeenCalledWith('contract-123', {
                start_date: snapshot.start_date,
                end_date: snapshot.end_date,
                frequency: snapshot.frequency,
                change_deadline_days: snapshot.change_deadline_days,
                cancellation_deadline_days: snapshot.cancellation_deadline_days,
                logistics_mode: snapshot.logistics_mode,
            });
        });

        it('should update contract items from snapshot', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractItemRepository.deleteByContractId.mockResolvedValue(undefined);
            contractItemRepository.createMany.mockResolvedValue([]);
            
            const snapshot = {
                items: [
                    {
                        product_id: 'product-123',
                        quantity: 20,
                        unit_price: 200.00,
                        requirements_json: { color: 'blue' }
                    }
                ]
            };

            await service['applyVersionChanges']('contract-123', snapshot);

            expect(contractItemRepository.deleteByContractId).toHaveBeenCalledWith('contract-123');
            expect(contractItemRepository.createMany).toHaveBeenCalled();
        });
    });

    describe('Helper Methods - compareItems', () => {
        it('should detect added items', () => {
            const itemsA: any[] = [];
            const itemsB = [{ product_id: 'product-123', quantity: 10, unit_price: 100 }];

            const differences = service['compareItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('ADDED');
            expect(differences[0].product_id).toBe('product-123');
        });

        it('should detect removed items', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100 }];
            const itemsB: any[] = [];

            const differences = service['compareItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('REMOVED');
            expect(differences[0].product_id).toBe('product-123');
        });

        it('should detect modified items', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: { color: 'red' } }];
            const itemsB = [{ product_id: 'product-123', quantity: 20, unit_price: 150, requirements_json: { color: 'blue' } }];

            const differences = service['compareItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('MODIFIED');
            expect(differences[0].changes).toHaveProperty('quantity');
            expect(differences[0].changes).toHaveProperty('unit_price');
            expect(differences[0].changes).toHaveProperty('requirements_json');
        });

        it('should not detect changes when items are identical', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100 }];
            const itemsB = [{ product_id: 'product-123', quantity: 10, unit_price: 100 }];

            const differences = service['compareItems'](itemsA, itemsB);

            expect(differences).toHaveLength(0);
        });
    });
});