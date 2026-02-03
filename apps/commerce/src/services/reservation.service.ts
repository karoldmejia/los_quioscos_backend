import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { BatchReservationRepository } from '../repositories/impl/reservation.repository';
import { BatchRepository } from '../repositories/impl/batch.repository';
import { BatchReservation } from '../entities/batch-reservation.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { ReservationRequestDTO } from '../dtos/reservation-request.dto';
import { ReservationRequestItemDTO } from '../dtos/reservation-request-item.dto';
import { BatchAllocationDTO } from '../dtos/batch-allocation.dto';
import { validate } from 'class-validator';
import { StockAvailabilityResponseDTO } from '../dtos/stock-availability-responde.dto';
import { EntityManager, QueryRunner } from 'typeorm';

@Injectable()
export class BatchReservationService {
    private readonly logger = new Logger(BatchReservationService.name);

    // Default expiration times in minutes
    private readonly INITIAL_RESERVATION_MINUTES = 15;
    private readonly ACCEPTED_RESERVATION_MINUTES = 20;

    constructor(
        private readonly reservationRepository: BatchReservationRepository,
        private readonly batchRepository: BatchRepository,
    ) { }


  async createReservations(request: ReservationRequestDTO, queryRunner?: QueryRunner,): Promise<BatchReservation[]> {
    const {orderId, kioskUserId, items, expiresInMinutes = this.INITIAL_RESERVATION_MINUTES} = request;

    const manager = queryRunner?.manager;

    try {
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

      const allReservations: BatchReservation[] = [];

      for (const item of items) {
        const itemReservations = await this.reserveForProduct(orderId, kioskUserId, item.productId, item.quantity, expiresAt, manager,);

        allReservations.push(...itemReservations);
      }

      this.logger.log(
        `Created ${allReservations.length} reservations for order ${orderId}`,
      );

      return allReservations;
    } catch (error) {
      if (!queryRunner) {
        try {
          await this.releaseReservationsByOrder(orderId);
        } catch (rollbackError) {
        }
      }

      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to create reservations');
    }
  }

  private async reserveForProduct(orderId: string, kioskUserId: number, productId: string, quantity: number, expiresAt: Date, manager?: EntityManager,): Promise<BatchReservation[]> {
    const batches = await this.batchRepository.findActiveByProductIdandKioskId(
      productId,
      kioskUserId,
      manager,
    );

    if (batches.length === 0) {
      throw new RpcException(`No active batches found for product ${productId}`);
    }

    let remainingQuantity = quantity;
    const reservations: BatchReservation[] = [];

    for (const batch of batches) {
      if (remainingQuantity <= 0) break;

      const totalReserved =
        await this.reservationRepository.getTotalReservedQuantityByBatch(batch.id,manager);

      const available = batch.currentQuantity - totalReserved;

      if (available > 0) {
        const quantityToReserve = Math.min(remainingQuantity, available);

        // create reservation
        const reservation = await this.reservationRepository.create(
          {
            batchId: batch.id,
            productId,
            orderId,
            kioskUserId,
            quantity: quantityToReserve,
            status: ReservationStatus.ACTIVE,
            expiresAt,
          },
          manager,
        );

        // increase reservedQuantity on batch
        await this.batchRepository.incrementReservedQuantity(
          batch.id,
          quantityToReserve,
          manager,
        );

        reservations.push(reservation);
        remainingQuantity -= quantityToReserve;
      }
    }

    if (remainingQuantity > 0) {
      if (!manager && reservations.length > 0) {
        await this.releaseReservationsByIds(reservations.map((r) => r.id));
      }

      throw new RpcException(
        `Insufficient stock for product ${productId}. ` +
          `Requested: ${quantity}, Available: ${quantity - remainingQuantity}`,
      );
    }

    return reservations;
  }

    // extends time for an accepted order
    async extendReservationsForAcceptedOrder(orderId: string): Promise<void> {
        try {
            const updatedCount = await this.reservationRepository.extendReservationsForOrder(
                orderId,
                this.ACCEPTED_RESERVATION_MINUTES
            );

            this.logger.log(`Extended ${updatedCount} reservations for order ${orderId}`);
        } catch (error) {
            throw new RpcException('Failed to extend reservations');
        }
    }

