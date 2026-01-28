import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Role } from './role.entity';
import { KioskProfile } from './kiosk_profile.entity';

@Entity()
export class User {
  [x: string]: any;
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  password: string | null;

  @Column({ type: 'varchar', nullable: true })
  profile_photo_url: string | null;

  @ManyToOne(() => Role, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;
  
  @Column({type: 'timestamp', nullable: true, default: null})
  deletedAt: Date | null;

  @OneToOne(() => KioskProfile, (profile) => profile.user, {cascade: true,onDelete: 'CASCADE'})
  @JoinColumn({ name: 'userId' })
  kioskProfile: KioskProfile;


}
