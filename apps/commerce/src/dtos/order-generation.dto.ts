import { IsUUID, IsDateString, IsArray, ValidateNested, IsNumber, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

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
    contract_schedule_id: string;

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
    schedule_id: string;
    order_id?: string;
    error?: string;
}

export class ScheduleGenerationSummaryDto {
    contracts_processed: number;
    schedules_created: number;
    orders_generated: number;
    errors: Array<{
        schedule_id: string;
        error: string;
    }>;
}