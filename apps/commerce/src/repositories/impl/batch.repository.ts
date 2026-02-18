import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, MoreThanOrEqual, Not, Between, Like, MoreThan, EntityManager } from 'typeorm';
import { IBatchRepository } from '../ibatch.repository';
import { Batch } from '../../entities/batch.entity';
import { BatchStatus } from '../../enums/batch-status.enum';

@Injectable()
export class BatchRepository extends IBatchRepository {
    constructor(
        @InjectRepository(Batch)
        private readonly repo: Repository<Batch>,
        private dataSource: DataSource,
    ) {
        super();
    }

    async create(batch: Batch): Promise<Batch> {
        const newBatch = this.repo.create(batch);
        return await this.repo.save(newBatch);
    }

    async save(batch: Batch): Promise<Batch> {
        return await this.repo.save(batch);
    }

    async update(batch: Batch): Promise<Batch> {
        return await this.repo.save(batch);
    }

    async findById(batchId: string): Promise<Batch | null> {
        return await this.repo.findOne({
            where: {
                id: batchId,
                status: Not(BatchStatus.DELETED),
            },
            relations: ['product'],
        });
    }

    async findByIdIncludingDeleted(batchId: string): Promise<Batch | null> {
        return await this.repo.findOne({
            where: { id: batchId },
            relations: ['product'],
        });
    }

    async findByProductId(productId: string): Promise<Batch[]> {
        return await this.repo.find({
            where: {
                productId,
                status: Not(BatchStatus.DELETED),
            },
            order: { expirationDate: 'ASC' },
            relations: ['product'],
        });
    }

    async findBatchesByStatus(status: BatchStatus): Promise<Batch[]> {
        return await this.repo.find({
            where: { status },
            relations: ['product'],
            order: { expirationDate: 'ASC' },
        });
    }

    async getTotalStockByProduct(productId: string, kioskUserId?: number): Promise<number> {
        const query = this.repo
            .createQueryBuilder('batch')
            .select('SUM(batch.currentQuantity)', 'total')
            .where('batch.productId = :productId', { productId })
            .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
            .andWhere('batch.expirationDate >= :today', { today: new Date() })
            .andWhere('batch.currentQuantity > 0');

        if (kioskUserId !== undefined) {
            query.andWhere('batch.kioskUserId = :kioskUserId', { kioskUserId });
        }

        const result = await query.getRawOne();
        return parseInt(result?.total || '0', 10);
    }

    async getAvailableStockByProduct(productId: string, kioskUserId?: number): Promise<number> {
        const query = this.repo
            .createQueryBuilder('batch')
            .select('SUM(batch.currentQuantity - batch.reservedQuantity)', 'total')
            .where('batch.productId = :productId', { productId })
            .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
            .andWhere('batch.expirationDate >= :today', { today: new Date() })
            .andWhere('(batch.currentQuantity - batch.reservedQuantity) > 0');

        if (kioskUserId !== undefined) {
            query.andWhere('batch.kioskUserId = :kioskUserId', { kioskUserId });
        }

        const result = await query.getRawOne();
        return parseInt(result?.total || '0', 10);
    }

    async getBatchHistory(productId?: string, batchId?: string): Promise<Batch[]> {
        const query = this.repo.createQueryBuilder('batch')
            .leftJoinAndSelect('batch.product', 'product')
            .leftJoinAndSelect('batch.movements', 'movements')
            .orderBy('batch.createdAt', 'DESC');

        if (batchId) {
            query.where('batch.id = :batchId', { batchId });
        } else if (productId) {
            query.where('batch.productId = :productId', { productId });
        }

        return await query.getMany();
    }

    async getNextBatchId(productionDate: Date): Promise<string> {
        const dateStr = productionDate.toISOString().slice(0, 10).replace(/-/g, '');

        const lastBatch = await this.repo.findOne({
            where: {
                id: Like(`LOTE-${dateStr}-%`),
            },
            order: { id: 'DESC' },
        });

        let sequence = 1;
        if (lastBatch) {
            const lastSequence = parseInt(lastBatch.id.split('-')[2], 10);
            sequence = lastSequence + 1;
        }

        return `LOTE-${dateStr}-${sequence.toString().padStart(3, '0')}`;
    }

