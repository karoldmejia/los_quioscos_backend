import { KioskProfile } from "../entities/kiosk_profile.entity";

export abstract class IKioskProfileRepository {
  abstract findByUserId(userId: number): Promise<KioskProfile | null>;
  abstract findAll(): Promise<KioskProfile[]>; 

  abstract findActiveProfiles(): Promise<KioskProfile[]>;
  abstract findProfilesReadyToOperate(): Promise<KioskProfile[]>; // canOperate = true
  abstract findProfilesWithPendingDocuments(): Promise<KioskProfile[]>;

  abstract create(profile: Partial<KioskProfile>): Promise<KioskProfile>;
  abstract update(profile: KioskProfile): Promise<KioskProfile>;
}
