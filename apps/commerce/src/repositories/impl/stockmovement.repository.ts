import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { StockMovement } from '../../entities/stock-movement.entity';
import { Repository, DataSource, Between } from 'typeorm';
import { IStockMovementRepository } from "../istockmovement.repository";
import { StockMovementType } from '../../enums/stock-movement-type.enum';


@Injectable()
export class StockMovementRepository implements IStockMovementRepository {
  constructor(
    @InjectRepository(StockMovement)
    private readonly repo: Repository<StockMovement>,
    private dataSource: DataSource,
  ) {}

  // basic crud functionalities
  async create(movement: StockMovement): Promise<StockMovement> {
    const newMovement = this.repo.create(movement);
    return await this.repo.save(newMovement);
  }

  async save(movement: StockMovement): Promise<StockMovement> {
    return await this.repo.save(movement);
  }

  async findById(movementId: string): Promise<StockMovement | null> {
    return await this.repo.findOne({
      where: { id: movementId },
      relations: ['batch', 'batch.product'],
    });
  }

  // basic queries
  async findByBatchId(batchId: string): Promise<StockMovement[]> {
    return await this.repo.find({
      where: { batchId },
      relations: ['batch', 'batch.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByProductId(productId: string): Promise<StockMovement[]> {
    return await this.repo
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.batch', 'batch')
      .leftJoinAndSelect('batch.product', 'product')
      .where('batch.productId = :productId', { productId })
      .orderBy('movement.createdAt', 'DESC')
      .getMany();
  }

  async findByType(type: StockMovementType): Promise<StockMovement[]> {
    return await this.repo.find({
      where: { type },
      relations: ['batch', 'batch.product'],
      order: { createdAt: 'DESC' },
    });
  }

  // advanced queries
  async findMovementsByDateRange(startDate: Date, endDate: Date): Promise<StockMovement[]> {
    return await this.repo.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
      relations: ['batch', 'batch.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findMovementsByBatchAndDate(batchId: string, startDate: Date, endDate: Date): Promise<StockMovement[]> {
    return await this.repo.find({
      where: {
        batchId,
        createdAt: Between(startDate, endDate),
      },
      relations: ['batch', 'batch.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findMovementsByProductAndDate(productId: string, startDate: Date, endDate: Date): Promise<StockMovement[]> {
    return await this.repo
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.batch', 'batch')
      .leftJoinAndSelect('batch.product', 'product')
      .where('batch.productId = :productId', { productId })
      .andWhere('movement.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('movement.createdAt', 'DESC')
      .getMany();
  }

  // statistical queries
  async getTotalMovementByBatch(batchId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('movement')
      .select('SUM(movement.delta)', 'total')
      .where('movement.batchId = :batchId', { batchId })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  async getTotalMovementByProduct(productId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('movement')
      .leftJoin('movement.batch', 'batch')
      .select('SUM(movement.delta)', 'total')
      .where('batch.productId = :productId', { productId })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  async getMovementSummaryByProduct(productId: string, startDate?: Date, endDate?: Date): Promise<any> {
    let query = this.repo
      .createQueryBuilder('movement')
      .leftJoin('movement.batch', 'batch')
      .select('movement.type', 'type')
      .addSelect('SUM(movement.delta)', 'total')
      .addSelect('COUNT(movement.id)', 'count')
      .where('batch.productId = :productId', { productId })
      .groupBy('movement.type');

    if (startDate && endDate) {
      query = query.andWhere('movement.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    return await query.getRawMany();
  }

  // transactional helpers
  async executeInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return await this.dataSource.transaction(callback);
  }
}