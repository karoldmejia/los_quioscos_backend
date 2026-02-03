import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { OrderService } from '../services/order.service';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';

@Controller()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @MessagePattern({ cmd: 'create_order_with_items_and_reserve_stock' })
  async createOrderWithItemsAndReserveStock(@Payload()payload: {orderData: Partial<Order>;itemsData: Partial<OrderItem>[];expiresInMinutes?: number;},): Promise<Order> {
    const { orderData, itemsData, expiresInMinutes } = payload;

    return await this.orderService.createOrderWithItemsAndReserveStock({
      orderData,
      itemsData,
      expiresInMinutes,
    });
  }

  @MessagePattern({ cmd: 'accept_order' })
  async acceptOrder(@Payload() orderId: string): Promise<Order> {
    return await this.orderService.acceptOrder(orderId);
  }

  @MessagePattern({ cmd: 'reject_order' })
  async rejectOrder(@Payload() orderId: string): Promise<Order> {
    return await this.orderService.rejectOrder(orderId);
  }

  @MessagePattern({ cmd: 'mark_order_ready_for_payment' })
  async markOrderReadyForPayment(
    @Payload() payload: { orderId: string; expiresAt: Date | string },
  ): Promise<void> {
    const { orderId, expiresAt } = payload;

    const expiresAtDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);

    return await this.orderService.markOrderReadyForPayment(orderId, expiresAtDate);
  }

  // payment confirmed

  @MessagePattern({ cmd: 'mark_order_as_paid' })
  async markOrderAsPaid(
    @Payload()
    payload: {
      orderId: string;
      paymentInfo?: any;
    },
  ): Promise<Order> {
    const { orderId, paymentInfo } = payload;
    return await this.orderService.markOrderAsPaid(orderId, paymentInfo);
  }

  // cancellations

  @MessagePattern({ cmd: 'order_cancellation_requested' })
  async cancellationRequested(@Payload() orderId: string): Promise<void> {
    return await this.orderService.cancellationRequested(orderId);
  }

  @MessagePattern({ cmd: 'cancel_order_final' })
  async cancelOrderFinal(@Payload() orderId: string): Promise<void> {
    return await this.orderService.cancelOrderFinal(orderId);
  }

  // auto time out

  @MessagePattern({ cmd: 'auto_reject_order_timeout' })
  async autoRejectTimeout(@Payload() orderId: string): Promise<void> {
    return await this.orderService.autoRejectTimeout(orderId);
  }

  // finders

  @MessagePattern({ cmd: 'get_order_by_id' })
  async getOrderById(@Payload() orderId: string): Promise<Order | null> {
    return await this.orderService.getOrderById(orderId);
  }

  @MessagePattern({ cmd: 'get_order_with_items' })
  async getOrderWithItems(@Payload() orderId: string): Promise<Order | null> {
    return await this.orderService.getOrderWithItems(orderId);
  }

  @MessagePattern({ cmd: 'get_order_items' })
  async getOrderItems(@Payload() orderId: string): Promise<OrderItem[]> {
    return await this.orderService.getOrderItems(orderId);
  }
}
