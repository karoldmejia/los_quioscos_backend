import { IsArray, IsObject } from "class-validator";

export class CheckoutSessionResponseDto<T = any, U = any> {
  @IsObject()
  session: T;

  @IsArray()
  orders: U[];
}