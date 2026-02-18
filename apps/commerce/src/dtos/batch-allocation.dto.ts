import { IsUUID, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Batch } from '../entities/batch.entity';

export class BatchAllocationDTO {
  @IsUUID()
  batchId: string;

  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @ValidateNested()
  @Type(() => Batch)
  batch: Batch;
}