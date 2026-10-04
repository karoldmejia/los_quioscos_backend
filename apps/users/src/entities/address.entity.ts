import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.entity";

@Entity('addresses')
export class Address {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({nullable: true })
    alias: string;

    @Column()
    country: string;

    @Column()
    department: string;

    @Column()
    municipality: string;

    @Column({nullable: true })
    neighborhood: string;

    @Column({nullable: true })
    addressLine: string;

    @Column({nullable: true })
    reference: string;

    @Column({ type: 'float' })
    latitude: number;

    @Column({ type: 'float' })
    longitude: number;

    @Column({nullable: true })
    mapboxId: string;

    @Column()
    isDefault: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;
}