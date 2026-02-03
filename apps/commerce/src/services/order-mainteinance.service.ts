import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { OrderRepository } from "../repositories/impl/order.repository";
import { OrderService } from "./order.service";
import { OrderStatus } from "../enums/order-status.enum";

@Injectable()
export class OrderMaintenanceService {
  private readonly logger = new Logger(OrderMaintenanceService.name);

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderService: OrderService,
  ) {}

  // runs every minut, auto rejects orders that already expired
  @Cron(CronExpression.EVERY_MINUTE)
  async autoRejectPendingOrders(): Promise<void> {
    const now = new Date();

    const orders = await this.orderRepository.findMany({
      status: OrderStatus.PENDING_KIOSK_CONFIRMATION,
      expiresAtBefore: now,
      limit: 200,
    });

    if (orders.length === 0) return;

    this.logger.log(`Auto rejecting ${orders.length} pending orders...`);

    for (const order of orders) {
      try {
        await this.orderService.autoRejectTimeout(order.id);
      } catch (err) {
        this.logger.error(
          `Failed autoRejectTimeout for order ${order.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  // runs every minute, cancel orders accepted or ready for payment that expired for no payment
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredPaymentOrders(): Promise<void> {
    const now = new Date();

    const orders = await this.orderRepository.findMany({
      status: [OrderStatus.ACCEPTED, OrderStatus.READY_FOR_PAYMENT],
      expiresAtBefore: now,
      limit: 200,
    });

    if (orders.length === 0) return;

    this.logger.log(`Cancelling ${orders.length} expired payment orders...`);

    for (const order of orders) {
      try {
        await this.orderService.cancellationRequested(order.id);
      } catch (err) {
        this.logger.error(
          `Failed cancellationRequested for order ${order.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
