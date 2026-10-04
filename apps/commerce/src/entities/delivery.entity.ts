import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Contract } from "./contract.entity";
import { DeliveryStatus } from "../enums/delivery-status.enum";
import { DeliveryMode } from "src/enums/delivery-mode.enum";

@Entity('deliveries')
export class Delivery {

  @PrimaryGeneratedColumn('uuid')
  delivery_id: string;

  @ManyToOne(() => Contract, contract => contract.deliveries)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: string;

  @Column({ type: 'timestamp' })
  scheduled_delivery_date: Date;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.SCHEDULED })
  status: DeliveryStatus;

  @Column({ type: 'enum', enum: DeliveryMode, default: DeliveryMode.INDIVIDUAL })
  deliveryMode: DeliveryMode;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}