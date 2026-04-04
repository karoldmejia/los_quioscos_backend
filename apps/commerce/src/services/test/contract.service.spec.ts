import { Test, TestingModule } from '@nestjs/testing';
import { ContractService } from '../contract.service';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractItemRepository } from '../../repositories/impl/contract-item.repository';
import { ContractVersionRepository } from '../../repositories/impl/contract-version.repository';
import { Contract } from '../../entities/contract.entity';
import { ContractStatus } from '../../enums/contract-status.enum';
import { ContractItem } from '../../entities/contract-item.entity';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { Product } from '../../entities/product.entity';
import { ProductCategory } from '../../enums/product-category.enum';
import { UnitMeasure } from '../../enums/unit-measure.enum';

describe('ContractService', () => {
    let service: ContractService;
    let contractRepository: jest.Mocked<ContractRepository>;
    let contractItemRepository: jest.Mocked<ContractItemRepository>;
    let contractVersionRepository: jest.Mocked<ContractVersionRepository>;

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

    const now = new Date();
    const start_date = new Date(now);
    start_date.setDate(start_date.getDate() + 1);
    const end_date = new Date(now);
    end_date.setMonth(end_date.getMonth() + 1);

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
        parent_contract_id: null as any,
        created_at: new Date(),
        updated_at: new Date(),
        parent_contract: null,
        child_contracts: [],
        contractItems: [],
        versions: [],
        schedules: [],
    };

    const mockActiveContract: Contract = {
        ...mockContract,
        status: ContractStatus.ACTIVE,
        contract_id: 'active-contract-123'
    };

    const mockContractItem: ContractItem = {
        contract_item_id: 'item-123',
        contract_id: 'contract-123',
        product_id: 'product-123',
        quantity: 10,
        unit_price: 100.50,
        requirements_json: { color: 'red' },
        product: mockProduct,
        contract: mockContract as any,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContractService,
                {
                    provide: ContractRepository,
                    useValue: {
                        createContract: jest.fn(),
                        findById: jest.fn(),
                        findContractsByBusiness: jest.fn(),
                        findContractsByKiosk: jest.fn(),
                        findByStatus: jest.fn(),
                        findActiveContracts: jest.fn(),
                        updateContract: jest.fn(),
                        updateStatus: jest.fn(),
                        findContractsExpiringSoon: jest.fn(),
                        findRenewalsByParent: jest.fn(),
                    },
                },
                {
                    provide: ContractItemRepository,
                    useValue: {
                        findByContractId: jest.fn(),
                        createMany: jest.fn(),
                        cloneItemsFromContract: jest.fn(),
                    },
                },
                {
                    provide: ContractVersionRepository,
                    useValue: {
                        create: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ContractService>(ContractService);
        contractRepository = module.get(ContractRepository);
        contractItemRepository = module.get(ContractItemRepository);
        contractVersionRepository = module.get(ContractVersionRepository);
    });

    describe('createContract', () => {
        const createContractDto = {
            business_id: 'business-123',
            kiosk_id: 'kiosk-123',
            transporter_id: 'transporter-123',
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
                    requirements_json: { color: 'red' },
                },
            ],
        };

        it('should create a contract successfully', async () => {
            contractRepository.createContract.mockResolvedValue(mockContract);
            contractItemRepository.createMany.mockResolvedValue([mockContractItem]);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.createContract(createContractDto);

            expect(contractRepository.createContract).toHaveBeenCalledWith({
                business_id: createContractDto.business_id,
                kiosk_id: createContractDto.kiosk_id,
                transporter_id: createContractDto.transporter_id,
                start_date: createContractDto.start_date,
                end_date: createContractDto.end_date,
                frequency: createContractDto.frequency,
                change_deadline_days: createContractDto.change_deadline_days,
                cancellation_deadline_days: createContractDto.cancellation_deadline_days,
                logistics_mode: createContractDto.logistics_mode,
            });
            expect(result).toHaveProperty('contract_id', 'contract-123');
            expect(result).toHaveProperty('items');
            expect(result.items).toHaveLength(1);
        });

        it('should throw error when start date is after end date', async () => {
            const invalidDto = {
                ...createContractDto,
                start_date: new Date('2025-12-31'),
                end_date: new Date('2025-01-01'),
            };

            await expect(service.createContract(invalidDto)).rejects.toThrow(RpcException);
            await expect(service.createContract(invalidDto)).rejects.toMatchObject({
                message: 'Contract has invalid dates: start date must be before end date',
            });
        });

        it('should throw error when start date is in the past', async () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const invalidDto = {
                ...createContractDto,
                start_date: yesterday,
                end_date: new Date(),
            };

            await expect(service.createContract(invalidDto)).rejects.toThrow(RpcException);
            await expect(service.createContract(invalidDto)).rejects.toMatchObject({
                message: 'Start date cannot be in the past',
            });
        });

        it('should throw error when no items are provided', async () => {
            const invalidDto = {
                ...createContractDto,
                items: [],
            };

            await expect(service.createContract(invalidDto)).rejects.toThrow(RpcException);
            await expect(service.createContract(invalidDto)).rejects.toMatchObject({
                message: 'Contract must have at least one item',
            });
        });
    });

    describe('getContract', () => {
        it('should return contract when found', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getContract('contract-123');

            expect(result).toHaveProperty('contract_id', 'contract-123');
            expect(result.items[0]).toHaveProperty('product_name', 'Test Product');
            expect(contractRepository.findById).toHaveBeenCalledWith('contract-123');
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.getContract('non-existent')).rejects.toThrow(RpcException);
            await expect(service.getContract('non-existent')).rejects.toMatchObject({
                message: 'Contract not found: non-existent',
            });
        });
    });

    describe('getContracts', () => {
        const filterDto = {};

        it('should return all active contracts when no filters', async () => {
            contractRepository.findActiveContracts.mockResolvedValue([mockContract]);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getContracts(filterDto);

            expect(contractRepository.findActiveContracts).toHaveBeenCalled();
            expect(result).toHaveLength(1);
        });

        it('should filter by business_id', async () => {
            const filterWithBusiness = { business_id: 'business-123' };
            contractRepository.findContractsByBusiness.mockResolvedValue([mockContract]);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getContracts(filterWithBusiness);

            expect(contractRepository.findContractsByBusiness).toHaveBeenCalledWith('business-123');
            expect(result).toHaveLength(1);
        });

        it('should filter by kiosk_id', async () => {
            const filterWithKiosk = { kiosk_id: 'kiosk-123' };
            contractRepository.findContractsByKiosk.mockResolvedValue([mockContract]);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getContracts(filterWithKiosk);

            expect(contractRepository.findContractsByKiosk).toHaveBeenCalledWith('kiosk-123');
            expect(result).toHaveLength(1);
        });

        it('should filter by status', async () => {
            const filterWithStatus = { status: ContractStatus.DRAFT };
            contractRepository.findByStatus.mockResolvedValue([mockContract]);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getContracts(filterWithStatus);

            expect(contractRepository.findByStatus).toHaveBeenCalledWith(ContractStatus.DRAFT);
            expect(result).toHaveLength(1);
        });

        it('should filter by date ranges', async () => {
            const filterWithDates = {
                start_date_from: new Date(now),
                start_date_to: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
                end_date_from: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
                end_date_to: new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000),
            };

            contractRepository.findActiveContracts.mockResolvedValue([mockContract]);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getContracts(filterWithDates);

            expect(result).toHaveLength(1);
        });

        it('should return empty array when no contracts match filters', async () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const filterWithDates = {
                start_date_from: futureDate,
            };

            contractRepository.findActiveContracts.mockResolvedValue([mockContract]);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getContracts(filterWithDates);

            expect(result).toHaveLength(0);
        });
    });

    describe('activateContract', () => {
        const activateDto = { transporter_id: 'new-transporter-123' };

        it('should activate a draft contract successfully', async () => {
            const draftContract = { ...mockContract, status: ContractStatus.DRAFT };
            contractRepository.findById.mockResolvedValueOnce(draftContract);
            contractRepository.findById.mockResolvedValueOnce({ ...draftContract, status: ContractStatus.ACTIVE });
            contractRepository.updateStatus.mockResolvedValue(undefined);
            contractRepository.updateContract.mockResolvedValue(undefined);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.activateContract('contract-123', activateDto);

            expect(contractRepository.updateStatus).toHaveBeenCalledWith('contract-123', ContractStatus.ACTIVE);
            expect(contractRepository.updateContract).toHaveBeenCalledWith('contract-123', {
                transporter_id: activateDto.transporter_id,
            });
            expect(result.status).toBe(ContractStatus.ACTIVE);
        });

        it('should activate a negotiation contract successfully', async () => {
            const negotiationContract = { ...mockContract, status: ContractStatus.NEGOTIATION };
            contractRepository.findById.mockResolvedValueOnce(negotiationContract);
            contractRepository.findById.mockResolvedValueOnce({ ...negotiationContract, status: ContractStatus.ACTIVE });
            contractRepository.updateStatus.mockResolvedValue(undefined);
            contractRepository.updateContract.mockResolvedValue(undefined);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.activateContract('contract-123', {});

            expect(result.status).toBe(ContractStatus.ACTIVE);
        });

        it('should activate without updating transporter when not provided', async () => {
            const draftContract = { ...mockContract, status: ContractStatus.DRAFT };
            const emptyActivateDto = {};

            contractRepository.findById.mockResolvedValueOnce(draftContract);
            contractRepository.findById.mockResolvedValueOnce({ ...draftContract, status: ContractStatus.ACTIVE });
            contractRepository.updateStatus.mockResolvedValue(undefined);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            await service.activateContract('contract-123', emptyActivateDto);

            expect(contractRepository.updateContract).not.toHaveBeenCalled();
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.activateContract('non-existent', activateDto)).rejects.toThrow(RpcException);
            await expect(service.activateContract('non-existent', activateDto)).rejects.toMatchObject({
                message: 'Contract not found: non-existent',
            });
        });

        it('should throw error when contract is not in valid status', async () => {
            const activeContract = { ...mockContract, status: ContractStatus.ACTIVE };
            contractRepository.findById.mockResolvedValue(activeContract);

            await expect(service.activateContract('contract-123', activateDto)).rejects.toThrow(RpcException);
            await expect(service.activateContract('contract-123', activateDto)).rejects.toMatchObject({
                message: 'Contract is not in a valid status for activation',
            });
        });

        it('should throw error when contract has already ended', async () => {
            const pastEndDate = new Date();
            pastEndDate.setDate(pastEndDate.getDate() - 1);

            const expiredContract = {
                ...mockContract,
                status: ContractStatus.DRAFT,
                start_date: new Date('2024-01-01'),
                end_date: pastEndDate,
            };

            contractRepository.findById.mockResolvedValue(expiredContract);

            await expect(service.activateContract('contract-123', activateDto)).rejects.toThrow(RpcException);
            await expect(service.activateContract('contract-123', activateDto)).rejects.toMatchObject({
                message: 'Cannot activate contract that has already ended',
            });
        });
    });

    describe('expireContracts', () => {
        it('should expire contracts that have passed end date', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const expiredContract = {
                ...mockContract,
                contract_id: 'contract-1',
                end_date: pastDate
            };

            const activeContract = {
                ...mockContract,
                contract_id: 'contract-2',
                end_date: futureDate
            };
            contractRepository.findActiveContracts.mockResolvedValue([expiredContract, activeContract]);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.expireContracts();

            expect(result).toBe(1);
            expect(contractRepository.updateStatus).toHaveBeenCalledWith(expiredContract.contract_id, ContractStatus.EXPIRED);
            expect(contractRepository.updateStatus).not.toHaveBeenCalledWith(activeContract.contract_id, ContractStatus.EXPIRED);
        });

        it('should return 0 when no contracts are expired', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const activeContract = { ...mockContract, end_date: futureDate };
            contractRepository.findActiveContracts.mockResolvedValue([activeContract]);

            const result = await service.expireContracts();

            expect(result).toBe(0);
            expect(contractRepository.updateStatus).not.toHaveBeenCalled();
        });

        it('should handle empty contracts list', async () => {
            contractRepository.findActiveContracts.mockResolvedValue([]);

            const result = await service.expireContracts();

            expect(result).toBe(0);
            expect(contractRepository.updateStatus).not.toHaveBeenCalled();
        });
    });

    describe('expireContract', () => {
        it('should expire an active contract with past end date', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const activeContract = { ...mockContract, status: ContractStatus.ACTIVE, end_date: pastDate };
            const updatedContract = { ...activeContract, status: ContractStatus.EXPIRED };

            contractRepository.findById.mockResolvedValueOnce(activeContract);
            contractRepository.findById.mockResolvedValueOnce(updatedContract);
            contractRepository.updateStatus.mockResolvedValue(undefined);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.expireContract('contract-123');

            expect(contractRepository.updateStatus).toHaveBeenCalledWith('contract-123', ContractStatus.EXPIRED);
            expect(result.status).toBe(ContractStatus.EXPIRED);
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.expireContract('non-existent')).rejects.toThrow(RpcException);
            await expect(service.expireContract('non-existent')).rejects.toMatchObject({
                message: 'Contract not found: non-existent',
            });
        });

        it('should throw error when contract is not active', async () => {
            const draftContract = { ...mockContract, status: ContractStatus.DRAFT };
            contractRepository.findById.mockResolvedValue(draftContract);

            await expect(service.expireContract('contract-123')).rejects.toThrow(RpcException);
            await expect(service.expireContract('contract-123')).rejects.toMatchObject({
                message: 'Contract is not active: contract-123',
            });
        });

        it('should throw error when end date is not in the past', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const activeContract = { ...mockContract, status: ContractStatus.ACTIVE, end_date: futureDate };
            contractRepository.findById.mockResolvedValue(activeContract);

            await expect(service.expireContract('contract-123')).rejects.toThrow(RpcException);
            await expect(service.expireContract('contract-123')).rejects.toMatchObject({
                message: expect.stringContaining('Cannot expire contract'),
            });
        });
    });

    describe('Renewal Operations', () => {
        const expiringContract = {
            ...mockActiveContract,
            contract_id: 'expiring-123',
            end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        };

        describe('findExpiringContracts', () => {
            it('should return contracts expiring within specified days', async () => {
                contractRepository.findContractsExpiringSoon.mockResolvedValue([expiringContract]);

                const result = await service.findExpiringContracts(14);

                expect(contractRepository.findContractsExpiringSoon).toHaveBeenCalledWith(14);
                expect(result).toHaveLength(1);
                expect(result[0]).toHaveProperty('contract_id', expiringContract.contract_id);
                expect(result[0]).toHaveProperty('days_until_expiry');
            });

            it('should return empty array when no contracts expiring', async () => {
                contractRepository.findContractsExpiringSoon.mockResolvedValue([]);

                const result = await service.findExpiringContracts(14);

                expect(result).toHaveLength(0);
            });

            it('should use default 14 days when parameter not provided', async () => {
                contractRepository.findContractsExpiringSoon.mockResolvedValue([]);

                await service.findExpiringContracts();

                expect(contractRepository.findContractsExpiringSoon).toHaveBeenCalledWith(14);
            });
        });

        describe('processExpiringContracts', () => {
            it('should process notifications for expiring contracts at different intervals', async () => {
                const mockLogger = jest.spyOn(service['logger'], 'log').mockImplementation();

                const contract14Days = {
                    ...mockActiveContract,
                    contract_id: 'contract-14',
                    end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                };
                const contract7Days = {
                    ...mockActiveContract,
                    contract_id: 'contract-7',
                    end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                };
                const contract3Days = {
                    ...mockActiveContract,
                    contract_id: 'contract-3',
                    end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                };
                const contract1Day = {
                    ...mockActiveContract,
                    contract_id: 'contract-1',
                    end_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
                };

                contractRepository.findContractsExpiringSoon
                    .mockResolvedValueOnce([contract14Days])
                    .mockResolvedValueOnce([contract7Days])
                    .mockResolvedValueOnce([contract3Days])
                    .mockResolvedValueOnce([contract1Day]);

                contractRepository.findByStatus.mockResolvedValue([]);

                const result = await service.processExpiringContracts();

                expect(result).toHaveLength(4);
                expect(result[0].notification_type).toBe('TWO_WEEKS');
                expect(result[1].notification_type).toBe('ONE_WEEK');
                expect(result[2].notification_type).toBe('THREE_DAYS');
                expect(result[3].notification_type).toBe('ONE_DAY');

                mockLogger.mockRestore();
            });

            it('should check for expired contracts after processing notifications', async () => {
                const expiredContract = {
                    ...mockActiveContract,
                    contract_id: 'expired-contract',
                    end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
                };

                contractRepository.findContractsExpiringSoon.mockResolvedValue([]);
                contractRepository.findByStatus.mockResolvedValue([expiredContract]);
                contractRepository.updateStatus.mockResolvedValue(undefined);

                await service.processExpiringContracts();

                expect(contractRepository.updateStatus).toHaveBeenCalledWith(
                    expiredContract.contract_id,
                    ContractStatus.EXPIRED
                );
            });

            it('should handle no expiring contracts', async () => {
                contractRepository.findContractsExpiringSoon.mockResolvedValue([]);
                contractRepository.findByStatus.mockResolvedValue([]);

                const result = await service.processExpiringContracts();

                expect(result).toHaveLength(0);
            });
        });

        describe('autoRenewContract', () => {
            const originalContract = { ...mockActiveContract };
            const newContract = { ...mockContract, contract_id: 'new-contract-456', status: ContractStatus.DRAFT };

            beforeEach(() => {
                jest.clearAllMocks();
            });

            it('should successfully auto-renew an active contract', async () => {
                contractRepository.findById
                    .mockResolvedValueOnce(originalContract)
                    .mockResolvedValueOnce(newContract);
                contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);
                contractRepository.createContract.mockResolvedValue(newContract);
                contractItemRepository.cloneItemsFromContract.mockResolvedValue(null as any);
                contractVersionRepository.create.mockResolvedValue(null as any);

                const result = await service.autoRenewContract('active-contract-123');

                expect(result.success).toBe(true);
                expect(result.new_contract_id).toBe('new-contract-456');
                expect(result.status).toBe('RENEWED');
                expect(contractRepository.createContract).toHaveBeenCalled();
                expect(contractItemRepository.cloneItemsFromContract).toHaveBeenCalled();
                expect(contractVersionRepository.create).toHaveBeenCalled();
            });

            it('should return not eligible when contract is not active or expired', async () => {
                const draftContract = { ...mockContract, status: ContractStatus.DRAFT };
                contractRepository.findById.mockResolvedValue(draftContract);

                const result = await service.autoRenewContract('contract-123');

                expect(result.success).toBe(false);
                expect(result.status).toBe('NOT_ELIGIBLE');
                expect(result.message).toBe('Contract is not eligible for renewal');
                expect(contractRepository.createContract).not.toHaveBeenCalled();
            });

            it('should return not eligible when active contract expires in more than 30 days', async () => {
                const farEndDate = new Date();
                farEndDate.setDate(farEndDate.getDate() + 40);
                const longContract = { ...originalContract, end_date: farEndDate };
                contractRepository.findById.mockResolvedValue(longContract);

                const result = await service.autoRenewContract('active-contract-123');

                expect(result.success).toBe(false);
                expect(result.status).toBe('NOT_ELIGIBLE');
            });

            it('should handle contract not found', async () => {
                contractRepository.findById.mockResolvedValue(null);

                const result = await service.autoRenewContract('non-existent');

                expect(result.success).toBe(false);
                expect(result.status).toBe('FAILED');
                expect(result.error).toBeDefined();
            });

            it('should handle errors during renewal process', async () => {
                contractRepository.findById.mockResolvedValue(originalContract);
                contractRepository.createContract.mockRejectedValue(new Error('Database error'));

                const result = await service.autoRenewContract('active-contract-123');

                expect(result.success).toBe(false);
                expect(result.status).toBe('FAILED');
                expect(result.error).toBe('Database error');
            });

            it('should calculate new dates correctly for renewal', async () => {
                const originalStart = new Date('2024-01-01');
                const originalEnd = new Date('2024-01-31');
                const contractWithDates = {
                    ...originalContract,
                    start_date: originalStart,
                    end_date: originalEnd
                };

                const newContractWithDates = {
                    ...newContract,
                    start_date: new Date('2024-02-01'),
                    end_date: new Date('2024-03-02')
                };

                contractRepository.findById
                    .mockResolvedValueOnce(contractWithDates)
                    .mockResolvedValueOnce(newContractWithDates);
                contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);
                contractRepository.createContract.mockResolvedValue(newContractWithDates);
                contractItemRepository.cloneItemsFromContract.mockResolvedValue(null as any);
                contractVersionRepository.create.mockResolvedValue(null as any);

                await service.autoRenewContract('active-contract-123');

                const expectedStartDate = new Date('2024-02-01');
                const expectedEndDate = new Date('2024-03-02');

                expect(contractRepository.createContract).toHaveBeenCalledWith(
                    expect.objectContaining({
                        start_date: expectedStartDate,
                        end_date: expectedEndDate
                    })
                );
            });
        });

        describe('renewMultipleContracts', () => {
            it('should renew multiple contracts successfully', async () => {
                const contractIds = ['contract-1', 'contract-2'];
                const mockResults = [
                    { success: true, parent_contract_id: 'contract-1', new_contract_id: 'new-1', status: 'RENEWED' },
                    { success: true, parent_contract_id: 'contract-2', new_contract_id: 'new-2', status: 'RENEWED' }
                ];

                jest.spyOn(service, 'autoRenewContract')
                    .mockResolvedValueOnce(mockResults[0] as any)
                    .mockResolvedValueOnce(mockResults[1] as any);

                const results = await service.renewMultipleContracts(contractIds);

                expect(results).toHaveLength(2);
                expect(results[0].success).toBe(true);
                expect(results[1].success).toBe(true);
                expect(service.autoRenewContract).toHaveBeenCalledTimes(2);
            });

            it('should handle partial failures when renewing multiple contracts', async () => {
                const contractIds = ['contract-1', 'contract-2', 'contract-3'];

                jest.spyOn(service, 'autoRenewContract')
                    .mockResolvedValueOnce({ success: true, parent_contract_id: 'contract-1', new_contract_id: 'new-1', status: 'RENEWED' } as any)
                    .mockResolvedValueOnce({ success: false, parent_contract_id: 'contract-2', status: 'FAILED', error: 'Error' } as any)
                    .mockResolvedValueOnce({ success: true, parent_contract_id: 'contract-3', new_contract_id: 'new-3', status: 'RENEWED' } as any);

                const results = await service.renewMultipleContracts(contractIds);

                expect(results).toHaveLength(3);
                expect(results[0].success).toBe(true);
                expect(results[1].success).toBe(false);
                expect(results[2].success).toBe(true);
            });

            it('should handle empty contract list', async () => {
                const results = await service.renewMultipleContracts([]);

                expect(results).toHaveLength(0);
            });
        });

        describe('renewAllExpiredContracts', () => {
            it('should renew all expired contracts without existing renewals', async () => {
                const expiredContracts = [
                    { ...mockContract, contract_id: 'expired-1', status: ContractStatus.EXPIRED },
                    { ...mockContract, contract_id: 'expired-2', status: ContractStatus.EXPIRED }
                ];

                contractRepository.findByStatus.mockResolvedValue(expiredContracts);
                contractRepository.findRenewalsByParent
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce([]);

                jest.spyOn(service, 'renewMultipleContracts').mockResolvedValue([
                    { success: true, parent_contract_id: 'expired-1', new_contract_id: 'new-1', status: 'RENEWED' },
                    { success: true, parent_contract_id: 'expired-2', new_contract_id: 'new-2', status: 'RENEWED' }
                ] as any);

                const results = await service.renewAllExpiredContracts();

                expect(results).toHaveLength(2);
                expect(contractRepository.findByStatus).toHaveBeenCalledWith(ContractStatus.EXPIRED);
                expect(service.renewMultipleContracts).toHaveBeenCalledWith(['expired-1', 'expired-2']);
            });

            it('should skip contracts that already have existing renewals', async () => {
                const expiredContracts = [
                    { ...mockContract, contract_id: 'expired-1', status: ContractStatus.EXPIRED },
                    { ...mockContract, contract_id: 'expired-2', status: ContractStatus.EXPIRED }
                ];

                contractRepository.findByStatus.mockResolvedValue(expiredContracts);
                contractRepository.findRenewalsByParent
                    .mockResolvedValueOnce([{ ...mockContract, status: ContractStatus.DRAFT }])
                    .mockResolvedValueOnce([]);

                jest.spyOn(service, 'renewMultipleContracts').mockResolvedValue([
                    { success: true, parent_contract_id: 'expired-2', new_contract_id: 'new-2', status: 'RENEWED' }
                ] as any);

                const results = await service.renewAllExpiredContracts();

                expect(results).toHaveLength(1);
                expect(service.renewMultipleContracts).toHaveBeenCalledWith(['expired-2']);
            });

            it('should handle no expired contracts', async () => {
                contractRepository.findByStatus.mockResolvedValue([]);

                jest.spyOn(service, 'renewMultipleContracts').mockResolvedValue([]);

                const results = await service.renewAllExpiredContracts();

                expect(results).toHaveLength(0);
                expect(service.renewMultipleContracts).toHaveBeenCalledWith([]);
            });
        });
    });

    describe('Helper Methods', () => {
        describe('mapToResponseDto', () => {
            it('should calculate total value correctly', async () => {
                const multipleItems: ContractItem[] = [
                    {
                        ...mockContractItem,
                        quantity: 10,
                        unit_price: 100.50,
                        product: mockProduct
                    },
                    {
                        ...mockContractItem,
                        contract_item_id: 'item-456',
                        quantity: 5,
                        unit_price: 50.25,
                        product: mockProduct
                    },
                ];

                contractRepository.findById.mockResolvedValue(mockContract);
                contractItemRepository.findByContractId.mockResolvedValue(multipleItems);

                const result = await service.getContract('contract-123');

                const expectedTotal = (10 * 100.50) + (5 * 50.25);
                expect(result.total_value).toBe(expectedTotal);
            });

            it('should handle items without product relation', async () => {
                const itemWithoutProduct = {
                    ...mockContractItem,
                    product: null as any,
                };

                contractRepository.findById.mockResolvedValue(mockContract);
                contractItemRepository.findByContractId.mockResolvedValue([itemWithoutProduct]);

                const result = await service.getContract('contract-123');

                expect(result.items[0].product_name).toBeUndefined();
            });
        });

        describe('calculateDaysUntilExpiry', () => {
            it('should calculate correct days until expiry', () => {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 10);

                const days = service['calculateDaysUntilExpiry'](futureDate);

                expect(days).toBe(10);
            });

            it('should return 0 for today\'s date', () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const days = service['calculateDaysUntilExpiry'](today);

                expect(days).toBe(0);
            });

            it('should return negative for past dates', () => {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - 5);

                const days = service['calculateDaysUntilExpiry'](pastDate);

                expect(days).toBe(-5);
            });
        });

        describe('shouldNotifyAtInterval', () => {
            it('should return true when days until expiry equals interval', () => {
                expect(service['shouldNotifyAtInterval'](14, 14)).toBe(true);
                expect(service['shouldNotifyAtInterval'](7, 7)).toBe(true);
                expect(service['shouldNotifyAtInterval'](3, 3)).toBe(true);
                expect(service['shouldNotifyAtInterval'](1, 1)).toBe(true);
            });

            it('should return false when days until expiry does not equal interval', () => {
                expect(service['shouldNotifyAtInterval'](13, 14)).toBe(false);
                expect(service['shouldNotifyAtInterval'](8, 7)).toBe(false);
                expect(service['shouldNotifyAtInterval'](4, 3)).toBe(false);
                expect(service['shouldNotifyAtInterval'](2, 1)).toBe(false);
            });
        });

        describe('getNotificationType', () => {
            it('should return correct notification types', () => {
                expect(service['getNotificationType'](14)).toBe('TWO_WEEKS');
                expect(service['getNotificationType'](7)).toBe('ONE_WEEK');
                expect(service['getNotificationType'](3)).toBe('THREE_DAYS');
                expect(service['getNotificationType'](1)).toBe('ONE_DAY');
                expect(service['getNotificationType'](0)).toBe('EXPIRED');
                expect(service['getNotificationType'](10)).toBe('GENERAL');
            });
        });

        describe('isEligibleForRenewal', () => {
            it('should return true for active contract expiring within 30 days', () => {
                const nearEndDate = new Date();
                nearEndDate.setDate(nearEndDate.getDate() + 20);
                const contract = { ...mockActiveContract, end_date: nearEndDate };

                expect(service['isEligibleForRenewal'](contract)).toBe(true);
            });

            it('should return false for active contract expiring beyond 30 days', () => {
                const farEndDate = new Date();
                farEndDate.setDate(farEndDate.getDate() + 40);
                const contract = { ...mockActiveContract, end_date: farEndDate };

                expect(service['isEligibleForRenewal'](contract)).toBe(false);
            });

            it('should return true for expired contract', () => {
                const expiredContract = { ...mockContract, status: ContractStatus.EXPIRED };

                expect(service['isEligibleForRenewal'](expiredContract)).toBe(true);
            });

            it('should return false for draft contract', () => {
                const draftContract = { ...mockContract, status: ContractStatus.DRAFT };

                expect(service['isEligibleForRenewal'](draftContract)).toBe(false);
            });
        });

        describe('calculateContractDuration', () => {
            it('should calculate correct duration in days', () => {
                const start = new Date('2024-01-01');
                const end = new Date('2024-01-31');

                const duration = service['calculateContractDuration'](start, end);

                expect(duration).toBe(30);
            });

            it('should handle same day duration', () => {
                const start = new Date('2024-01-01');
                const end = new Date('2024-01-01');

                const duration = service['calculateContractDuration'](start, end);

                expect(duration).toBe(0);
            });
        });

        describe('hasExistingRenewal', () => {
            it('should return true when active renewal exists', async () => {
                const renewals = [
                    { ...mockContract, status: ContractStatus.DRAFT },
                    { ...mockContract, status: ContractStatus.ACTIVE }
                ];
                contractRepository.findRenewalsByParent.mockResolvedValue(renewals);

                const result = await service['hasExistingRenewal']('contract-123');

                expect(result).toBe(true);
            });

            it('should return false when only expired renewals exist', async () => {
                const renewals = [
                    { ...mockContract, status: ContractStatus.EXPIRED }
                ];
                contractRepository.findRenewalsByParent.mockResolvedValue(renewals);

                const result = await service['hasExistingRenewal']('contract-123');

                expect(result).toBe(false);
            });

            it('should return false when no renewals exist', async () => {
                contractRepository.findRenewalsByParent.mockResolvedValue([]);

                const result = await service['hasExistingRenewal']('contract-123');

                expect(result).toBe(false);
            });
        });
    });
});