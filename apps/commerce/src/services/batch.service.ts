import { Injectable, Logger } from '@nestjs/common';
import { Batch } from '../entities/batch.entity';
import { BatchStatus } from '../enums/batch-status.enum';
import { StockMovementType } from '../enums/stock-movement-type.enum';
import { BatchRepository } from '../repositories/impl/batch.repository';
import { RpcException } from '@nestjs/microservices';
import { CreateBatchDto } from '../dtos/create-batch.dto';
import { StockMovementService } from './stockmovement.service';
import { CreateStockMovementDto } from '../dtos/create-stockmovement.dto';
import { Cron } from '@nestjs/schedule';
import { ProductService } from './product.service';

@Injectable()
export class BatchService {

    constructor(
        private readonly repo: BatchRepository,
        private readonly productService: ProductService,
        private readonly stockMovementService: StockMovementService,
    ) { }

    // create and register a batch
    async createBatch(dto: CreateBatchDto): Promise<Batch> {
        // domain validations
        if (dto.initialQuantity <= 0) {
            throw new RpcException('initialQuantity must be greater than 0');
        }

        const productionDate = new Date(dto.productionDate)

        if (!productionDate || productionDate > new Date()) {
            throw new RpcException('productionDate must be a valid date not in the future');
        }

        const product = await this.productService.findById(dto.productId);
        if (!product) {
            throw new RpcException(`Product with id ${dto.productId} not found`);
        }

        // calculate expiration date based on product duration
        const expirationDate = new Date(productionDate);
        expirationDate.setDate(expirationDate.getDate() + product.durationDays);

        const batchId = await this.repo.getNextBatchId(productionDate);

        // create batch
        const batch = new Batch();
        batch.id = batchId;
        batch.productId = dto.productId;
        batch.productionDate = productionDate;
        batch.expirationDate = expirationDate;
        batch.initialQuantity = dto.initialQuantity;
        batch.currentQuantity = dto.initialQuantity;
        batch.status = BatchStatus.ACTIVE;
        batch.createdAt = new Date();

        const savedBatch = await this.repo.create(batch);

        const stockDto: CreateStockMovementDto = {
            batchId,
            type: StockMovementType.RESTOCK,
            delta: dto.initialQuantity
        };

        await this.stockMovementService.createMovement(stockDto);

        return savedBatch;
    }

    async findById(batchId: string): Promise<Batch | null> {
        return await this.repo.findById(batchId);
    }

    async getActiveBatchesByProduct(productId: string): Promise<Batch[]> {
        const batches = await this.repo.findActiveByProductId(productId);
        return batches;
    }

    async getTotalStockByProduct(productId: string): Promise<number> {
        return await this.repo.getTotalStockByProduct(productId);
    }

    async markBatchAsDepleted(batchId: string, reason?: string): Promise<Batch> {
        const batch = await this.repo.findById(batchId);
        if (!batch) {
            throw new RpcException(`Batch with id ${batchId} not found`);
        }

        if (batch.currentQuantity <= 0) {
            throw new RpcException('Batch is already depleted');
        }

        const oldQuantity = batch.currentQuantity;

        // update batch using transaction
        const updatedBatch = await this.repo.executeInTransaction(async () => {
            const stockDto: CreateStockMovementDto = {
                batchId: batch.id,
                type: StockMovementType.MANUAL_OUT,
                delta: -oldQuantity
            };

            await this.stockMovementService.applyMovement(stockDto);

            batch.currentQuantity = 0;
            batch.status = BatchStatus.DEPLETED;
            const savedBatch = await this.repo.save(batch);

            return savedBatch;
        });

        return updatedBatch;
    }

    // mark whole product as out of stock
    async markProductAsOutOfStock(productId: string, reason?: string): Promise<void> {
        const batches = await this.repo.findByProductId(productId);
        const activeBatches = batches.filter(b =>
            b.status === BatchStatus.ACTIVE && b.currentQuantity > 0
        );

        if (activeBatches.length === 0) {
            return;
        }

        await this.repo.executeInTransaction(async () => {
            for (const batch of activeBatches) {
                const oldQuantity = batch.currentQuantity;

                const stockDto: CreateStockMovementDto = {
                    batchId: batch.id,
                    type: StockMovementType.MANUAL_OUT,
                    delta: -oldQuantity
                };
                await this.stockMovementService.applyMovement(stockDto);

                batch.currentQuantity = 0;
                batch.status = BatchStatus.MANUAL_OUT;
                await this.repo.save(batch);
            }
        });
    }

