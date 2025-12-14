import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToOne,  } from 'typeorm';
import { StatusType } from './status_type.entity';
import { User } from './user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryColumn()
  user_id: number; // PK and FK to User

  @OneToOne(() => User, { cascade: true })
  @JoinColumn({ name: 'user_id' })
  user: User;
  
  @Column({ unique: true })
  full_legal_name: string;

  @ManyToOne(() => StatusType, status => status.profiles)
  @JoinColumn({ name: 'status_id' })
  status: StatusType;
}
 