import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,} from 'typeorm';
import { Contract } from './contract.entity';
import { Product } from './product.entity';

@Entity('contract_items')
export class ContractItem {
  @PrimaryGeneratedColumn('uuid')
  contract_item_id: string;

  @ManyToOne(() => Contract, (contract) => contract.contractItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id' })
  contract: Contract;

  @Column()
  contract_id: string;

  @ManyToOne(() => Product, (product) => product.contractItems, {
    eager: true,
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unit_price: number;

  @Column({ type: 'json', nullable: true })
  requirements_json: any;
}