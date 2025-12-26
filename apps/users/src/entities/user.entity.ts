import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from './role.entity';

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

  @Column({ nullable: true })
  role_id: number | null;

  @Column({type: 'timestamp', nullable: true, default: null})
  deletedAt: Date | null;

}
