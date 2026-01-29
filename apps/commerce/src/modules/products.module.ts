import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductService } from '../services/product.service';
import { ProductRepository } from '../repositories/impl/product.repository';
import { Product } from '../entities/product.entity';
import { ProductsController } from '../controllers/products.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Product]),
    ],
    controllers: [ProductsController],
    providers: [
        ProductService,
        ProductRepository,
    ],
    exports: [
        ProductService,
        ProductRepository,
    ],
})
export class ProductsModule {}