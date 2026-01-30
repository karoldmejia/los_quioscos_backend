import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CreateStockMovementDto } from '../dtos/create-stockmovement.dto';
import { StockMovement } from '../entities/stockmovement.entity';
import { Batch } from '../entities/batch.entity';
import { BatchService } from './batch.service';
import { StockMovementRepository } from '../repositories/impl/stockmovement.repository';
import { RpcException } from '@nestjs/microservices';
import { StockMovementType } from '../enums/stock-movement-type.enum';
import { ConsumeStockFefoResultDto } from '../dtos/consumed-stock.dto';
import { BatchConsumedDto } from '../dtos/batch-consumed.dto';

@Injectable()
export class StockMovementService {

    constructor(
        private readonly movementRepository: StockMovementRepository,
        @Inject(forwardRef(() => BatchService))
        private readonly batchService: BatchService,
    ) { }


    // register a movement (base function)
    async createMovement(stockMovementDto: CreateStockMovementDto): Promise<StockMovement> {
        const delta = stockMovementDto.delta;
        if (delta === 0) {
            throw new RpcException('Delta cannot be zero');
        }

        // create movement
        const movement = new StockMovement();
        movement.batchId = stockMovementDto.batchId;
        movement.type = stockMovementDto.type;
        movement.delta = delta;
        movement.createdAt = new Date();

        const savedMovement = await this.movementRepository.create(movement);
        return savedMovement;
    }

    // apply movement
    async applyMovement(stockMovementDto: CreateStockMovementDto): Promise<{ movement: StockMovement; batch: Batch; }> {
        const delta = stockMovementDto.delta;
        const batchId = stockMovementDto.batchId;
        const type = stockMovementDto.type;

        if (delta === 0) {
            throw new RpcException('Delta cannot be zero');
        }

        // use transaction to guarantee consistency
        const result = await this.movementRepository.executeInTransaction(async () => {
            // 1. get current batch
            const batch = await this.batchService.findById(batchId);
            if (!batch) {
                throw new RpcException(`Batch with id ${batchId} not found`);
            }

            // 2. verify it is not negative
            const newQuantity = batch.currentQuantity + delta;
            if (newQuantity < 0) {
                throw new RpcException(`Insufficient stock in batch ${batchId}. Available: ${batch.currentQuantity}, requested: ${-delta}`);
            }

            // 3. update batch quantity
            await this.batchService.updateBatchQuantity(batchId, delta);

            // 4. create movement
            const movement = await this.createMovement(stockMovementDto);

            // 5. update batch status
            const refreshedBatch = await this.batchService.refreshBatchStatus(batchId);

            // 6. implement low stock alert (later)
            // await this.checkLowStock(batch.productId);

            return {
                movement,
                batch: refreshedBatch,
            };
        });

        return result;
    }

    // manual adjustment
    async adjustStock(batchId: string, delta: number): Promise<{ movement: StockMovement; batch: Batch; }> {
        if (delta === 0) {
            throw new RpcException('Delta cannot be zero for adjustment');
        }
        const dto: CreateStockMovementDto = { batchId, type: StockMovementType.ADJUSTMENT, delta };

        return await this.applyMovement(dto);
    }

