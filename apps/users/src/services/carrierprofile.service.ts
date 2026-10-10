import { CarrierActivatedEventDto, CarrierUpdatedEventDto, CreateCarrierProfileDto, UpdateCarrierProfileDto } from "../dtos/carrierprofile.dto";
import { CarrierProfile } from "../entities/carrier_profile.entity";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { UsersService } from "./users.service";
import { RpcException } from "@nestjs/microservices";
import type { ClientGrpc, ClientKafka } from "@nestjs/microservices";
import { KioskProfileService } from "./kioskprofile.service";
import { CreateVehicleDto, UpdateVehicleDto, UploadVehiclePhotosDto, UpsertVehicleEventDto } from "../dtos/vehicle.dto";
import { Vehicle } from "../entities/vehicle.entity";
import { CreateCarrierDocumentDto } from "../dtos/carrierdocument.dto";
import { DocumentsValidationService } from "./documents-validation.service";
import { DocumentStatus } from "../enums/document_status.enum";
import { CarrierDocument } from "../entities/carrier_document.entity";
import { DocumentType } from "../enums/document_type.enum";
import { AddressService } from "./address.service";

@Injectable()
export class CarrierProfileService {

    private photosService: any;
    private readonly logger = new Logger(CarrierProfileService.name);

    constructor(
        @InjectRepository(CarrierProfile)
        private readonly repo: Repository<CarrierProfile>,
        @InjectRepository(Vehicle)
        private readonly vehicleRepo: Repository<Vehicle>,
        @InjectRepository(CarrierDocument)
        private readonly documentRepo: Repository<CarrierDocument>,

        private readonly usersService: UsersService,
        private readonly kiosksService: KioskProfileService,
        private readonly documentsValidation: DocumentsValidationService,
        private readonly addressService: AddressService,
        @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
        @Inject('PHOTOS_PACKAGE') private client: ClientGrpc,
    ) {
        this.photosService = this.client.getService('PhotosService');
    }

    async createProfile(dto: CreateCarrierProfileDto): Promise<CarrierProfile> {
        const user = await this.usersService.findUserById(dto.userId)
        if (!user) {
            throw new RpcException("User with id " + dto.userId + " not found")
        }
        if (await this.kiosksService.getProfileByUserId(dto.userId)) {
            throw new RpcException("User already has a kiosk profile created")
        }
        if (await this.repo.findOneBy({ userId: dto.userId })) {
            throw new RpcException("User already has a carrier profile created")
        }
        if (await this.repo.findOneBy({ idNumber: dto.idNumber })) {
            throw new RpcException("Already exists a profile with same id number")
        }
        return await this.repo.save({
            userId: dto.userId,
            fullLegalName: dto.fullLegalName,
            idNumber: dto.idNumber,
            serviceRadiusKm: 5,
        })
    }

    async updateProfile(dto: UpdateCarrierProfileDto): Promise<CarrierProfile> {
        const profile = await this.repo.findOneBy({ userId: dto.userId })
        if (!profile) {
            throw new RpcException("User does not have a carrier profile associated")
        }

        const previous = {
            serviceRadiusKm: profile.serviceRadiusKm,
            isAcceptingRoutes: profile.isAcceptingRoutes,
        }
        if (dto.fullLegalName !== undefined) {
            profile.fullLegalName = dto.fullLegalName
        }
        if (dto.serviceRadiusKm !== undefined) {
            profile.serviceRadiusKm = dto.serviceRadiusKm
        }
        if (dto.isAcceptingRoutes !== undefined) {
            profile.isAcceptingRoutes = dto.isAcceptingRoutes
        }

        await this.repo.save(profile)

        const payload: Partial<CarrierUpdatedEventDto> = {};

        if (dto.serviceRadiusKm !== undefined && dto.serviceRadiusKm !== previous.serviceRadiusKm
        ) {
            payload.serviceRadiusKm = dto.serviceRadiusKm;
        }
        if (dto.isAcceptingRoutes !== undefined && dto.isAcceptingRoutes !== previous.isAcceptingRoutes
        ) {
            payload.isAcceptingRoutes = dto.isAcceptingRoutes;
        }

        if (Object.keys(payload).length > 0) {
            const event: CarrierUpdatedEventDto = {
                userId: profile.userId,
                ...payload,
                updatedAt: new Date().toISOString()
            };
            this.kafkaClient.emit('carrier.updated', event)
        }

        return profile
    }

    async getProfile(userId: string): Promise<CarrierProfile> {
        const profile = await this.repo.findOneBy({ userId })
        if (!profile) {
            throw new RpcException("Carrier profile not found for user " + userId)
        }
        return profile
    }

