import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { RolePermission } from './role_permission.entity';
import { UserRole } from './user_role.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => RolePermission, rp => rp.role)
  role_permissions: RolePermission[];

  @OneToMany(() => UserRole, ur => ur.role)
  user_roles: UserRole[];
}
