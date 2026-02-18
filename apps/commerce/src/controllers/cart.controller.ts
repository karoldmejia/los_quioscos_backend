import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CartService } from '../services/cart.service';
import { Cart } from '../entities/cart.entity';
import { CartItem } from '../entities/cart-item.entity';
import { CartStatus } from '../enums/cart-status.enum';

@Controller()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // cart management

  @MessagePattern({ cmd: 'get_or_create_cart' })
  async getOrCreateCart(@Payload() userId: string): Promise<Cart> {
    return await this.cartService.getOrCreateCart(userId);
  }

  @MessagePattern({ cmd: 'update_cart_activity' })
  async updateCartActivity(@Payload() cartId: string): Promise<void> {
    return await this.cartService.updateCartActivity(cartId);
  }

  @MessagePattern({ cmd: 'update_cart_status' })
  async updateCartStatus(@Payload() payload: { cartId: string; status: CartStatus }): Promise<Cart> {
    const { cartId, status } = payload;
    return await this.cartService.updateCartStatus(cartId, status);
  }

  // cart items management

  @MessagePattern({ cmd: 'add_item_to_cart' })
  async addItemToCart(@Payload() payload: { userId: string; productId: string; quantity: number }): Promise<Cart | null> {
    const { userId, productId, quantity } = payload;
    return await this.cartService.addItem(userId, productId, quantity);
  }

  @MessagePattern({ cmd: 'update_item_quantity' })
  async updateItemQuantity(@Payload() payload: { itemId: string; quantity: number }): Promise<CartItem> {
    const { itemId, quantity } = payload;
    return await this.cartService.updateItemQuantity(itemId, quantity);
  }

  @MessagePattern({ cmd: 'remove_item_from_cart' })
  async removeItemFromCart(@Payload() itemId: string): Promise<void> {
    return await this.cartService.removeItem(itemId);
  }

  @MessagePattern({ cmd: 'clear_cart' })
  async clearCart(@Payload() cartId: string): Promise<void> {
    return await this.cartService.clearCart(cartId);
  }

  @MessagePattern({ cmd: 'get_cart_item' })
  async getCartItem(@Payload() itemId: string): Promise<CartItem> {
    return await this.cartService.getCartItem(itemId);
  }

  // stock validation

  @MessagePattern({ cmd: 'validate_cart_stock' })
  async validateCartStock(@Payload() cartId: string): Promise<boolean> {
    return await this.cartService.validateCartStock(cartId);
  }

  @MessagePattern({ cmd: 'get_product_current_quantity' })
  async getProductCurrentQuantity(@Payload() productId: string): Promise<number> {
    return await this.cartService['getProductCurrentQuantity'](productId);
  }

  // status management

  @MessagePattern({ cmd: 'mark_abandoned_carts' })
  async markAbandonedCarts(): Promise<number> {
    return await this.cartService.markAbandonedCarts();
  }

  @MessagePattern({ cmd: 'cleanup_old_abandoned_carts' })
  async cleanupOldAbandonedCarts(): Promise<number> {
    return await this.cartService.cleanupOldAbandonedCarts();
  }

  @MessagePattern({ cmd: 'perform_cart_maintenance' })
  async performCartMaintenance(): Promise<void> {
    return await this.cartService.performMaintenance();
  }

  // helper methods

  @MessagePattern({ cmd: 'calculate_cart_total' })
  async calculateCartTotal(@Payload() cartId: string): Promise<number> {
    return await this.cartService.calculateCartTotal(cartId);
  }

  @MessagePattern({ cmd: 'count_cart_items' })
  async countCartItems(@Payload() cartId: string): Promise<number> {
    return await this.cartService.countItems(cartId);
  }

  @MessagePattern({ cmd: 'is_cart_empty' })
  async isCartEmpty(@Payload() cartId: string): Promise<boolean> {
    return await this.cartService.isCartEmpty(cartId);
  }

  @MessagePattern({ cmd: 'get_cart_summary' })
  async getCartSummary(@Payload() cartId: string): Promise<any> {
    return await this.cartService.getCartSummary(cartId);
  }

  @MessagePattern({ cmd: 'sync_cart_item_prices' })
  async syncCartItemPrices(@Payload() cartId: string): Promise<void> {
    return await this.cartService.syncItemPrices(cartId);
  }

}