import { Order } from "../entities/order.entity";
import { OrderStatus } from "../enums/order-status.enum";

export abstract class IOrderRepository {
  abstract create(orderData: Partial<Order>): Promise<Order>;
  abstract save(order: Order): Promise<Order>;
  abstract update(orderId: string, data: Partial<Order>): Promise<void>;

  abstract findById(orderId: string): Promise<Order | null>;
  abstract findByIdWithItems(orderId: string): Promise<Order | null>;
  abstract findByIdWithItemsAndReservations(orderId: string): Promise<Order | null>;

  abstract findByCheckoutSessionId(sessionId: string): Promise<Order[]>;
  abstract findByCheckoutSessionIdWithItems(sessionId: string): Promise<Order[]>;

  abstract findByUserId(userId: string): Promise<Order[]>;
  abstract findByUserIdWithItems(userId: string): Promise<Order[]>;

  abstract findByKioskUserId(kioskUserId: number): Promise<Order[]>;
  abstract findByKioskUserIdWithItems(kioskUserId: number): Promise<Order[]>;

  abstract findByStatus(status: OrderStatus): Promise<Order[]>;
  abstract findByKioskAndStatus(kioskUserId: number, status: OrderStatus): Promise<Order[]>;

  abstract markAccepted(orderId: string): Promise<void>;
  abstract markRejected(orderId: string): Promise<void>;
  abstract markReadyForPayment(orderId: string, expiresAt: Date): Promise<void>;
  abstract markPaid(orderId: string): Promise<void>;

  abstract markExpiredOrders(thresholdDate: Date): Promise<number>;

  abstract markCancelRequested(orderId: string): Promise<void>;
  abstract markCancelled(orderId: string): Promise<void>;
}
