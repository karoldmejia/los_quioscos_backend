import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, LessThan, MoreThanOrEqual, Between, In, MoreThan, EntityManager } from "typeorm";
import { IBatchReservationRepository } from "../ireservation.repository";
import { BatchReservation } from "../../entities/batch-reservation.entity";
import { ReservationStatus } from "../../enums/reservation-status.enum";

@Injectable()
export class BatchReservationRepository extends IBatchReservationRepository {
    constructor(
        @InjectRepository(BatchReservation)
        private readonly repo: Repository<BatchReservation>,
        private dataSource: DataSource,
    ) {
        super();
    }

    // basic crud

    async create(data: Partial<BatchReservation>, manager?: EntityManager) {
        const reservation = this.getRepo(manager).create(data);
        return this.getRepo(manager).save(reservation);
    }

    async createMany(reservationsData: Partial<BatchReservation>[]): Promise<BatchReservation[]> {
        const reservations = this.repo.create(reservationsData);
        return await this.repo.save(reservations);
    }

    async save(reservation: BatchReservation): Promise<BatchReservation> {
        return await this.repo.save(reservation);
    }

    async saveMany(reservations: BatchReservation[]): Promise<BatchReservation[]> {
        return await this.repo.save(reservations);
    }

    async update(reservationId: string, data: Partial<BatchReservation>): Promise<void> {
        await this.repo.update(reservationId, {
            ...data,
            updatedAt: new Date()
        });
    }

    async delete(reservationId: string): Promise<void> {
        await this.repo.delete(reservationId);
    }

    // finders

    async findById(reservationId: string): Promise<BatchReservation | null> {
        return await this.repo.findOne({
            where: { id: reservationId },
            relations: ['batch', 'order', 'orderItem']
        });
    }

    async findByIds(reservationIds: string[]): Promise<BatchReservation[]> {
        if (reservationIds.length === 0) return [];
        return await this.repo.find({
            where: { id: In(reservationIds) },
            relations: ['batch']
        });
    }

