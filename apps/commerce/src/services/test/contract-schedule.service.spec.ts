import { Test, TestingModule } from '@nestjs/testing';
import { ContractScheduleService } from '../contract-schedule.service';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractItemRepository } from '../../repositories/impl/contract-item.repository';
import { ContractVersionRepository } from '../../repositories/impl/contract-version.repository';
import { ContractScheduleRepository } from '../../repositories/impl/contract-schedule.repository';
import { ContractScheduleVersionRepository } from '../../repositories/impl/contract-schedule-version.repository';
import { ContractScheduleItemRepository } from '../../repositories/impl/contract-schedule-item.repository';
import { Contract } from '../../entities/contract.entity';
import { ContractStatus } from '../../enums/contract-status.enum';
import { ContractScheduleStatus } from '../../enums/contract-schedule-status.enum';
import { ContractScheduleVersionStatus } from '../../enums/contract-schedule-version-status.enum';
import { ProposedBy } from '../../enums/proposed-by.enum';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { OrderService } from '../order.service';
import { Product } from '../../entities/product.entity';
import { ProductCategory } from '../../enums/product-category.enum';
import { UnitMeasure } from '../../enums/unit-measure.enum';

describe('ContractScheduleService', () => {
    let service: ContractScheduleService;
    let contractRepository: jest.Mocked<ContractRepository>;
    let contractItemRepository: jest.Mocked<ContractItemRepository>;
    let contractVersionRepository: jest.Mocked<ContractVersionRepository>;
    let contractScheduleRepository: jest.Mocked<ContractScheduleRepository>;
    let contractScheduleVersionRepository: jest.Mocked<ContractScheduleVersionRepository>;
    let contractScheduleItemRepository: jest.Mocked<ContractScheduleItemRepository>;
    let ordersService: jest.Mocked<OrderService>;

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

    const scheduled_delivery_date = new Date();
    scheduled_delivery_date.setDate(scheduled_delivery_date.getDate() + 1);

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
        proposed_by: ProposedBy.SYSTEM,
        change_reason: 'Initial schedule creation',
        status: ContractScheduleVersionStatus.AUTO_APPLIED,
        created_at: new Date(),
        updated_at: new Date(),
        contract_schedule: mockSchedule as any,
        items: [],
    };

    const mockScheduleItem = {
        contract_schedule_item_id: 'item-123',
        contract_schedule_version_id: 'version-123',
        product_id: 'product-123',
        quantity: 10,
        unit_price: 100.50,
        requirements_json: { color: 'red' },
        created_at: new Date(),
        updated_at: new Date(),
        contract_schedule_version: mockScheduleVersion as any,
    };

    const mockContractItem = {
        contract_item_id: 'contract-item-123',
        contract_id: 'contract-123',
        product_id: 'product-123',
        quantity: 10,
        unit_price: 100.50,
        requirements_json: { color: 'red' },
        created_at: new Date(),
        updated_at: new Date(),
        product: mockProduct as any,
        contract: mockContract as any,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContractScheduleService,
                {
                    provide: ContractRepository,
                    useValue: {
                        findActiveContracts: jest.fn(),
                        findById: jest.fn(),
                        findContractsExpiringSoon: jest.fn(),
                        findByStatus: jest.fn(),
                        updateStatus: jest.fn(),
                        findRenewalsByParent: jest.fn(),
                        createContract: jest.fn(),
                    },
                },
                {
                    provide: ContractItemRepository,
                    useValue: {
                        findByContractId: jest.fn(),
                        cloneItemsFromContract: jest.fn(),
                    },
                },
                {
                    provide: ContractVersionRepository,
                    useValue: {
                        create: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleRepository,
                    useValue: {
                        findByContractId: jest.fn(),
                        createMany: jest.fn(),
                        findById: jest.fn(),
                        findSchedulesForOrderGeneration: jest.fn(),
                        updateStatus: jest.fn(),
                        findSchedulesForDateRange: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleVersionRepository,
                    useValue: {
                        create: jest.fn(),
                        findAcceptedVersion: jest.fn(),
                        findByScheduleId: jest.fn(),
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
                    provide: OrderService,
                    useValue: {
                        createOrderWithItemsAndReserveStock: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ContractScheduleService>(ContractScheduleService);
        contractRepository = module.get(ContractRepository);
        contractItemRepository = module.get(ContractItemRepository);
        contractVersionRepository = module.get(ContractVersionRepository);
        contractScheduleRepository = module.get(ContractScheduleRepository);
        contractScheduleVersionRepository = module.get(ContractScheduleVersionRepository);
        contractScheduleItemRepository = module.get(ContractScheduleItemRepository);
        ordersService = module.get(OrderService);
    });

    describe('generateSchedulesForContract', () => {
        it('should generate new schedules for a contract', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([]);
            contractScheduleRepository.createMany.mockResolvedValue([mockSchedule]);
            contractScheduleVersionRepository.create.mockResolvedValue(mockScheduleVersion);
            contractScheduleItemRepository.createMany.mockResolvedValue([mockScheduleItem]);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.generateSchedulesForContract('contract-123');

            expect(result).toBe(1);
            expect(contractScheduleRepository.createMany).toHaveBeenCalled();
            expect(contractScheduleVersionRepository.create).toHaveBeenCalled();
            expect(contractScheduleItemRepository.createMany).toHaveBeenCalled();
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.generateSchedulesForContract('non-existent')).rejects.toThrow(RpcException);
            await expect(service.generateSchedulesForContract('non-existent')).rejects.toMatchObject({
                message: 'Contract not found: non-existent',
            });
        });

        it('should throw error when contract is not active', async () => {
            const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };
            contractRepository.findById.mockResolvedValue(inactiveContract);

            await expect(service.generateSchedulesForContract('contract-123')).rejects.toThrow(RpcException);
            await expect(service.generateSchedulesForContract('contract-123')).rejects.toMatchObject({
                message: 'Contract is not active: contract-123',
            });
        });

        it('should not create duplicate schedules', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);

            const requiredDates = service['calculateRequiredDates'](
                mockContract.start_date,
                mockContract.end_date,
                mockContract.frequency
            );

            if (requiredDates.length === 0) {
                return;
            }

            const existingSchedule = {
                ...mockSchedule,
                scheduled_delivery_date: requiredDates[0]
            };

            contractScheduleRepository.findByContractId.mockResolvedValue([existingSchedule]);

            let createdSchedules: any[] = [];
            contractScheduleRepository.createMany.mockImplementation((schedules) => {
                createdSchedules = schedules;
                return Promise.resolve([]);
            });

            await service.generateSchedulesForContract('contract-123');

            const existingDateStr = requiredDates[0].toISOString().split('T')[0];
            const hasExistingDate = createdSchedules.some(
                schedule => schedule.scheduled_delivery_date.toISOString().split('T')[0] === existingDateStr
            );
            expect(hasExistingDate).toBe(false);

            for (const schedule of createdSchedules) {
                const scheduleDateStr = schedule.scheduled_delivery_date.toISOString().split('T')[0];
                const isInRequiredDates = requiredDates.some(
                    date => date.toISOString().split('T')[0] === scheduleDateStr
                );
                expect(isInRequiredDates).toBe(true);
            }
        });
    });

    describe('generateSchedulesForAllContracts', () => {
        it('should generate schedules for all active contracts', async () => {
            contractRepository.findActiveContracts.mockResolvedValue([mockContract]);
            jest.spyOn(service, 'generateSchedulesForContract').mockResolvedValue(5);

            const result = await service.generateSchedulesForAllContracts();

            expect(result.contracts_processed).toBe(1);
            expect(result.schedules_created).toBe(5);
        });

        it('should handle errors for individual contracts', async () => {
            contractRepository.findActiveContracts.mockResolvedValue([mockContract]);
            jest.spyOn(service, 'generateSchedulesForContract').mockRejectedValue(new Error('Test error'));

            const result = await service.generateSchedulesForAllContracts();

            expect(result.contracts_processed).toBe(1);
            expect(result.schedules_created).toBe(0);
        });

        it('should handle empty active contracts list', async () => {
            contractRepository.findActiveContracts.mockResolvedValue([]);

            const result = await service.generateSchedulesForAllContracts();

            expect(result.contracts_processed).toBe(0);
            expect(result.schedules_created).toBe(0);
        });
    });

    describe('getItemsForSchedule', () => {
        it('should return accepted version items when available', async () => {
            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(mockScheduleVersion);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue([mockScheduleItem]);

            const result = await service.getItemsForSchedule('schedule-123');

            expect(result.source).toBe('schedule_version');
            expect(result.version_number).toBe(1);
            expect(result.items).toHaveLength(1);
        });

        it('should return auto-applied version when no accepted version', async () => {
            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(null);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([{
                ...mockScheduleVersion,
                status: ContractScheduleVersionStatus.AUTO_APPLIED
            }]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue([mockScheduleItem]);

            const result = await service.getItemsForSchedule('schedule-123');

            expect(result.source).toBe('schedule_version');
            expect(result.version_number).toBe(1);
        });

        it('should return contract items when no schedule versions exist', async () => {
            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(null);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([]);
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);

            const result = await service.getItemsForSchedule('schedule-123');

            expect(result.source).toBe('contract');
            expect(result.version_number).toBe(0);
            expect(result.items).toHaveLength(1);
        });

        it('should throw error when schedule not found', async () => {
            contractScheduleVersionRepository.findAcceptedVersion.mockResolvedValue(null);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([]);
            contractScheduleRepository.findById.mockResolvedValue(null);

            await expect(service.getItemsForSchedule('schedule-123')).rejects.toThrow('Schedule not found');
        });
    });

    describe('generateOrdersForUpcomingSchedules', () => {
        it('should generate orders for upcoming schedules', async () => {
            contractScheduleRepository.findSchedulesForOrderGeneration.mockResolvedValue([mockSchedule]);
            contractRepository.findById.mockResolvedValue(mockContract);
            jest.spyOn(service, 'generateOrderForSchedule').mockResolvedValue({
                success: true,
                schedule_id: 'schedule-123',
                order_id: 'order-123'
            });
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);

            const results = await service.generateOrdersForUpcomingSchedules();

            expect(results).toHaveLength(1);
            expect(results[0].success).toBe(true);
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalledWith(
                'schedule-123',
                ContractScheduleStatus.ORDER_GENERATED
            );
        });

        it('should skip when contract is not active', async () => {
            contractScheduleRepository.findSchedulesForOrderGeneration.mockResolvedValue([mockSchedule]);
            contractRepository.findById.mockResolvedValue({ ...mockContract, status: ContractStatus.DRAFT });
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);

            const results = await service.generateOrdersForUpcomingSchedules();

            expect(results[0].success).toBe(false);
            expect(results[0].error).toBe('Contract is not active');
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalledWith(
                'schedule-123',
                ContractScheduleStatus.CANCELLED
            );
        });

        it('should handle errors during order generation', async () => {
            contractScheduleRepository.findSchedulesForOrderGeneration.mockResolvedValue([mockSchedule]);
            contractRepository.findById.mockResolvedValue(mockContract);
            jest.spyOn(service, 'generateOrderForSchedule').mockRejectedValue(new Error('Order failed'));

            const results = await service.generateOrdersForUpcomingSchedules();

            expect(results[0].success).toBe(false);
            expect(results[0].error).toBe('Order failed');
        });

        it('should handle no schedules found', async () => {
            contractScheduleRepository.findSchedulesForOrderGeneration.mockResolvedValue([]);

            const results = await service.generateOrdersForUpcomingSchedules();

            expect(results).toHaveLength(0);
        });
    });

    describe('generateOrderForScheduleId', () => {
        it('should generate order for valid schedule', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            jest.spyOn(service, 'generateOrderForSchedule').mockResolvedValue({
                success: true,
                schedule_id: 'schedule-123',
                order_id: 'order-123'
            });

            const result = await service.generateOrderForScheduleId('schedule-123');

            expect(result.success).toBe(true);
            expect(result.order_id).toBe('order-123');
        });

        it('should return error when schedule not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(null);

            const result = await service.generateOrderForScheduleId('non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Schedule not found');
        });
    });

    describe('markSchedulesAsSkipped', () => {
        it('should mark schedules as skipped for date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');
            contractScheduleRepository.findSchedulesForDateRange.mockResolvedValue([mockSchedule]);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.markSchedulesAsSkipped('contract-123', startDate, endDate);

            expect(result).toBe(1);
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalledWith(
                'schedule-123',
                ContractScheduleStatus.SKIPPED
            );
        });

        it('should skip only SCHEDULED status schedules', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-31');
            const alreadyProcessedSchedule = {
                ...mockSchedule,
                status: ContractScheduleStatus.ORDER_GENERATED
            };
            contractScheduleRepository.findSchedulesForDateRange.mockResolvedValue([
                mockSchedule,
                alreadyProcessedSchedule
            ]);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.markSchedulesAsSkipped('contract-123', startDate, endDate);

            expect(result).toBe(1);
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalledTimes(1);
        });
    });

    describe('runFullGenerationProcess', () => {
        it('should run full generation process successfully', async () => {
            jest.spyOn(service, 'generateSchedulesForAllContracts').mockResolvedValue({
                contracts_processed: 5,
                schedules_created: 10
            });
            jest.spyOn(service, 'generateOrdersForUpcomingSchedules').mockResolvedValue([
                { success: true, schedule_id: '1', order_id: 'order-1' },
                { success: true, schedule_id: '2', order_id: 'order-2' },
                { success: false, schedule_id: '3', error: 'Failed' }
            ]);

            const result = await service.runFullGenerationProcess();

            expect(result.contracts_processed).toBe(5);
            expect(result.schedules_created).toBe(10);
            expect(result.orders_generated).toBe(2);
            expect(result.errors).toHaveLength(1);
        });
    });

    describe('Date Generation Methods', () => {
        describe('calculateRequiredDates', () => {
            const now = new Date();
            const startDate = new Date(now);
            startDate.setDate(startDate.getDate() + 1);
            const endDate = new Date(now);
            endDate.setMonth(endDate.getMonth() + 1);

            it('should generate daily dates', () => {
                const dates = service['calculateRequiredDates'](startDate, endDate, 'daily');
                expect(dates.length).toBeGreaterThan(0);
            });

            it('should generate weekly dates', () => {
                const dates = service['calculateRequiredDates'](startDate, endDate, 'weekly');
                expect(dates.length).toBeGreaterThan(0);
            });

            it('should generate biweekly dates', () => {
                const dates = service['calculateRequiredDates'](startDate, endDate, 'biweekly');
                expect(dates.length).toBeGreaterThan(0);
            });

            it('should generate monthly dates', () => {
                const dates = service['calculateRequiredDates'](startDate, endDate, 'monthly');
                expect(dates.length).toBeGreaterThan(0);
            });

            it('should generate custom frequency dates', () => {
                const dates = service['calculateRequiredDates'](startDate, endDate, 'MON,WED,FRI');
                expect(dates.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Renewal Operations', () => {
        const expiringContract = {
            ...mockContract,
            end_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        };

        describe('findExpiringContracts', () => {
            it('should return expiring contracts', async () => {
                contractRepository.findContractsExpiringSoon.mockResolvedValue([expiringContract]);

                const result = await service.findExpiringContracts(14);

                expect(result).toHaveLength(1);
                expect(result[0]).toHaveProperty('days_until_expiry');
            });
        });

        describe('processExpiringContracts', () => {
            it('should process expiring contracts', async () => {
                contractRepository.findContractsExpiringSoon.mockResolvedValue([expiringContract]);
                contractRepository.findByStatus.mockResolvedValue([]);
                jest.spyOn(service['logger'], 'log').mockImplementation();

                const result = await service.processExpiringContracts();

                expect(result).toBeDefined();
            });
        });

        describe('autoRenewContract', () => {
            it('should auto-renew eligible contract', async () => {
                const newContract = { ...mockContract, contract_id: 'new-contract' };
                contractRepository.findById
                    .mockResolvedValueOnce(mockContract)
                    .mockResolvedValueOnce(newContract);
                contractItemRepository.findByContractId.mockResolvedValue([mockContractItem]);
                contractRepository.createContract.mockResolvedValue(newContract);
                contractItemRepository.cloneItemsFromContract.mockResolvedValue(null as any);
                contractVersionRepository.create.mockResolvedValue(null as any);

                const result = await service.autoRenewContract('contract-123');

                expect(result.success).toBe(true);
                expect(result.status).toBe('RENEWED');
            });

            it('should return not eligible for draft contract', async () => {
                const draftContract = { ...mockContract, status: ContractStatus.DRAFT };
                contractRepository.findById.mockResolvedValue(draftContract);

                const result = await service.autoRenewContract('contract-123');

                expect(result.success).toBe(false);
                expect(result.status).toBe('NOT_ELIGIBLE');
            });
        });

        describe('renewMultipleContracts', () => {
            it('should renew multiple contracts', async () => {
                jest.spyOn(service, 'autoRenewContract')
                    .mockResolvedValueOnce({ success: true, parent_contract_id: '1', status: 'RENEWED' } as any)
                    .mockResolvedValueOnce({ success: true, parent_contract_id: '2', status: 'RENEWED' } as any);

                const results = await service.renewMultipleContracts(['1', '2']);

                expect(results).toHaveLength(2);
                expect(results[0].success).toBe(true);
            });
        });

        describe('renewAllExpiredContracts', () => {
            it('should renew all expired contracts', async () => {
                const expiredContracts = [
                    { ...mockContract, contract_id: 'expired-1', status: ContractStatus.EXPIRED }
                ];
                contractRepository.findByStatus.mockResolvedValue(expiredContracts);
                contractRepository.findRenewalsByParent.mockResolvedValue([]);
                jest.spyOn(service, 'renewMultipleContracts').mockResolvedValue([]);

                const result = await service.renewAllExpiredContracts();

                expect(result).toBeDefined();
            });
        });
    });

    describe('Helper Methods', () => {
        describe('calculateDaysUntilExpiry', () => {
            it('should calculate correct days', () => {
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 10);
                const days = service['calculateDaysUntilExpiry'](futureDate);
                expect(days).toBe(10);
            });
        });

        describe('shouldNotifyAtInterval', () => {
            it('should return true when days equals interval', () => {
                expect(service['shouldNotifyAtInterval'](14, 14)).toBe(true);
                expect(service['shouldNotifyAtInterval'](7, 7)).toBe(true);
            });

            it('should return false when days not equal interval', () => {
                expect(service['shouldNotifyAtInterval'](13, 14)).toBe(false);
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
            it('should return true for active contract expiring soon', () => {
                const nearEndDate = new Date();
                nearEndDate.setDate(nearEndDate.getDate() + 20);
                const contract = { ...mockContract, status: ContractStatus.ACTIVE, end_date: nearEndDate };
                expect(service['isEligibleForRenewal'](contract)).toBe(true);
            });

            it('should return false for active contract expiring far', () => {
                const farEndDate = new Date();
                farEndDate.setDate(farEndDate.getDate() + 40);
                const contract = { ...mockContract, status: ContractStatus.ACTIVE, end_date: farEndDate };
                expect(service['isEligibleForRenewal'](contract)).toBe(false);
            });

            it('should return true for expired contract', () => {
                const contract = { ...mockContract, status: ContractStatus.EXPIRED };
                expect(service['isEligibleForRenewal'](contract)).toBe(true);
            });
        });

        describe('calculateContractDuration', () => {
            it('should calculate duration in days', () => {
                const start = new Date('2024-01-01');
                const end = new Date('2024-01-31');
                const duration = service['calculateContractDuration'](start, end);
                expect(duration).toBe(30);
            });
        });
    });
});