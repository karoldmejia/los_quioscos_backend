import { IsString, IsOptional, IsNumber, Min, Max, MinLength } from 'class-validator';

export class SearchProductDto {
    @IsString()
    @MinLength(2)
    query: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number;
}