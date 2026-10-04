import { IsUUID, IsInt, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class ReservationRequestDTO {
  @IsUUID()
  orderId: string;

  @IsInt()
  kioskUserId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationRequestItemDTO)
  items: ReservationRequestItemDTO[];

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'ExpiresInMinutes must be at least 1 minute' })
  expiresInMinutes?: number = 15;
}

export class ReservationRequestItemDTO {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}