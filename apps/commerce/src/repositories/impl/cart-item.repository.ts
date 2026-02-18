import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ICartItemRepository } from "../icart-item.repository";
import { CartItem } from "../../entities/cart-item.entity";

@Injectable()
export class CartItemRepository extends ICartItemRepository {
    
    constructor(
        @InjectRepository(CartItem)
        private readonly repo: Repository<CartItem>,
    ) {
        super();
    }

    async create(itemData: Partial<CartItem>): Promise<CartItem> {
        const item = this.repo.create(itemData);
        return await this.repo.save(item);
    }

    async save(item: CartItem): Promise<CartItem> {
        return await this.repo.save(item);
    }

    async update(itemId: string, data: Partial<CartItem>): Promise<void> {
        await this.repo.update(itemId, data);
    }

    async delete(itemId: string): Promise<void> {
        await this.repo.delete(itemId);
    }

    async deleteByCartId(cartId: string): Promise<void> {
        await this.repo.delete({ cartId });
    }

    async findById(itemId: string): Promise<CartItem | null> {
        return await this.repo.findOne({
            where: { id: itemId }
        });
    }

    async findByIdWithRelations(itemId: string): Promise<CartItem | null> {
        return await this.repo.findOne({
            where: { id: itemId },
            relations: ['product', 'cart']
        });
    }

    async findByCartId(cartId: string): Promise<CartItem[]> {
        return await this.repo.find({
            where: { cartId },
            order: { createdAt: 'DESC' }
        });
    }

    async findByCartIdWithProduct(cartId: string): Promise<CartItem[]> {
        return await this.repo.find({
            where: { cartId },
            relations: ['product'],
            order: { createdAt: 'DESC' }
        });
    }

    async findByCartAndProduct(cartId: string, productId: string): Promise<CartItem | null> {
        return await this.repo.findOne({
            where: { cartId, productId }
        });
    }

    async existsByCartAndProduct(cartId: string, productId: string): Promise<boolean> {
        const count = await this.repo.count({
            where: { cartId, productId }
        });
        return count > 0;
    }

    async countByCartId(cartId: string): Promise<number> {
        return await this.repo.count({
            where: { cartId }
        });
    }
}