import { BatchReservation } from "../entities/batch-reservation.entity";
import { ReservationStatus } from "../enums/reservation-status.enum";

export abstract class IBatchReservationRepository {
    // basic crud
    abstract create(reservationData: Partial<BatchReservation>): Promise<BatchReservation>;
    abstract createMany(reservationsData: Partial<BatchReservation>[]): Promise<BatchReservation[]>;
    abstract save(reservation: BatchReservation): Promise<BatchReservation>;
    abstract saveMany(reservations: BatchReservation[]): Promise<BatchReservation[]>;
    abstract update(reservationId: string, data: Partial<BatchReservation>): Promise<void>;
    abstract delete(reservationId: string): Promise<void>;
    
    // basic finders
    abstract findById(reservationId: string): Promise<BatchReservation | null>;
    abstract findByBatchId(batchId: string): Promise<BatchReservation[]>;
    abstract findActiveByBatchId(batchId: string): Promise<BatchReservation[]>;
    abstract findByOrderId(orderId: string): Promise<BatchReservation[]>;
    abstract findActiveByOrderId(orderId: string): Promise<BatchReservation[]>;
    abstract findByOrderItemId(orderItemId: string): Promise<BatchReservation[]>;
    abstract findByProductId(productId: string): Promise<BatchReservation[]>;
    abstract findActiveByProductId(productId: string): Promise<BatchReservation[]>;
    abstract findByKioskUserId(kioskUserId: number): Promise<BatchReservation[]>;
    abstract findActiveByKioskUserId(kioskUserId: number): Promise<BatchReservation[]>;
    abstract findByStatus(status: ReservationStatus): Promise<BatchReservation[]>;
    
    abstract findActiveReservationsByBatch(batchId: string): Promise<BatchReservation[]>;
    abstract findExpiredActiveReservations(): Promise<BatchReservation[]>;
    abstract findActiveReservationsExpiringBetween(startDate: Date, endDate: Date): Promise<BatchReservation[]>;
    abstract findByBatchAndProduct(batchId: string, productId: string): Promise<BatchReservation[]>;
    
    // disponibility
    abstract getTotalReservedQuantityByBatch(batchId: string): Promise<number>;
    abstract getTotalReservedQuantityByProduct(productId: string): Promise<number>;
    abstract validateStockAvailability(batchId: string, requestedQuantity: number, currentQuantity: number): Promise<boolean>;
    
    // status management
    abstract extendReservationsForOrder(orderId: string, additionalMinutes?: number): Promise<number>;
    abstract releaseReservationsForOrder(orderId: string): Promise<number>;
    abstract releaseReservationsByIds(reservationIds: string[]): Promise<number>;
    abstract consumeReservationsForOrder(orderId: string): Promise<number>;
    abstract markExpiredReservations(): Promise<number>;
    
    // transactions
    abstract executeInTransaction<T>(callback: () => Promise<T>): Promise<T>;
    abstract deleteAllByOrderId(orderId: string): Promise<number>;
    abstract deleteByIds(reservationIds: string[]): Promise<number>;
    
    // Métodos auxiliares
    abstract findWithBatchInfoByOrder(orderId: string): Promise<BatchReservation[]>;
    abstract getReservationsExpiringSoon(minutesThreshold?: number): Promise<BatchReservation[]>;
    abstract hasActiveReservations(orderId: string): Promise<boolean>;
}