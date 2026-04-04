import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Contract } from "./contract.entity";
import { ContractScheduleStatus } from "../enums/contract-schedule-status.enum";
import { ContractScheduleVersion } from "./contract-schedule-version.entity";

@Entity('contract_schedules')
export class ContractSchedule {

  @PrimaryGeneratedColumn('uuid')
  contract_schedule_id: string;

  @ManyToOne(() => Contract, contract => contract.schedules)
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: string;

  @Column({ type: 'timestamp' })
  scheduled_delivery_date: Date;

  @Column({
    type: 'enum',
    enum: ContractScheduleStatus,
    default: ContractScheduleStatus.SCHEDULED
  })
  status: ContractScheduleStatus;

  @OneToMany(
    () => ContractScheduleVersion,
    version => version.contract_schedule
  )
  versions: ContractScheduleVersion[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}