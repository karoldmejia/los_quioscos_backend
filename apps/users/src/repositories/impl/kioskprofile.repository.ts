import { Injectable } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { IKioskProfileRepository } from "../ikioskprofile.repository";
import { KioskProfile } from "../../entities/kiosk_profile.entity";

@Injectable()
export class KioskProfileRepository extends IKioskProfileRepository {
    private repo: Repository<KioskProfile>;

    constructor(private readonly dataSource: DataSource) {
        super();
        this.repo = this.dataSource.getRepository(KioskProfile);
    }

    // basic querys
    async findByUserId(userId: number): Promise<KioskProfile | null> {
        return await this.repo.findOne({ 
            where: { userId },
            relations: ['user']
        });
    }

    async findAll(): Promise<KioskProfile[]> {
        return await this.repo.find({
            relations: ['user']
        });
    }

    // status querys
    async findActiveProfiles(): Promise<KioskProfile[]> {
        return await this.repo
            .createQueryBuilder('profile')
            .innerJoinAndSelect('profile.user', 'user')
            .where('user.deletedAt IS NULL')
            .getMany();
    }

    async findProfilesReadyToOperate(): Promise<KioskProfile[]> {
        return await this.repo
            .createQueryBuilder('profile')
            .innerJoinAndSelect('profile.user', 'user')
            .where('profile.canOperate = :canOperate', { canOperate: true })
            .andWhere('user.deletedAt IS NULL')
            .getMany();
    }

    async findProfilesWithPendingDocuments(): Promise<KioskProfile[]> {
        return await this.repo
            .createQueryBuilder("profile")
            .innerJoinAndSelect('profile.user', 'user')
            .where("JSON_CONTAINS(JSON_KEYS(profile.documentsStatus), :pending)", { pending: '"PENDING"' })
            .andWhere('user.deletedAt IS NULL')
            .getMany();
    }

    // create/update
    async create(profile: Partial<KioskProfile>): Promise<KioskProfile> {
        const newProfile = this.repo.create(profile);
        newProfile.canOperate = false; // default initial
        return await this.repo.save(newProfile);
    }

    async update(profile: KioskProfile): Promise<KioskProfile> {
        return await this.repo.save(profile);
    }

    async findByKioskName(kioskName: string): Promise<KioskProfile | null> {
        return await this.repo
            .createQueryBuilder('profile')
            .innerJoinAndSelect('profile.user', 'user')
            .where('profile.kioskName = :kioskName', { kioskName })
            .andWhere('user.deletedAt IS NULL')
            .select(['profile.userId', 'profile.kioskName'])
            .getOne();
    }

    async findByFullLegalName(fullLegalName: string): Promise<KioskProfile | null> {
        return await this.repo
            .createQueryBuilder('profile')
            .innerJoinAndSelect('profile.user', 'user')
            .where('profile.fullLegalName = :fullLegalName', { fullLegalName })
            .andWhere('user.deletedAt IS NULL')
            .select(['profile.userId', 'profile.fullLegalName'])
            .getOne();
    }

    async findByKioskNameIncludeDeleted(kioskName: string): Promise<KioskProfile | null> {
        return await this.repo.findOne({ 
            where: { kioskName },
            relations: ['user'],
            select: ['userId', 'kioskName']
        });
    }

    async findByFullLegalNameIncludeDeleted(fullLegalName: string): Promise<KioskProfile | null> {
        return await this.repo.findOne({ 
            where: { fullLegalName },
            relations: ['user'],
            select: ['userId', 'fullLegalName']
        });
    }
}