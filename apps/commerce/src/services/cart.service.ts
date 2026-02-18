import { Injectable, Logger } from '@nestjs/common';
import { CartRepository } from '../repositories/impl/cart.repository';
import { CartItemRepository } from '../repositories/impl/cart-item.repository';
import { ProductRepository } from '../repositories/impl/product.repository';
import { BatchRepository } from '../repositories/impl/batch.repository';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { Product } from '../entities/product.entity';
import { CartStatus } from '../enums/cart-status.enum';
import { RpcException } from '@nestjs/microservices';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CartService {
    private readonly INACTIVITY_THRESHOLD_MINUTES = 30;
    private readonly CLEANUP_ABANDONED_AFTER_DAYS = 7;
    private readonly logger = new Logger(CartService.name);

    constructor(
        private readonly cartRepository: CartRepository,
        private readonly cartItemRepository: CartItemRepository,
        private readonly productRepository: ProductRepository,
        private readonly batchRepository: BatchRepository,
    ) { }

    // cart management

    async getOrCreateCart(userId: string): Promise<Cart> {
        let cart = await this.cartRepository.findActiveByUserIdWithItems(userId);

        if (!cart) {
            cart = await this.cartRepository.create({
                userId,
                status: CartStatus.ACTIVE,
                lastActivityAt: new Date(),
                items: []
            });
        }

        return cart;
    }

    async updateCartActivity(cartId: string): Promise<void> {
        await this.cartRepository.updateActivity(cartId);
    }

    // basic items management

    async addItem(userId: string, productId: string, quantity: number): Promise<Cart | null> {
        if (quantity <= 0) {
            throw new RpcException('Quantity must be greater than zero');
        }

        const cart = await this.getOrCreateCart(userId);
        const product = await this.validateProduct(productId);
        
        const totalStock = await this.getProductCurrentQuantity(productId);
        if (quantity > totalStock) {
            throw new RpcException(`Insufficient stock. Available: ${totalStock}, Solicited: ${quantity}`);
        }

        const existingItem = await this.cartItemRepository.findByCartAndProduct(cart.id, productId);

        if (existingItem) {
            await this.updateItemQuantity(
                existingItem.id,
                existingItem.quantity + quantity
            );
        } else {
            await this.cartItemRepository.create({
                cartId: cart.id,
                productId,
                quantity,
                product
            });
        }

        await this.updateCartActivity(cart.id);
        return await this.cartRepository.findActiveByUserIdWithItems(userId);
    }

    async updateItemQuantity(itemId: string, newQuantity: number): Promise<CartItem> {
        if (newQuantity <= 0) {
            throw new RpcException('Quantity must be greater than zero');
        }

        const item = await this.cartItemRepository.findByIdWithRelations(itemId);

        if (!item) {
            throw new RpcException('Item not found in cart');
        }

        const totalStock = await this.getProductCurrentQuantity(item.productId);
        if (newQuantity > totalStock) {
            throw new RpcException(
                `Insufficient stock. Available: ${totalStock}, Solicited: ${newQuantity}`
            );
        }

        await this.cartItemRepository.update(itemId, { quantity: newQuantity });
        await this.updateCartActivity(item.cartId);

        return await this.cartItemRepository.findByIdWithRelations(itemId) as CartItem;
    }

    async removeItem(itemId: string): Promise<void> {
        const item = await this.cartItemRepository.findByIdWithRelations(itemId);

        if (!item) {
            throw new RpcException('Item not found in cart');
        }

        await this.cartItemRepository.delete(itemId);
        await this.updateCartActivity(item.cartId);
    }

    async clearCart(cartId: string): Promise<void> {
        await this.cartItemRepository.deleteByCartId(cartId);
        await this.updateCartActivity(cartId);
    }

    // simple stock validation

    private async getProductCurrentQuantity(productId: string): Promise<number> {
        const batches = await this.batchRepository.findActiveByProductId(productId);
        return batches.reduce((total, batch) => total + batch.currentQuantity, 0);
    }

    private async validateProduct(productId: string): Promise<Product> {
        const product = await this.productRepository.findById(productId);

        if (!product || !product.active) {
            throw new RpcException('Product not found or not available');
        }

        return product;
    }

    async validateCartStock(cartId: string): Promise<boolean> {
        const cart = await this.cartRepository.findByIdWithItems(cartId);

        if (!cart) {
            throw new RpcException('Cart not found');
        }

        for (const item of cart.items) {
            const availableStock = await this.getProductCurrentQuantity(item.productId);
            if (item.quantity > availableStock) {
                return false;
            }
        }

        return true;
    }

    // status management

    async markAbandonedCarts(): Promise<number> {
        const thresholdDate = new Date();
        thresholdDate.setMinutes(
            thresholdDate.getMinutes() - this.INACTIVITY_THRESHOLD_MINUTES
        );

        return await this.cartRepository.markAbandonedCarts(thresholdDate);
    }

    async cleanupOldAbandonedCarts(): Promise<number> {
        const cleanupDate = new Date();
        cleanupDate.setDate(
            cleanupDate.getDate() - this.CLEANUP_ABANDONED_AFTER_DAYS
        );

        return await this.cartRepository.cleanupOldAbandonedCarts(cleanupDate);
    }

    async performMaintenance(): Promise<void> {
        await this.markAbandonedCarts();
        await this.cleanupOldAbandonedCarts();
    }

    // helper methods

    async calculateCartTotal(cartId: string): Promise<number> {
        const cart = await this.cartRepository.findByIdWithItems(cartId);

        if (!cart) {
            throw new RpcException('Cart not found');
        }

        return cart.items.reduce((total, item) => {
            const itemPrice = parseFloat(item.product.price) || 0;
            return total + (itemPrice * item.quantity);
        }, 0);
    }

    async countItems(cartId: string): Promise<number> {
        return await this.cartItemRepository.countByCartId(cartId);
    }

    async isCartEmpty(cartId: string): Promise<boolean> {
        const count = await this.countItems(cartId);
        return count === 0;
    }

    async getCartSummary(cartId: string) {
        const cart = await this.cartRepository.findByIdWithItems(cartId);

        if (!cart) {
            throw new RpcException('Cart not found');
        }

        const total = await this.calculateCartTotal(cartId);
        const itemCount = await this.countItems(cartId);
        const isEmpty = itemCount === 0;

        return {
            cartId: cart.id,
            userId: cart.userId,
            status: cart.status,
            lastActivityAt: cart.lastActivityAt,
            itemCount,
            total,
            isEmpty,
            items: cart.items.map(item => ({
                id: item.id,
                productId: item.productId,
                productName: item.product.name,
                quantity: item.quantity,
                price: parseFloat(item.product.price),
                subtotal: parseFloat(item.product.price) * item.quantity
            }))
        };
    }

    async syncItemPrices(cartId: string): Promise<void> {
        const cart = await this.cartRepository.findByIdWithItems(cartId);

        if (!cart) {
            throw new RpcException('Cart not found');
        }

        for (const item of cart.items) {
            const product = await this.productRepository.findById(item.productId);

            if (!product || !product.active) {
                await this.cartItemRepository.delete(item.id);
            }
        }
    }

    async getCartItem(itemId: string): Promise<CartItem> {
        const item = await this.cartItemRepository.findByIdWithRelations(itemId);

        if (!item) {
            throw new RpcException('Item not found');
        }

        return item;
    }

    async updateCartStatus(cartId: string, status: CartStatus): Promise<Cart> {
        return await this.cartRepository.updateStatus(cartId, status);
    }

    // cron jobs

    private async syncPricesForAllCarts(): Promise<void> {
        try {
            const activeCarts = await this.cartRepository.findByStatus(CartStatus.ACTIVE);
            
            let syncedCount = 0;
            let removedItemsCount = 0;

            for (const cart of activeCarts) {
                try {
                    const cartWithItems = await this.cartRepository.findByIdWithItems(cart.id);
                    if (!cartWithItems) continue;
                    
                    const beforeCount = cartWithItems.items.length;
                    await this.syncItemPrices(cart.id);
                    
                    const updatedCart = await this.cartRepository.findByIdWithItems(cart.id);
                    if (updatedCart && updatedCart.items.length < beforeCount) {
                        removedItemsCount += (beforeCount - updatedCart.items.length);
                    }
                    
                    syncedCount++;
                } catch (error) {
                    this.logger.warn(`Error synchronizing cart ${cart.id}: ${error.message}`);
                }
            }

            this.logger.log(`Synchronized ${syncedCount} carts, deleted ${removedItemsCount} obsolete items`);
        } catch (error) {
            this.logger.error('Error on massive prices synchronization:', error);
            throw error;
        }
    }

    private async validateStockForAllCarts(): Promise<void> {
        try {
            const activeCarts = await this.cartRepository.findByStatus(CartStatus.ACTIVE);
            
            let validCarts = 0;
            let invalidCarts = 0;
            const cartsWithProblems: string[] = [];

            for (const cart of activeCarts) {
                try {
                    const isValid = await this.validateCartStock(cart.id);
                    if (!isValid) {
                        invalidCarts++;
                        cartsWithProblems.push(cart.id);
                        this.logger.warn(`Cart ${cart.id} has stock problems`);
                    } else {
                        validCarts++;
                    }
                } catch (error) {
                    this.logger.warn(`Error validating stock for cart ${cart.id}: ${error.message}`);
                }
            }

            if (invalidCarts > 0) {
                this.logger.warn(`${invalidCarts} carts have stock problems: ${cartsWithProblems.join(', ')}`);
            }
            
            this.logger.log(`Validated ${activeCarts.length} carts: ${validCarts} valid, ${invalidCarts} with problems`);
        } catch (error) {
            this.logger.error('Error on massive stock validation:', error);
            throw error;
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleAbandonedCartsCron(): Promise<void> {
        this.logger.log('Executing cron: Marking abandoned carts');
        try {
            const markedCount = await this.markAbandonedCarts();
            if (markedCount > 0) {
                this.logger.log(`${markedCount} cars markes as abandoned`);
            }
        } catch (error) {
            this.logger.error('Error on cron for abandoned carts:', error);
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleCleanupAbandonedCartsCron(): Promise<void> {
        this.logger.log('Executing cron: Clean abandones carts');
        try {
            const cleanedCount = await this.cleanupOldAbandonedCarts();
            if (cleanedCount > 0) {
                this.logger.log(`${cleanedCount} abandoned carts deleted`);
            }
        } catch (error) {
            this.logger.error('Error on cron of carts cleaning:', error);
        }
    }

    @Cron(CronExpression.EVERY_2_HOURS)
    async handleSyncPricesCron(): Promise<void> {
        this.logger.log('Executing cron: Synchronize prices for all carts');
        try {
            await this.syncPricesForAllCarts();
        } catch (error) {
            this.logger.error('Error on cron for prices synchronization:', error);
        }
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleStockValidationCron(): Promise<void> {
        this.logger.log('Executing cron: Validate stock of all active carts');
        try {
            await this.validateStockForAllCarts();
        } catch (error) {
            this.logger.error('Error on cron of stock validation:', error);
        }
    }

    @Cron(CronExpression.EVERY_HOUR)
    async handleMaintenanceCron(): Promise<void> {
        this.logger.log('Executing cron: Complete cart mainteinance');
        try {
            await this.performMaintenance();
        } catch (error) {
            this.logger.error('Error on cron of mainteinance:', error);
        }
    }
}