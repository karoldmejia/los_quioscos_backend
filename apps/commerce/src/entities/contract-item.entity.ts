import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,} from 'typeorm';
import { Product } from './product.entity';
import { TargetType } from '../enums/target-type.enum';

@Entity('contract_items')
export class ContractItem {
  @PrimaryGeneratedColumn('uuid')
  contract_item_id: string;

  @Column({type: 'enum', enum: TargetType})
  target_type: TargetType;

  @Column()
  target_id: string;

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
  
  @Column()
  version_id: number
}