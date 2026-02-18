import { IsEnum, IsNumber, IsString, IsOptional, IsArray, MaxLength, IsPositive, IsDecimal,MinLength, Max } from 'class-validator';
import { ProductCategory } from '../enums/product-category.enum';
import { UnitMeasure } from '../enums/unit-measure.enum';

export class CreateProductDto {
    @IsNumber()
    kioskUserId: number;

    @IsString()
    @MinLength(2)
    @MaxLength(120)
    name: string;

    @IsEnum(ProductCategory)
    category: ProductCategory;

    @IsOptional()
    @IsEnum(UnitMeasure)
    unitMeasure?: UnitMeasure;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    customUnitMeasure?: string;

    @IsString()
    @IsDecimal({ decimal_digits: '2' })
    price: string;

    @IsNumber()
    @IsPositive()
    @Max(30) // max one month
    durationDays: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    description?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @MaxLength(5, { each: true }) // max 5 photos
    photos?: string[];
}