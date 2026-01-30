import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ProductRepository } from '../repositories/impl/product.repository';
import { Product } from '../entities/product.entity';
import { ProductCategory } from '../enums/product-category.enum';
import { CreateProductDto } from '../dtos/create-product.dto';
import { UpdateProductDto } from '../dtos/update-product.dto';
import { SearchProductDto } from '../dtos/search-product.dto';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ProductService {
    constructor(
        private readonly productRepository: ProductRepository,
    ) {}

    // create a new product
    async create(createProductDto: CreateProductDto): Promise<Product> {
        // validate that the name does not exist for this kiosk
        const nameExists = await this.productRepository.existsByNameForKiosk(
            createProductDto.kioskUserId,
            createProductDto.name
        );
        
        if (nameExists) {
            throw new RpcException(
                `A product with name "${createProductDto.name}" already exists for this kiosk`
            );
        }

        // validate price
        const price = parseFloat(createProductDto.price);
        if (isNaN(price) || price <= 0) {
            throw new RpcException('Price must be a positive number');
        }

        // validate duration
        if (createProductDto.durationDays <= 0) {
            throw new RpcException('Duration in days must be greater than 0');
        }

        // create product entity
        const product = new Product();
        product.kioskUserId = createProductDto.kioskUserId;
        product.name = createProductDto.name.trim();
        product.category = createProductDto.category;
        product.unitMeasure = createProductDto.unitMeasure;
        product.customUnitMeasure = createProductDto.customUnitMeasure?.trim();
        product.price = createProductDto.price;
        product.durationDays = createProductDto.durationDays;
        product.description = createProductDto.description?.trim();
        product.photos = createProductDto.photos || [];
        product.active = true;

        return await this.productRepository.create(product);
    }

    /**
     * update an existing product
     */
    async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
        // search product
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new RpcException(`Product with ID ${id} has not been found`);
        }

        // verify that product belongs to kiosk (if trying to change kioskUserId)
        if (updateProductDto.kioskUserId && updateProductDto.kioskUserId !== product.kioskUserId) {
            throw new RpcException('Its not possible to change a products kiosk');
        }

        // if its in the process, verify uniqueness
        if (updateProductDto.name && updateProductDto.name !== product.name) {
            const nameExists = await this.productRepository.existsByNameForKiosk(
                product.kioskUserId,
                updateProductDto.name
            );
            
            if (nameExists) {
                throw new RpcException(
                `A product with name "${updateProductDto.name}" already exists for this kiosk`
                );
            }
            product.name = updateProductDto.name.trim();
        }

        // validate and update if price is not null
        if (updateProductDto.price !== undefined) {
            const price = parseFloat(updateProductDto.price);
            if (isNaN(price) || price <= 0) {
                throw new RpcException('Price must be a positive number');
            }
            product.price = updateProductDto.price;
        }

        // same with duration
        if (updateProductDto.durationDays !== undefined) {
            if (updateProductDto.durationDays <= 0) {
                throw new RpcException('Duration must be greater than 0');
            }
            product.durationDays = updateProductDto.durationDays;
        }

        // update other fields
        if (updateProductDto.category !== undefined) {
            product.category = updateProductDto.category;
        }
        if (updateProductDto.unitMeasure !== undefined) {
            product.unitMeasure = updateProductDto.unitMeasure;
        }
        if (updateProductDto.customUnitMeasure !== undefined) {
            product.customUnitMeasure = updateProductDto.customUnitMeasure.trim();
        }
        if (updateProductDto.description !== undefined) {
            product.description = updateProductDto.description.trim();
        }
        if (updateProductDto.photos !== undefined) {
            product.photos = updateProductDto.photos;
        }

        return await this.productRepository.update(product);
    }

    /**
     * get a product with its
     */
    async findById(id: string): Promise<Product> {
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new RpcException(`Product with ID ${id} has not been found`);
        }
        return product;
    }

    /**
     * get a product by id including deleted ones
     */
    async findByIdIncludingDeleted(id: string): Promise<Product> {
        const product = await this.productRepository.findByIdIncludingDeleted(id);
        if (!product) {
            throw new RpcException(`Product with ID ${id} has not been found`);
        }
        return product;
    }

    /**
     * get all products
     */
    async findAll(): Promise<Product[]> {
        return await this.productRepository.findAll();
    }

    /**
     * get all kiosk products
     */
    async findAllByKioskUserId(kioskUserId: number): Promise<Product[]> {
        return await this.productRepository.findAllByKioskUserId(kioskUserId);
    }

    /**
     * get all kiosks active products
     */
    async findActiveByKioskUserId(kioskUserId: number): Promise<Product[]> {
        return await this.productRepository.findActiveByKioskUserId(kioskUserId);
    }

    /**
     * get active products by category
     */
    async findActiveByCategory(category: ProductCategory): Promise<Product[]> {
        return await this.productRepository.findActiveByCategory(category);
    }

    /**
     * get active products by name
     */
    async searchActiveByName(searchDto: SearchProductDto): Promise<Product[]> {
        const { query, limit } = searchDto;
        
        if (!query || query.trim().length < 2) {
            throw new RpcException('Search query must contain at least 2 characters');
        }

        const results = await this.productRepository.searchActiveByName(query.trim());
        
        if (limit && limit > 0) {
            return results.slice(0, limit);
        }
        
        return results;
    }

    /**
     * deactivate product
     */
    async deactivate(id: string): Promise<Product> {
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new RpcException(`Product with ID ${id} has not been found`);
        }

        if (!product.active) {
            throw new RpcException(`Product with ${id} its already deactivated`);
        }

        return await this.productRepository.deactivate(id);
    }

    /**
     * Activa un producto
     */
    async activate(id: string): Promise<Product> {
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new RpcException(`Product with ID ${id} has not been found`);
        }

        if (product.active) {
            throw new RpcException(`Product with ${id} its already activated`);
        }

        return await this.productRepository.activate(id);
    }

    /**
     * delete a product (soft delete)
     */
    async remove(id: string): Promise<void> {
        const product = await this.productRepository.findById(id);
        if (!product) {
            throw new RpcException(`Product with ID ${id} has not been found`);
        }

        await this.productRepository.softDelete(id);
    }

    async existsByNameForKiosk(kioskUserId: number, name: string): Promise<boolean> {
        return await this.productRepository.existsByNameForKiosk(kioskUserId, name);
    }

    async countByKiosk(kioskUserId: number): Promise<number> {
        return await this.productRepository.countByKiosk(kioskUserId);
    }

    async findRecentlyAdded(limit: number = 10): Promise<Product[]> {
        if (limit <= 0 || limit > 100) {
            throw new RpcException('Limit its between 1 and 100');
        }
        return await this.productRepository.findRecentlyAdded(limit);
    }


    async findProductsByKioskAndCategory(
        kioskUserId: number, 
        category: ProductCategory
    ): Promise<Product[]> {
        return await this.productRepository.findProductsByKioskAndCategory(kioskUserId, category);
    }

    /**
     * validate if a product can be ordered
     */
    async validateProductForOrder(productId: string): Promise<{isValid: boolean; product?: Product;error?: string; }> {
        try {
            const product = await this.findById(productId);
            
            if (!product.active) {
                return {
                    isValid: false,
                    error: 'Product is not active'
                };
            }

            if (product.deletedAt) {
                return {
                    isValid: false,
                    error: 'Product has been deleted'
                };
            }

            return {
                isValid: true,
                product
            };
        } catch (error) {
            return {
                isValid: false,
                error: error instanceof RpcException 
                    ? 'Product not found' 
                    : 'Error validating product'
            };
        }
    }
}