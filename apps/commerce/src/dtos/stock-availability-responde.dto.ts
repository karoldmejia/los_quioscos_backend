import { IsUUID, IsInt, IsBoolean, Min } from 'class-validator';

export class StockAvailabilityResponseDTO {
  @IsUUID()
  productId: string;

  @IsBoolean()
  available: boolean;

  @IsInt()
  @Min(1)
  requested: number;

  @IsInt()
  @Min(0)
  availableQuantity: number;

  @IsBoolean()
  hasSufficientStock: boolean;

  constructor(partial: Partial<StockAvailabilityResponseDTO>) {
    Object.assign(this, partial);
    this.hasSufficientStock = this.available;
  }
}