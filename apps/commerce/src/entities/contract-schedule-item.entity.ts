import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { ContractScheduleVersion } from "./contract-schedule-version.entity";

@Entity('contract_schedule_items')
export class ContractScheduleItem {

  @PrimaryGeneratedColumn('uuid')
  contract_schedule_item_id: string;

  @ManyToOne(
    () => ContractScheduleVersion,
    version => version.items
  )
  @JoinColumn({ name: 'contract_schedule_version_id' })
  contract_schedule_version: ContractScheduleVersion;

  @Column()
  contract_schedule_version_id: string;

  @Column()
  product_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'json', nullable: true })
  requirements_json: any;
}