    // releases all reservations for order
    async releaseReservationsByOrder(orderId: string): Promise<number> {
        try {
            const activeReservations = await this.reservationRepository.findActiveByOrderId(orderId);

            // updated release quantities on batches
            for (const reservation of activeReservations) {
                await this.batchRepository.decrementReservedQuantity(
                    reservation.batchId,
                    reservation.quantity
                );
            }

            // mark reservations as releases
            const releasedCount = await this.reservationRepository.releaseReservationsForOrder(orderId);

            this.logger.log(`Released ${releasedCount} reservations for order ${orderId}`);
            return releasedCount;

        } catch (error) {
            throw new RpcException('Failed to release reservations');
        }
    }

    // mark reservations as used and modifies stock
    async consumeReservationsByOrder(orderId: string): Promise<number> {
        try {
            const activeReservations = await this.reservationRepository.findActiveByOrderId(orderId);

            if (activeReservations.length === 0) {
                this.logger.warn(`No active reservations found for order ${orderId}`);
                return 0;
            }

            // update batches
            for (const reservation of activeReservations) {
                await this.batchRepository.consumeReservedQuantity(reservation.batchId, reservation.quantity);
            }

            // mark reservations as consumed
            const consumedCount = await this.reservationRepository.consumeReservationsForOrder(orderId);

            this.logger.log(`Consumed ${consumedCount} reservations for order ${orderId}`);
            return consumedCount;

        } catch (error) {
            throw new RpcException('Failed to consume reservations');
        }
    }


    async releaseReservationsByIds(reservationIds: string[]): Promise<number> {
        try {
            if (reservationIds.length === 0) return 0;

            const reservations = await this.reservationRepository.findByIds(reservationIds);

            for (const reservation of reservations) {
                if (reservation.status === ReservationStatus.ACTIVE) {
                    await this.batchRepository.decrementReservedQuantity(
                        reservation.batchId,
                        reservation.quantity
                    );
                }
            }

            const releasedCount = await this.reservationRepository.releaseReservationsByIds(reservationIds);

            this.logger.log(`Released ${releasedCount} reservations`);
            return releasedCount;

        } catch (error) {
            throw new RpcException('Failed to release reservations');
        }
    }

    // process expired reservations
    async processExpiredReservations(): Promise<number> {
        try {
            const expiredReservations = await this.reservationRepository.findExpiredActiveReservations();

            if (expiredReservations.length === 0) {
                return 0;
            }

            // Actualizar cantidades reservadas en lotes
            // update reserved qtys for batches
            for (const reservation of expiredReservations) {
                await this.batchRepository.decrementReservedQuantity(
                    reservation.batchId,
                    reservation.quantity
                );
            }

            // Marcar como expiradas
            // mark as expired
            const expiredCount = await this.reservationRepository.markExpiredReservations();

            this.logger.log(`Marked ${expiredCount} reservations as expired`);
            return expiredCount;

        } catch (error) {
            throw new RpcException('Failed to process expired reservations');
        }
    }

    // verifies stock availability for products
    async checkStockAvailability(kioskUserId: number, items: ReservationRequestItemDTO[]): Promise<StockAvailabilityResponseDTO[]> {
        try {
            if (items && items.length > 0) {
                for (const item of items) {
                    const errors = await validate(item);
                    if (errors.length > 0) {
                        throw new RpcException(`Invalid item data: ${JSON.stringify(errors)}`);
                    }
                }
            }

            const results: StockAvailabilityResponseDTO[] = [];

            const availabilityPromises = items.map(async (item) => {
                const batches = await this.batchRepository.findActiveByProductIdandKioskId(item.productId,kioskUserId);

                let totalAvailable = 0;

                for (const batch of batches) {
                    const totalReserved = await this.reservationRepository.getTotalReservedQuantityByBatch(batch.id);
                    const available = batch.currentQuantity - totalReserved;
                    totalAvailable += Math.max(0, available);
                }

                return new StockAvailabilityResponseDTO({
                    productId: item.productId,
                    available: totalAvailable >= item.quantity,
                    requested: item.quantity,
                    availableQuantity: totalAvailable,
                    hasSufficientStock: totalAvailable >= item.quantity
                });
            });

            const availabilityResults = await Promise.all(availabilityPromises);

            return availabilityResults;

        } catch (error) {
            if (error instanceof RpcException) {
                throw error;
            }

            throw new RpcException({
                message: 'Failed to check stock availability',
                code: 'STOCK_CHECK_ERROR',
                details: error.message
            });
        }
    }

