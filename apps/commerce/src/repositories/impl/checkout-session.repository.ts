import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In, Between, MoreThanOrEqual, Not, IsNull } from 'typeorm';
import { ICheckoutSessionRepository } from '../icheckout-session.repository';
import { CheckoutSession } from '../../entities/checkout-session.entity';
import { CheckoutSessionStatus } from '../../enums/checkout-session-status.enum';
import { Order } from '../../entities/order.entity';

@Injectable()
export class CheckoutSessionRepository implements ICheckoutSessionRepository {
    constructor(
        @InjectRepository(CheckoutSession)
        private readonly repo: Repository<CheckoutSession>,
        private dataSource: DataSource,
    ) {}

    // BASIC CRUD

    async create(sessionData: Partial<CheckoutSession>): Promise<CheckoutSession> {
        const session = this.repo.create(sessionData);
        return await this.repo.save(session);
    }

    async save(session: CheckoutSession): Promise<CheckoutSession> {
        return await this.repo.save(session);
    }

    async update(sessionId: string, data: Partial<CheckoutSession>): Promise<void> {
        await this.repo.update(sessionId, {
            ...data,
            updatedAt: new Date()
        });
    }

    async delete(sessionId: string): Promise<void> {
        await this.repo.delete(sessionId);
    }

    // SEARCH

    async findById(sessionId: string): Promise<CheckoutSession | null> {
        return await this.repo.findOne({
            where: { id: sessionId }
        });
    }

    async findByIdWithOrders(sessionId: string): Promise<CheckoutSession | null> {
        return await this.repo.findOne({
            where: { id: sessionId },
            relations: ['orders']
        });
    }