    // restock
    async restockBatch(batchId: string, quantity: number): Promise<{ movement: StockMovement; batch: Batch }> {
        if (quantity <= 0) {
            throw new RpcException('Restock quantity must be greater than 0');
        }

        // verify that it is not expired
        const batch = await this.batchService.findById(batchId);
        if (!batch) {
            throw new RpcException(`Batch with id ${batchId} not found`);
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expirationDate = new Date(batch.expirationDate);
        expirationDate.setHours(0, 0, 0, 0);
        if (expirationDate < today) {
            throw new RpcException('Cannot restock expired batch');
        }

        const dto: CreateStockMovementDto = { batchId, type: StockMovementType.RESTOCK, delta: quantity };

        return await this.applyMovement(dto);
    }

    async consumeStockFEFO(productId: string, requestedQuantity: number, orderId?: string): Promise<ConsumeStockFefoResultDto> {
        if (requestedQuantity <= 0) {
            throw new RpcException('Requested quantity must be greater than 0');
        }

        const totalStock = await this.batchService.getTotalStockByProduct(productId);
        if (totalStock < requestedQuantity) {
            throw new RpcException(`Insufficient stock for product ${productId}. Available: ${totalStock}, requested: ${requestedQuantity}`);
        }

        const activeBatches = await this.batchService.getActiveBatchesByProduct(productId);
        if (activeBatches.length === 0) {
            throw new RpcException(`No active batches found for product ${productId}`);
        }

        let remainingQuantity = requestedQuantity;
        const movements: StockMovement[] = [];
        const batchesConsumed: BatchConsumedDto[] = [];

        const result = await this.movementRepository.executeInTransaction(async () => {
            for (const batch of activeBatches) {
                if (remainingQuantity <= 0) break;

                const availableInBatch = Math.min(batch.currentQuantity, remainingQuantity);

                if (availableInBatch > 0) {
                    const dto: CreateStockMovementDto = { batchId: batch.id, type: StockMovementType.SALE, delta: -availableInBatch };
                    const movement = await this.applyMovement(dto);

                    movements.push(movement.movement);

                    batchesConsumed.push({
                        batchId: batch.id,
                        consumed: availableInBatch,
                        remaining: movement.batch.currentQuantity,
                        status: movement.batch.status,
                    });

                    remainingQuantity -= availableInBatch;
                }
            }

            const dto: ConsumeStockFefoResultDto = {
                success: remainingQuantity === 0,
                consumedQuantity: requestedQuantity - remainingQuantity,
                remainingQuantity,
                movements,
                batchesConsumed,
            };

            return dto;
        });

        return result;
    }

    // delete for expiration
    async registerExpiredRemoval(batchId: string): Promise<{movement: StockMovement; batch: any;}> {
        const batch = await this.batchService.findById(batchId);
        if (!batch) {
            throw new RpcException(`Batch with id ${batchId} not found`);
        }

        if (batch.currentQuantity <= 0) {
            throw new RpcException('Batch already has zero quantity');
        }

        const delta = -batch.currentQuantity;

        const dto: CreateStockMovementDto = { batchId: batch.id, type: StockMovementType.EXPIRED_REMOVAL, delta };

        return await this.applyMovement(dto);
    }

    async getMovementsByBatch(batchId: string): Promise<StockMovement[]> {
        return await this.movementRepository.findByBatchId(batchId);
    }

    async getMovementsByProduct(productId: string): Promise<StockMovement[]> {
        return await this.movementRepository.findByProductId(productId);
    }

    // get product movement summary
    async getProductMovementSummary(productId: string, days?: number): Promise<any> {
        const endDate = new Date();
        const startDate = days ? new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000)) : undefined;

        const summary = await this.movementRepository.getMovementSummaryByProduct(productId, startDate, endDate);

        // calculate totals
        let totalIn = 0;
        let totalOut = 0;

        summary.forEach(item => {
            const total = parseInt(item.total, 10);
            if (total > 0) {
                totalIn += total;
            } else {
                totalOut += Math.abs(total);
            }
        });

        return {
            summary,
            totals: {
                in: totalIn,
                out: totalOut,
                net: totalIn - totalOut,
            },
            period: {
                startDate: startDate || 'all time',
                endDate,
            },
        };
    }

    async getBatchMovementHistory(batchId: string, days?: number): Promise<{ movements: StockMovement[]; summary: any; }> {
        const endDate = new Date();
        const startDate = days ? new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000)) : undefined;

        let movements: StockMovement[];

        if (startDate) {
            movements = await this.movementRepository.findMovementsByBatchAndDate(batchId, startDate, endDate);
        } else {
            movements = await this.movementRepository.findByBatchId(batchId);
        }

        // calculate summary
        const summary = movements.reduce((acc, movement) => {
            if (!acc[movement.type]) {
                acc[movement.type] = { count: 0, total: 0 };
            }
            acc[movement.type].count++;
            acc[movement.type].total += movement.delta;
            return acc;
        }, {} as Record<string, { count: number; total: number }>);

        return { movements, summary };
    }

    // method to verify stock integrity
    async verifyStockIntegrity(batchId: string): Promise<boolean> {
        const batch = await this.batchService.findById(batchId);
        if (!batch) {
            throw new RpcException(`Batch with id ${batchId} not found`);
        }

        // calculate supposed quantity based on movements
        const totalMovement = await this.movementRepository.getTotalMovementByBatch(batchId);
        const theoreticalQuantity = totalMovement;

        // Compare with current quantity
        const integrity = batch.currentQuantity === theoreticalQuantity;

        if (!integrity) {
            throw new RpcException(`Stock integrity issue for batch ${batchId}: Current=${batch.currentQuantity}, Theoretical=${theoreticalQuantity}`);
        }

        return integrity;
    }
}