    async getActiveReservationsByOrder(orderId: string): Promise<BatchReservation[]> {
        try {
            return await this.reservationRepository.findActiveByOrderId(orderId);
        } catch (error) {
            throw new RpcException('Failed to get active reservations');
        }
    }


    // gets all reservations from an order
    async getReservationsWithBatchInfo(orderId: string): Promise<BatchReservation[]> {
        try {
            return await this.reservationRepository.findWithBatchInfoByOrder(orderId);
        } catch (error) {
            throw new RpcException('Failed to get reservations with batch info');
        }
    }

    //validates if an order has active reservations
    async hasActiveReservations(orderId: string): Promise<boolean> {
        try {
            return await this.reservationRepository.hasActiveReservations(orderId);
        } catch (error) {
            throw new RpcException('Failed to check active reservations');
        }
    }

    // get total reserved qty by batch
    async getTotalReservedByBatch(batchId: string): Promise<number> {
        try {
            return await this.reservationRepository.getTotalReservedQuantityByBatch(batchId);
        } catch (error) {
            throw new RpcException('Failed to get total reserved by batch');
        }
    }

    // get real available quantity on a batch
    async getBatchAvailableQuantity(batchId: string): Promise<number> {
        try {
            const batch = await this.batchRepository.findById(batchId);
            if (!batch) {
                throw new RpcException(`Batch ${batchId} not found`);
            }

            const totalReserved = await this.reservationRepository.getTotalReservedQuantityByBatch(batchId);
            return batch.currentQuantity - totalReserved;

        } catch (error) {
            if (error instanceof RpcException) {
                throw error;
            }
            throw new RpcException('Failed to get batch available quantity');
        }
    }

    // get reservations about to expire
    async getReservationsExpiringSoon(minutesThreshold: number = 5): Promise<BatchReservation[]> {
        try {
            return await this.reservationRepository.getReservationsExpiringSoon(minutesThreshold);
        } catch (error) {
            throw new RpcException('Failed to get expiring reservations');
        }
    }


    // simulates asignation without creating real reservations
    async simulateReservationAllocation(kioskUserId: number, items: ReservationRequestItemDTO[]): Promise<BatchAllocationDTO[][]> {
        try {
            const allocations: BatchAllocationDTO[][] = [];

            for (const item of items) {
                const batches = await this.batchRepository.findActiveByProductIdandKioskId(item.productId, kioskUserId);
                const itemAllocations: BatchAllocationDTO[] = [];
                let remainingQuantity = item.quantity;

                for (const batch of batches) {
                    if (remainingQuantity <= 0) break;

                    const totalReserved = await this.reservationRepository.getTotalReservedQuantityByBatch(batch.id);
                    const available = batch.currentQuantity - totalReserved;

                    if (available > 0) {
                        const quantityToAllocate = Math.min(remainingQuantity, available);

                        itemAllocations.push({
                            batchId: batch.id,
                            productId: item.productId,
                            quantity: quantityToAllocate,
                            batch
                        });

                        remainingQuantity -= quantityToAllocate;
                    }
                }

                if (remainingQuantity > 0) {
                    throw new RpcException(
                        `Insufficient stock for product ${item.productId}. ` +
                        `Requested: ${item.quantity}, Available: ${item.quantity - remainingQuantity}`
                    );
                }

                allocations.push(itemAllocations);
            }

            return allocations;

        } catch (error) {
            if (error instanceof RpcException) {
                throw error;
            }
            throw new RpcException('Failed to simulate reservation allocation');
        }
    }
}