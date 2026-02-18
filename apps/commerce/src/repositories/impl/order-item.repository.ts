import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { IOrderItemRepository } from "../iorder-item.repository";
import { OrderItem } from "../../entities/order-item.entity";

@Injectable()
export class OrderItemRepository extends IOrderItemRepository {
  constructor(
    @InjectRepository(OrderItem)
    private readonly repo: Repository<OrderItem>,
  ) {
    super();
  }

  async create(itemData: Partial<OrderItem>): Promise<OrderItem> {
    const item = this.repo.create(itemData);
    return await this.repo.save(item);
  }

  async createMany(itemsData: Partial<OrderItem>[]): Promise<OrderItem[]> {
    const items = this.repo.create(itemsData);
    return await this.repo.save(items);
  }

  async save(item: OrderItem): Promise<OrderItem> {
    return await this.repo.save(item);
  }

  async saveMany(items: OrderItem[]): Promise<OrderItem[]> {
    return await this.repo.save(items);
  }

  async findById(itemId: string): Promise<OrderItem | null> {
    return await this.repo.findOne({
      where: { id: itemId },
    });
  }

  async findByOrderId(orderId: string): Promise<OrderItem[]> {
    return await this.repo.find({
      where: { orderId },
      order: { createdAt: "ASC" },
    });
  }

  async findByOrderIdWithProduct(orderId: string): Promise<OrderItem[]> {
    return await this.repo.find({
      where: { orderId },
      relations: ["product"],
      order: { createdAt: "ASC" },
    });
  }

  async findByProductId(productId: string): Promise<OrderItem[]> {
    return await this.repo.find({
      where: { productId },
      order: { createdAt: "DESC" },
    });
  }

  async deleteByOrderId(orderId: string): Promise<void> {
    await this.repo.delete({ orderId });
  }
}
