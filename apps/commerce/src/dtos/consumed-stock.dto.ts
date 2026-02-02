import { IsArray, IsBoolean, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StockMovement } from '../entities/stock-movement.entity';
import { BatchConsumedDto } from './batch-consumed.dto';

export class ConsumeStockFefoResultDto {
  @IsBoolean()
  success: boolean;

  @IsInt()
  @Min(0)
  consumedQuantity: number;

  @IsInt()
  @Min(0)
  remainingQuantity: number;

  @IsArray()
  movements: StockMovement[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchConsumedDto)
  batchesConsumed: BatchConsumedDto[];
}
