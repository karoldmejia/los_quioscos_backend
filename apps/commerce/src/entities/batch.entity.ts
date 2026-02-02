import { Entity, PrimaryColumn, Column, CreateDateColumn, Index, DeleteDateColumn, Check, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { BatchStatus } from '../enums/batch-status.enum';
import { StockMovement } from './stock-movement.entity';
import { Product } from './product.entity';
import { IsInt, Min } from 'class-validator';

@Entity('batches')
export class Batch {
    @PrimaryColumn({ type: 'varchar', length: 50 })
    id: string; //like LOTE-20240620-001

    @Index()
    @Column({ type: 'uuid' })
    productId: string;

    @ManyToOne(() => Product, (product) => product.batches, { onDelete: 'CASCADE', })
    @JoinColumn({ name: 'productId' })
    product: Product;

    @Column({ type: 'date' })
    productionDate: Date;

    @Column({ type: 'date' })
    expirationDate: Date;

    @Column({ type: 'int' })
    @IsInt()
    @Min(0)
    initialQuantity: number;

    @Column({ type: 'int' })
    @IsInt()
    @Min(0)
    currentQuantity: number;

    @Column({ type: 'int', default: 0 })
    reservedQuantity: number;


    @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.ACTIVE })
    status: BatchStatus;

    @CreateDateColumn()
    createdAt: Date;

    @OneToMany(() => StockMovement, (movement) => movement.batch, { cascade: true, })
    movements: StockMovement[];
}