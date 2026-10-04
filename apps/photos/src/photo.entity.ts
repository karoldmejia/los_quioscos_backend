import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('photos')
export class Photo{

    @PrimaryGeneratedColumn('uuid')
    photoId: string;

    @Column()
    photoUrl: string;

    @CreateDateColumn({type: 'timestamp'})
    createdAt: Date;
}