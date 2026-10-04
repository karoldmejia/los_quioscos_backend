import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { CarrierProfile } from "./carrier_profile.entity";
import { KioskProfile } from "./kiosk_profile.entity";
import { DayOfWeek } from "../enums/day_of_week.enum";

@Entity('profile_schedules')
export class ProfileSchedules {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    profileType: 'carrier' | 'kiosk';

    @Column({ name: 'profile_id' })
    profileId: string; 

    @Column({ type: 'enum', enum: DayOfWeek })
    dayOfWeek: DayOfWeek;

    @Column({ type: 'time' })
    startTime: string;

    @Column({ type: 'time' })
    endTime: string;

    @Column({default: true})
    isActive: boolean;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;
}