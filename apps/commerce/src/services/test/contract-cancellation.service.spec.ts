import { Test, TestingModule } from '@nestjs/testing';
import { ContractCancellationService } from '../contract-cancellation.service';
import { RpcException } from '@nestjs/microservices';
import { ContractRepository } from '../../repositories/impl/contract.repository';
import { ContractItemRepository } from '../../repositories/impl/contract-item.repository';
import { ContractStatus } from '../../enums/contract-status.enum';
import { ProposedBy } from '../../enums/proposed-by.enum';
import { LogisticsMode } from '../../enums/logistics-mode.enum';
import { Contract } from '../../entities/contract.entity';
import { DeliveryRepository } from 'src/repositories/impl/delivery.repository';
import { ContractVersionRepository } from 'src/repositories/impl/contract-version.repository';
import { DeliveryStatus } from 'src/enums/delivery-status.enum';
import { PenaltyType } from 'src/enums/penalty-type.enum';
import { VersionStatus } from 'src/enums/version-status.enum';
import { TargetType } from 'src/enums/target-type.enum';

describe('ContractCancellationService', () => {
    let service: ContractCancellationService;
    let contractRepository: jest.Mocked<ContractRepository>;
    let deliveryRepository: jest.Mocked<DeliveryRepository>;
    let contractVersionRepository: jest.Mocked<ContractVersionRepository>;
    let contractItemRepository: jest.Mocked<ContractItemRepository>;

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
        deliveries: [],
    };

    const mockPausedContract: Contract = {
        ...mockContract,
        status: ContractStatus.PAUSED,
        pause_start_date: new Date(),
        pause_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const mockDelivery = {
        delivery_id: 'delivery-123',
        contract_id: 'contract-123',
        scheduled_delivery_date: scheduled_delivery_date,
        status: DeliveryStatus.SCHEDULED,
        created_at: new Date(),
        updated_at: new Date(),
        contract: mockContract as any,
        versions: []
    };

    const mockOrderGeneratedDelivery = {
        ...mockDelivery,
        status: DeliveryStatus.ORDER_GENERATED,
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
                    provide: DeliveryRepository,
                    useValue: {
                        findById: jest.fn(),
                        updateStatus: jest.fn(),
                        findDeliveriesForDateRange: jest.fn(),
                        findByContractId: jest.fn(),
                    },
                },
                {
                    provide: ContractVersionRepository,
                    useValue: {
                        getNextVersionNumber: jest.fn(),
                        create: jest.fn(),
                    },
                },
                {
                    provide: ContractItemRepository,
                    useValue: {},
                },
            ],
        }).compile();

        service = module.get<ContractCancellationService>(ContractCancellationService);
        contractRepository = module.get(ContractRepository);
        deliveryRepository = module.get(DeliveryRepository);
        contractVersionRepository = module.get(ContractVersionRepository);
        contractItemRepository = module.get(ContractItemRepository);
    });

    describe('cancelDelivery', () => {
        const cancelDto = {
            delivery_id: 'delivery-123',
            cancelled_by: ProposedBy.BUSINESS,
            cancellation_date: new Date(),
        };

        it('should cancel a delivery successfully', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);
            deliveryRepository.updateStatus.mockResolvedValue(undefined);
            contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractVersionRepository.create.mockResolvedValue(null as any);

            const result = await service.cancelDelivery(cancelDto);

            expect(result.success).toBe(true);
            expect(result.delivery_id).toBe('delivery-123');
            expect(result.new_status).toBe(DeliveryStatus.CANCELLED);
            expect(deliveryRepository.updateStatus).toHaveBeenCalledWith(
                'delivery-123',
                DeliveryStatus.CANCELLED
            );
            expect(contractVersionRepository.create).toHaveBeenCalled();
        });

        it('should throw error when delivery not found', async () => {
            deliveryRepository.findById.mockResolvedValue(null);

            try {
                await service.cancelDelivery(cancelDto);
                fail('Expected RpcException to be thrown');
            } catch (error: any) {
                expect(error.error.status).toBe(404);
                expect(error.error.message).toBe('Delivery not found: delivery-123');
            }
        });

        it('should throw error when contract not found', async () => {
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(null);

            await expect(service.cancelDelivery(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelDelivery(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract not found for delivery: delivery-123',
                    status: 404,
                }
            });
        });

        it('should throw error when contract is not active', async () => {
            const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };
            deliveryRepository.findById.mockResolvedValue(mockDelivery);
            contractRepository.findById.mockResolvedValue(inactiveContract);

            await expect(service.cancelDelivery(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelDelivery(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Contract is not active. Current status: DRAFT',
                    status: 400,
                }
            });
        });

        it('should throw error when delivery cannot be cancelled', async () => {
            const cancelledDelivery = { ...mockDelivery, status: DeliveryStatus.CANCELLED };
            deliveryRepository.findById.mockResolvedValue(cancelledDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);

            await expect(service.cancelDelivery(cancelDto)).rejects.toThrow(RpcException);
            await expect(service.cancelDelivery(cancelDto)).rejects.toMatchObject({
                error: {
                    message: 'Delivery cannot be cancelled. Current status: CANCELLED',
                    status: 400,
                }
            });
        });

        it('should handle delivery with ORDER_GENERATED status', async () => {
            deliveryRepository.findById.mockResolvedValue(mockOrderGeneratedDelivery);
            contractRepository.findById.mockResolvedValue(mockContract);
            deliveryRepository.updateStatus.mockResolvedValue(undefined);
            contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
            contractVersionRepository.create.mockResolvedValue(null as any);

            const result = await service.cancelDelivery(cancelDto);

            expect(result.success).toBe(true);
            expect(deliveryRepository.updateStatus).toHaveBeenCalled();
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
            deliveryRepository.findDeliveriesForDateRange.mockResolvedValue([mockDelivery]);
            deliveryRepository.updateStatus.mockResolvedValue(undefined);
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

        it('should skip deliveries in the pause date range', async () => {
            const deliveries = [
                { ...mockDelivery, status: DeliveryStatus.SCHEDULED },
                { ...mockDelivery, status: DeliveryStatus.ORDER_GENERATED, contract_delivery_id: 'delivery-456' },
                { ...mockDelivery, status: DeliveryStatus.SCHEDULED, contract_delivery_id: 'delivery-789' },
            ];

            contractRepository.findById.mockResolvedValue(mockContract);
            deliveryRepository.findDeliveriesForDateRange.mockResolvedValue(deliveries);
            deliveryRepository.updateStatus.mockResolvedValue(undefined);
            contractRepository.updateContract.mockResolvedValue(undefined);

            const result = await service.pauseContract(pauseDto);

            expect(result.success).toBe(true);
            // Only SCHEDULED deliveries should be updated
            expect(deliveryRepository.updateStatus).toHaveBeenCalledTimes(2);
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
            const futureDelivery = {
                ...mockDelivery,
                scheduled_delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            };
            const pastDelivery = {
                ...mockDelivery,
                scheduled_delivery_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                contract_delivery_id: 'delivery-past',
            };

            contractRepository.findById.mockResolvedValue(mockContract);
            deliveryRepository.findByContractId.mockResolvedValue([futureDelivery, pastDelivery]);
            deliveryRepository.updateStatus.mockResolvedValue(undefined);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.cancelContract(cancelDto);

            expect(result.success).toBe(true);
            expect(result.contract_id).toBe('contract-123');
            expect(result.new_status).toBe(ContractStatus.CANCELLED);
            expect(contractRepository.updateStatus).toHaveBeenCalledWith('contract-123', ContractStatus.CANCELLED);
            expect(deliveryRepository.updateStatus).toHaveBeenCalledTimes(1);
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
            deliveryRepository.findByContractId.mockResolvedValue([]);
            contractRepository.updateStatus.mockResolvedValue(undefined);

            const result = await service.cancelContract(cancelDto);

            expect(result.success).toBe(true);
            expect(result.new_status).toBe(ContractStatus.CANCELLED);
        });
    });

    describe('Helper Methods', () => {
        describe('getNextScheduledDelivery', () => {
            it('should return the next delivered delivery', async () => {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const nextWeek = new Date(today);
                nextWeek.setDate(nextWeek.getDate() + 7);

                const deliveries = [
                    { ...mockDelivery, scheduled_delivery_date: tomorrow, status: DeliveryStatus.SCHEDULED },
                    { ...mockDelivery, scheduled_delivery_date: nextWeek, status: DeliveryStatus.SCHEDULED, contract_delivery_id: 'delivery-2' },
                ];

                deliveryRepository.findByContractId.mockResolvedValue(deliveries);

                const result = await service['getNextScheduledDelivery']('contract-123');

                expect(result).toBeDefined();
                expect(result.scheduled_delivery_date).toBe(tomorrow);
            });

            it('should return null when no future deliveries exist', async () => {
                const pastDate = new Date();
                pastDate.setDate(pastDate.getDate() - 7);
                const deliveries = [
                    { ...mockDelivery, scheduled_delivery_date: pastDate, status: DeliveryStatus.SCHEDULED },
                ];

                deliveryRepository.findByContractId.mockResolvedValue(deliveries);

                const result = await service['getNextScheduledDelivery']('contract-123');

                expect(result).toBeNull();
            });

            it('should ignore deliveries that are not SCHEDULED', async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const deliveries = [
                    { ...mockDelivery, scheduled_delivery_date: tomorrow, status: DeliveryStatus.CANCELLED },
                ];

                deliveryRepository.findByContractId.mockResolvedValue(deliveries);

                const result = await service['getNextScheduledDelivery']('contract-123');

                expect(result).toBeNull();
            });
        });

        describe('createCancellationVersion', () => {
            it('should create a cancellation version', async () => {
                contractVersionRepository.getNextVersionNumber.mockResolvedValue(2);
                contractVersionRepository.create.mockResolvedValue(null as any);

                await service['createCancellationVersion']('delivery-123', ProposedBy.BUSINESS);

                expect(contractVersionRepository.getNextVersionNumber).toHaveBeenCalledWith(TargetType.DELIVERY, 'delivery-123');
                expect(contractVersionRepository.create).toHaveBeenCalledWith({
                    target_type: 'DELIVERY',
                    target_id: 'delivery-123',
                    version_number: 2,
                    proposed_by: ProposedBy.BUSINESS,
                    change_reason: `Delivery cancelled`,
                    status: VersionStatus.AUTO_APPLIED,
                });
            });
        });

        describe('validateDeliveryForCancellation', () => {
            it('should validate delivery in SCHEDULED status', () => {
                expect(() => {
                    service['validateDeliveryForCancellation'](mockDelivery, mockContract);
                }).not.toThrow();
            });

            it('should validate delivery in ORDER_GENERATED status', () => {
                expect(() => {
                    service['validateDeliveryForCancellation'](mockOrderGeneratedDelivery, mockContract);
                }).not.toThrow();
            });

            it('should throw error for invalid delivery status', () => {
                const cancelledDelivery = { ...mockDelivery, status: DeliveryStatus.CANCELLED };

                expect(() => {
                    service['validateDeliveryForCancellation'](cancelledDelivery, mockContract);
                }).toThrow(RpcException);
            });

            it('should throw error for invalid contract status', () => {
                const inactiveContract = { ...mockContract, status: ContractStatus.DRAFT };

                expect(() => {
                    service['validateDeliveryForCancellation'](mockDelivery, inactiveContract);
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