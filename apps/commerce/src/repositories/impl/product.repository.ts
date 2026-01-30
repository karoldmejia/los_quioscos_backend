import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike, IsNull } from "typeorm";
import { IProductRepository } from "../iproduct.repository";
import { Product } from "../../entities/product.entity";
import { ProductCategory } from "../../enums/product-category.enum";
import { RpcException } from "@nestjs/microservices";

@Injectable()
export class ProductRepository extends IProductRepository {
    
    constructor(
        @InjectRepository(Product)
        private readonly repo: Repository<Product>,
    ) {
        super();
    }

    async create(product: Product): Promise<Product> {
        const newProduct = this.repo.create(product);
        return await this.repo.save(newProduct);
    }

    async save(product: Product): Promise<Product> {
        return await this.repo.save(product);
    }

    async update(product: Product): Promise<Product> {
        return await this.repo.save(product);
    }

    async softDelete(productId: string): Promise<void> {
        await this.repo.softDelete(productId);
    }

    async deactivate(productId: string): Promise<Product> {
        await this.repo.update(productId, { active: false });
        const product = await this.findById(productId);
        if (!product) {
            throw new RpcException(`Product with id ${productId} not found`);
        }
        return product;
    }

    async activate(productId: string): Promise<Product> {
        await this.repo.update(productId, { active: true });
        const product = await this.findById(productId);
        if (!product) {
            throw new RpcException(`Product with id ${productId} not found`);
        }
        return product;
    }

    async findById(productId: string): Promise<Product | null> {
        return await this.repo.findOne({
            where: { 
                id: productId,
                deletedAt: IsNull(),
            }
        });
    }

    async findByIdIncludingDeleted(productId: string): Promise<Product | null> {
        return await this.repo.findOne({
            where: { id: productId },
            withDeleted: true
        });
    }

    async findAll(): Promise<Product[]> {
        return await this.repo.find({
            order: { createdAt: 'DESC' }
        });
    }

    async findAllByKioskUserId(kioskUserId: number): Promise<Product[]> {
        return await this.repo.find({
            where: { 
                kioskUserId,
                deletedAt: IsNull() 
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findActiveByKioskUserId(kioskUserId: number): Promise<Product[]> {
        return await this.repo.find({
            where: { 
                kioskUserId,
                active: true,
            },
            order: { createdAt: 'DESC' }
        });
    }

    async findActiveByCategory(category: ProductCategory): Promise<Product[]> {
        return await this.repo.find({
            where: { 
                category,
                active: true,
            },
            order: { createdAt: 'DESC' }
        });
    }

    async searchActiveByName(query: string): Promise<Product[]> {
        return await this.repo.find({
            where: [
                { 
                    name: ILike(`%${query}%`),
                    active: true,
                },
                {
                    description: ILike(`%${query}%`),
                    active: true,
                }
            ],
            order: { createdAt: 'DESC' },
            take: 50
        });
    }

    async existsByNameForKiosk(kioskUserId: number, name: string): Promise<boolean> {
        const count = await this.repo.count({
            where: { 
                kioskUserId,
                name: ILike(name),
            }
        });
        return count > 0;
    }

    async countByKiosk(kioskUserId: number): Promise<number> {
        return await this.repo.count({
            where: { 
                kioskUserId,
            }
        });
    }

    async findRecentlyAdded(limit: number = 10): Promise<Product[]> {
        return await this.repo.find({
            where: { 
                active: true,
            },
            order: { createdAt: 'DESC' },
            take: limit
        });
    }

    async findProductsByKioskAndCategory(kioskUserId: number, category: ProductCategory): Promise<Product[]> {
        return await this.repo.find({
            where: { 
                kioskUserId,
                category,
                active: true,
            },
            order: { createdAt: 'DESC' }
        });
    }
}