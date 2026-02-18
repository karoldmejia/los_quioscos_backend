import { IsEnum, IsInt, IsNotEmpty, IsString, Min, Max } from 'class-validator';
import { StockMovementType } from '../enums/stock-movement-type.enum';

export class CreateStockMovementDto {
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsEnum(StockMovementType)
  type: StockMovementType;

  @IsInt()
  @Min(-1000000)
  @Max(1000000)
  delta: number;
}
