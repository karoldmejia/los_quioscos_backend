import { StockMovementType } from '../enums/stock-movement-type.enum';
import { StockMovement } from '../entities/stockmovement.entity';

export interface IStockMovementRepository {
  // basic crud functionalities
  create(movement: StockMovement): Promise<StockMovement>;
  save(movement: StockMovement): Promise<StockMovement>;
  findById(movementId: string): Promise<StockMovement | null>;
  
  // simple queries
  findByBatchId(batchId: string): Promise<StockMovement[]>;
  findByProductId(productId: string): Promise<StockMovement[]>;
  findByType(type: StockMovementType): Promise<StockMovement[]>;
  
  // advanced queries
  findMovementsByDateRange(startDate: Date, endDate: Date): Promise<StockMovement[]>;
  findMovementsByBatchAndDate(batchId: string, startDate: Date, endDate: Date): Promise<StockMovement[]>;
  findMovementsByProductAndDate(productId: string, startDate: Date, endDate: Date): Promise<StockMovement[]>;
  
  // statistical queries
  getTotalMovementByBatch(batchId: string): Promise<number>;
  getTotalMovementByProduct(productId: string): Promise<number>;
  getMovementSummaryByProduct(productId: string, startDate?: Date, endDate?: Date): Promise<any>;
  
  // transactional helper method
  executeInTransaction<T>(callback: () => Promise<T>): Promise<T>;
}