    async deleteProfile(userId: string): Promise<void> {
        const profile = await this.repo.findOneBy({ userId })
        if (!profile) {
            throw new RpcException("Carrier profile not found for user " + userId)
        }
        try {
            await this.deleteVehicle(userId)
            if (profile.canOperate){
                await this.publishVehicle(profile, 'delete')
            }
        } catch (error) {
            console.log('No vehicle to delete, continuing with profile deletion');
        }
        await this.repo.softDelete({ userId })
        this.kafkaClient.emit('carrier.deleted', {
            userId: profile.userId,
            deletedAt: new Date().toISOString()
        }
        )
    }

    async getAllProfiles(): Promise<CarrierProfile[]> {
        return await this.repo.find()
    }

    // vehicles functionalities

    async createVehicle(dto: CreateVehicleDto): Promise<Vehicle> {
        const profile = await this.repo.findOneBy({ userId: dto.carrierProfileId })
        if (!profile) {
            throw new RpcException("Carrier profile not found for user " + dto.carrierProfileId)
        }

        const existingVehicle = await this.vehicleRepo.findOneBy({ carrierProfile: profile })
        if (existingVehicle) {
            throw new RpcException("This carrier already has a vehicle registered")
        }
        const existingPlate = await this.vehicleRepo.findOneBy({ plate: dto.plate })
        if (existingPlate) {
            throw new RpcException("Vehicle plate already registered")
        }

        const vehicle = this.vehicleRepo.create({
            carrierProfile: profile,
            type: dto.type,
            brand: dto.brand,
            model: dto.model,
            plate: dto.plate,
            maxWeightKg: dto.maxWeightKg,
            acceptedPackageTypes: dto.acceptedPackageTypes,
            vehiclePhotos: []
        })

        await this.vehicleRepo.save(vehicle)
        await this.publishVehicle(profile, 'upsert')

        return vehicle
    }

    async updateVehicle(dto: UpdateVehicleDto): Promise<Vehicle> {
        const profile = await this.repo.findOneBy({ userId: dto.carrierProfileId })
        if (!profile) {
            throw new RpcException("Carrier profile not found for user " + dto.carrierProfileId)
        }

        const vehicle = await this.vehicleRepo.findOneBy({ carrierProfile: profile })
        if (!vehicle) {
            throw new RpcException("Vehicle not found for this carrier")
        }

        if (dto.plate && dto.plate != vehicle.plate) {
            const existingPlate = await this.vehicleRepo.findOneBy({ plate: dto.plate })
            if (existingPlate) {
                throw new RpcException("Vehicle plate already registered")
            }
        }

        if (dto.type !== undefined) vehicle.type = dto.type
        if (dto.brand !== undefined) vehicle.brand = dto.brand
        if (dto.model !== undefined) vehicle.model = dto.model
        if (dto.plate !== undefined) vehicle.plate = dto.plate
        if (dto.maxWeightKg !== undefined) vehicle.maxWeightKg = dto.maxWeightKg
        if (dto.acceptedPackageTypes !== undefined) vehicle.acceptedPackageTypes = dto.acceptedPackageTypes

        await this.vehicleRepo.save(vehicle)
                await this.publishVehicle(profile, 'upsert')

        return vehicle
    }

    async getVehicle(vehicleId: string): Promise<Vehicle> {
        const vehicle = await this.vehicleRepo.findOneBy({ vehicleId })
        if (!vehicle) {
            throw new RpcException("Vehicle not found")
        }
        return vehicle
    }

    async deleteVehicle(carrierProfileId: string): Promise<void> {
        const profile = await this.repo.findOneBy({userId: carrierProfileId})
        if (!profile){
            throw new RpcException('Carrier profile does not exist')
        }
        const vehicle = await this.vehicleRepo.findOneBy({carrierProfile: profile
        })
        if (!vehicle) {
            return;
        }
        await this.vehicleRepo.remove(vehicle)
        if(profile.canOperate){
            await this.publishVehicle(profile, 'delete')
        }
    }

    async getAllVehicles(): Promise<Vehicle[]> {
        return await this.vehicleRepo.find({ relations: ['carrierProfile'] })
    }

    // documents

