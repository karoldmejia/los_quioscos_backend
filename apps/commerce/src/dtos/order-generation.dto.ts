import { IsUUID, IsDateString, IsArray, ValidateNested, IsNumber, IsString, IsOptional, IsNotEmpty, IsEnum, Min, IsPositive, Max, IsBoolean, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { PackageType } from '../enums/package-type.enum';
import { DeliveryMode } from 'src/enums/delivery-mode.enum';

export class OrderItemDto {
    @IsUUID()
    product_id: string;

    @IsNumber()
    quantity: number;

    @IsNumber()
    unit_price: number;

    @IsOptional()
    requirements_json?: any;
}

export class GenerateOrderDto {
    @IsUUID()
    delivery_id: string;

    @IsUUID()
    contract_id: string;

    @IsUUID()
    business_id: string;

    @IsUUID()
    kiosk_id: string;

    @IsNumber()
    kiosk_user_id: number;

    @IsDateString()
    scheduled_delivery_date: Date;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    @IsNumber()
    total_value: number;
}

export class OrderGenerationResultDto {
    success: boolean;
    delivery_id: string;
    order_id?: string;
    error?: string;
}

export class DeliveryGenerationSummaryDto {
    contracts_processed: number;
    deliveries_created: number;
    orders_generated: number;
    errors: Array<{
        delivery_id: string;
        error: string;
    }>;
}

export class PackageDto {
    @IsNotEmpty()
    @IsNumber()
    @Min(0.01)
    @Max(500)
    weightKg: number;

    @IsNotEmpty()
    @IsEnum(PackageType)
    packageType: PackageType;

    @IsNotEmpty()
    @IsBoolean()
    isFragile: boolean;
}

export class LogisticsLoadDto {
    @IsNotEmpty()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => PackageDto)
    packages: PackageDto[];
}

export interface OrderPaidItemDto {
    name: string;
    unit: string;
    quantity: number;
}

export interface OrderPaidEventDto {
    orderId: string;
    userId: string;
    kioskId: string;
    deliveryMode: DeliveryMode;
    items: OrderPaidItemDto[];
    logisticsLoad: LogisticsLoadDto;
}