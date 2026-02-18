import { Column, CreateDateColumn, DeleteDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { CartItem } from "./cart-item.entity";
import { CartStatus } from "../enums/cart-status.enum";

@Entity('carts')
export class Cart {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @Column({ type: 'enum', enum: CartStatus, default: CartStatus.ACTIVE })
    status: CartStatus;

    @Column({ type: 'timestamp', nullable: true })
    lastActivityAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => CartItem, (item) => item.cart, { cascade: true })
    items: CartItem[];

    @DeleteDateColumn()
    deletedAt?: Date;
}