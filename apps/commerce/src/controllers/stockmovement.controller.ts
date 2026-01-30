import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { StockMovementService } from '../services/stockmovement.service';
import { StockMovement } from '../entities/stockmovement.entity';
import { CreateStockMovementDto } from '../dtos/create-stockmovement.dto';
import { Batch } from '../entities/batch.entity';
import { ConsumeStockFefoResultDto } from '../dtos/consumed-stock.dto';

@Controller()
export class StockMovementController {
  constructor(private readonly stockMovementService: StockMovementService) {}

  @MessagePattern({ cmd: 'create_movement' })
  async createMovement(@Payload() dto: CreateStockMovementDto): Promise<StockMovement> {
    return await this.stockMovementService.createMovement(dto);
  }

  @MessagePattern({ cmd: 'apply_movement' })
  async applyMovement(@Payload() dto: CreateStockMovementDto): Promise<{
    movement: StockMovement;
    batch: Batch;
  }> {
    return await this.stockMovementService.applyMovement(dto);
  }

  @MessagePattern({ cmd: 'adjust_stock' })
  async adjustStock(@Payload() payload: { batchId: string; delta: number }): Promise<{
    movement: StockMovement;
    batch: Batch;
  }> {
    const { batchId, delta } = payload;
    return await this.stockMovementService.adjustStock(batchId, delta);
  }

  @MessagePattern({ cmd: 'restock_batch' })
  async restockBatch(@Payload() payload: { batchId: string; quantity: number }): Promise<{
    movement: StockMovement;
    batch: Batch;
  }> {
    const { batchId, quantity } = payload;
    return await this.stockMovementService.restockBatch(batchId, quantity);
  }

  @MessagePattern({ cmd: 'consume_stock_fefo' })
  async consumeStockFEFO(@Payload() payload: {
    productId: string;
    requestedQuantity: number;
    orderId?: string;
  }): Promise<ConsumeStockFefoResultDto> {
    const { productId, requestedQuantity, orderId } = payload;
    return await this.stockMovementService.consumeStockFEFO(productId, requestedQuantity, orderId);
  }

  @MessagePattern({ cmd: 'register_expired_removal' })
  async registerExpiredRemoval(@Payload() batchId: string): Promise<{
    movement: StockMovement;
    batch: any;
  }> {
    return await this.stockMovementService.registerExpiredRemoval(batchId);
  }

  @MessagePattern({ cmd: 'get_movements_by_batch' })
  async getMovementsByBatch(@Payload() batchId: string): Promise<StockMovement[]> {
    return await this.stockMovementService.getMovementsByBatch(batchId);
  }

  @MessagePattern({ cmd: 'get_movements_by_product' })
  async getMovementsByProduct(@Payload() productId: string): Promise<StockMovement[]> {
    return await this.stockMovementService.getMovementsByProduct(productId);
  }

  @MessagePattern({ cmd: 'get_product_movement_summary' })
  async getProductMovementSummary(@Payload() payload: {
    productId: string;
    days?: number;
  }): Promise<any> {
    const { productId, days } = payload;
    return await this.stockMovementService.getProductMovementSummary(productId, days);
  }

  @MessagePattern({ cmd: 'get_batch_movement_history' })
  async getBatchMovementHistory(@Payload() payload: {
    batchId: string;
    days?: number;
  }): Promise<{ movements: StockMovement[]; summary: any }> {
    const { batchId, days } = payload;
    return await this.stockMovementService.getBatchMovementHistory(batchId, days);
  }

  @MessagePattern({ cmd: 'verify_stock_integrity' })
  async verifyStockIntegrity(@Payload() batchId: string): Promise<boolean> {
    return await this.stockMovementService.verifyStockIntegrity(batchId);
  }
}