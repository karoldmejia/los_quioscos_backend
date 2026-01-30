import { IsDateString, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  // it is better to get is as a ISO string from the request
  // Ej: "2026-01-29" o "2026-01-29T10:00:00.000Z"
  @IsDateString()
  productionDate: string;

  @IsInt()
  @Min(1)
  initialQuantity: number;
}
