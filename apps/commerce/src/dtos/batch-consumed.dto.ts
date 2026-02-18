import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { BatchStatus } from '../enums/batch-status.enum';

export class BatchConsumedDto {
  @IsString()
  @IsNotEmpty()
  batchId: string;

  @IsInt()
  @Min(0)
  consumed: number;

  @IsInt()
  @Min(0)
  remaining: number;

  @IsEnum(BatchStatus)
  status: BatchStatus;
}
