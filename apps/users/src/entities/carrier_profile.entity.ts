import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryColumn, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { User } from "./user.entity";
import { CarrierDocument } from "./carrier_document.entity";
import { Vehicle } from "./vehicle.entity";
import { ProfileSchedules } from "./profile_schedule.entity";

@Entity('carrier_profiles')
export class CarrierProfile {

    @PrimaryColumn()
    userId: string;

    @OneToOne(() => User)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    fullLegalName: string;

    @Column()
    idNumber: string;

    @Column({ type: 'float'})
    serviceRadiusKm?: number;

    @Column({ default: false })
    canOperate: boolean;

    @Column({ default: false })
    isAcceptingRoutes: boolean;

    @Column({ type: 'timestamp', nullable: true })
    declarationSignedAt: Date;

    @OneToMany(() => CarrierDocument, (document) => document.carrierProfile, { cascade: true })
    documents: CarrierDocument[]

    @OneToOne(() => Vehicle, (vehicle) => vehicle.carrierProfile, { cascade: true })
    vehicle: Vehicle;

    @DeleteDateColumn({ type: 'timestamp', nullable: true })
    deletedAt: Timestamp;
}