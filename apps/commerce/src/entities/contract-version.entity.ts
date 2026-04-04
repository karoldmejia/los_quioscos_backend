import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn} from 'typeorm';
import { Contract } from './contract.entity';

@Entity('contract_versions')
export class ContractVersion {
  @PrimaryGeneratedColumn()
  contract_version_id: number;

  @ManyToOne(() => Contract, (contract) => contract.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: string;

  @Column('int')
  version_number: number;

  @Column()
  proposed_by: string;

  @Column({ type: 'json' })
  terms_json_snapshot: any;

  @CreateDateColumn()
  created_at: Date;
}