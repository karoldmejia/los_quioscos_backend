import { VehicleType } from "../enums/type_vehicle.enum";
import { Column, DeleteDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CarrierProfile } from "./carrier_profile.entity";
import { PackageType } from "@/enums/package_type.enum";

@Entity('vehicles')
export class Vehicle{

    @PrimaryGeneratedColumn('uuid')
    vehicleId: string;

    @OneToOne(() => CarrierProfile, (carrier) => carrier.vehicle, {onDelete: 'CASCADE'})
    @JoinColumn({name: 'carrier_profile_id'})
    carrierProfile: CarrierProfile;

    @Column({type: 'enum', enum: VehicleType})
    type: VehicleType;

    @Column()
    brand: string;

    @Column()
    model: string;

    @Column({unique: true})
    plate: string;

    @Column({ type: 'float' })
    maxWeightKg: number;

    @Column({ type: 'json' })
    acceptedPackageTypes: PackageType[]

    @Column({type: 'json'})
    vehiclePhotos: string[];

    @DeleteDateColumn({type: 'timestamp', nullable: true})
    deletedAt: Date;
}