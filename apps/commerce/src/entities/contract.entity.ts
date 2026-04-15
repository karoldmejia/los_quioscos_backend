import { LogisticsMode } from '../enums/logistics-mode.enum';
import { ContractStatus } from '../enums/contract-status.enum';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ContractItem } from './contract-item.entity';
import { ContractVersion } from './contract-version.entity';

@Entity('contracts')
export class Contract {
    @PrimaryGeneratedColumn('uuid')
    contract_id: string;

    @Column({ type: 'uuid' })
    business_id: string;

    @Column({ type: 'uuid' })
    kiosk_id: string;

    @Column({ type: 'uuid', nullable: true })
    transporter_id: string;

    @Column({
        type: 'enum',
        enum: ContractStatus,
        default: ContractStatus.DRAFT
    })
    status: ContractStatus;

    @Column({ type: 'date' })
    start_date: Date;

    @Column({ type: 'date' })
    end_date: Date;

    @Column({ type: 'date', nullable: true })
    pause_start_date: Date | null;

    @Column({ type: 'date', nullable: true })
    pause_end_date: Date | null;

    @Column({ type: 'varchar', length: 50 })
    frequency: string;

    @Column({ type: 'int' })
    change_deadline_days: number;

    @Column({ type: 'int' })
    cancellation_deadline_days: number;

    @Column({
        type: 'enum', enum: LogisticsMode
    })
    logistics_mode: LogisticsMode;

    @Column({ type: 'int', default: 1 })
    version: number;

    @Column({ type: 'uuid', nullable: true })
    parent_contract_id: string | null;

    @ManyToOne(() => Contract, contract => contract.child_contracts, { nullable: true })
    @JoinColumn({ name: 'parent_contract_id' })
    parent_contract: Contract | null;

    @CreateDateColumn({ type: 'timestamp' })
    created_at: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updated_at: Date;

    @OneToMany(() => Contract, contract => contract.parent_contract)
    child_contracts: Contract[] | null;

    @OneToMany(() => ContractItem, (item) => item.product)
    contractItems: ContractItem[];

    @OneToMany(() => ContractVersion, v => v.contract, { cascade: true })
    versions: ContractVersion[];
    schedules: any;
}