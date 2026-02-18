import { IsUUID, IsInt, Min } from 'class-validator';

export class ReservationRequestItemDTO {
  @IsUUID()
  productId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}