    async getBatchesNeedingExpiration(): Promise<Batch[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return await this.repo.find({
            where: {
                status: BatchStatus.ACTIVE,
                expirationDate: LessThan(today),
                currentQuantity: MoreThan(0),
            },
            relations: ['product'],
        });
    }

    async getBatchesExpiringSoon(daysThreshold: number = 3): Promise<Batch[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thresholdDate = new Date(today);
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        return await this.repo.find({
            where: {
                status: BatchStatus.ACTIVE,
                expirationDate: Between(today, thresholdDate),
                currentQuantity: MoreThan(0),
            },
            relations: ['product'],
            order: { expirationDate: 'ASC' },
        });
    }

    async getBatchWithMovements(batchId: string): Promise<Batch | null> {
        return await this.repo.findOne({
            where: { id: batchId },
            relations: ['product', 'movements'],
        });
    }


    async incrementReservedQuantity(batchId: string, qty: number, manager?: EntityManager) {
        return this.getRepo(manager).increment(
            { id: batchId },
            'reservedQuantity',
            qty,
        );
    }

    async decrementReservedQuantity(batchId: string, quantity: number): Promise<void> {
        await this.repo.decrement(
            { id: batchId, status: BatchStatus.ACTIVE },
            'reservedQuantity',
            quantity
        );
    }

    async consumeReservedQuantity(batchId: string, quantity: number): Promise<void> {
        await this.repo
            .createQueryBuilder()
            .update(Batch)
            .set({
                currentQuantity: () => `currentQuantity - ${quantity}`,
                reservedQuantity: () => `reservedQuantity - ${quantity}`,
            })
            .where("id = :batchId", { batchId })
            .andWhere("status = :status", { status: BatchStatus.ACTIVE })
            .andWhere("currentQuantity >= :quantity", { quantity })
            .andWhere("reservedQuantity >= :quantity", { quantity })
            .execute();
    }

    async findActiveByProductIdandKioskId(productId: string, kioskUserId: number, manager?: EntityManager,): Promise<Batch[]> {
        const repo: Repository<Batch> = manager
            ? manager.getRepository(Batch)
            : this.repo;

        return await repo.find({
            where: {
                product: {
                    id: productId,
                    kioskUserId: kioskUserId,
                },
                status: BatchStatus.ACTIVE,
                currentQuantity: MoreThan(0),
                expirationDate: MoreThanOrEqual(new Date()),
            },
            relations: ['product'],
            order: {
                expirationDate: 'ASC',
            },
        });
    }
    private getRepo(manager?: EntityManager) {
        return manager ? manager.getRepository(Batch) : this.repo;
    }

    async findActiveByProductId(productId: string): Promise<Batch[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return await this.repo.find({
            where: {
                productId,
                status: BatchStatus.ACTIVE,
                currentQuantity: MoreThanOrEqual(0),
                expirationDate: MoreThanOrEqual(today),
            },
            order: {
                expirationDate: 'ASC',
                productionDate: 'ASC',
            },
            relations: ['product'],
        });
    }

    async findActiveBatchesWithAvailableStock(productId: string, kioskUserId: number): Promise<Batch[]> {
        return await this.repo
            .createQueryBuilder('batch')
            .where('batch.productId = :productId', { productId })
            .andWhere('batch.kioskUserId = :kioskUserId', { kioskUserId })
            .andWhere('batch.status = :status', { status: BatchStatus.ACTIVE })
            .andWhere('batch.expirationDate >= :today', { today: new Date() })
            .andWhere('(batch.currentQuantity - batch.reservedQuantity) > 0')
            .orderBy('batch.expirationDate', 'ASC') // FEFO
            .addOrderBy('batch.productionDate', 'ASC')
            .getMany();
    }

    async getAvailableQuantityByBatch(batchId: string): Promise<number> {
        const batch = await this.repo.findOne({
            where: {
                id: batchId,
                status: BatchStatus.ACTIVE,
                expirationDate: MoreThanOrEqual(new Date())
            },
            select: ['currentQuantity', 'reservedQuantity']
        });

        if (!batch) {
            return 0;
        }

        return Math.max(0, batch.currentQuantity - batch.reservedQuantity);
    }

    async executeInTransaction<T>(callback: () => Promise<T>): Promise<T> {
        return await this.dataSource.transaction(callback);
    }
}