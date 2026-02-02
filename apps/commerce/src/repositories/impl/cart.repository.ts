import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, LessThan } from "typeorm";
import { ICartRepository } from "../icart.repository";
import { Cart } from "../../entities/cart.entity";
import { CartStatus } from "../../enums/cart-status.enum";
import { RpcException } from "@nestjs/microservices";

@Injectable()
export class CartRepository extends ICartRepository {

    constructor(
        @InjectRepository(Cart)
        private readonly repo: Repository<Cart>,
    ) {
        super();
    }

    async create(cartData: Partial<Cart>): Promise<Cart> {
        const cart = this.repo.create(cartData);
        return await this.repo.save(cart);
    }

    async save(cart: Cart): Promise<Cart> {
        return await this.repo.save(cart);
    }

    async update(cartId: string, data: Partial<Cart>): Promise<void> {
        await this.repo.update(cartId, {
            ...data,
            updatedAt: new Date()
        });
    }

    async softDelete(cartId: string): Promise<void> {
        await this.repo.softDelete(cartId);
    }

    async findById(cartId: string): Promise<Cart | null> {
        return await this.repo.findOne({
            where: {
                id: cartId,
                deletedAt: IsNull()
            }
        });
    }

    async findByIdWithItems(cartId: string): Promise<Cart | null> {
        return await this.repo.findOne({
            where: {
                id: cartId,
                deletedAt: IsNull()
            },
            relations: ['items', 'items.product']
        });
    }

    async findByUserId(userId: string): Promise<Cart | null> {
        return await this.repo.findOne({
            where: {
                userId,
                deletedAt: IsNull()
            }
        });
    }

    async findActiveByUserId(userId: string): Promise<Cart | null> {
        return await this.repo.findOne({
            where: {
                userId,
                status: CartStatus.ACTIVE,
                deletedAt: IsNull()
            }
        });
    }

    async findActiveByUserIdWithItems(userId: string): Promise<Cart | null> {
        return await this.repo.findOne({
            where: {
                userId,
                status: CartStatus.ACTIVE,
                deletedAt: IsNull()
            },
            relations: ['items', 'items.product']
        });
    }

    async updateStatus(cartId: string, status: CartStatus): Promise<Cart> {
        await this.repo.update(cartId, {
            status,
            updatedAt: new Date()
        });
        const cart = await this.findById(cartId);
        if (!cart) {
            throw new RpcException(`Cart not found`);
        }
        return cart;
    }

    async updateActivity(cartId: string): Promise<void> {
        await this.repo.update(cartId, {
            lastActivityAt: new Date(),
            updatedAt: new Date()
        });
    }

    async markAbandonedCarts(thresholdDate: Date): Promise<number> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                status: CartStatus.ABANDONED,
                updatedAt: new Date(),
            })
            .where('"carts"."status" = :status', {
                status: CartStatus.ACTIVE,
            })
            .andWhere('"carts"."lastActivityAt" < :threshold', {
                threshold: thresholdDate,
            })
            .andWhere('"carts"."deletedAt" IS NULL')
            .execute();

        return result.affected ?? 0;
    }

async cleanupOldAbandonedCarts(cleanupDate: Date): Promise<number> {

    const result = await this.repo.softDelete({
        status: CartStatus.ABANDONED,
        updatedAt: LessThan(cleanupDate)
    });

    return result.affected || 0;
}

    async countItems(cartId: string): Promise<number> {
        return await this.repo
            .createQueryBuilder('cart')
            .leftJoin('cart.items', 'items')
            .where('cart.id = :cartId', { cartId })
            .andWhere('cart.deletedAt IS NULL')
            .getCount();
    }
}