import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { RolePermission } from './role_permission.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @OneToMany(() => RolePermission, rp => rp.permission)
  role_permissions: RolePermission[];
}
