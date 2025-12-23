import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserRole } from './user_role.entity';

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

  @OneToMany(() => UserRole, ur => ur.user)
  user_roles: UserRole[];

  @Column({type: 'timestamp', nullable: true, default: null})
  deletedAt: Date | null;

}
