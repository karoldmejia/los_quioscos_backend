import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Batch } from './batch.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { ReservationStatus } from '../enums/reservation-status.enum';

@Entity('batch_reservations')
@Index(['batchId', 'status'])
@Index(['orderId', 'status'])
@Index(['expiresAt'])
export class BatchReservation {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 50 })
    batchId: string;

    @ManyToOne(() => Batch, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'batchId' })
    batch: Batch;

    @Column({ type: 'uuid' })
    productId: string;

    @Column({ type: 'uuid' })
    orderId: string;

    @ManyToOne(() => Order, (order) => order.reservations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderId' })
    order: Order;

    @Column({ type: 'uuid', nullable: true })
    orderItemId: string;

    @ManyToOne(() => OrderItem, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'orderItemId' })
    orderItem: OrderItem;

    @Column({ type: 'int' })
    kioskUserId: number;

    @Column({ type: 'int' })
    quantity: number;

    @Column({type: 'enum', enum: ReservationStatus, default: ReservationStatus.ACTIVE})
    status: ReservationStatus;

    @Column({ type: 'timestamp' })
    expiresAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}