import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import { OrderRepository } from '../repositories/impl/order.repository';
import { OrderItemRepository } from '../repositories/impl/order-item.repository';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { OrderStatus } from '../enums/order-status.enum';

import { BatchReservationService } from './reservation.service';
import { DataSource } from 'typeorm';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
        private readonly dataSource: DataSource,

    private readonly orderRepository: OrderRepository,
    private readonly orderItemRepository: OrderItemRepository,
    private readonly reservationService: BatchReservationService,
  ) {}


  /**
   * ORDER CREATION + RESERVATIONS
   * this method represents:
   * "cart -> checkoutSession -> orders by kiosk"
   *
   * requirement:
   * - We create reservations for 15min, without discounting from real stock
   * - If there is not enough stock, it must safely fail
   */
  async createOrderWithItemsAndReserveStock(params: {orderData: Partial<Order>; itemsData: Partial<OrderItem>[]; expiresInMinutes?: number;}): Promise<Order> {
    const { orderData, itemsData, expiresInMinutes = 15 } = params;

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. create order in transaction
      const order = await queryRunner.manager.save(Order, {
        ...orderData,
        status: OrderStatus.PENDING_KIOSK_CONFIRMATION,
      });

      // 2. create order items
      const items = await queryRunner.manager.save(
        OrderItem,
        itemsData.map((i) => ({
          ...i,
          orderId: order.id,
        })),
      );

      // 3) create reservations
      await this.reservationService.createReservations(
        {
          orderId: order.id,
          kioskUserId: order.kioskUserId,
          expiresInMinutes,
          items: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
          })),
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `Order ${order.id} created, and reserved stock (${items.length} items)`,
      );

      const full = await this.orderRepository.findByIdWithItems(order.id);
      return full ?? order;
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to create order and reserve stock');
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * ACCEPT BY KIOSK
   * 
   * requirement:
   * if kiosk accepts:
   * - time is extended for 15 minutes more
   * - order changes status
   */
  async acceptOrder(orderId: string): Promise<Order> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) throw new RpcException('Order not found');

      if (order.status !== OrderStatus.PENDING_KIOSK_CONFIRMATION) {
        throw new RpcException(`Order cannot be accepted in status: ${order.status}`);
      }

      await this.reservationService.extendReservationsForAcceptedOrder(orderId);
      await this.orderRepository.markAccepted(orderId);

      const updated = await this.orderRepository.findById(orderId);
      this.logger.log(`Order ${orderId} accepted + reservations extended`);

      return updated!;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to accept order');
    }
  }

  /**
   * REJECT BY KIOSK
   * 
   * requirement:
   * if kiosk rejects, it must release all reservations, and mark order as rejected
   */
  async rejectOrder(orderId: string): Promise<Order> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) throw new RpcException('Order not found');

      if (order.status !== OrderStatus.PENDING_KIOSK_CONFIRMATION) {
        throw new RpcException(`Order cannot be rejected in status: ${order.status}`);
      }

      await this.reservationService.releaseReservationsByOrder(orderId);
      await this.orderRepository.markRejected(orderId);

      const updated = await this.orderRepository.findById(orderId);
      this.logger.log(`Order ${orderId} rejected + reservations released`);

      return updated!;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to reject order');
    }
  }

  /**
   * READY FOR PAYMENT
   * 
   * just exists to change order status
   */
  async markOrderReadyForPayment(orderId: string, expiresAt: Date): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) throw new RpcException('Order not found');

      if (order.status !== OrderStatus.ACCEPTED) {
        throw new RpcException(
          `Order must be ACCEPTED to be READY_FOR_PAYMENT. Current: ${order.status}`,
        );
      }

      await this.orderRepository.markReadyForPayment(orderId, expiresAt);

      this.logger.log(`Order ${orderId} marked READY_FOR_PAYMENT`);
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to mark order ready for payment');
    }
  }

  /**
   * PAYMENT CONFIRMED
   * 
   * requirement:
   * when payment is confirmed, it must:
   * - consume reservations (discount from currentQuantity and reservedQuantity)
   * - reserved status is now consumed
   * - order is now paid
   */
  async markOrderAsPaid(orderId: string, paymentInfo?: any): Promise<Order> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) throw new RpcException('Order not found');

      const allowedStatuses = [OrderStatus.READY_FOR_PAYMENT, OrderStatus.ACCEPTED];

      if (!allowedStatuses.includes(order.status)) {
        throw new RpcException(`Order cannot be PAID in status: ${order.status}`);
      }

      // consume reservations
      await this.reservationService.consumeReservationsByOrder(orderId);

      // 2) Marcar PAID + guardar paymentInfo
      // mark as paid
      await this.orderRepository.update(orderId, {
        status: OrderStatus.PAID,
        paidAt: new Date(),
        paymentInfo: paymentInfo ?? order.paymentInfo,
        updatedAt: new Date(),
      });

      const updated = await this.orderRepository.findById(orderId);
      this.logger.log(`Order ${orderId} marked PAID + reservations consumed`);

      return updated!;
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to mark order as paid');
    }
  }

  /**
   * CANCELLATIONS
   * 
   * requirement:
   * if its before acceptation by kiosk or before payment,
   * it must cancel order and release reservations
   */
  async cancellationRequested(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) throw new RpcException('Order not found');

      if (order.status === OrderStatus.PAID) {
        await this.orderRepository.markCancelRequested(orderId);
        this.logger.log(`Order ${orderId} cancellation requested (PAID)`);
        return;
      }

      const cancellableStatuses = [
        OrderStatus.PENDING_KIOSK_CONFIRMATION,
        OrderStatus.ACCEPTED,
        OrderStatus.READY_FOR_PAYMENT,
      ];

      if (!cancellableStatuses.includes(order.status)) {
        throw new RpcException(`Order cannot be cancelled in status: ${order.status}`);
      }

      await this.reservationService.releaseReservationsByOrder(orderId);
      await this.orderRepository.markCancelled(orderId);

      this.logger.log(`Order ${orderId} cancelled + reservations released`);
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to cancel order');
    }
  }

  /**
   * Cancellation after payment
   */
  async cancelOrderFinal(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) throw new RpcException('Order not found');

      const allowed = [OrderStatus.CANCEL_REQUESTED];
      if (!allowed.includes(order.status)) {
        throw new RpcException(`Order cannot be finally cancelled in status: ${order.status}`);
      }

      const hasActive = await this.reservationService.hasActiveReservations(orderId);
      if (hasActive) {
        await this.reservationService.releaseReservationsByOrder(orderId);
      }

      await this.orderRepository.markCancelled(orderId);

      this.logger.log(`Order ${orderId} finally cancelled`);
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to finalize cancellation');
    }
  }

  /**
   * AUTO TIMEOUT
   * 
   * requirement:
   * if kiosk does not answer in less than 10min, its marked as
   * rejected and reservations are released
   */
  async autoRejectTimeout(orderId: string): Promise<void> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) throw new RpcException('Order not found');

      if (order.status !== OrderStatus.PENDING_KIOSK_CONFIRMATION) {
        return;
      }

      await this.reservationService.releaseReservationsByOrder(orderId);

      await this.orderRepository.update(orderId, {
        status: OrderStatus.AUTO_REJECTED_TIMEOUT,
        updatedAt: new Date(),
      });

      this.logger.log(`Order ${orderId} auto-rejected by timeout + reservations released`);
    } catch (error) {
      if (error instanceof RpcException) throw error;
      throw new RpcException('Failed to auto reject order');
    }
  }

  // finders

  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      return await this.orderRepository.findById(orderId);
    } catch (error) {
      throw new RpcException('Failed to get order');
    }
  }

  async getOrderWithItems(orderId: string): Promise<Order | null> {
    try {
      return await this.orderRepository.findByIdWithItems(orderId);
    } catch (error) {
      throw new RpcException('Failed to get order with items');
    }
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    try {
      return await this.orderItemRepository.findByOrderId(orderId);
    } catch (error) {
      throw new RpcException('Failed to get order items');
    }
  }
}
