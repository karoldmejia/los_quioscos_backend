import { CartItem } from "../entities/cart-item.entity";

export abstract class ICartItemRepository {
  abstract create(item: Partial<CartItem>): Promise<CartItem>;
  abstract save(item: CartItem): Promise<CartItem>;
  abstract update(itemId: string, data: Partial<CartItem>): Promise<void>;
  abstract delete(itemId: string): Promise<void>;
  abstract deleteByCartId(cartId: string): Promise<void>;
  
  abstract findById(itemId: string): Promise<CartItem | null>;
  abstract findByIdWithRelations(itemId: string): Promise<CartItem | null>;
  abstract findByCartId(cartId: string): Promise<CartItem[]>;
  abstract findByCartIdWithProduct(cartId: string): Promise<CartItem[]>;
  abstract findByCartAndProduct(cartId: string, productId: string): Promise<CartItem | null>;
  
  abstract existsByCartAndProduct(cartId: string, productId: string): Promise<boolean>;
  abstract countByCartId(cartId: string): Promise<number>;
}