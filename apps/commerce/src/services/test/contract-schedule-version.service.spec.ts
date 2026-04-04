import { Test, TestingModule } from '@nestjs/testing';
import { ContractScheduleVersionService } from '../contract-schedule-version.service';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractScheduleRepository } from '../../repositories/impl/contract-schedule.repository';
import { ContractScheduleVersionRepository } from '../../repositories/impl/contract-schedule-version.repository';
import { ContractScheduleItemRepository } from '../../repositories/impl/contract-schedule-item.repository';
import { ContractItemRepository } from '../../repositories/impl/contract-item.repository';
import { ContractScheduleVersionStatus } from '../../enums/contract-schedule-version-status.enum';
import { ProposedBy } from '../../enums/proposed-by.enum';
import { ContractStatus } from '../../enums/contract-status.enum';
import { ContractScheduleStatus } from '../../enums/contract-schedule-status.enum';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { Contract } from '../../entities/contract.entity';

describe('ContractScheduleVersionService', () => {
    let service: ContractScheduleVersionService;
    let contractRepository: jest.Mocked<ContractRepository>;
    let contractScheduleRepository: jest.Mocked<ContractScheduleRepository>;
    let contractScheduleVersionRepository: jest.Mocked<ContractScheduleVersionRepository>;
    let contractScheduleItemRepository: jest.Mocked<ContractScheduleItemRepository>;
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
        versions: [],
        schedules: [],
    };

    const mockSchedule = {
        contract_schedule_id: 'schedule-123',
        contract_id: 'contract-123',
        scheduled_delivery_date: scheduled_delivery_date,
        status: ContractScheduleStatus.SCHEDULED,
        created_at: new Date(),
        updated_at: new Date(),
        contract: mockContract as any,
        versions: [],
    };

    const mockScheduleVersion = {
        contract_schedule_version_id: 'version-123',
        contract_schedule_id: 'schedule-123',
        version_number: 1,
        proposed_by: ProposedBy.BUSINESS,
        change_reason: 'Change requested by business',
        status: ContractScheduleVersionStatus.PROPOSED,
        created_at: new Date(),
        updated_at: new Date(),
        contract_schedule: mockSchedule as any,
        items: [],
    };

    const mockScheduleItems = [
        {
            contract_schedule_item_id: 'item-123',
            contract_schedule_version_id: 'version-123',
            product_id: 'product-123',
            quantity: 10,
            unit_price: 100.50,
            requirements_json: { color: 'red' },
            created_at: new Date(),
            updated_at: new Date(),
            contract_schedule_version: mockScheduleVersion as any,

        }
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContractScheduleVersionService,
                {
                    provide: ContractRepository,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleRepository,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleVersionRepository,
                    useValue: {
                        hasPendingProposal: jest.fn(),
                        getNextVersionNumber: jest.fn(),
                        create: jest.fn(),
                        findByScheduleId: jest.fn(),
                        findLatestVersion: jest.fn(),
                        updateStatus: jest.fn(),
                        findAcceptedVersion: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleItemRepository,
                    useValue: {
                        createMany: jest.fn(),
                        findByVersionId: jest.fn(),
                    },
                },
                {
                    provide: ContractItemRepository,
                    useValue: {
                        findByContractId: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ContractScheduleVersionService>(ContractScheduleVersionService);
        contractRepository = module.get(ContractRepository);
        contractScheduleRepository = module.get(ContractScheduleRepository);
        contractScheduleVersionRepository = module.get(ContractScheduleVersionRepository);
        contractScheduleItemRepository = module.get(ContractScheduleItemRepository);
        contractItemRepository = module.get(ContractItemRepository);
    });

    describe('proposeScheduleChange', () => {
        const proposeDto = {
            contract_schedule_id: 'schedule-123',
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

        it('should propose a schedule change successfully', async () => {
            const createdVersion = {
                ...mockScheduleVersion,
                version_number: 2,
                status: ContractScheduleVersionStatus.PROPOSED
            };

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleVersionRepository.hasPendingProposal.mockResolvedValue(false);
            contractScheduleVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractScheduleVersionRepository.create.mockResolvedValue(createdVersion);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([createdVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);
            contractScheduleItemRepository.createMany.mockResolvedValue(mockScheduleItems);

            const result = await service.proposeScheduleChange(proposeDto);

            expect(result).toBeDefined();
            expect(result.version_number).toBe(2);
            expect(result.status).toBe(ContractScheduleVersionStatus.PROPOSED);
            expect(contractScheduleVersionRepository.create).toHaveBeenCalled();
            expect(contractScheduleItemRepository.createMany).toHaveBeenCalled();
        });
        it('should throw error when schedule not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(null);

            await expect(service.proposeScheduleChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeScheduleChange(proposeDto)).rejects.toMatchObject({
                message: `Contract schedule not found: ${proposeDto.contract_schedule_id}`,
            });
        });

        it('should throw error when contract not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.proposeScheduleChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeScheduleChange(proposeDto)).rejects.toMatchObject({
                message: `Contract not found for schedule: ${proposeDto.contract_schedule_id}`,
            });
        });

        it('should throw error when contract is not active', async () => {
            const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(inactiveContract);

            await expect(service.proposeScheduleChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeScheduleChange(proposeDto)).rejects.toMatchObject({
                message: `Contract is not active. Current status: DRAFT`,
            });
        });

        it('should throw error when schedule is not in SCHEDULED status', async () => {
            const cancelledSchedule = { ...mockSchedule, status: ContractScheduleStatus.CANCELLED };
            contractScheduleRepository.findById.mockResolvedValue(cancelledSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.proposeScheduleChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeScheduleChange(proposeDto)).rejects.toMatchObject({
                message: `Schedule cannot be modified. Current status: CANCELLED`,
            });
        });

        it('should throw error when change deadline has passed', async () => {
            const pastDeliveryDate = new Date();
            pastDeliveryDate.setDate(pastDeliveryDate.getDate() - 1);
            const pastSchedule = { ...mockSchedule, scheduled_delivery_date: pastDeliveryDate };

            contractScheduleRepository.findById.mockResolvedValue(pastSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.proposeScheduleChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeScheduleChange(proposeDto)).rejects.toMatchObject({
                message: expect.stringContaining('Cannot modify schedule after the change deadline'),
            });
        });

        it('should throw error when system tries to propose change', async () => {
            const systemProposeDto = { ...proposeDto, proposed_by: ProposedBy.SYSTEM };
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.proposeScheduleChange(systemProposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeScheduleChange(systemProposeDto)).rejects.toMatchObject({
                message: `System cannot propose manual modifications`,
            });
        });

        it('should throw error when there is a pending proposal', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleVersionRepository.hasPendingProposal.mockResolvedValue(true);

            await expect(service.proposeScheduleChange(proposeDto)).rejects.toThrow(RpcException);
            await expect(service.proposeScheduleChange(proposeDto)).rejects.toMatchObject({
                message: `There is already a pending proposal for this schedule`,
            });
        });

        it('should create version without items when items not provided', async () => {
            const proposeDtoWithoutItems = {
                contract_schedule_id: 'schedule-123',
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Just a note',
                items: []
            };

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleVersionRepository.hasPendingProposal.mockResolvedValue(false);
            contractScheduleVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractScheduleVersionRepository.create.mockResolvedValue({
                ...mockScheduleVersion,
                version_number: 2
            });
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue([]);

            const result = await service.proposeScheduleChange(proposeDtoWithoutItems);

            expect(result).toBeDefined();
            expect(contractScheduleItemRepository.createMany).not.toHaveBeenCalled();
        });
    });

    describe('acceptScheduleChange', () => {
        const scheduleId = 'schedule-123';
        const versionNumber = 1;

        it('should accept a schedule change successfully', async () => {
            const proposedVersion = {
                ...mockScheduleVersion,
                version_number: 1,
                status: ContractScheduleVersionStatus.PROPOSED
            };
            const acceptedVersion = {
                ...mockScheduleVersion,
                version_number: 1,
                status: ContractScheduleVersionStatus.ACCEPTED
            };

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([proposedVersion]);
            contractScheduleVersionRepository.findLatestVersion.mockResolvedValue(proposedVersion);
            contractScheduleVersionRepository.updateStatus.mockResolvedValue(undefined);

            contractScheduleVersionRepository.findByScheduleId.mockResolvedValueOnce([proposedVersion]);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([acceptedVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.acceptScheduleChange(scheduleId, versionNumber);

            expect(result.status).toBe(ContractScheduleVersionStatus.ACCEPTED);
            expect(contractScheduleVersionRepository.updateStatus).toHaveBeenCalledWith(
                mockScheduleVersion.contract_schedule_version_id,
                ContractScheduleVersionStatus.ACCEPTED
            );
        });

        it('should throw error when schedule not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(null);

            await expect(service.acceptScheduleChange(scheduleId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptScheduleChange(scheduleId, versionNumber)).rejects.toMatchObject({
                message: `Contract schedule not found: ${scheduleId}`,
            });
        });

        it('should throw error when version not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([]);

            await expect(service.acceptScheduleChange(scheduleId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptScheduleChange(scheduleId, versionNumber)).rejects.toMatchObject({
                message: `Version ${versionNumber} not found for schedule ${scheduleId}`,
            });
        });

        it('should throw error when trying to accept non-latest version', async () => {
            const olderVersion = { ...mockScheduleVersion, version_number: 1 };
            const latestVersion = { ...mockScheduleVersion, version_number: 2 };

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([olderVersion, latestVersion]);
            contractScheduleVersionRepository.findLatestVersion.mockResolvedValue(latestVersion);

            await expect(service.acceptScheduleChange(scheduleId, 1)).rejects.toThrow(RpcException);
            await expect(service.acceptScheduleChange(scheduleId, 1)).rejects.toMatchObject({
                message: `Only the latest version (2) can be accepted/rejected`,
            });
        });

        it('should throw error when version is already accepted', async () => {
            const acceptedVersion = { ...mockScheduleVersion, status: ContractScheduleVersionStatus.ACCEPTED };

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([acceptedVersion]);
            contractScheduleVersionRepository.findLatestVersion.mockResolvedValue(acceptedVersion);

            await expect(service.acceptScheduleChange(scheduleId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.acceptScheduleChange(scheduleId, versionNumber)).rejects.toMatchObject({
                message: `Version is already ACCEPTED`,
            });
        });
    });

    describe('rejectScheduleChange', () => {
        const scheduleId = 'schedule-123';
        const versionNumber = 1;

        it('should reject a schedule change successfully', async () => {
            const proposedVersion = {
                ...mockScheduleVersion,
                version_number: 1,
                status: ContractScheduleVersionStatus.PROPOSED
            };
            const rejectedVersion = {
                ...mockScheduleVersion,
                version_number: 1,
                status: ContractScheduleVersionStatus.REJECTED
            };

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([proposedVersion]);
            contractScheduleVersionRepository.findLatestVersion.mockResolvedValue(proposedVersion);
            contractScheduleVersionRepository.updateStatus.mockResolvedValue(undefined);

            contractScheduleVersionRepository.findByScheduleId.mockResolvedValueOnce([proposedVersion]);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([rejectedVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.rejectScheduleChange(scheduleId, versionNumber);

            expect(result.status).toBe(ContractScheduleVersionStatus.REJECTED);
            expect(contractScheduleVersionRepository.updateStatus).toHaveBeenCalledWith(
                mockScheduleVersion.contract_schedule_version_id,
                ContractScheduleVersionStatus.REJECTED
            );
        });

        it('should throw error when schedule not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(null);

            await expect(service.rejectScheduleChange(scheduleId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.rejectScheduleChange(scheduleId, versionNumber)).rejects.toMatchObject({
                message: `Contract schedule not found: ${scheduleId}`,
            });
        });

        it('should throw error when version not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([]);

            await expect(service.rejectScheduleChange(scheduleId, versionNumber)).rejects.toThrow(RpcException);
            await expect(service.rejectScheduleChange(scheduleId, versionNumber)).rejects.toMatchObject({
                message: `Version ${versionNumber} not found for schedule ${scheduleId}`,
            });
        });
    });

    describe('getScheduleModificationHistory', () => {
        const scheduleId = 'schedule-123';

        it('should return modification history successfully', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(mockScheduleVersion);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.getScheduleModificationHistory(scheduleId);

            expect(result).toHaveProperty('schedule_id', scheduleId);
            expect(result).toHaveProperty('scheduled_delivery_date');
            expect(result).toHaveProperty('current_status');
            expect(result.versions).toHaveLength(1);
            expect(result.active_version).toBeDefined();
        });

        it('should return history without active version when none accepted', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(null);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.getScheduleModificationHistory(scheduleId);

            expect(result.active_version).toBeUndefined();
        });

        it('should throw error when schedule not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(null);

            await expect(service.getScheduleModificationHistory(scheduleId)).rejects.toThrow(RpcException);
            await expect(service.getScheduleModificationHistory(scheduleId)).rejects.toMatchObject({
                message: `Contract schedule not found: ${scheduleId}`,
            });
        });
    });

    describe('compareScheduleVersions', () => {
        const scheduleId = 'schedule-123';
        const versionNumberA = 1;
        const versionNumberB = 2;

        it('should compare versions successfully', async () => {
            const version1 = { ...mockScheduleVersion, version_number: 1 };
            const version2 = { ...mockScheduleVersion, version_number: 2 };

            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([version1, version2]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.compareScheduleVersions(scheduleId, versionNumberA, versionNumberB);

            expect(result).toHaveProperty('version_a');
            expect(result).toHaveProperty('version_b');
            expect(result).toHaveProperty('differences');
        });

        it('should throw error when version A not found', async () => {
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);

            await expect(service.compareScheduleVersions(scheduleId, 1, 2)).rejects.toThrow(RpcException);
            await expect(service.compareScheduleVersions(scheduleId, 1, 2)).rejects.toMatchObject({
                message: `One or both versions not found`,
            });
        });

        it('should throw error when version B not found', async () => {
            const version1 = { ...mockScheduleVersion, version_number: 1 };
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([version1]);

            await expect(service.compareScheduleVersions(scheduleId, 1, 2)).rejects.toThrow(RpcException);
        });
    });

    describe('getActiveVersionForOrderGeneration', () => {
        const scheduleId = 'schedule-123';

        it('should return active version when exists', async () => {
            const acceptedVersion = {
                ...mockScheduleVersion,
                status: ContractScheduleVersionStatus.ACCEPTED
            };

            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(acceptedVersion);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.getActiveVersionForOrderGeneration(scheduleId);

            expect(result).toBeDefined();
            expect(result?.status).toBe(ContractScheduleVersionStatus.ACCEPTED);
        });

        it('should return null when no active version exists', async () => {
            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(null);

            const result = await service.getActiveVersionForOrderGeneration(scheduleId);

            expect(result).toBeNull();
        });
    });

    describe('Helper Methods - compareScheduleItems', () => {
        it('should detect added items', () => {
            const itemsA: any[] = [];
            const itemsB = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];

            const differences = service['compareScheduleItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('ADDED');
            expect(differences[0].product_id).toBe('product-123');
        });

        it('should detect removed items', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];
            const itemsB: any[] = [];

            const differences = service['compareScheduleItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('REMOVED');
            expect(differences[0].product_id).toBe('product-123');
        });

        it('should detect modified items', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: { color: 'red' } }];
            const itemsB = [{ product_id: 'product-123', quantity: 20, unit_price: 150, requirements_json: { color: 'blue' } }];

            const differences = service['compareScheduleItems'](itemsA, itemsB);

            expect(differences).toHaveLength(1);
            expect(differences[0].type).toBe('MODIFIED');
            expect(differences[0].changes).toHaveProperty('quantity');
            expect(differences[0].changes).toHaveProperty('unit_price');
            expect(differences[0].changes).toHaveProperty('requirements_json');
        });

        it('should not detect changes when items are identical', () => {
            const itemsA = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];
            const itemsB = [{ product_id: 'product-123', quantity: 10, unit_price: 100, requirements_json: null }];

            const differences = service['compareScheduleItems'](itemsA, itemsB);

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

            const differences = service['compareScheduleItems'](itemsA, itemsB);

            expect(differences).toHaveLength(3);
            expect(differences.find(d => d.product_id === 'product-123')?.type).toBe('MODIFIED');
            expect(differences.find(d => d.product_id === 'product-456')?.type).toBe('REMOVED');
            expect(differences.find(d => d.product_id === 'product-789')?.type).toBe('ADDED');
        });
    });

    describe('Helper Methods - calculateScheduleVersionDifferences', () => {
        it('should detect metadata differences', () => {
            const versionA = {
                contract_schedule_version_id: '1',
                contract_schedule_id: 'schedule-123',
                version_number: 1,
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Reason A',
                status: ContractScheduleVersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };
            const versionB = {
                contract_schedule_version_id: '2',
                contract_schedule_id: 'schedule-123',
                version_number: 2,
                proposed_by: ProposedBy.KIOSK,
                change_reason: 'Reason B',
                status: ContractScheduleVersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };

            const differences = service['calculateScheduleVersionDifferences'](versionA, versionB);

            expect(differences.metadata.proposed_by).toBeDefined();
            expect(differences.metadata.change_reason).toBeDefined();
        });

        it('should not detect metadata differences when same', () => {
            const versionA = {
                contract_schedule_version_id: '1',
                contract_schedule_id: 'schedule-123',
                version_number: 1,
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Same reason',
                status: ContractScheduleVersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };
            const versionB = {
                contract_schedule_version_id: '2',
                contract_schedule_id: 'schedule-123',
                version_number: 2,
                proposed_by: ProposedBy.BUSINESS,
                change_reason: 'Same reason',
                status: ContractScheduleVersionStatus.PROPOSED,
                items: [],
                created_at: new Date()
            };

            const differences = service['calculateScheduleVersionDifferences'](versionA, versionB);

            expect(differences.metadata.proposed_by).toBeUndefined();
            expect(differences.metadata.change_reason).toBeUndefined();
        });
    });
});