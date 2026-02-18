import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { CheckoutSession } from './checkout-session.entity';
import { OrderStatus } from '../enums/order-status.enum';
import { OrderItem } from './order-item.entity';
import { BatchReservation } from './batch-reservation.entity';

@Entity('orders')
export class Order {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    checkoutSessionId: string;

    @ManyToOne(() => CheckoutSession, (session) => session.orders, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'checkoutSessionId' })
    checkoutSession: CheckoutSession;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'int' })
    kioskUserId: number;

    @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_KIOSK_CONFIRMATION })
    status: OrderStatus;

    @Column({ type: "decimal", precision: 12, scale: 2, default: 0 })
    subtotalProducts: string;

    @Column({ type: 'timestamp', nullable: true })
    acceptedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    rejectedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    paidAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    shippingInfo: any;

    @Column({ type: 'jsonb', nullable: true })
    paymentInfo: any;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
    items: OrderItem[];

    @OneToMany(() => BatchReservation, (reservation) => reservation.order)
    reservations: BatchReservation[];
}