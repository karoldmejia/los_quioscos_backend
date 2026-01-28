import { Controller, NotFoundException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { KioskProfileService } from '../services/kioskprofile.service';
import { KioskProfileDto } from '../dtos/kioskprofile.dto';
import { KioskProfile } from '../entities/kiosk_profile.entity';

@Controller()
export class KioskProfileController {
  constructor(private readonly kioskProfileService: KioskProfileService) {}

  @MessagePattern({ cmd: 'update_kiosk_profile' })
  async updateProfile(@Payload() payload: { userId: number; dto: KioskProfileDto }): Promise<KioskProfile> {
    return await this.kioskProfileService.updateProfile(payload.userId, payload.dto);
  }

  @MessagePattern({ cmd: 'get_kiosk_profile_by_user' })
  async getProfileByUser(@Payload() userId: number): Promise<KioskProfile> {
    return await this.kioskProfileService.getProfileByUserId(userId);
  }

  @MessagePattern({ cmd: 'get_all_kiosk_profiles' })
  async getAllProfiles(): Promise<KioskProfile[]> {
    return await this.kioskProfileService.getAllProfiles();
  }

  @MessagePattern({ cmd: 'get_active_kiosk_profiles' })
  async getActiveProfiles(): Promise<KioskProfile[]> {
    return await this.kioskProfileService.getActiveProfiles();
  }

  @MessagePattern({ cmd: 'get_kiosk_profiles_ready_to_operate' })
  async getProfilesReadyToOperate(): Promise<KioskProfile[]> {
    return await this.kioskProfileService.getProfilesReadyToOperate();
  }

  @MessagePattern({ cmd: 'get_kiosk_profiles_with_pending_documents' })
  async getProfilesWithPendingDocuments(): Promise<KioskProfile[]> {
    return await this.kioskProfileService.getProfilesWithPendingDocuments();
  }

  @MessagePattern({ cmd: 'upload_kiosk_id_document' })
  async uploadIdDocument(@Payload() payload: { userId: number; file: Buffer; selfie?: Buffer }): Promise<{ profile: KioskProfile; validation: any }> {
    const { userId, file, selfie } = payload;
    return await this.kioskProfileService.uploadIdDocument(userId, file, selfie);
  }

  @MessagePattern({ cmd: 'sign_kiosk_declaration' })
  async signDeclaration(@Payload() userId: number): Promise<KioskProfile> {
    return await this.kioskProfileService.signDeclaration(userId);
  }
}
