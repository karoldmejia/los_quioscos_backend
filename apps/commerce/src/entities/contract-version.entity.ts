import { TargetType } from '../enums/target-type.enum';
import { VersionStatus } from '../enums/version-status.enum';
import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn} from 'typeorm';

@Entity('contract_versions')
export class ContractVersion {
  @PrimaryGeneratedColumn()
  contract_version_id: number;

  @Column('int')
  version_number: number;

  @Column()
  proposed_by: string;

  @Column({ type: 'json', nullable: true})
  terms_json_snapshot?: any;

  @Column({ type: 'json', nullable: true })
  change_reason?: string;

  @CreateDateColumn()
  created_at: Date;

  @Column({type: 'enum', enum: TargetType})
  target_type: TargetType;

  @Column()
  target_id: string;

  @Column({type: 'enum', enum: VersionStatus, default: VersionStatus.PROPOSED})
  status: VersionStatus;

}