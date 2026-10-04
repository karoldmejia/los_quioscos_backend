import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { CarrierProfile } from "./carrier_profile.entity";
import { DocumentStatus } from "../enums/document_status.enum";
import { DocumentType } from "../enums/document_type.enum";

@Entity('carrier_documents')
export class CarrierDocument{

    @PrimaryGeneratedColumn('uuid')
    carrierDocumentId: string;

    @ManyToOne(() => CarrierProfile, (profile) => profile.documents, {onDelete: 'CASCADE'})
    @JoinColumn({name: 'carrier_profile_id'})
    carrierProfile: CarrierProfile;

    @Column({type: 'enum', enum: DocumentType})
    type: DocumentType;

    @Column()
    docId: string;

    @Column({type: 'enum', enum: DocumentStatus})
    status: DocumentStatus;

    @DeleteDateColumn()
    deletedAt: Timestamp;
}