import { IsUUID, IsInt, IsArray, ValidateNested, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationRequestItemDTO } from './reservation-request-item.dto';

export class ReservationRequestDTO {
  @IsUUID()
  orderId: string;

  @IsInt()
  kioskUserId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationRequestItemDTO)
  items: ReservationRequestItemDTO[];

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'ExpiresInMinutes must be at least 1 minute' })
  expiresInMinutes?: number = 15;
}