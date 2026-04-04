import { Test, TestingModule } from '@nestjs/testing';
import { ContractCancellationService } from '../contract-cancellation.service';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractScheduleRepository } from '../../repositories/impl/contract-schedule.repository';
import { ContractScheduleVersionRepository } from '../../repositories/impl/contract-schedule-version.repository';
import { ContractItemRepository } from '../../repositories/impl/contract-item.repository';
import { ContractScheduleStatus } from '../../enums/contract-schedule-status.enum';
import { ContractStatus } from '../../enums/contract-status.enum';
import { ContractScheduleVersionStatus } from '../../enums/contract-schedule-version-status.enum';
import { ProposedBy } from '../../enums/proposed-by.enum';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { Contract } from '../../entities/contract.entity';
import { PenaltyService } from '../penalty.service';
import { PenaltyType } from 'src/enums/penalty-type.enum';

describe('ContractCancellationService', () => {
    let service: ContractCancellationService;
    let contractRepository: jest.Mocked<ContractRepository>;
    let contractScheduleRepository: jest.Mocked<ContractScheduleRepository>;
    let contractScheduleVersionRepository: jest.Mocked<ContractScheduleVersionRepository>;
    let contractItemRepository: jest.Mocked<ContractItemRepository>;
    let penaltyService: jest.Mocked<PenaltyService>;

    const now = new Date();
    const start_date = new Date(now);
    start_date.setDate(start_date.getDate() + 1);
    const end_date = new Date(now);
    end_date.setMonth(end_date.getMonth() + 6);
    const scheduled_delivery_date = new Date(now);
    scheduled_delivery_date.setDate(scheduled_delivery_date.getDate() + 7);

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

    const mockPausedContract: Contract = {
        ...mockContract,
        status: ContractStatus.PAUSED,
        pause_start_date: new Date(),
        pause_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

    const mockPenalty = {
        penalty_amount: 100,
        reason: 'Cancellation penalty',
        days_in_advance: 5,
        penalty_type: PenaltyType.FIFTY_PERCENT
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ContractCancellationService,
                {
                    provide: ContractRepository,
                    useValue: {
                        findById: jest.fn(),
                        updateContract: jest.fn(),
                        updateStatus: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleRepository,
                    useValue: {
                        findById: jest.fn(),
                        updateStatus: jest.fn(),
                        findSchedulesForDateRange: jest.fn(),
                        findByContractId: jest.fn(),
                    },
                },
                {
                    provide: ContractScheduleVersionRepository,
                    useValue: {
                        getNextVersionNumber: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: ContractItemRepository,
                    useValue: {},
                },
                {
                    provide: PenaltyService,
                    useValue: {
                        calculateScheduleCancellationPenalty: jest.fn(),
                        calculateContractCancellationPenalty: jest.fn(),
                        shouldSuspendAccount: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<ContractCancellationService>(ContractCancellationService);
        contractRepository = module.get(ContractRepository);
        contractScheduleRepository = module.get(ContractScheduleRepository);
        contractScheduleVersionRepository = module.get(ContractScheduleVersionRepository);
        contractItemRepository = module.get(ContractItemRepository);
        penaltyService = module.get(PenaltyService);
    });

    describe('cancelSchedule', () => {
        const cancelDto = {
            schedule_id: 'schedule-123',
            cancelled_by: ProposedBy.BUSINESS,
            cancellation_date: new Date(),
        };

        it('should cancel a schedule successfully', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            penaltyService.calculateScheduleCancellationPenalty.mockResolvedValue(mockPenalty);
            penaltyService.shouldSuspendAccount.mockReturnValue(false);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);
            contractScheduleVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractScheduleVersionRepository.create.mockResolvedValue(null as any);

            const result = await service.cancelSchedule(cancelDto);

            expect(result.success).toBe(true);
            expect(result.schedule_id).toBe('schedule-123');
            expect(result.new_status).toBe(ContractScheduleStatus.CANCELLED);
            expect(result.penalty).toEqual(mockPenalty);
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalledWith(
                'schedule-123',
                ContractScheduleStatus.CANCELLED
            );
            expect(contractScheduleVersionRepository.create).toHaveBeenCalled();
        });

        it('should throw error when schedule not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(null);

            try {
                await service.cancelSchedule(cancelDto);
                fail('Expected RpcException to be thrown');
            } catch (error: any) {
                expect(error.error.status).toBe(404);
                expect(error.error.message).toBe('Schedule not found: schedule-123');
            }
        });

        it('should throw error when contract not found', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.cancelSchedule(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelSchedule(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract not found for schedule: schedule-123',
                    status: 404,
                }
            });
        });

        it('should throw error when contract is not active', async () => {
            const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(inactiveContract);

            await expect(service.cancelSchedule(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelSchedule(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract is not active. Current status: DRAFT',
                    status: 400,
                }
            });
        });

        it('should throw error when schedule cannot be cancelled', async () => {
            const cancelledSchedule = { ...mockSchedule, status: ContractScheduleStatus.CANCELLED };
            contractScheduleRepository.findById.mockResolvedValue(cancelledSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.cancelSchedule(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelSchedule(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Schedule cannot be cancelled. Current status: CANCELLED',
                    status: 400,
                }
            });
        });

        it('should handle schedule with ORDER_GENERATED status', async () => {
            contractScheduleRepository.findById.mockResolvedValue(mockOrderGeneratedSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            penaltyService.calculateScheduleCancellationPenalty.mockResolvedValue(mockPenalty);
            penaltyService.shouldSuspendAccount.mockReturnValue(false);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);
            contractScheduleVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractScheduleVersionRepository.create.mockResolvedValue(null as any);

            const result = await service.cancelSchedule(cancelDto);

            expect(result.success).toBe(true);
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalled();
        });

        it('should handle account suspension when penalty is severe', async () => {
            const severePenalty = { ...mockPenalty, penalty_amount: 1000 };
            contractScheduleRepository.findById.mockResolvedValue(mockSchedule);
            contractRepository.findById.mockResolvedValue(mockContract);
            penaltyService.calculateScheduleCancellationPenalty.mockResolvedValue(severePenalty);
            penaltyService.shouldSuspendAccount.mockReturnValue(true);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);
            contractScheduleVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractScheduleVersionRepository.create.mockResolvedValue(null as any);

            const result = await service.cancelSchedule(cancelDto);

            expect(result.success).toBe(true);
            // Verificar que se llamó a handleAccountSuspension (a través del log)
            expect(penaltyService.shouldSuspendAccount).toHaveBeenCalledWith(severePenalty);
        });
    });

    describe('pauseContract', () => {
        const pauseDto = {
            contract_id: 'contract-123',
            pause_start_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            pause_end_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            requested_by: ProposedBy.BUSINESS,
        };

        it('should pause a contract successfully', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findSchedulesForDateRange.mockResolvedValue([mockSchedule]);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);
            contractRepository.updateContract.mockResolvedValue(undefined);

            const result = await service.pauseContract(pauseDto);

            expect(result.success).toBe(true);
            expect(result.contract_id).toBe('contract-123');
            expect(result.new_status).toBe(ContractStatus.PAUSED);
            expect(contractRepository.updateContract).toHaveBeenCalledWith('contract-123', {
                pause_start_date: expect.any(Date),
                pause_end_date: expect.any(Date),
                status: ContractStatus.PAUSED,
            });
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.pauseContract(pauseDto)).rejects.toThrow(RpcException);
            await expect(service.pauseContract(pauseDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract not found: contract-123',
                    status: 404,
                }
            });
        });

        it('should throw error when contract is not active', async () => {
            const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };
            contractRepository.findById.mockResolvedValue(inactiveContract);

            await expect(service.pauseContract(pauseDto)).rejects.toThrow(RpcException);
            await expect(service.pauseContract(pauseDto)).rejects.toMatchObject({
                error: {
                    message: 'Only active contracts can be paused. Current status: DRAFT',
                    status: 400,
                }
            });
        });

        it('should throw error when contract is already paused', async () => {
            const alreadyPausedContract = {
                ...mockContract,
                status: ContractStatus.ACTIVE,
                pause_start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                pause_end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            };
            contractRepository.findById.mockResolvedValue(alreadyPausedContract);

            await expect(service.pauseContract(pauseDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract is already paused',
                    status: 400,
                }
            });
        });

        it('should throw error when pause start date violates change deadline', async () => {
            const earlyPauseDto = {
                ...pauseDto,
                pause_start_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            };
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.pauseContract(earlyPauseDto)).rejects.toThrow(RpcException);
            await expect(service.pauseContract(earlyPauseDto)).rejects.toMatchObject({
                error: {
                    message: expect.stringContaining('Pause cannot start before'),
                    status: 400,
                }
            });
        });

        it('should skip schedules in the pause date range', async () => {
            const schedules = [
                { ...mockSchedule, status: ContractScheduleStatus.SCHEDULED },
                { ...mockSchedule, status: ContractScheduleStatus.ORDER_GENERATED, contract_schedule_id: 'schedule-456' },
                { ...mockSchedule, status: ContractScheduleStatus.SCHEDULED, contract_schedule_id: 'schedule-789' },
            ];

            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findSchedulesForDateRange.mockResolvedValue(schedules);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);
            contractRepository.updateContract.mockResolvedValue(undefined);

            const result = await service.pauseContract(pauseDto);

            expect(result.success).toBe(true);
            // Only SCHEDULED schedules should be updated
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalledTimes(2);
        });
    });

    describe('resumeContract', () => {
        const contractId = 'contract-123';

        it('should resume a paused contract successfully', async () => {
            contractRepository.findById.mockResolvedValue(mockPausedContract);
            contractRepository.updateContract.mockResolvedValue(undefined);

            const result = await service.resumeContract(contractId);

            expect(result.success).toBe(true);
            expect(result.contract_id).toBe(contractId);
            expect(result.new_status).toBe(ContractStatus.ACTIVE);
            expect(contractRepository.updateContract).toHaveBeenCalledWith(contractId, {
                pause_start_date: undefined,
                pause_end_date: undefined,
                status: ContractStatus.ACTIVE,
            });
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.resumeContract(contractId)).rejects.toThrow(RpcException);
            await expect(service.resumeContract(contractId)).rejects.toMatchObject({
                error: {
                    message: 'Contract not found: contract-123',
                    status: 404,
                }
            });
        });

        it('should throw error when contract is not paused', async () => {
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.resumeContract(contractId)).rejects.toThrow(RpcException);
            await expect(service.resumeContract(contractId)).rejects.toMatchObject({
                error: {
                    message: 'Contract is not paused. Current status: ACTIVE',
                    status: 400,
                }
            });
        });
    });

    describe('cancelContract', () => {
        const cancelDto = {
            contract_id: 'contract-123',
            cancelled_by: ProposedBy.BUSINESS,
            cancellation_date: new Date(),
        };

        it('should cancel a contract successfully', async () => {
            const futureSchedule = {
                ...mockSchedule,
                scheduled_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            };
            const pastSchedule = {
                ...mockSchedule,
                scheduled_delivery_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                contract_schedule_id: 'schedule-past',
            };

            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([futureSchedule, pastSchedule]);
            penaltyService.calculateContractCancellationPenalty.mockResolvedValue(mockPenalty);
            penaltyService.shouldSuspendAccount.mockReturnValue(false);
            contractScheduleRepository.updateStatus.mockResolvedValue(undefined);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.cancelContract(cancelDto);

            expect(result.success).toBe(true);
            expect(result.contract_id).toBe('contract-123');
            expect(result.new_status).toBe(ContractStatus.CANCELLED);
            expect(result.penalty).toEqual(mockPenalty);
            expect(contractRepository.updateStatus).toHaveBeenCalledWith('contract-123', ContractStatus.CANCELLED);
            expect(contractScheduleRepository.updateStatus).toHaveBeenCalledTimes(1);
        });

        it('should throw error when contract not found', async () => {
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.cancelContract(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelContract(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract not found: contract-123',
                    status: 404,
                }
            });
        });

        it('should throw error when contract cannot be cancelled', async () => {
            const cancelledContract = { ...mockContract, status: ContractStatus.CANCELLED };
            contractRepository.findById.mockResolvedValue(cancelledContract);

            await expect(service.cancelContract(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelContract(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract cannot be cancelled. Current status: CANCELLED',
                    status: 400,
                }
            });
        });

        it('should handle contract in PAUSED status', async () => {
            contractRepository.findById.mockResolvedValue(mockPausedContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([]);
            penaltyService.calculateContractCancellationPenalty.mockResolvedValue(mockPenalty);
            penaltyService.shouldSuspendAccount.mockReturnValue(false);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.cancelContract(cancelDto);

            expect(result.success).toBe(true);
            expect(result.new_status).toBe(ContractStatus.CANCELLED);
        });

        it('should handle account suspension when penalty is severe', async () => {
            const severePenalty = { ...mockPenalty, penalty_amount: 1000 };
            contractRepository.findById.mockResolvedValue(mockContract);
            contractScheduleRepository.findByContractId.mockResolvedValue([]);
            penaltyService.calculateContractCancellationPenalty.mockResolvedValue(severePenalty);
            penaltyService.shouldSuspendAccount.mockReturnValue(true);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.cancelContract(cancelDto);

            expect(result.success).toBe(true);
            expect(penaltyService.shouldSuspendAccount).toHaveBeenCalledWith(severePenalty);
        });
    });

    describe('Helper Methods', () => {
        describe('getNextScheduledDelivery', () => {
            it('should return the next scheduled delivery', async () => {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);

                const schedules = [
                    { ...mockSchedule, scheduled_delivery_date: tomorrow, status: ContractScheduleStatus.SCHEDULED },
                    { ...mockSchedule, scheduled_delivery_date: nextWeek, status: ContractScheduleStatus.SCHEDULED, contract_schedule_id: 'schedule-2' },
                ];

                contractScheduleRepository.findByContractId.mockResolvedValue(schedules);

                const result = await service['getNextScheduledDelivery']('contract-123');

                expect(result).toBeDefined();
                expect(result.scheduled_delivery_date).toBe(tomorrow);
            });

            it('should return null when no future schedules exist', async () => {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - 7);
                const schedules = [
                    { ...mockSchedule, scheduled_delivery_date: pastDate, status: ContractScheduleStatus.SCHEDULED },
                ];

                contractScheduleRepository.findByContractId.mockResolvedValue(schedules);

                const result = await service['getNextScheduledDelivery']('contract-123');

                expect(result).toBeNull();
            });

            it('should ignore schedules that are not SCHEDULED', async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const schedules = [
                    { ...mockSchedule, scheduled_delivery_date: tomorrow, status: ContractScheduleStatus.CANCELLED },
                ];

                contractScheduleRepository.findByContractId.mockResolvedValue(schedules);

                const result = await service['getNextScheduledDelivery']('contract-123');

                expect(result).toBeNull();
            });
        });

        describe('createCancellationVersion', () => {
            it('should create a cancellation version', async () => {
                contractScheduleVersionRepository.getNextVersionNumber.mockResolvedValue(2);
                contractScheduleVersionRepository.create.mockResolvedValue(null as any);

                await service['createCancellationVersion']('schedule-123', ProposedBy.BUSINESS, mockPenalty);

                expect(contractScheduleVersionRepository.getNextVersionNumber).toHaveBeenCalledWith('schedule-123');
                expect(contractScheduleVersionRepository.create).toHaveBeenCalledWith({
                    contract_schedule_id: 'schedule-123',
                    version_number: 2,
                    proposed_by: ProposedBy.BUSINESS,
                    change_reason: `Schedule cancelled. Penalty: $${mockPenalty.penalty_amount}`,
                    status: ContractScheduleVersionStatus.AUTO_APPLIED,
                });
            });
        });

        describe('validateScheduleForCancellation', () => {
            it('should validate schedule in SCHEDULED status', () => {
                expect(() => {
                    service['validateScheduleForCancellation'](mockSchedule, mockContract);
                }).not.toThrow();
            });

            it('should validate schedule in ORDER_GENERATED status', () => {
                expect(() => {
                    service['validateScheduleForCancellation'](mockOrderGeneratedSchedule, mockContract);
                }).not.toThrow();
            });

            it('should throw error for invalid schedule status', () => {
                const cancelledSchedule = { ...mockSchedule, status: ContractScheduleStatus.CANCELLED };

                expect(() => {
                    service['validateScheduleForCancellation'](cancelledSchedule, mockContract);
                }).toThrow(RpcException);
            });

            it('should throw error for invalid contract status', () => {
                const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };

                expect(() => {
                    service['validateScheduleForCancellation'](mockSchedule, inactiveContract);
                }).toThrow(RpcException);
            });
        });

        describe('validateContractForPause', () => {
            it('should validate active contract', () => {
                expect(() => {
                    service['validateContractForPause'](mockContract, new Date());
                }).not.toThrow();
            });

            it('should throw error for inactive contract', () => {
                const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };

                expect(() => {
                    service['validateContractForPause'](inactiveContract, new Date());
                }).toThrow(RpcException);
            });

            it('should throw error for already paused contract', () => {
                const pausedContract = {
                    ...mockContract,
                    status: ContractStatus.PAUSED,
                    pause_start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                    pause_end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                };

                expect(() => {
                    service['validateContractForPause'](pausedContract, new Date());
                }).toThrow(RpcException);
            });
        });

        describe('validatePauseDates', () => {
            it('should validate pause dates', () => {
                const validPauseDate = new Date();
                validPauseDate.setDate(validPauseDate.getDate() + mockContract.change_deadline_days + 1);

                expect(() => {
                    service['validatePauseDates'](mockContract, validPauseDate);
                }).not.toThrow();
            });

            it('should throw error when pause date is too soon', () => {
                const earlyPauseDate = new Date();
                earlyPauseDate.setDate(earlyPauseDate.getDate() + 1);

                expect(() => {
                    service['validatePauseDates'](mockContract, earlyPauseDate);
                }).toThrow(RpcException);
            });
        });

        describe('validateContractForCancellation', () => {
            it('should validate active contract', () => {
                expect(() => {
                    service['validateContractForCancellation'](mockContract);
                }).not.toThrow();
            });

            it('should validate paused contract', () => {
                expect(() => {
                    service['validateContractForCancellation'](mockPausedContract);
                }).not.toThrow();
            });

            it('should throw error for invalid contract status', () => {
                const cancelledContract = { ...mockContract, status: ContractStatus.CANCELLED };

                expect(() => {
                    service['validateContractForCancellation'](cancelledContract);
                }).toThrow(RpcException);
            });
        });
    });
});