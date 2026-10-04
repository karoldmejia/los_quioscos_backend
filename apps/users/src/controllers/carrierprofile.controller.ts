import { Controller, NotFoundException } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CarrierProfileService } from '../services/carrierprofile.service';
import { CreateCarrierProfileDto, UpdateCarrierProfileDto } from '../dtos/carrierprofile.dto';
import { CarrierProfile } from '../entities/carrier_profile.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { CreateVehicleDto, UpdateVehicleDto, UploadVehiclePhotosDto } from '../dtos/vehicle.dto';
import { CreateCarrierDocumentDto } from '../dtos/carrierdocument.dto';

@Controller()
export class CarrierProfileController {
    constructor(private readonly carrierProfileService: CarrierProfileService) { }

    // carrier profile

    @MessagePattern({ cmd: 'create_carrier_profile' })
    async createProfile(@Payload() dto: CreateCarrierProfileDto): Promise<CarrierProfile> {
        return await this.carrierProfileService.createProfile(dto);
    }

    @MessagePattern({ cmd: 'update_carrier_profile' })
    async updateProfile(@Payload() dto: UpdateCarrierProfileDto): Promise<CarrierProfile> {
        return await this.carrierProfileService.updateProfile(dto);
    }

    @MessagePattern({ cmd: 'get_carrier_profile' })
    async getProfile(@Payload() userId: string): Promise<CarrierProfile> {
        return await this.carrierProfileService.getProfile(userId);
    }

    @MessagePattern({ cmd: 'delete_carrier_profile' })
    async deleteProfile(@Payload() userId: string): Promise<{ success: boolean }> {
        await this.carrierProfileService.deleteProfile(userId);
        return { success: true };
    }

    @MessagePattern({ cmd: 'get_all_carrier_profiles' })
    async getAllProfiles(): Promise<CarrierProfile[]> {
        return await this.carrierProfileService.getAllProfiles();
    }

    // vehicles

    @MessagePattern({ cmd: 'create_vehicle' })
    async createVehicle(@Payload() dto: CreateVehicleDto): Promise<Vehicle> {
        return await this.carrierProfileService.createVehicle(dto);
    }

    @MessagePattern({ cmd: 'update_vehicle' })
    async updateVehicle(@Payload() dto: UpdateVehicleDto): Promise<Vehicle> {
        return await this.carrierProfileService.updateVehicle(dto);
    }

    @MessagePattern({ cmd: 'get_vehicle' })
    async getVehicle(@Payload() vehicleId: string): Promise<Vehicle> {
        return await this.carrierProfileService.getVehicle(vehicleId);
    }

    @MessagePattern({ cmd: 'delete_vehicle' })
    async deleteVehicle(@Payload() carrierProfileId: string): Promise<{ success: boolean }> {
        await this.carrierProfileService.deleteVehicle(carrierProfileId);
        return { success: true };
    }

    @MessagePattern({ cmd: 'get_all_vehicles' })
    async getAllVehicles(): Promise<Vehicle[]> {
        return await this.carrierProfileService.getAllVehicles();
    }

    // documents

    @MessagePattern({ cmd: 'upload_carrier_document' })
    async uploadCarrierDocument(@Payload() dto: CreateCarrierDocumentDto): Promise<{ success: boolean }> {
        const result = await this.carrierProfileService.uploadCarrierDocument(dto);
        return { success: result };
    }

    @MessagePattern({ cmd: 'verify_carrier_operational_status' })
    async verifyOperationalStatus(@Payload() userId: string): Promise<{ canOperate: boolean }> {
        const profile = await this.carrierProfileService.getProfile(userId);
        await this.carrierProfileService.verifyOperationalStatus(profile);
        const updatedProfile = await this.carrierProfileService.getProfile(userId);
        return { canOperate: updatedProfile.canOperate };
    }

    // vehicle photos

    @MessagePattern({ cmd: 'upload_vehicle_photos' })
    async uploadVehiclePhotos(@Payload() dto: UploadVehiclePhotosDto): Promise<{ success: boolean }> {
        const result = await this.carrierProfileService.uploadVehiclePhoto(dto);
        return { success: result };
    }
}