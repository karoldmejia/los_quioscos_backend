import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { RolePermission } from './role_permission.entity';

@Entity('roles')
export class Role {
  [x: string]: any;
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @OneToMany(() => RolePermission, rp => rp.role)
  role_permissions: RolePermission[];
}
