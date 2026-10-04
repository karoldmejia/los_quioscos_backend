import { Injectable, NotFoundException } from "@nestjs/common";
import { KioskProfileDto } from "../dtos/kioskprofile.dto";
import { KioskProfile } from "../entities/kiosk_profile.entity";
import { DocumentStatus } from "../enums/document_status.enum";
import { DocumentsValidationService } from "./documents-validation.service";
import { RpcException } from "@nestjs/microservices";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";

@Injectable()
export class KioskProfileService {
    constructor(
        @InjectRepository(KioskProfile)
        private readonly repo: Repository<KioskProfile>,
        private readonly documentsValidation: DocumentsValidationService,
    ) { }

    async create(dto: KioskProfileDto): Promise<KioskProfile> {
        return await this.repo.create({
            userId: dto.userId,
            fullLegalName: dto.fullLegalName || '',
            idNumber: dto.idNumber || '',
            kioskName: dto.kioskName || '',
            kioskDescr: dto.kioskDescr || '',
            documentsStatus: { ID: DocumentStatus.PENDING },
            serviceRadiusKm: 5,
            declarationSignedAt: undefined,
        });
    }

    async updateProfile(userId: string, dto: KioskProfileDto): Promise<KioskProfile> {
        // 1. Verificar si el perfil existe
        const existingProfile = await this.repo.findOneBy({ userId });
        if (!existingProfile) {
            throw new RpcException(`Kiosk's profile not found for user ${userId}`);
        }

        if (dto.idNumber !== undefined) {
            if (!this.validateIdNumber(dto.idNumber)) {
                throw new RpcException('ID number must have between 7 and 10 digits');
            }
        }

        if (dto.kioskName !== undefined) {
            const isUnique = await this.isKioskNameUnique(dto.kioskName, userId);
            if (!isUnique) {
                throw new RpcException('Kiosk name is already taken');
            }
        }

        if (dto.fullLegalName !== undefined) {
            const isUnique = await this.isFullLegalNameUnique(dto.fullLegalName, userId);
            if (!isUnique) {
                throw new RpcException('Full legal name is already registered');
            }
        }

        if (dto.fullLegalName !== undefined) existingProfile.fullLegalName = dto.fullLegalName;
        if (dto.idNumber !== undefined) existingProfile.idNumber = dto.idNumber;
        if (dto.kioskName !== undefined) existingProfile.kioskName = dto.kioskName;
        if (dto.kioskDescr !== undefined) existingProfile.kioskDescr = dto.kioskDescr;

        const updatedProfile = await this.repo.save(existingProfile);

        return updatedProfile;
    }

    // getters

    async getProfileByUserId(userId: string): Promise<KioskProfile> {
        const profile = await this.repo.findOneBy({ userId });
        if (!profile) throw new RpcException(`Kiosk's profile not found for user ${userId}`);
        return profile;
    }
    async getAllProfiles(): Promise<KioskProfile[]> {
        return await this.repo.find({
            relations: ['user']
        });
    }

    async getActiveProfiles(): Promise<KioskProfile[]> {
        return await this.repo
            .createQueryBuilder('profile')
            .innerJoinAndSelect('profile.user', 'user')
            .where('user.deletedAt IS NULL')
            .getMany();
    }

    async getProfilesReadyToOperate(): Promise<KioskProfile[]> {
        return await this.repo
            .createQueryBuilder('profile')
            .innerJoinAndSelect('profile.user', 'user')
            .where('profile.canOperate = :canOperate', { canOperate: true })
            .andWhere('user.deletedAt IS NULL')
            .getMany();
    }

    async getProfilesWithPendingDocuments(): Promise<KioskProfile[]> {
        return await this.repo
            .createQueryBuilder("profile")
            .innerJoinAndSelect('profile.user', 'user')
            .where("JSON_CONTAINS(JSON_KEYS(profile.documentsStatus), :pending)", { pending: '"PENDING"' })
            .andWhere('user.deletedAt IS NULL')
            .getMany();
    }

    async getProfilesByUserIds(userIds: string[]): Promise<KioskProfile[]> {
        return await this.repo.find({
            where: { userId: In(userIds) },
        });
    }

    // documents

    async uploadIdDocument(userId: string, file: Buffer, selfie?: Buffer): Promise<{ profile: KioskProfile; validation: any }> {
        const profile = await this.getProfileByUserId(userId);
        const docPriority = ['1', '2'];
        let validationResult: any = null;
        for (const dt of docPriority) {
            try {
                validationResult = await this.documentsValidation.validateDocument(userId, dt, [file], selfie);

                // if its valid, we end the loop
                if (validationResult.is_valid) {
                    break;
                }
                // if its not, we continue with the next doc type
            } catch (e) {
                continue;
            }
        }

        // if after all doc_type its still not valid, its rejected
        const finalStatus = validationResult?.is_valid ? DocumentStatus.VALID : DocumentStatus.REJECTED;

        // update id status on profile
        profile.documentsStatus['ID'] = finalStatus;

        profile.canOperate = Object.values(profile.documentsStatus).every(
            s => s === DocumentStatus.VALID
        ) && !!profile.declarationSignedAt;

        const updatedProfile = await this.repo.save(profile);

        return {
            profile: updatedProfile,
            validation: validationResult
        };
    }

    async signDeclaration(userId: string): Promise<KioskProfile> {
        const profile = await this.repo.findOneBy({ userId });
        if (!profile) throw new RpcException("Profile not found");

        profile.declarationSignedAt = new Date();

        const allValid = Object.values(profile.documentsStatus || {}).every(
            s => s === DocumentStatus.VALID
        );
        profile.canOperate = allValid && !!profile.declarationSignedAt;

        const updatedProfile = await this.repo.save(profile);

        return updatedProfile;
    }

    // helpers

    private validateIdNumber(idNumber: string): boolean {
        if (!idNumber) return false;

        const cleanedId = idNumber.replace(/\D/g, '');
        return cleanedId.length >= 7 && cleanedId.length <= 10;
    }

    private async isKioskNameUnique(kioskName: string, excludeuserId: string): Promise<boolean> {
        if (!kioskName) return true;

        const existingProfile = await this.repo.findOneBy({ kioskName });

        if (!existingProfile) return true;
        return existingProfile.userId === excludeuserId;
    }

    private async isFullLegalNameUnique(fullLegalName: string, excludeuserId: string): Promise<boolean> {
        if (!fullLegalName) return true;

        const existingProfile = await this.repo.findOneBy({ fullLegalName });
        if (!existingProfile) return true;

        return existingProfile.userId === excludeuserId;
    }

}