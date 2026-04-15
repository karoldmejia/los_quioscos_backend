import { IsInt, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class CreateContractItemDto {
  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsOptional()
  requirements_json?: any;
}

export class ContractItemResponseDto {
  contract_item_id: string;
  product_id: string;
  product_name?: string;
  quantity: number;
  unit_price: number;
  requirements_json?: any;
  subtotal: number;
}