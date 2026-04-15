import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ContractSchedule } from "./contract-schedule.entity";
import { ProposedBy } from "../enums/proposed-by.enum";
import { ContractScheduleVersionStatus } from "../enums/contract-schedule-version-status.enum";
import { ContractScheduleItem } from "./contract-schedule-item.entity";

@Entity('contract_schedule_versions')
export class ContractScheduleVersion {

  @PrimaryGeneratedColumn('uuid')
  contract_schedule_version_id: string;

  @ManyToOne(
    () => ContractSchedule,
    schedule => schedule.versions
  )
  @JoinColumn({ name: 'contract_schedule_id' })
  contract_schedule: ContractSchedule;

  @Column()
  contract_schedule_id: string;

  @Column()
  version_number: number;

  @Column({type: 'enum', enum: ProposedBy})
  proposed_by: ProposedBy;

  @Column({ nullable: true })
  change_reason: string;

  @Column({type: 'enum', enum: ContractScheduleVersionStatus, default: ContractScheduleVersionStatus.PROPOSED})
  status: ContractScheduleVersionStatus;

  @OneToMany(
    () => ContractScheduleItem,
    item => item.contract_schedule_version,
    { cascade: true }
  )
  items: ContractScheduleItem[];

  @CreateDateColumn()
  created_at: Date;
}