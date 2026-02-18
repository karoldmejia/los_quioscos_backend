import { Cart } from "../entities/cart.entity";
import { CartStatus } from "../enums/cart-status.enum";

export abstract class ICartRepository {
  abstract create(cart: Partial<Cart>): Promise<Cart>;
  abstract save(cart: Cart): Promise<Cart>;
  abstract update(cartId: string, data: Partial<Cart>): Promise<void>;
  abstract softDelete(cartId: string): Promise<void>;
  
  abstract findById(cartId: string): Promise<Cart | null>;
  abstract findByIdWithItems(cartId: string): Promise<Cart | null>;
  abstract findByUserId(userId: string): Promise<Cart | null>;
  abstract findActiveByUserId(userId: string): Promise<Cart | null>;
  abstract findActiveByUserIdWithItems(userId: string): Promise<Cart | null>;
  
  abstract updateStatus(cartId: string, status: CartStatus): Promise<Cart>;
  abstract updateActivity(cartId: string): Promise<void>;
  
  abstract markAbandonedCarts(thresholdDate: Date): Promise<number>;
  abstract cleanupOldAbandonedCarts(cleanupDate: Date): Promise<number>;
  
  abstract countItems(cartId: string): Promise<number>;
}