    async findByBatchId(batchId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { batchId },
            order: { createdAt: 'DESC' }
        });
    }

    async findActiveByBatchId(batchId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: {
                batchId,
                status: ReservationStatus.ACTIVE,
                expiresAt: MoreThanOrEqual(new Date())
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findByOrderId(orderId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { orderId },
            order: { createdAt: 'DESC' }
        });
    }

    async findActiveByOrderId(orderId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: {
                orderId,
                status: ReservationStatus.ACTIVE,
                expiresAt: MoreThanOrEqual(new Date())
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findByOrderItemId(orderItemId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { orderItemId },
            order: { createdAt: 'DESC' }
        });
    }

    async findByProductId(productId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { productId },
            order: { createdAt: 'DESC' }
        });
    }

    async findActiveByProductId(productId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: {
                productId,
                status: ReservationStatus.ACTIVE,
                expiresAt: MoreThanOrEqual(new Date())
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findByKioskUserId(kioskUserId: number): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { kioskUserId },
            order: { createdAt: 'DESC' }
        });
    }

    async findActiveByKioskUserId(kioskUserId: number): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: {
                kioskUserId,
                status: ReservationStatus.ACTIVE,
                expiresAt: MoreThanOrEqual(new Date())
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findByStatus(status: ReservationStatus): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { status },
            order: { createdAt: 'DESC' }
        });
    }

    // specific querys

    async findActiveReservationsByBatch(batchId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: {
                batchId,
                status: ReservationStatus.ACTIVE,
                expiresAt: MoreThanOrEqual(new Date())
            },
            order: { expiresAt: 'ASC' }
        });
    }

    async findExpiredActiveReservations(): Promise<BatchReservation[]> {
        const now = new Date();
        return await this.repo.find({
            where: {
                status: ReservationStatus.ACTIVE,
                expiresAt: LessThan(now)
            },
            relations: ['batch']
        });
    }

    async findActiveReservationsExpiringBetween(startDate: Date, endDate: Date): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: {
                status: ReservationStatus.ACTIVE,
                expiresAt: Between(startDate, endDate)
            },
            order: { expiresAt: 'ASC' }
        });
    }

    async findByBatchAndProduct(batchId: string, productId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { batchId, productId },
            order: { createdAt: 'DESC' }
        });
    }

    async getTotalReservedQuantityByBatch(batchId: string, manager?: EntityManager) {
        const result = await this.getRepo(manager)
            .createQueryBuilder('r')
            .select('COALESCE(SUM(r.quantity), 0)', 'total')
            .where('r.batchId = :batchId', { batchId })
            .andWhere('r.status = :status', { status: ReservationStatus.ACTIVE })
            .getRawOne();

        return Number(result.total);
    }

    async getTotalReservedQuantityByProduct(productId: string): Promise<number> {
        const result = await this.repo
            .createQueryBuilder('reservation')
            .select('SUM(reservation.quantity)', 'total')
            .where('reservation.productId = :productId', { productId })
            .andWhere('reservation.status = :status', { status: ReservationStatus.ACTIVE })
            .andWhere('reservation.expiresAt >= :now', { now: new Date() })
            .getRawOne();

        return parseInt(result?.total || '0', 10);
    }

    async getTotalReservedQuantityByProductAndKiosk(productId: string, kioskUserId: number): Promise<number> {
        const result = await this.repo
            .createQueryBuilder('reservation')
            .select('SUM(reservation.quantity)', 'total')
            .where('reservation.productId = :productId', { productId })
            .andWhere('reservation.kioskUserId = :kioskUserId', { kioskUserId })
            .andWhere('reservation.status = :status', { status: ReservationStatus.ACTIVE })
            .andWhere('reservation.expiresAt >= :now', { now: new Date() })
            .getRawOne();

        return parseInt(result?.total || '0', 10);
    }

    // status management

    async extendReservationsForOrder(orderId: string, additionalMinutes: number = 15): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                expiresAt: () => `"expiresAt" + INTERVAL '${additionalMinutes} minutes'`,
                updatedAt: () => 'CURRENT_TIMESTAMP',
            })
            .where(`"orderId" = :orderId`, { orderId })
            .andWhere(`"status" = :status`, { status: ReservationStatus.ACTIVE })
            .andWhere(`"expiresAt" >= :now`, { now: new Date() })
            .execute();

        return result.affected || 0;
    }


    async releaseReservationsForOrder(orderId: string): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: ReservationStatus.RELEASED,
                updatedAt: new Date()
            })
            .where('orderId = :orderId', { orderId })
            .andWhere('status = :status', { status: ReservationStatus.ACTIVE })
            .execute();

        return result.affected || 0;
    }

    async releaseReservationsByIds(reservationIds: string[]): Promise<number> {
        if (reservationIds.length === 0) return 0;

        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: ReservationStatus.RELEASED,
                updatedAt: new Date()
            })
            .where('id IN (:...ids)', { ids: reservationIds })
            .andWhere('status = :status', { status: ReservationStatus.ACTIVE })
            .execute();

        return result.affected || 0;
    }

    async consumeReservationsForOrder(orderId: string): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: ReservationStatus.CONSUMED,
                updatedAt: new Date()
            })
            .where('orderId = :orderId', { orderId })
            .andWhere('status = :status', { status: ReservationStatus.ACTIVE })
            .execute();

        return result.affected || 0;
    }

    async markExpiredReservations(): Promise<number> {
        const now = new Date();

        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: ReservationStatus.EXPIRED,
                updatedAt: new Date()
            })
            .where('status = :status', { status: ReservationStatus.ACTIVE })
            .andWhere('expiresAt < :now', { now })
            .execute();

        return result.affected || 0;
    }

    // validations

    async validateStockAvailability(batchId: string, requestedQuantity: number, currentQuantity: number): Promise<boolean> {
        const totalReserved = await this.getTotalReservedQuantityByBatch(batchId);
        const available = currentQuantity - totalReserved;
        return available >= requestedQuantity;
    }

    async findWithBatchInfoByOrder(orderId: string): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { orderId },
            relations: ['batch'],
            order: { createdAt: 'DESC' }
        });
    }

    // transactions

    async executeInTransaction<T>(callback: () => Promise<T>): Promise<T> {
        return await this.dataSource.transaction(callback);
    }

    async deleteAllByOrderId(orderId: string): Promise<number> {
        const result = await this.repo.delete({ orderId });
        return result.affected || 0;
    }

    async deleteByIds(reservationIds: string[]): Promise<number> {
        if (reservationIds.length === 0) return 0;

        const result = await this.repo.delete(reservationIds);
        return result.affected || 0;
    }

    async getReservationsExpiringSoon(minutesThreshold: number = 5): Promise<BatchReservation[]> {
        const now = new Date();
        const threshold = new Date(now.getTime() + minutesThreshold * 60 * 1000);

        return await this.repo.find({
            where: {
                status: ReservationStatus.ACTIVE,
                expiresAt: Between(now, threshold)
            },
            relations: ['order', 'batch'],
            order: { expiresAt: 'ASC' },
            take: 100
        });
    }

    // verify if an order has active reservations
    async hasActiveReservations(orderId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: {
                orderId,
                status: ReservationStatus.ACTIVE,
                expiresAt: MoreThanOrEqual(new Date())
            }
        });
        return count > 0;
    }

    async findByBatchAndProductAndKiosk(batchId: string, productId: string, kioskUserId: number): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: { batchId, productId, kioskUserId },
            order: { createdAt: 'DESC' }
        });
    }

    async findActiveReservationsByProductAndKiosk(productId: string, kioskUserId: number): Promise<BatchReservation[]> {
        return await this.repo.find({
            where: {
                productId,
                kioskUserId,
                status: ReservationStatus.ACTIVE,
                expiresAt: MoreThanOrEqual(new Date())
            },
            order: { expiresAt: 'ASC' }
        });
    }

    async getTotalReservedQuantityByBatchAndProduct(batchId: string, productId: string): Promise<number> {
        const result = await this.repo
            .createQueryBuilder('reservation')
            .select('SUM(reservation.quantity)', 'total')
            .where('reservation.batchId = :batchId', { batchId })
            .andWhere('reservation.productId = :productId', { productId })
            .andWhere('reservation.status = :status', { status: ReservationStatus.ACTIVE })
            .andWhere('reservation.expiresAt >= :now', { now: new Date() })
            .getRawOne();

        return parseInt(result?.total || '0', 10);
    }

    private getRepo(manager?: EntityManager) {
        return manager ? manager.getRepository(BatchReservation) : this.repo;
    }

}