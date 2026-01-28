import { Injectable, NotFoundException } from "@nestjs/common";
import { KioskProfileRepository } from "../repositories/impl/kioskprofile.repository";
import { KioskProfileDto } from "../dtos/kioskprofile.dto";
import { KioskProfile } from "../entities/kiosk_profile.entity";
import { DocumentStatus } from "../entities/document_status.enum";
import { DocumentsValidationService } from "./documents-validation.service";
import { RpcException } from "@nestjs/microservices";

@Injectable()
export class KioskProfileService {
    constructor(
        private readonly repo: KioskProfileRepository,
        private readonly documentsValidation: DocumentsValidationService,
    ) {}

    async create(dto: KioskProfileDto): Promise<KioskProfile> {
        return await this.repo.create({
            userId: dto.userId,
            fullLegalName: dto.fullLegalName || '',
            idNumber: dto.idNumber || '',
            kioskName: dto.kioskName || '',
            kioskDescr: dto.kioskDescr || '',
            documentsStatus: { ID: DocumentStatus.PENDING },
            declarationSignedAt: undefined,
        });
    }

    async updateProfile(userId: number, dto: KioskProfileDto): Promise<KioskProfile> {
        // 1. Verificar si el perfil existe
        const existingProfile = await this.repo.findByUserId(userId);
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

        const updatedProfile = await this.repo.update(existingProfile);

        return updatedProfile;
    }

    async getProfileByUserId(userId: number): Promise<KioskProfile> {
        const profile = await this.repo.findByUserId(userId);
        if (!profile) throw new RpcException(`Kiosk's profile not found for user ${userId}`);
        return profile;
    }
    async getAllProfiles(): Promise<KioskProfile[]> {
        return await this.repo.findAll();
    }

    async getActiveProfiles(): Promise<KioskProfile[]> {
        return await this.repo.findActiveProfiles();
    }

    async getProfilesReadyToOperate(): Promise<KioskProfile[]> {
        return await this.repo.findProfilesReadyToOperate();
    }

    async getProfilesWithPendingDocuments(): Promise<KioskProfile[]> {
        return await this.repo.findProfilesWithPendingDocuments();
    }

    async uploadIdDocument(userId: number, file: Buffer, selfie?: Buffer): Promise<{ profile: KioskProfile; validation: any }> {
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

        const updatedProfile = await this.repo.update(profile);

        return {
            profile: updatedProfile,
            validation: validationResult
        };
    }

    async signDeclaration(userId: number): Promise<KioskProfile> {
        const profile = await this.repo.findByUserId(userId);
        if (!profile) throw new RpcException("Profile not found");

        profile.declarationSignedAt = new Date();

        const allValid = Object.values(profile.documentsStatus || {}).every(
            s => s === DocumentStatus.VALID
        );
        profile.canOperate = allValid && !!profile.declarationSignedAt;

        const updatedProfile = await this.repo.update(profile);

        return updatedProfile;    
    }

    // helpers

    private validateIdNumber(idNumber: string): boolean {
        if (!idNumber) return false;
        
        const cleanedId = idNumber.replace(/\D/g, '');
        return cleanedId.length >= 7 && cleanedId.length <= 10;
    }

    private async isKioskNameUnique(kioskName: string, excludeUserId: number): Promise<boolean> {
        if (!kioskName) return true;
        
        const existingProfile = await this.repo.findByKioskName(kioskName);
        
        if (!existingProfile) return true;
        return existingProfile.userId === excludeUserId;
    }

    private async isFullLegalNameUnique(fullLegalName: string, excludeUserId: number): Promise<boolean> {
        if (!fullLegalName) return true;
        
        const existingProfile = await this.repo.findByFullLegalName(fullLegalName);
        if (!existingProfile) return true;
        
        return existingProfile.userId === excludeUserId;
    }

}