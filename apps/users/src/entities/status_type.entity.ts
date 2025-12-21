import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Profile } from './profile.entity';

@Entity('status_type')
export class StatusType {
  @PrimaryGeneratedColumn()
  status_id: number;

  @Column()
  status_name: string;

  @OneToMany(() => Profile, profile => profile.status)
  profiles: Profile[];
}
