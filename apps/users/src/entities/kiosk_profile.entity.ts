import { Entity, PrimaryColumn, Column, JoinColumn, OneToOne, OneToMany } from 'typeorm';
import { DocumentStatus } from '../enums/document_status.enum';
import { User } from './user.entity';
import { ProfileSchedules } from './profile_schedule.entity';

@Entity('kiosk_profiles')
export class KioskProfile {
  @PrimaryColumn()
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  fullLegalName: string;

  @Column()
  idNumber?: string;

  @Column({ type: 'float'})
  serviceRadiusKm?: number;

  @Column()
  kioskName: string;

  @Column({ nullable: true })
  kioskDescr: string;

  @Column({ type: 'json', nullable: true })
  documentsStatus: Record<string, DocumentStatus>;

  @Column({ default: false })
  canOperate: boolean;

  @Column({ type: 'timestamp', nullable: true })
  declarationSignedAt: Date;
}
