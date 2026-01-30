import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { BatchService } from '../services/batch.service';
import { Batch } from '../entities/batch.entity';
import { CreateBatchDto } from '../dtos/create-batch.dto';

@Controller()
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @MessagePattern({ cmd: 'create_batch' })
  async createBatch(@Payload() dto: CreateBatchDto): Promise<Batch> {
    return await this.batchService.createBatch(dto);
  }

  @MessagePattern({ cmd: 'get_batch' })
  async getBatch(@Payload() batchId: string): Promise<Batch | null> {
    return await this.batchService.findById(batchId);
  }

  @MessagePattern({ cmd: 'get_active_batches_by_product' })
  async getActiveBatchesByProduct(@Payload() productId: string): Promise<Batch[]> {
    return await this.batchService.getActiveBatchesByProduct(productId);
  }

  @MessagePattern({ cmd: 'get_total_stock_by_product' })
  async getTotalStockByProduct(@Payload() productId: string): Promise<number> {
    return await this.batchService.getTotalStockByProduct(productId);
  }

  @MessagePattern({ cmd: 'mark_batch_as_depleted' })
  async markBatchAsDepleted(@Payload() payload: { batchId: string; reason?: string }): Promise<Batch> {
    const { batchId, reason } = payload;
    return await this.batchService.markBatchAsDepleted(batchId, reason);
  }

  @MessagePattern({ cmd: 'mark_product_as_out_of_stock' })
  async markProductAsOutOfStock(@Payload() payload: { productId: string; reason?: string }): Promise<void> {
    const { productId, reason } = payload;
    return await this.batchService.markProductAsOutOfStock(productId, reason);
  }

  @MessagePattern({ cmd: 'refresh_batch_status' })
  async refreshBatchStatus(@Payload() batchId: string): Promise<Batch> {
    return await this.batchService.refreshBatchStatus(batchId);
  }

  @MessagePattern({ cmd: 'expire_batches_job' })
  async expireBatchesJob(): Promise<number> {
    return await this.batchService.expireBatchesJob();
  }

  @MessagePattern({ cmd: 'delete_batch' })
  async deleteBatch(@Payload() payload: { batchId: string; reason?: string }): Promise<void> {
    const { batchId, reason } = payload;
    return await this.batchService.deleteBatch(batchId, reason);
  }

  @MessagePattern({ cmd: 'get_batch_history' })
  async getBatchHistory(@Payload() payload: { productId?: string; batchId?: string }): Promise<Batch[]> {
    const { productId, batchId } = payload;
    return await this.batchService.getBatchHistory(productId, batchId);
  }

  @MessagePattern({ cmd: 'update_batch_quantity' })
  async updateBatchQuantity(@Payload() payload: { batchId: string; delta: number }): Promise<Batch> {
    const { batchId, delta } = payload;
    return await this.batchService.updateBatchQuantity(batchId, delta);
  }

  @MessagePattern({ cmd: 'get_product_stock_summary' })
  async getProductStockSummary(@Payload() productId: string): Promise<{
    totalStock: number;
    activeBatches: Batch[];
    expiringSoon: Batch[];
  }> {
    return await this.batchService.getProductStockSummary(productId);
  }

  @MessagePattern({ cmd: 'refresh_all_batch_statuses' })
  async refreshAllBatchStatuses(): Promise<void> {
    return await this.batchService.refreshAllBatchStatuses();
  }

}