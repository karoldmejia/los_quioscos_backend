import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, OneToOne, DeleteDateColumn } from 'typeorm';
import { Role } from './role.entity';
import { KioskProfile } from './kiosk_profile.entity';
import { CarrierProfile } from './carrier_profile.entity';
import { Address } from './address.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ type: 'uuid', nullable: true })
  profile_photo: string | null;

  @ManyToOne(() => Role, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToOne(() => KioskProfile, (profile) => profile.user, { cascade: true, onDelete: 'CASCADE' })
  kioskProfile: KioskProfile | null;

  @OneToOne(() => CarrierProfile, (profile) => profile.user, { cascade: true, onDelete: 'CASCADE' })
  carrierProfile: CarrierProfile | null;

  @OneToMany(() => Address, (address) => address.user, { cascade: true })
  addresses: Address[]
}
