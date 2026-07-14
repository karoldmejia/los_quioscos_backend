import { Test, TestingModule } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractItemRepository } from '../../repositories/impl/contract-item.repository';
import { ProposedBy } from '../../enums/proposed-by.enum';
import { ContractStatus } from '../../enums/contract-status.enum';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { Contract } from '../../entities/contract.entity';
import { DeliveryRepository } from 'src/repositories/impl/delivery.repository';
import { ContractVersionRepository } from 'src/repositories/impl/contract-version.repository';
import { VersionStatus } from 'src/enums/version-status.enum';
import { DeliveryVersionService } from '../delivery-version.service';
import { DeliveryStatus } from 'src/enums/delivery-status.enum';
import { TargetType } from 'src/enums/target-type.enum';
import { ProductCategory } from 'src/enums/product-category.enum';
import { Product } from 'src/entities/product.entity';
import { UnitMeasure } from 'src/enums/unit-measure.enum';

describe('DeliveryVersionService', () => {
    let service: DeliveryVersionService;
    let contractRepository: jest.Mocked<ContractRepository>;
    let deliveryRepository: jest.Mocked<DeliveryRepository>;
    let contractVersionRepository: jest.Mocked<ContractVersionRepository>;
    let contractItemRepository: jest.Mocked<ContractItemRepository>;

    const now = new Date();
    const start_date = new Date(now);
    start_date.setDate(start_date.getDate() + 1);
    const end_date = new Date(now);
    end_date.setMonth(end_date.getMonth() + 1);
    const scheduled_delivery_date = new Date(now);
    scheduled_delivery_date.setDate(scheduled_delivery_date.getDate() + 14);

    const mockContract: Contract = {
        contract_id: 'contract-123',
        business_id: 'business-123',
        kiosk_id: 'kiosk-123',
        transporter_id: 'transporter-123',
        status: ContractStatus.ACTIVE,
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
        deliveries: [],
    };

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
    
        
    const mockDelivery = {
        delivery_id: 'delivery-123',
        contract_id: 'contract-123',
        scheduled_delivery_date: scheduled_delivery_date,
        status: DeliveryStatus.SCHEDULED,
        created_at: new Date(),
        updated_at: new Date(),
        contract: mockContract as any,
        versions: [],
    };

    const mockDeliveryVersion = {
        contract_version_id: 123,
        target_type: TargetType.DELIVERY,
        target_id: 'delivery-123',
        version_number: 1,
        proposed_by: ProposedBy.BUSINESS,
        change_reason: 'Change requested by business',
        status: VersionStatus.PROPOSED,
        created_at: new Date(),
        updated_at: new Date(),
        contract_delivery: mockDelivery as any,
        items: [],
    };

    const mockDeliveryItems = [
        {
            contract_item_id: 'item-123',
            target_type: TargetType.DELIVERY,
            target_id: 'delivery-123',
            product_id: 'product-123',
            quantity: 10,
            unit_price: 100.50,
            requirements_json: { color: 'red' },
            created_at: new Date(),
            updated_at: new Date(),
            version_id: 1,
            product: mockProduct as any,
        }
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeliveryVersionService,
                {
                    provide: ContractRepository,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: DeliveryRepository,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: ContractVersionRepository,
                    useValue: {
                        hasPendingProposal: jest.fn(),
                        getNextVersionNumber: jest.fn(),
                        create: jest.fn(),
                        findByTarget: jest.fn(),
                        findLatestVersion: jest.fn(),
                        updateStatus: jest.fn(),
                        findAcceptedVersion: jest.fn(),
                                                findById: jest.fn(),

                    },
                },
                {
                    provide: ContractItemRepository,
                    useValue: {
                        createMany: jest.fn(),
                        findByVersionId: jest.fn(),
                                                findByContractId: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<DeliveryVersionService>(DeliveryVersionService);
        contractRepository = module.get(ContractRepository);
        deliveryRepository = module.get(DeliveryRepository);
        contractVersionRepository = module.get(ContractVersionRepository);
        contractItemRepository = module.get(ContractItemRepository);
        contractItemRepository = module.get(ContractItemRepository);
                contractVersionRepository.findById.mockResolvedValue(mockDeliveryVersion);

    });

    describe('proposeDeliveryChange', () => {
        const proposeDto = {
            delivery_id: 'delivery-123',
            proposed_by: ProposedBy.BUSINESS,
            change_reason: 'Need to adjust quantities',
            items: [
                {
                    product_id: 'product-123',
                    quantity: 20,
                    unit_price: 150.00,
                    requirements_json: { color: 'blue' }
                }
            ]
        };

        it('should propose a delivery change successfully', async () => {
            const createdVersion = {
                ...mockDeliveryVersion,
                version_number: 2,
                status: VersionStatus.PROPOSED,
            };

            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.hasPendingProposal.mockResolvedValue(false);
            contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractVersionRepository.create.mockResolvedValue(createdVersion);
            contractVersionRepository.findByTarget.mockResolvedValue([createdVersion]);
            contractItemRepository.findByVersionId.mockResolvedValue(mockDeliveryItems);
            contractItemRepository.createMany.mockResolvedValue(mockDeliveryItems);
    contractVersionRepository.findById.mockResolvedValue(createdVersion);

            const result = await service.proposeDeliveryChange(proposeDto);

            expect(result).toBeDefined();
            expect(result.version_number).toBe(2);
            expect(result.status).toBe(VersionStatus.PROPOSED);
            expect(contractVersionRepository.create).toHaveBeenCalled();
            expect(contractItemRepository.createMany).toHaveBeenCalled();
        });
        it('should throw error when delivery not found', async () => {
            deliveryRepository.findById.mockResolvedValue(null);

            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toMatchObject({
                message: `Contract delivery not found: ${proposeDto.delivery_id}`,
            });
        });

        it('should throw error when contract not found', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toMatchObject({
                message: `Contract not found for delivery: ${proposeDto.delivery_id}`,
            });
        });

        it('should throw error when contract is not active', async () => {
            const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(inactiveContract);

            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toMatchObject({
                message: `Contract is not active. Current status: DRAFT`,
            });
        });

        it('should throw error when delivery is not in SCHEDULED status', async () => {
            const cancelledDelivery = { ...mockDelivery, status: DeliveryStatus.CANCELLED };
            deliveryRepository.findById.mockResolvedValue(cancelledDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toMatchObject({
                message: `Delivery cannot be modified. Current status: CANCELLED`,
            });
        });

        it('should throw error when change deadline has passed', async () => {
            const pastDeliveryDate = new Date();
            pastDeliveryDate.setDate(pastDeliveryDate.getDate() - 1);
            const pastDelivery = { ...mockDelivery, scheduled_delivery_date: pastDeliveryDate };

                const mockCreatedVersion = {
        ...mockDeliveryVersion,
        version_number: 2,
        scheduled_delivery_date: pastDeliveryDate
    };

            deliveryRepository.findById.mockResolvedValue(pastDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);
    contractVersionRepository.hasPendingProposal.mockResolvedValue(false);
    contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
    contractVersionRepository.create.mockResolvedValue(mockCreatedVersion);
contractItemRepository.findByVersionId.mockResolvedValue([])

            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toMatchObject({
                message: expect.stringContaining('Cannot modify delivery after the change deadline'),
            });
        });

        it('should throw error when system tries to propose change', async () => {
            const systemProposeDto = { ...proposeDto, proposed_by: ProposedBy.SYSTEM };
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.proposeDeliveryChange(systemProposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeDeliveryChange(systemProposeDto)).rejects.toMatchObject({
                message: `System cannot propose manual modifications`,
            });
        });

        it('should throw error when there is a pending proposal', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.hasPendingProposal.mockResolvedValue(true);

            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeDeliveryChange(proposeDto)).rejects.toMatchObject({
                message: `There is already a pending proposal for this delivery`,
            });
        });

        it('should create version without items when items not provided', async () => {
            const proposeDtoWithoutItems = {
                delivery_id: 'delivery-123',
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Just a note',
                items: []
            };

            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractVersionRepository.hasPendingProposal.mockResolvedValue(false);
            contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractVersionRepository.create.mockResolvedValue({
                ...mockDeliveryVersion,
                version_number: 2
            });
            contractVersionRepository.findByTarget.mockResolvedValue([mockDeliveryVersion]);
            contractItemRepository.findByVersionId.mockResolvedValue([]);

            const result = await service.proposeDeliveryChange(proposeDtoWithoutItems);

            expect(result).toBeDefined();
            expect(contractItemRepository.createMany).not.toHaveBeenCalled();
        });
    });

    describe('acceptDeliveryChange', () => {
        const deliveryId = 'delivery-123';
        const versionNumber = 1;

        it('should accept a delivery change successfully', async () => {
            const proposedVersion = {
                ...mockDeliveryVersion,
                version_number: 1,
                status: VersionStatus.PROPOSED
            };
            const acceptedVersion = {
                ...mockDeliveryVersion,
                version_number: 1,
                status: VersionStatus.ACCEPTED
            };

            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([proposedVersion]);
            contractVersionRepository.findLatestVersion.mockResolvedValue(proposedVersion);
            contractVersionRepository.updateStatus.mockResolvedValue(null);

            contractVersionRepository.findByTarget.mockResolvedValueOnce([proposedVersion]);
            contractVersionRepository.findByTarget.mockResolvedValue([acceptedVersion]);
            contractItemRepository.findByVersionId.mockResolvedValue(mockDeliveryItems);

               contractVersionRepository.findById
        .mockResolvedValueOnce(proposedVersion)
        .mockResolvedValueOnce(acceptedVersion);
            const result = await service.acceptDeliveryChange(deliveryId, versionNumber);

            expect(result.status).toBe(VersionStatus.ACCEPTED);
            expect(contractVersionRepository.updateStatus).toHaveBeenCalledWith( TargetType.DELIVERY, deliveryId,
                mockDeliveryVersion.contract_version_id,
                VersionStatus.ACCEPTED
            );
        });

        it('should throw error when delivery not found', async () => {
            deliveryRepository.findById.mockResolvedValue(null);

            await expect(service.acceptDeliveryChange(deliveryId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptDeliveryChange(deliveryId, versionNumber)).rejects.toMatchObject({
                message: `Contract delivery not found: ${deliveryId}`,
            });
        });

        it('should throw error when version not found', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([]);

            await expect(service.acceptDeliveryChange(deliveryId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptDeliveryChange(deliveryId, versionNumber)).rejects.toMatchObject({
                message: `Version ${versionNumber} not found for delivery ${deliveryId}`,
            });
        });

        it('should throw error when trying to accept non-latest version', async () => {
            const olderVersion = { ...mockDeliveryVersion, version_number: 1 };
            const latestVersion = { ...mockDeliveryVersion, version_number: 2 };

            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([olderVersion, latestVersion]);
            contractVersionRepository.findLatestVersion.mockResolvedValue(latestVersion);

            await expect(service.acceptDeliveryChange(deliveryId, 1)).rejects.toThrow(RpcException);
            await expect(service.acceptDeliveryChange(deliveryId, 1)).rejects.toMatchObject({
                message: `Only the latest version (2) can be accepted/rejected`,
            });
        });

        it('should throw error when version is already accepted', async () => {
            const acceptedVersion = { ...mockDeliveryVersion, status: VersionStatus.ACCEPTED };

            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([acceptedVersion]);
            contractVersionRepository.findLatestVersion.mockResolvedValue(acceptedVersion);

            await expect(service.acceptDeliveryChange(deliveryId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptDeliveryChange(deliveryId, versionNumber)).rejects.toMatchObject({
                message: `Version is already ACCEPTED`,
            });
        });
    });

    describe('rejectDeliveryChange', () => {
        const deliveryId = 'delivery-123';
        const versionNumber = 1;

        it('should reject a delivery change successfully', async () => {
            const proposedVersion = {
                ...mockDeliveryVersion,
                version_number: 1,
                status: VersionStatus.PROPOSED
            };
            const rejectedVersion = {
                ...mockDeliveryVersion,
                version_number: 1,
                status: VersionStatus.REJECTED
            };

            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([proposedVersion]);
            contractVersionRepository.findLatestVersion.mockResolvedValue(proposedVersion);
            contractVersionRepository.updateStatus.mockResolvedValue(null);

            contractVersionRepository.findByTarget.mockResolvedValueOnce([proposedVersion]);
            contractVersionRepository.findByTarget.mockResolvedValue([rejectedVersion]);
            contractItemRepository.findByVersionId.mockResolvedValue(mockDeliveryItems);
               contractVersionRepository.findById
        .mockResolvedValueOnce(proposedVersion)
        .mockResolvedValueOnce(rejectedVersion);
            const result = await service.rejectDeliveryChange(deliveryId, versionNumber);

            expect(result.status).toBe(VersionStatus.REJECTED);
            expect(contractVersionRepository.updateStatus).toHaveBeenCalledWith(TargetType.DELIVERY, deliveryId, mockDeliveryVersion.contract_version_id, VersionStatus.REJECTED
            );
        });

        it('should throw error when delivery not found', async () => {
            deliveryRepository.findById.mockResolvedValue(null);

            await expect(service.rejectDeliveryChange(deliveryId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.rejectDeliveryChange(deliveryId, versionNumber)).rejects.toMatchObject({
                message: `Contract delivery not found: ${deliveryId}`,
            });
        });

        it('should throw error when version not found', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([]);

            await expect(service.rejectDeliveryChange(deliveryId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.rejectDeliveryChange(deliveryId, versionNumber)).rejects.toMatchObject({
                message: `Version ${versionNumber} not found for delivery ${deliveryId}`,
            });
        });
    });

    describe('getDeliveryModificationHistory', () => {
        const deliveryId = 'delivery-123';

        it('should return modification history successfully', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([mockDeliveryVersion]);
            contractVersionRepository.findAcceptedVersion.mockResolvedValue(mockDeliveryVersion);
            contractItemRepository.findByVersionId.mockResolvedValue(mockDeliveryItems);

            const result = await service.getDeliveryModificationHistory(deliveryId);

            expect(result).toHaveProperty('delivery_id', deliveryId);
            expect(result).toHaveProperty('scheduled_delivery_date');
            expect(result).toHaveProperty('current_status');
            expect(result.versions).toHaveLength(1);
            expect(result.active_version).toBeDefined();
        });

        it('should return history without active version when none accepted', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractVersionRepository.findByTarget.mockResolvedValue([mockDeliveryVersion]);
            contractVersionRepository.findAcceptedVersion.mockResolvedValue(null);
            contractItemRepository.findByVersionId.mockResolvedValue(mockDeliveryItems);

            const result = await service.getDeliveryModificationHistory(deliveryId);

            expect(result.active_version).toBeUndefined();
        });

        it('should throw error when delivery not found', async () => {
            deliveryRepository.findById.mockResolvedValue(null);

            await expect(service.getDeliveryModificationHistory(deliveryId)).rejects.toThrow(RpcException);
            await expect(service.getDeliveryModificationHistory(deliveryId)).rejects.toMatchObject({
                message: `Contract delivery not found: ${deliveryId}`,
            });
        });
    });

    describe('compareDeliveryVersions', () => {
        const deliveryId = 'delivery-123';
        const versionNumberA = 1;
        const versionNumberB = 2;

        it('should compare versions successfully', async () => {
            const version1 = { ...mockDeliveryVersion, version_number: 1 };
            const version2 = { ...mockDeliveryVersion, version_number: 2 };

            contractVersionRepository.findByTarget.mockResolvedValue([version1, version2]);
            contractItemRepository.findByVersionId.mockResolvedValue(mockDeliveryItems);

            const result = await service.compareDeliveryVersions(deliveryId, versionNumberA, versionNumberB);

            expect(result).toHaveProperty('version_a');
            expect(result).toHaveProperty('version_b');
            expect(result).toHaveProperty('differences');
        });

        it('should throw error when version A not found', async () => {
            contractVersionRepository.findByTarget.mockResolvedValue([mockDeliveryVersion]);

            await expect(service.compareDeliveryVersions(deliveryId, 1, 2)).rejects.toThrow(RpcException);
            await expect(service.compareDeliveryVersions(deliveryId, 1, 2)).rejects.toMatchObject({
                message: `One or both versions not found`,
            });
        });

        it('should throw error when version B not found', async () => {
            const version1 = { ...mockDeliveryVersion, version_number: 1 };
            contractVersionRepository.findByTarget.mockResolvedValue([version1]);

            await expect(service.compareDeliveryVersions(deliveryId, 1, 2)).rejects.toThrow(RpcException);
        });
    });

    describe('getActiveVersionForOrderGeneration', () => {
        const deliveryId = 'delivery-123';

        it('should return active version when exists', async () => {
            const acceptedVersion = {
                ...mockDeliveryVersion,
                status: VersionStatus.ACCEPTED
            };

            contractVersionRepository.findAcceptedVersion.mockResolvedValue(acceptedVersion);
            contractItemRepository.findByVersionId.mockResolvedValue(mockDeliveryItems);

            const result = await service.getActiveVersionForOrderGeneration(deliveryId);

            expect(result).toBeDefined();
            expect(result?.status).toBe(VersionStatus.ACCEPTED);
        });

        it('should return null when no active version exists', async () => {
            contractVersionRepository.findAcceptedVersion.mockResolvedValue(null);

            const result = await service.getActiveVersionForOrderGeneration(deliveryId);

            expect(result).toBeNull();
        });
    });

    describe('Helper Methods - compareDeliveryItems', () => {
        it('should detect added items', () => {
            const itemsA: any[] = [];
            const itemsB = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];

            const differences = service['compareDeliveryItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('ADDED');
            expect(differences[0].product_id).toBe('product-123');
        });

        it('should detect removed items', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];
            const itemsB: any[] = [];

            const differences = service['compareDeliveryItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('REMOVED');
            expect(differences[0].product_id).toBe('product-123');
        });

        it('should detect modified items', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: { color: 'red' } }];
            const itemsB = [{ product_id: 'product-123', quantity: 20, unit_price: 150, requirements_json: { color: 'blue' } }];

            const differences = service['compareDeliveryItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('MODIFIED');
            expect(differences[0].changes).toHaveProperty('quantity');
            expect(differences[0].changes).toHaveProperty('unit_price');
            expect(differences[0].changes).toHaveProperty('requirements_json');
        });

        it('should not detect changes when items are identical', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];
            const itemsB = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];

            const differences = service['compareDeliveryItems'](itemsA, itemsB);

            expect(differences).toHaveLength(0);
        });

        it('should handle multiple items', () => {
            const itemsA = [
                { product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null },
                { product_id: 'product-456', quantity: 5, unit_price: 50, requirements_json: null }
            ];
            const itemsB = [
                { product_id: 'product-123', quantity: 15, unit_price: 100, requirements_json: null },
                { product_id: 'product-789', quantity: 20, unit_price: 200, requirements_json: null }
            ];

            const differences = service['compareDeliveryItems'](itemsA, itemsB);

            expect(differences).toHaveLength(3);
            expect(differences.find(d => d.product_id === 'product-123')?.type).toBe('MODIFIED');
            expect(differences.find(d => d.product_id === 'product-456')?.type).toBe('REMOVED');
            expect(differences.find(d => d.product_id === 'product-789')?.type).toBe('ADDED');
        });
    });

    describe('Helper Methods - calculateDeliveryVersionDifferences', () => {
        it('should detect metadata differences', () => {
            const versionA = {
                delivery_version_id: '1',
                delivery_id: 'delivery-123',
                version_number: 1,
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Reason A',
                status: VersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };
            const versionB = {
                delivery_version_id: '2',
                delivery_id: 'delivery-123',
                version_number: 2,
                proposed_by: ProposedBy.KIOSK,
                change_reason: 'Reason B',
                status: VersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };

            const differences = service['calculateDeliveryVersionDifferences'](versionA, versionB);

            expect(differences.metadata.proposed_by).toBeDefined();
            expect(differences.metadata.change_reason).toBeDefined();
        });

        it('should not detect metadata differences when same', () => {
            const versionA = {
                delivery_version_id: '1',
                delivery_id: 'delivery-123',
                version_number: 1,
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Same reason',
                status: VersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };
            const versionB = {
                delivery_version_id: '2',
                delivery_id: 'delivery-123',
                version_number: 2,
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Same reason',
                status: VersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };

            const differences = service['calculateDeliveryVersionDifferences'](versionA, versionB);

            expect(differences.metadata.proposed_by).toBeUndefined();
            expect(differences.metadata.change_reason).toBeUndefined();
        });
    });
});