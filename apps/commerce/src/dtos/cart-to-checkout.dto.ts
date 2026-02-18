import { IsNotEmpty, IsString } from "class-validator";

export class CartToCheckoutDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  cartId: string;
}