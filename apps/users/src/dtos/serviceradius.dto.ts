import { IsNumber, IsPositive, Max, Min } from "class-validator";

export class CreateServiceRadiusDto {
    @IsNumber()
    @IsPositive()
    userId: string;

    @IsNumber()
    @Min(1)
    @Max(50)
    serviceRadiusKm: number;
}

export class UpdateServiceRadiusDto {
    @IsNumber()
    @Min(1)
    @Max(50)
    serviceRadiusKm: number;
}