    async refreshBatchStatus(batchId: string): Promise<Batch> {
        const batch = await this.repo.findById(batchId);
        if (!batch) {
            throw new RpcException(`Batch with id ${batchId} not found`);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expirationDate = new Date(batch.expirationDate);
        expirationDate.setHours(0, 0, 0, 0);

        let newStatus = batch.status;

        // Check expiration first - this should take precedence
        if (expirationDate <= today) {
            newStatus = BatchStatus.EXPIRED;

            if (batch.currentQuantity > 0) {
                await this.handleExpiredBatchWithStock(batch);
            }
        }
        // Only check for other statuses if not expired
        else if (batch.currentQuantity <= 0) {
            // Check if it's MANUAL_OUT first
            if (batch.status === BatchStatus.MANUAL_OUT) {
                newStatus = BatchStatus.MANUAL_OUT;
            } else {
                newStatus = BatchStatus.DEPLETED;
            }
        }
        else if (batch.currentQuantity > 0) {
            newStatus = BatchStatus.ACTIVE;
        }

        // Only change it if status changed
        if (batch.status !== newStatus) {
            batch.status = newStatus;
            const updatedBatch = await this.repo.save(batch);
            return updatedBatch;
        }

        return batch;
    }

    @Cron('0 5 0 * * *')
    async expireBatchesCron(): Promise<void> {

        try {
            const expiredCount = await this.expireBatchesJob();
        } catch (error) {
        }
    }

    async expireBatchesJob(): Promise<number> {
        const batchesNeedingExpiration = await this.repo.getBatchesNeedingExpiration();

        if (batchesNeedingExpiration.length === 0) {
            return 0;
        }

        let expiredCount = 0;

        for (const batch of batchesNeedingExpiration) {
            try {
                await this.handleExpiredBatchWithStock(batch);
                expiredCount++;
            } catch (error) {
            }
        }

        return expiredCount;
    }

    // soft delete batch
    async deleteBatch(batchId: string, reason?: string): Promise<void> {
        const batch = await this.repo.findById(batchId);
        if (!batch) {
            throw new RpcException(`Batch with id ${batchId} not found`);
        }

        // we just delete it if its depleted or expired
        if (batch.status !== BatchStatus.DEPLETED && batch.status !== BatchStatus.EXPIRED) {
            throw new RpcException('Batch can only be deleted if DEPLETED or EXPIRED');
        }

        batch.status = BatchStatus.DELETED;
        await this.repo.save(batch);
    }

    async getBatchHistory(productId?: string, batchId?: string): Promise<Batch[]> {
        return await this.repo.getBatchHistory(productId, batchId);
    }

    // method to update batch quantity
    async updateBatchQuantity(batchId: string, delta: number,): Promise<Batch> {
        if (delta === 0) {
            throw new RpcException('Delta cannot be zero');
        }

        return await this.repo.executeInTransaction(async () => {
            const batch = await this.repo.findById(batchId);

            if (!batch) {
                throw new RpcException(`Batch with id ${batchId} not found`);
            }

            if (batch.status !== BatchStatus.ACTIVE) {
                throw new RpcException(`Cannot update quantity for batch in status: ${batch.status}`);
            }

            const today = new Date();
            if (batch.expirationDate < today) {
                throw new RpcException('Cannot update quantity for expired batch');
            }

            const newQuantity = batch.currentQuantity + delta;

            if (newQuantity < 0) {
                throw new RpcException(
                    `Insufficient stock. Available: ${batch.currentQuantity}, requested: ${Math.abs(delta)}`,
                );
            }
            batch.currentQuantity = newQuantity;

            if (batch.currentQuantity === 0) {
                batch.status = BatchStatus.DEPLETED;
            }
            const updatedBatch = await this.repo.save(batch);
            return updatedBatch;
        });
    }

    // helpers private methods
    private async handleExpiredBatchWithStock(batch: Batch): Promise<void> {
        if (batch.currentQuantity <= 0) {
            batch.status = BatchStatus.EXPIRED;
            await this.repo.save(batch);
            return;
        }

        const oldQuantity = batch.currentQuantity;

        // use transaction for consistency
        await this.repo.executeInTransaction(async () => {
            batch.currentQuantity = 0;
            batch.status = BatchStatus.EXPIRED;
            await this.repo.save(batch);

            const stockDto: CreateStockMovementDto = {
                batchId: batch.id,
                type: StockMovementType.EXPIRED_REMOVAL,
                delta: -oldQuantity
            };

            await this.stockMovementService.createMovement(stockDto);
        });
    }

    // aditional methods
    async getProductStockSummary(productId: string): Promise<{ totalStock: number; activeBatches: Batch[]; expiringSoon: Batch[]; }> {
        const [totalStock, activeBatches, expiringSoon] = await Promise.all([
            this.getTotalStockByProduct(productId),
            this.getActiveBatchesByProduct(productId),
            this.repo.getBatchesExpiringSoon(3),
        ]);

        return {
            totalStock,
            activeBatches,
            expiringSoon: expiringSoon.filter(b => b.productId === productId),
        };
    }

    async refreshAllBatchStatuses(): Promise<void> {
        const allBatches = await this.repo.findBatchesByStatus(BatchStatus.ACTIVE);

        for (const batch of allBatches) {
            try {
                await this.refreshBatchStatus(batch.id);
            } catch (RpcException) {
                throw new RpcException(`Failed to refresh batch ${batch.id}: ${RpcException.message}`);
            }
        }
    }
}