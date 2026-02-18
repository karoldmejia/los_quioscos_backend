import { CheckoutSessionStatus } from '../enums/checkout-session-status.enum';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Order } from './order.entity';

@Entity('checkout_sessions')
export class CheckoutSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'uuid', nullable: true })
    cartId: string;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    totalAmount: string;

    @Column({type: 'enum', enum: CheckoutSessionStatus, default: CheckoutSessionStatus.PENDING})
    status: CheckoutSessionStatus;

    @Column({ type: 'timestamp', nullable: true })
    expiresAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => Order, (order) => order.checkoutSession)
    orders: Order[];
}