import { BatchStatus } from '../enums/batch-status.enum';
import { Batch } from '../entities/batch.entity';

export abstract class IBatchRepository {
  // basic crud methods
  abstract create(batch: Batch): Promise<Batch>;
  abstract save(batch: Batch): Promise<Batch>;
  abstract update(batch: Batch): Promise<Batch>;
  abstract findById(batchId: string): Promise<Batch | null>;
  abstract findByIdIncludingDeleted(batchId: string): Promise<Batch | null>;
  
  // query methods
  abstract findByProductId(productId: string): Promise<Batch[]>;
  abstract findActiveByProductId(productId: string, kioskUserId: number): Promise<Batch[]>;
  abstract findBatchesByStatus(status: BatchStatus): Promise<Batch[]>;
  abstract getTotalStockByProduct(productId: string): Promise<number>;
  abstract getBatchHistory(productId?: string, batchId?: string): Promise<Batch[]>;
  
  // next batch
  abstract getNextBatchId(productionDate: Date): Promise<string>;
  
  // specific query methods
  abstract getBatchesNeedingExpiration(): Promise<Batch[]>;
  abstract getBatchesExpiringSoon(daysThreshold?: number): Promise<Batch[]>;
  abstract getBatchWithMovements(batchId: string): Promise<Batch | null>;

  abstract executeInTransaction<T>(callback: () => Promise<T>): Promise<T>;
}