    async findByUserId(userId: string): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: { userId },
            order: { createdAt: 'DESC' }
        });
    }

    async findByCartId(cartId: string): Promise<CheckoutSession | null> {
        return await this.repo.findOne({
            where: { cartId }
        });
    }

    async findByStatus(status: CheckoutSessionStatus): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: { status },
            order: { createdAt: 'DESC' }
        });
    }

    async findExpiredSessions(thresholdDate: Date): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: {
                expiresAt: LessThan(thresholdDate),
                status: In([CheckoutSessionStatus.PENDING, CheckoutSessionStatus.PROCESSING])
            },
            relations: ['orders']
        });
    }

    // SPECIFIC SEARCH

    async findActiveByUserId(userId: string): Promise<CheckoutSession | null> {
        return await this.repo.findOne({
            where: {
                userId,
                status: In([
                    CheckoutSessionStatus.PENDING,
                    CheckoutSessionStatus.PROCESSING
                ])
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findPendingByUserId(userId: string): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: {
                userId,
                status: CheckoutSessionStatus.PENDING
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findCompletedByUserId(userId: string): Promise<CheckoutSession[]> {
        const completedStatuses = [
            CheckoutSessionStatus.COMPLETED,
            CheckoutSessionStatus.CANCELLED,
            CheckoutSessionStatus.EXPIRED,
            CheckoutSessionStatus.FAILED
        ];
        
        return await this.repo.find({
            where: {
                userId,
                status: In(completedStatuses)
            },
            order: { createdAt: 'DESC' }
        });
    }

    // SPECIFIC FUNCTIONS

    async updateStatus(sessionId: string, status: CheckoutSessionStatus): Promise<CheckoutSession> {
        await this.repo.update(sessionId, {
            status,
            updatedAt: new Date()
        });
        
        const session = await this.findById(sessionId);
        if (!session) {
            throw new Error(`Checkout session with id ${sessionId} not found`);
        }
        return session;
    }

    async updateExpiration(sessionId: string, expiresAt: Date): Promise<void> {
        await this.repo.update(sessionId, {
            expiresAt,
            updatedAt: new Date()
        });
    }

    async updateTotalAmount(sessionId: string, totalAmount: string): Promise<void> {
        await this.repo.update(sessionId, {
            totalAmount,
            updatedAt: new Date()
        });
    }

    async addOrdersToSession(sessionId: string, orders: Order[]): Promise<void> {
        const session = await this.findByIdWithOrders(sessionId);
        if (!session) {
            throw new Error(`Checkout session with id ${sessionId} not found`);
        }
        
        // Initialize orders array if it's null/undefined
        if (!session.orders) {
            session.orders = [];
        }
        
        // Add new orders
        session.orders.push(...orders);
        await this.repo.save(session);
    }

    // TIMEOUT MANAGEMENT

    async markExpiredSessions(thresholdDate: Date): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: CheckoutSessionStatus.EXPIRED,
                updatedAt: new Date()
            })
            .where('expiresAt < :threshold', { threshold: thresholdDate })
            .andWhere('status IN (:...statuses)', {
                statuses: [CheckoutSessionStatus.PENDING, CheckoutSessionStatus.PROCESSING]
            })
            .execute();

        return result.affected || 0;
    }

    // RELATIONS WITH ENTITIES

    async findWithOrdersAndItems(sessionId: string): Promise<CheckoutSession | null> {
        return await this.repo.findOne({
            where: { id: sessionId },
            relations: ['orders', 'orders.items']
        });
    }

    async findSessionWithCompleteData(sessionId: string): Promise<CheckoutSession | null> {
        return await this.repo.findOne({
            where: { id: sessionId },
            relations: [
                'orders',
                'orders.items',
                'orders.items.product'
            ]
        });
    }

    // COUNT

    async countByStatus(status: CheckoutSessionStatus): Promise<number> {
        return await this.repo.count({
            where: { status }
        });
    }

    async countByUserId(userId: string): Promise<number> {
        return await this.repo.count({
            where: { userId }
        });
    }

    // EXISTENCE

    async existsActiveForUser(userId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: {
                userId,
                status: In([
                    CheckoutSessionStatus.PENDING,
                    CheckoutSessionStatus.PROCESSING
                ])
            }
        });
        return count > 0;
    }

    async existsForCart(cartId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: { cartId }
        });
        return count > 0;
    }

    // KIOSKS METHODS

    async findSessionsByKioskUserId(kioskUserId: number): Promise<CheckoutSession[]> {
        return await this.repo
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.orders', 'order')
            .where('order.kioskUserId = :kioskUserId', { kioskUserId })
            .andWhere('session.status != :cancelled', { 
                cancelled: CheckoutSessionStatus.CANCELLED 
            })
            .orderBy('session.createdAt', 'DESC')
            .getMany();
    }

    async findPendingSessionsByKioskUserId(kioskUserId: number): Promise<CheckoutSession[]> {
        return await this.repo
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.orders', 'order')
            .where('order.kioskUserId = :kioskUserId', { kioskUserId })
            .andWhere('session.status = :status', { 
                status: CheckoutSessionStatus.PENDING 
            })
            .orderBy('session.createdAt', 'DESC')
            .getMany();
    }

    // TRANSACTION SUPPORT

    async executeInTransaction<T>(callback: () => Promise<T>): Promise<T> {
        return await this.dataSource.transaction(callback);
    }

    // ADDITIONAL METHODS (not in interface but useful)

    async findRecentSessions(limit: number = 50): Promise<CheckoutSession[]> {
        return await this.repo.find({
            order: { createdAt: 'DESC' },
            take: limit
        });
    }

    async findSessionsInDateRange(startDate: Date, endDate: Date): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: {
                createdAt: Between(startDate, endDate)
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findSessionsWithTotalGreaterThan(amount: number): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: {
                totalAmount: MoreThanOrEqual(amount.toString())
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findCancellableSessions(): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: {
                status: In([
                    CheckoutSessionStatus.PENDING,
                    CheckoutSessionStatus.PROCESSING
                ]),
                expiresAt: Not(IsNull())
            },
            relations: ['orders']
        });
    }

    async cancelSession(sessionId: string): Promise<CheckoutSession> {
        return await this.updateStatus(sessionId, CheckoutSessionStatus.CANCELLED);
    }
    
    async findSessionsByUserAndStatus(
        userId: string, 
        statuses: CheckoutSessionStatus[]
    ): Promise<CheckoutSession[]> {
        return await this.repo.find({
            where: {
                userId,
                status: In(statuses)
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findSessionsWithExpiringOrders(thresholdDate: Date): Promise<CheckoutSession[]> {
        return await this.repo
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.orders', 'order')
            .where('order.expiresAt < :threshold', { threshold: thresholdDate })
            .andWhere('order.status IN (:...orderStatuses)', {
                orderStatuses: ['PENDING_KIOSK_CONFIRMATION', 'ACCEPTED']
            })
            .andWhere('session.status IN (:...sessionStatuses)', {
                sessionStatuses: [CheckoutSessionStatus.PENDING, CheckoutSessionStatus.PROCESSING]
            })
            .orderBy('session.createdAt', 'DESC')
            .getMany();
    }

    async bulkUpdateStatus(
        sessionIds: string[], 
        status: CheckoutSessionStatus
    ): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status,
                updatedAt: new Date()
            })
            .where('id IN (:...ids)', { ids: sessionIds })
            .execute();

        return result.affected || 0;
    }

    async findSessionsWithProducts(): Promise<CheckoutSession[]> {
        return await this.repo
            .createQueryBuilder('session')
            .innerJoinAndSelect('session.orders', 'order')
            .innerJoinAndSelect('order.items', 'item')
            .innerJoinAndSelect('item.product', 'product')
            .orderBy('session.createdAt', 'DESC')
            .getMany();
    }

    async findSessionsByProductId(productId: string): Promise<CheckoutSession[]> {
        return await this.repo
            .createQueryBuilder('session')
            .innerJoin('session.orders', 'order')
            .innerJoin('order.items', 'item')
            .where('item.productId = :productId', { productId })
            .andWhere('session.status IN (:...statuses)', {
                statuses: [
                    CheckoutSessionStatus.COMPLETED,
                    CheckoutSessionStatus.PROCESSING
                ]
            })
            .orderBy('session.createdAt', 'DESC')
            .getMany();
    }
}