import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";

import { IOrderRepository } from "../iorder.repository";
import { Order } from "../../entities/order.entity";
import { OrderStatus } from "../../enums/order-status.enum";
import { FindManyOrdersFilters } from "../../dtos/order.filters";

@Injectable()
export class OrderRepository extends IOrderRepository {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
  ) {
    super();
  }

  async create(orderData: Partial<Order>): Promise<Order> {
    const order = this.repo.create(orderData);
    return await this.repo.save(order);
  }

  async save(order: Order): Promise<Order> {
    return await this.repo.save(order);
  }

  async update(orderId: string, data: Partial<Order>): Promise<void> {
    await this.repo.update(orderId, {
      ...data,
      updatedAt: new Date(),
    });
  }

  // basic finders

  async findById(orderId: string): Promise<Order | null> {
    return await this.repo.findOne({
      where: { id: orderId },
    });
  }

  async findByIdWithItems(orderId: string): Promise<Order | null> {
    return await this.repo.findOne({
      where: { id: orderId },
      relations: [
        "items",
        "items.product",
      ],
    });
  }

  async findByIdWithItemsAndReservations(orderId: string): Promise<Order | null> {
    return await this.repo.findOne({
      where: { id: orderId },
      relations: [
        "items",
        "items.product",
        "reservations",
        "reservations.batch",
      ],
    });
  }

  async findByCheckoutSessionId(sessionId: string): Promise<Order[]> {
    return await this.repo.find({
      where: { checkoutSessionId: sessionId },
      order: { createdAt: "DESC" },
    });
  }

  async findByCheckoutSessionIdWithItems(sessionId: string): Promise<Order[]> {
    return await this.repo.find({
      where: { checkoutSessionId: sessionId },
      relations: ["items", "items.product"],
      order: { createdAt: "DESC" },
    });
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return await this.repo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async findByUserIdWithItems(userId: string): Promise<Order[]> {
    return await this.repo.find({
      where: { userId },
      relations: ["items", "items.product"],
      order: { createdAt: "DESC" },
    });
  }

  async findByKioskUserId(kioskUserId: number): Promise<Order[]> {
    return await this.repo.find({
      where: { kioskUserId },
      order: { createdAt: "DESC" },
    });
  }

  async findByKioskUserIdWithItems(kioskUserId: number): Promise<Order[]> {
    return await this.repo.find({
      where: { kioskUserId },
      relations: ["items", "items.product"],
      order: { createdAt: "DESC" },
    });
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    return await this.repo.find({
      where: { status },
      order: { createdAt: "DESC" },
    });
  }

  async findByKioskAndStatus(kioskUserId: number, status: OrderStatus): Promise<Order[]> {
    return await this.repo.find({
      where: { kioskUserId, status },
      order: { createdAt: "DESC" },
    });
  }

  // status transitions

  async markAccepted(orderId: string): Promise<void> {
    await this.repo.update(orderId, {
      status: OrderStatus.ACCEPTED,
      acceptedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async markRejected(orderId: string): Promise<void> {
    await this.repo.update(orderId, {
      status: OrderStatus.REJECTED,
      rejectedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async markReadyForPayment(orderId: string, expiresAt: Date): Promise<void> {
    await this.repo.update(orderId, {
      status: OrderStatus.READY_FOR_PAYMENT,
      expiresAt,
      updatedAt: new Date(),
    });
  }

  async markPaid(orderId: string): Promise<void> {
    await this.repo.update(orderId, {
      status: OrderStatus.PAID,
      paidAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // automatic expiration

  async markExpiredOrders(thresholdDate: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder("order")
      .update()
      .set({
        status: OrderStatus.AUTO_REJECTED_TIMEOUT,
        updatedAt: new Date(),
      })
      .where(`"orders"."status" = :status`, {
        status: OrderStatus.PENDING_KIOSK_CONFIRMATION,
      })
      .andWhere(`"orders"."createdAt" < :thresholdDate`, { thresholdDate })
      .execute();

    return result.affected ?? 0;
  }

  async markCancelRequested(orderId: string): Promise<void> {
    await this.repo.update(orderId, {
      status: OrderStatus.CANCEL_REQUESTED,
      updatedAt: new Date(),
    });
  }

  async markCancelled(orderId: string): Promise<void> {
    await this.repo.update(orderId, {
      status: OrderStatus.CANCELLED,
      updatedAt: new Date(),
    });
  }

  async findPendingExpired(now: Date): Promise<Order[]> {
    return this.repo.find({
      where: {
        status: OrderStatus.PENDING_KIOSK_CONFIRMATION,
        expiresAt: LessThan(now),
      },
      take: 200,
    });
  }

  async findPaymentExpired(now: Date): Promise<Order[]> {
    return this.repo.find({
      where: [
        { status: OrderStatus.ACCEPTED, expiresAt: LessThan(now) },
        { status: OrderStatus.READY_FOR_PAYMENT, expiresAt: LessThan(now) },
      ],
      take: 200,
    });
  }

  async findMany(filters: FindManyOrdersFilters): Promise<Order[]> {
  const {status, kioskUserId, userId, expiresAtBefore, limit = 200,} = filters;
  
  const qb = this.repo.createQueryBuilder("order");

  if (kioskUserId !== undefined) {
    qb.andWhere("order.kioskUserId = :kioskUserId", { kioskUserId });
  }

  if (userId !== undefined) {
    qb.andWhere("order.userId = :userId", { userId });
  }

  if (status !== undefined) {
    if (Array.isArray(status)) {
      qb.andWhere("order.status IN (:...status)", { status });
    } else {
      qb.andWhere("order.status = :status", { status });
    }
  }

  if (expiresAtBefore !== undefined) {
    qb.andWhere("order.expiresAt < :expiresAtBefore", { expiresAtBefore });
  }

  qb.orderBy("order.expiresAt", "ASC");
  qb.take(limit);

  return qb.getMany();
}


}