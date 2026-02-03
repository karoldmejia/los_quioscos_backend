import { OrderItem } from "../entities/order-item.entity";

export abstract class IOrderItemRepository {
  abstract create(itemData: Partial<OrderItem>): Promise<OrderItem>;
  abstract createMany(itemsData: Partial<OrderItem>[]): Promise<OrderItem[]>;

  abstract save(item: OrderItem): Promise<OrderItem>;
  abstract saveMany(items: OrderItem[]): Promise<OrderItem[]>;

  abstract findById(itemId: string): Promise<OrderItem | null>;

  abstract findByOrderId(orderId: string): Promise<OrderItem[]>;
  abstract findByOrderIdWithProduct(orderId: string): Promise<OrderItem[]>;

  abstract findByProductId(productId: string): Promise<OrderItem[]>;

  abstract deleteByOrderId(orderId: string): Promise<void>;
}