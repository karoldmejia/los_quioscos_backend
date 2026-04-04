import { Test, TestingModule } from '@nestjs/testing';
import { PenaltyService } from '../penalty.service';
import { RpcException } from '@nestjs/microservices';
import { ContractScheduleRepository } from '../../repositories/impl/contract-schedule.repository';
import { ContractScheduleItemRepository } from '../../repositories/impl/contract-schedule-item.repository';
import { ContractScheduleVersionRepository } from '../../repositories/impl/contract-schedule-version.repository';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractScheduleStatus } from '../../enums/contract-schedule-status.enum';
import { PenaltyType } from '../../enums/penalty-type.enum';
import { ContractStatus } from '../../enums/contract-status.enum';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { Contract } from 'src/entities/contract.entity';
import { ProposedBy } from 'src/enums/proposed-by.enum';
import { ContractScheduleVersionStatus } from 'src/enums/contract-schedule-version-status.enum';

describe('PenaltyService', () => {
    let service: PenaltyService;
    let contractScheduleRepository: jest.Mocked<ContractScheduleRepository>;
    let contractScheduleItemRepository: jest.Mocked<ContractScheduleItemRepository>;
    let contractScheduleVersionRepository: jest.Mocked<ContractScheduleVersionRepository>;
    let contractRepository: jest.Mocked<ContractRepository>;

    const now = new Date();
    const scheduled_delivery_date = new Date(now);
    scheduled_delivery_date.setDate(scheduled_delivery_date.getDate() + 7);

    const mockContract: Contract = {
        contract_id: 'contract-123',
        business_id: 'business-123',
        kiosk_id: 'kiosk-123',
        transporter_id: 'transporter-123',
        status: ContractStatus.DRAFT,
        start_date: new Date(),
        end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
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

    const mockSchedule = {
        contract_schedule_id: 'schedule-123',
        contract_id: 'contract-123',
        scheduled_delivery_date: scheduled_delivery_date,
        status: ContractScheduleStatus.SCHEDULED,
        created_at: new Date(),
        updated_at: new Date(),
        contract: mockContract as any,
        versions: []
    };

    const mockOrderGeneratedSchedule = {
        ...mockSchedule,
        status: ContractScheduleStatus.ORDER_GENERATED,
    };

    const mockScheduleVersion = {
        contract_schedule_version_id: 'version-123',
        contract_schedule_id: 'schedule-123',
        version_number: 1,
        status: ContractScheduleVersionStatus.AUTO_APPLIED,
        proposed_by: ProposedBy.BUSINESS,
        change_reason: 'Initial version',
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
            contract_schedule_version: mockScheduleVersion as any,

        },
        {
            contract_schedule_item_id: 'item-456',
            contract_schedule_version_id: 'version-123',
            product_id: 'product-456',
            quantity: 5,
            unit_price: 50.25,
            requirements_json: { size: 'large' },
            contract_schedule_version: mockScheduleVersion as any,

        },
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PenaltyService,
                {
                    provide: ContractScheduleRepository,
                    useValue: {
                        findById: jest.fn(),
                        findByContractId: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleItemRepository,
                    useValue: {
                        findByVersionId: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleVersionRepository,
                    useValue: {
                        findByScheduleId: jest.fn(),
                    },
                },
                {
                    provide: ContractRepository,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<PenaltyService>(PenaltyService);
        contractScheduleRepository = module.get(ContractScheduleRepository);
        contractScheduleItemRepository = module.get(ContractScheduleItemRepository);
        contractScheduleVersionRepository = module.get(ContractScheduleVersionRepository);
        contractRepository = module.get(ContractRepository);
    });

    describe('calculateScheduleCancellationPenalty', () => {
        const scheduleId = 'schedule-123';

        it('should return no penalty when cancellation is within deadline and schedule is SCHEDULED', async () => {
            const withinDeadlineDate = new Date();
            withinDeadlineDate.setDate(withinDeadlineDate.getDate() - 1);

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);

            const result = await service.calculateScheduleCancellationPenalty(scheduleId, withinDeadlineDate);

            expect(result.penalty_type).toBe(PenaltyType.NONE);
            expect(result.penalty_amount).toBe(0);
            expect(result.reason).toContain('within deadline');
        });

        it('should return 50% penalty when cancellation is outside deadline', async () => {
            const outsideDeadlineDate = new Date();
            outsideDeadlineDate.setDate(outsideDeadlineDate.getDate() + 1);

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.calculateScheduleCancellationPenalty(scheduleId, outsideDeadlineDate);

            const expectedPenalty = (10 * 100.50 + 5 * 50.25) * 0.5;
            expect(result.penalty_type).toBe(PenaltyType.FIFTY_PERCENT);
            expect(result.penalty_amount).toBe(expectedPenalty);
            expect(result.reason).toContain('outside deadline');
        });

        it('should return 50% penalty when order is already generated', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockOrderGeneratedSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.calculateScheduleCancellationPenalty(scheduleId);

            const expectedPenalty = (10 * 100.50 + 5 * 50.25) * 0.5;
            expect(result.penalty_type).toBe(PenaltyType.FIFTY_PERCENT);
            expect(result.penalty_amount).toBe(expectedPenalty);
            expect(result.reason).toContain('Order already generated');
        });

        it('should throw error when schedule not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(null);

            await expect(service.calculateScheduleCancellationPenalty(scheduleId)).rejects.toThrow(RpcException);
            await expect(service.calculateScheduleCancellationPenalty(scheduleId)).rejects.toMatchObject({
                error: {
                    status: 404,
                    message: `Schedule not found: ${scheduleId}`,
                }
            });
        });

        it('should throw error when contract not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.calculateScheduleCancellationPenalty(scheduleId)).rejects.toThrow(RpcException);
            await expect(service.calculateScheduleCancellationPenalty(scheduleId)).rejects.toMatchObject({
                error: {
                    status: 404,
                    message: `Contract not found for schedule: ${scheduleId}`,
                }
            });
        });

        it('should return 0 for schedule value when no active version found', async () => {
            const outsideDeadlineDate = new Date();
            outsideDeadlineDate.setDate(outsideDeadlineDate.getDate() - 10);

            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([]);

            const result = await service.calculateScheduleCancellationPenalty(scheduleId, outsideDeadlineDate);

            expect(result.penalty_amount).toBe(0);
            expect(result.order_value).toBeUndefined();
        });
    });

    describe('calculateContractCancellationPenalty', () => {
        const contractId = 'contract-123';
        const futureSchedule = {
            ...mockSchedule,
            contract_schedule_id: 'future-schedule',
            scheduled_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        };

        it('should return no penalty when no upcoming schedules', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([]);

            const result = await service.calculateContractCancellationPenalty(contractId);

            expect(result.penalty_type).toBe(PenaltyType.NONE);
            expect(result.penalty_amount).toBe(0);
            expect(result.reason).toContain('No upcoming schedules');
        });

        it('should return no penalty when cancellation is within deadline', async () => {
            const withinDeadlineDate = new Date();
            withinDeadlineDate.setDate(withinDeadlineDate.getDate() + 5); // 5 days before delivery

            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([futureSchedule]);

            const result = await service.calculateContractCancellationPenalty(contractId, withinDeadlineDate);

            expect(result.penalty_type).toBe(PenaltyType.NONE);
            expect(result.penalty_amount).toBe(0);
            expect(result.reason).toContain('within deadline');
        });

        it('should return 100% penalty when cancellation is outside deadline', async () => {
            const outsideDeadlineDate = new Date();
            outsideDeadlineDate.setDate(outsideDeadlineDate.getDate() + 20);

            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([futureSchedule]);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.calculateContractCancellationPenalty(contractId, outsideDeadlineDate);

            const expectedPenalty = (10 * 100.50 + 5 * 50.25) * 1.0;
            expect(result.penalty_type).toBe(PenaltyType.ONE_HUNDRED_PERCENT);
            expect(result.penalty_amount).toBe(expectedPenalty);
            expect(result.reason).toContain('100% of next order penalty');
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.calculateContractCancellationPenalty(contractId)).rejects.toThrow(RpcException);
            await expect(service.calculateContractCancellationPenalty(contractId)).rejects.toMatchObject({
                error: {
                    status: 404,
                    message: `Contract not found: ${contractId}`,
                }
            });
        });

        it('should use the next scheduled schedule for penalty calculation', async () => {
            const pastSchedule = {
                ...mockSchedule,
                contract_schedule_id: 'past-schedule',
                scheduled_delivery_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            };
            const nearFutureSchedule = {
                ...mockSchedule,
                contract_schedule_id: 'near-future',
                scheduled_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            };
            const farFutureSchedule = {
                ...mockSchedule,
                contract_schedule_id: 'far-future',
                scheduled_delivery_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            };

            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([pastSchedule, nearFutureSchedule, farFutureSchedule]);
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service.calculateContractCancellationPenalty(contractId);

            expect(result.schedule_id).toBe('near-future');
        });
    });

    describe('shouldSuspendAccount', () => {
        it('should return true when penalty amount is greater than 0', () => {
            const penalty: any = {
                penalty_type: PenaltyType.FIFTY_PERCENT,
                penalty_amount: 100,
            };
            expect(service.shouldSuspendAccount(penalty)).toBe(true);
        });

        it('should return false when penalty amount is 0', () => {
            const penalty: any = {
                penalty_type: PenaltyType.NONE,
                penalty_amount: 0,
            };
            expect(service.shouldSuspendAccount(penalty)).toBe(false);
        });

        it('should return false when penalty type is NONE', () => {
            const penalty: any = {
                penalty_type: PenaltyType.NONE,
                penalty_amount: 0,
            };
            expect(service.shouldSuspendAccount(penalty)).toBe(false);
        });
    });

    describe('getSuspensionResult', () => {
        it('should return suspension result when penalty applies', () => {
            const penalty: any = {
                penalty_type: PenaltyType.FIFTY_PERCENT,
                penalty_amount: 100,
            };
            const result = service.getSuspensionResult(penalty);

            expect(result.account_suspended).toBe(true);
            expect(result.suspension_reason).toContain('Unpaid penalty of $100');
            expect(result.grace_period_days).toBe(3);
            expect(result.suspension_date).toBeInstanceOf(Date);
        });

        it('should return non-suspension result when no penalty', () => {
            const penalty: any = {
                penalty_type: PenaltyType.NONE,
                penalty_amount: 0,
            };
            const result = service.getSuspensionResult(penalty);

            expect(result.account_suspended).toBe(false);
            expect(result.suspension_reason).toBe('Unpaid penalty of $0');
        });
    });

    describe('Helper Methods - isWithinChangeDeadline', () => {
        it('should return true when cancellation date is within deadline', () => {
            const deliveryDate = new Date('2024-12-15');
            const cancellationDate = new Date('2024-12-05');
            const changeDeadlineDays = 7;

            const result = service['isWithinChangeDeadline'](deliveryDate, cancellationDate, changeDeadlineDays);
            expect(result).toBe(true);
        });

        it('should return false when cancellation date is after deadline', () => {
            const deliveryDate = new Date('2024-12-15');
            const cancellationDate = new Date('2024-12-10');
            const changeDeadlineDays = 7;

            const result = service['isWithinChangeDeadline'](deliveryDate, cancellationDate, changeDeadlineDays);
            expect(result).toBe(false);
        });

        it('should return true when cancellation date equals deadline', () => {
            const deliveryDate = new Date('2024-12-15');
            const cancellationDate = new Date('2024-12-08');
            const changeDeadlineDays = 7;

            const result = service['isWithinChangeDeadline'](deliveryDate, cancellationDate, changeDeadlineDays);
            expect(result).toBe(true);
        });
    });

    describe('Helper Methods - isWithinCancellationDeadline', () => {
        it('should return true when cancellation date is within deadline', () => {
            const deliveryDate = new Date('2024-12-30');
            const cancellationDate = new Date('2024-12-10');
            const cancellationDeadlineDays = 15;

            const result = service['isWithinCancellationDeadline'](deliveryDate, cancellationDate, cancellationDeadlineDays);
            expect(result).toBe(true);
        });

        it('should return false when cancellation date is after deadline', () => {
            const deliveryDate = new Date('2024-12-30');
            const cancellationDate = new Date('2024-12-20');
            const cancellationDeadlineDays = 15;

            const result = service['isWithinCancellationDeadline'](deliveryDate, cancellationDate, cancellationDeadlineDays);
            expect(result).toBe(false);
        });
    });

    describe('Helper Methods - calculateScheduleValue', () => {
        it('should calculate total value of schedule items', async () => {
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([mockScheduleVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service['calculateScheduleValue']('schedule-123');

            const expectedTotal = (10 * 100.50) + (5 * 50.25);
            expect(result).toBe(expectedTotal);
        });

        it('should return 0 when no active version found', async () => {
            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([]);

            const result = await service['calculateScheduleValue']('schedule-123');

            expect(result).toBe(0);
        });

        it('should prioritize ACCEPTED version over AUTO_APPLIED', async () => {
            const autoAppliedVersion = {
                ...mockScheduleVersion,
                status: ContractScheduleVersionStatus.AUTO_APPLIED,
                contract_schedule_version_id: 'auto-version',
            };
            const acceptedVersion = {
                ...mockScheduleVersion,
                status: ContractScheduleVersionStatus.ACCEPTED,
                contract_schedule_version_id: 'accepted-version'
            };

            contractScheduleVersionRepository.findByScheduleId.mockResolvedValue([autoAppliedVersion, acceptedVersion]);
            contractScheduleItemRepository.findByVersionId.mockResolvedValue(mockScheduleItems);

            const result = await service['calculateScheduleValue']('schedule-123');

            expect(contractScheduleItemRepository.findByVersionId).toHaveBeenCalledWith('accepted-version');
            expect(result).toBeGreaterThan(0);
        });
    });

    describe('Helper Methods - getNextScheduledSchedule', () => {
        it('should return the next scheduled schedule', async () => {
            const pastSchedule = {
                ...mockSchedule,
                contract_schedule_id: 'past',
                scheduled_delivery_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                status: ContractScheduleStatus.SCHEDULED,
            };
            const nearFutureSchedule = {
                ...mockSchedule,
                contract_schedule_id: 'near',
                scheduled_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                status: ContractScheduleStatus.SCHEDULED,
            };
            const farFutureSchedule = {
                ...mockSchedule,
                contract_schedule_id: 'far',
                scheduled_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: ContractScheduleStatus.SCHEDULED,
            };

            contractScheduleRepository.findByContractId.mockResolvedValue([pastSchedule, farFutureSchedule, nearFutureSchedule]);

            const result = await service['getNextScheduledSchedule']('contract-123');

            expect(result.contract_schedule_id).toBe('near');
        });

        it('should return null when no future scheduled schedules exist', async () => {
            const pastSchedule = {
                ...mockSchedule,
                scheduled_delivery_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                status: ContractScheduleStatus.SCHEDULED,
            };

            contractScheduleRepository.findByContractId.mockResolvedValue([pastSchedule]);

            const result = await service['getNextScheduledSchedule']('contract-123');

            expect(result).toBeNull();
        });

        it('should ignore schedules that are not SCHEDULED', async () => {
            const cancelledSchedule = {
                ...mockSchedule,
                scheduled_delivery_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                status: ContractScheduleStatus.CANCELLED,
            };

            contractScheduleRepository.findByContractId.mockResolvedValue([cancelledSchedule]);

            const result = await service['getNextScheduledSchedule']('contract-123');

            expect(result).toBeNull();
        });
    });

    describe('Helper Methods - getContractById', () => {
        it('should return contract by id', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);

            const result = await service['getContractById']('contract-123');

            expect(result).toEqual(mockContract);
            expect(contractRepository.findById).toHaveBeenCalledWith('contract-123');
        });
    });
});