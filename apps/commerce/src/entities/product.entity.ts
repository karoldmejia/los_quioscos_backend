import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, DeleteDateColumn, OneToMany,} from 'typeorm';
import { ProductCategory } from '../enums/product-category.enum';
import { UnitMeasure } from '../enums/unit-measure.enum';
import { Batch } from './batch.entity';

@Entity('products')
    export class Product {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Index()
    @Column({ type: 'int' })
    kioskUserId: number;

    @Column({ type: 'varchar', length: 120 })
    name: string;

    @Column({ type: 'enum', enum: ProductCategory })
    category: ProductCategory;

    @Column({ type: 'enum', enum: UnitMeasure, nullable: true })
    unitMeasure?: UnitMeasure;

    @Column({ type: 'varchar', length: 50, nullable: true })
    customUnitMeasure?: string;

    @Column({ type: 'decimal', precision: 12, scale: 2 })
    price: string;

    @Column({ type: 'int' })
    durationDays: number;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @Column({ type: 'text', array: true, nullable: true })
    photos?: string[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ type: 'boolean' })
    active: boolean;
    
    @DeleteDateColumn()
    deletedAt?: Date;

    @OneToMany(() => Batch, (batch) => batch.product, { cascade: true })
    batches: Batch[];
}