    async uploadCarrierDocument(dto: CreateCarrierDocumentDto): Promise<boolean> {
        const profile = await this.getProfile(dto.carrierProfileId);
        let validationResult: any = null;

        if (dto.type === DocumentType.CEDULA) {
            const docPriority = ['1', '2'];
            for (const dt of docPriority) {
                try {
                    validationResult = await this.documentsValidation.validateDocument(dto.carrierProfileId, dt, [dto.file], dto.selfie);

                    // if its valid, we end the loop
                    if (validationResult.is_valid) {
                        break;
                    }
                    // if its not, we continue with the next doc type
                } catch (e) {
                    continue;
                }
            }
        } else {
            validationResult = await this.documentsValidation.validateDocument(dto.carrierProfileId, dto.type, [dto.file])
        }

        // if after all doc_type its still not valid, its rejected
        const isValid = validationResult?.is_valid;
        if (!isValid) {
            throw new RpcException("Document ID is not valid")
        }
        const docId = validationResult.docId;

        const document = await this.documentRepo.create({
            carrierProfile: profile,
            type: dto.type as DocumentType,
            docId: docId,
            status: DocumentStatus.VALID,
        })
        await this.documentRepo.save(document)

        await this.verifyOperationalStatus(profile)
        return isValid
    }

    // for the carrier identified with id, count how many documents has of each type
    // but only consider the ones which are approved. Returns type and count
    async verifyOperationalStatus(profile: CarrierProfile): Promise<void> {

        const profileId = profile.userId
        const wasOperational = profile.canOperate

        // im going to be using the documents repository to make this query
        const docCounts = await this.documentRepo
            // SELECT ... FROM carrier_documents doc
            .createQueryBuilder('doc')
            // SELECT doc.type AS type
            .select('doc.type', 'type')
            .addSelect('COUNT(*)', 'count')
            .where('doc.carrier_profile_id = :profileId', { profileId })
            .andWhere('doc.status = :status', { status: 'VALID' })
            .andWhere('doc.deletedAt IS NULL')
            .groupBy('doc.type')
            .getRawMany();

        const countMap = new Map<number, number>();
        for (const row of docCounts) {
            countMap.set(row.type, Number(row.count))
        }

        const group1 = [1, 2];
        const group2 = [3, 4, 5]

        const hasGroup1 = group1.some(type => (countMap.get(type) || 0) > 0)
        const hasAllGroup2 = group2.every(type => (countMap.get(type) || 0) > 0)

        profile.canOperate = hasGroup1 && hasAllGroup2;
        await this.repo.save(profile);

        if (!wasOperational && profile.canOperate) {
            const address = await this.addressService.getDefaultAddress(profile.userId)

            const payload: CarrierActivatedEventDto = {
                userId: profile.userId,
                serviceRadiusKm: profile.serviceRadiusKm || 5,
                baseLatitude: address.latitude,
                baseLongitude: address.longitude,
                isAcceptingRoutes: profile.isAcceptingRoutes,
                activatedAt: new Date().toISOString()

            }
            this.kafkaClient.emit('carrier.activated', payload)
            await this.publishVehicle(profile, 'upsert')
        } else if (wasOperational && !profile.canOperate) {
            this.kafkaClient.emit('carrier.deactivated', {
                userId: profile.userId,
                deactivatedAt: new Date().toISOString()
            })
            await this.publishVehicle(profile, 'upsert')
        }
    }

    // photos

    async uploadVehiclePhoto(dto: UploadVehiclePhotosDto): Promise<boolean> {
        const vehicle = await this.vehicleRepo.findOneBy({ vehicleId: dto.vehicleId });
        if (!vehicle) {
            throw new RpcException("Vehicle ID is not valid");
        }
        // Subir la fotos al servicio de fotos
        const photoIds: string[] = [];
        for (const file of dto.photos) {
            const { photoId } = await this.photosService.upload({ file });
            photoIds.push(photoId);
        }

        // Guardar los IDs en el vehículo
        vehicle.vehiclePhotos = photoIds;
        await this.vehicleRepo.save(vehicle);

        return true;
    }

    // kafka events

    async publishVehicle(profile: CarrierProfile, action: 'upsert' | 'delete'): Promise<void> {
        if (!profile.canOperate) {
            this.logger.log(`Carrier ${profile.userId} cannot operate yet, skipping vehicle event`)
            return;
        }
        const vehicle = await this.vehicleRepo.findOne({ where: { carrierProfile: profile } })
        if (!vehicle) {
            this.logger.log(`Carrier ${profile.userId} does not have a vehicle registered, skipping vehicle event`)
            return;
        }
        if (action === 'delete') {
            this.kafkaClient.emit('vehicle.deleted', {
                vehicleId: vehicle.vehicleId,
                carrierId: profile.userId,
                deletedAt: new Date().toISOString()
            })
        }
        if (action === 'upsert') {
            const payload: UpsertVehicleEventDto = {
                vehicleId: vehicle.vehicleId,
                carrierId: profile.userId,
                maxWeightKg: vehicle.maxWeightKg,
                acceptedPackageTypes: vehicle.acceptedPackageTypes,
                updatedAt: new Date().toISOString()
            }
            this.kafkaClient.emit('vehicle.activated', payload)
        }
    }
}