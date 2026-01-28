import { Entity, PrimaryColumn, Column, JoinColumn, OneToOne } from 'typeorm';
import { DocumentStatus } from './document_status.enum';
import { User } from './user.entity';

@Entity('kiosk_profiles')
export class KioskProfile {
  @PrimaryColumn()
  userId: number;

  @OneToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

  @Column()
  fullLegalName: string;

  @Column()
  idNumber: string;

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
