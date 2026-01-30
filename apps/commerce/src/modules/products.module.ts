import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from '../services/product.service';
import { ProductRepository } from '../repositories/impl/product.repository';
import { Product } from '../entities/product.entity';
import { ProductsController } from '../controllers/products.controller';
import { StockMovement } from '../entities/stockmovement.entity';
import { Batch } from '../entities/batch.entity';
import { BatchController } from '../controllers/batch.controller';
import { StockMovementController } from '../controllers/stockmovement.controller';
import { BatchService } from '../services/batch.service';
import { BatchRepository } from '../repositories/impl/batch.repository';
import { StockMovementService } from '../services/stockmovement.service';
import { StockMovementRepository } from '../repositories/impl/stockmovement.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([Product, Batch, StockMovement]),
    ],
    controllers: [ProductsController, BatchController, StockMovementController],
    providers: [
        ProductService,
        ProductRepository,
        BatchService,
        BatchRepository,
        StockMovementService,
        StockMovementRepository
    ],
    exports: [
        ProductService,
        ProductRepository,
        BatchService,
        BatchRepository,
        StockMovementService,
        StockMovementRepository
    ],
})
export class ProductsModule {}