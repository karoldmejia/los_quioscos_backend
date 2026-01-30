
import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn,} from 'typeorm';
import { Batch } from '../entities/batch.entity';
import { StockMovementType } from '../enums/stock-movement-type.enum';

@Entity('stock_movements')
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  batchId: string;

  @Column({
    type: 'enum',
    enum: StockMovementType,
  })
  type: StockMovementType;

  @Column({ type: 'int' })
  delta: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Batch, (batch) => batch.movements, {onDelete: 'CASCADE',})
  @JoinColumn({ name: 'batchId' })
  batch: Batch;

}