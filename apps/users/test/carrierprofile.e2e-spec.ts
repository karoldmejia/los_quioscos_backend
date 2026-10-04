import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.test') })

jest.mock('../src/services/redis.service', () => ({
    RedisService: jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK'),
        onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { User } from '../src/entities/user.entity';
import { CarrierProfile } from '../src/entities/carrier_profile.entity';
import { VehicleType } from '../src/enums/type_vehicle.enum';
import { DocumentType } from '../src/enums/document_type.enum';

jest.mock('../src/services/kioskprofile.service', () => ({
    KioskProfileService: jest.fn().mockImplementation(() => ({
        getProfileByUserId: jest.fn().mockResolvedValue(null),
    })),
}));

jest.mock('../src/services/documents-validation.service', () => ({
    DocumentsValidationService: jest.fn().mockImplementation(() => ({
        validateDocument: jest.fn().mockResolvedValue({
            is_valid: true,
            docId: 'test-doc-id-123',
        }),
    })),
}));

describe('CarrierProfile Microservice (TCP) - e2e', () => {
    let app: INestMicroservice;
    let client: ClientProxy;
    let dataSource: DataSource;

    const validProfile = {
        fullLegalName: 'Juan Perez',
        idNumber: '123456789',
    };

    const validVehicle = {
        type: VehicleType.CAR,
        brand: 'Toyota',
        model: 'Corolla',
        plate: 'ABC123',
        maxWeightKg: 500,
        maxVolumeM3: 2.5,
    };

    let validuserId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestMicroservice({
            transport: Transport.TCP,
            options: { host: '127.0.0.1', port: 3005 },
        });

        await app.listen();

        client = ClientProxyFactory.create({
            transport: Transport.TCP,
            options: { host: '127.0.0.1', port: 3005 },
        });
        await client.connect();

        dataSource = moduleFixture.get(DataSource);

    });

    beforeEach(async () => {
        const entities = dataSource.entityMetadatas;
        for (const entity of entities) {
            const repository = dataSource.getRepository(entity.name);
            await repository.query(
                `TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`,
            );
        }

        const userRepo = dataSource.getRepository(User);
        const savedUser = await userRepo.save({
            email: 'carrier@test.com',
            password: 'hashedpassword',
            username: 'carriertest',
            phone: '+573000000001',
        });

        validUserId = savedUser.user_id;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await client.close();
        await app.close();
    });

    // carrier

    it('create_carrier_profile - should create a carrier profile', async () => {
        const profile = await client
            .send({ cmd: 'create_carrier_profile' }, { userId: validUserId, ...validProfile })
            .toPromise();

        expect(profile.userId).toBe(validUserId);
        expect(profile.fullLegalName).toBe(validProfile.fullLegalName);
        expect(profile.idNumber).toBe(validProfile.idNumber);
    });

    it('create_carrier_profile - should throw if user does not exist', async () => {
        try {
            await client
                .send({ cmd: 'create_carrier_profile' }, { userId: 99999, ...validProfile })
                .toPromise();
            fail('Expected error');
        } catch (err: any) {
            expect(err.message).toContain('User with id 99999 not found');
        }
    });

    it('get_carrier_profile - should return profile for existing user', async () => {
        const repo = dataSource.getRepository(CarrierProfile);
        await repo.save({ userId: validUserId, ...validProfile });

        const profile = await client
            .send({ cmd: 'get_carrier_profile' }, validUserId)
            .toPromise();

        expect(profile.userId).toBe(validUserId);
        expect(profile.fullLegalName).toBe(validProfile.fullLegalName);
    });

    it('get_carrier_profile - should throw if profile not found', async () => {
        try {
            await client
                .send({ cmd: 'get_carrier_profile' }, 99999)
                .toPromise();
            fail('Expected error');
        } catch (err: any) {
            expect(err.message).toContain('Carrier profile not found');
        }
    });

    it('update_carrier_profile - should update profile', async () => {
        const repo = dataSource.getRepository(CarrierProfile);
        await repo.save({ userId: validUserId, ...validProfile });

        const updatedName = 'Updated Legal Name';
        const updated = await client
            .send({ cmd: 'update_carrier_profile' }, { userId: validUserId, fullLegalName: updatedName })
            .toPromise();

        expect(updated.fullLegalName).toBe(updatedName);
    });

    it('delete_carrier_profile - should soft delete profile and vehicle', async () => {
        const repo = dataSource.getRepository(CarrierProfile);
        await repo.save({ userId: validUserId, ...validProfile });

        await client
            .send({ cmd: 'create_vehicle' }, {
                carrierProfileId: validUserId,
                ...validVehicle
            })
            .toPromise();

        const result = await client
            .send({ cmd: 'delete_carrier_profile' }, validUserId)
            .toPromise();

        expect(result.success).toBe(true);

        const deleted = await repo.findOne({
            where: { userId: validUserId },
            withDeleted: true
        });

        expect(deleted?.deletedAt).toBeDefined();
    });

    // vehicle

    it('create_vehicle - should create a vehicle for carrier', async () => {
        const repo = dataSource.getRepository(CarrierProfile);
        await repo.save({ userId: validUserId, ...validProfile });

        const vehicle = await client
            .send({ cmd: 'create_vehicle' }, { carrierProfileId: validUserId, ...validVehicle })
            .toPromise();

        expect(vehicle.type).toBe(validVehicle.type);
        expect(vehicle.brand).toBe(validVehicle.brand);
        expect(vehicle.plate).toBe(validVehicle.plate);
    });

    it('create_vehicle - should throw if carrier profile not found', async () => {
        try {
            await client
                .send({ cmd: 'create_vehicle' }, { carrierProfileId: 99999, ...validVehicle })
                .toPromise();
            fail('Expected error');
        } catch (err: any) {
            expect(err.message).toContain('Carrier profile not found');
        }
    });

    it('get_vehicle - should return vehicle by id', async () => {
        const profileRepo = dataSource.getRepository(CarrierProfile);
        await profileRepo.save({ userId: validUserId, ...validProfile });

        const created = await client
            .send({ cmd: 'create_vehicle' }, { carrierProfileId: validUserId, ...validVehicle })
            .toPromise();

        const vehicle = await client
            .send({ cmd: 'get_vehicle' }, created.vehicleId)
            .toPromise();

        expect(vehicle.vehicleId).toBe(created.vehicleId);
        expect(vehicle.plate).toBe(validVehicle.plate);
    });

    it('update_vehicle - should update vehicle', async () => {
        const profileRepo = dataSource.getRepository(CarrierProfile);
        await profileRepo.save({ userId: validUserId, ...validProfile });

        const created = await client
            .send({ cmd: 'create_vehicle' }, { carrierProfileId: validUserId, ...validVehicle })
            .toPromise();

        const newPlate = 'XYZ789';
        const updated = await client
            .send({ cmd: 'update_vehicle' }, { carrierProfileId: validUserId, plate: newPlate })
            .toPromise();

        expect(updated.plate).toBe(newPlate);
    });

    // documents

    it('upload_carrier_document - should upload document and verify status', async () => {
        const repo = dataSource.getRepository(CarrierProfile);
        await repo.save({ userId: validUserId, ...validProfile });

        const fileBuffer = Buffer.from('fake document content');

        const result = await client
            .send({ cmd: 'upload_carrier_document' }, {
                carrierProfileId: validUserId,
                type: DocumentType.CEDULA,
                file: fileBuffer,
            })
            .toPromise();

        expect(result.success).toBe(true);
    });

    it('verify_carrier_operational_status - should return canOperate status', async () => {
        const repo = dataSource.getRepository(CarrierProfile);
        await repo.save({ userId: validUserId, ...validProfile, canOperate: false });

        const result = await client
            .send({ cmd: 'verify_carrier_operational_status' }, validUserId)
            .toPromise();

        expect(result).toHaveProperty('canOperate');
        expect(typeof result.canOperate).toBe('boolean');
    });

    // vehicle photos

    it('upload_vehicle_photos - should upload photos for vehicle', async () => {
        const profileRepo = dataSource.getRepository(CarrierProfile);
        await profileRepo.save({ userId: validUserId, ...validProfile });

        const created = await client
            .send({ cmd: 'create_vehicle' }, { carrierProfileId: validUserId, ...validVehicle })
            .toPromise();

        const fileBuffer = Buffer.from('fake image content');
        const result = await client
            .send({ cmd: 'upload_vehicle_photos' }, {
                vehicleId: created.vehicleId,
                photos: [fileBuffer, fileBuffer],
            })
            .toPromise();

        expect(result.success).toBe(true);

        const vehicleRepo = dataSource.getRepository('vehicles');
        const updated = await vehicleRepo.findOneBy({ vehicleId: created.vehicleId });
        expect(updated?.vehiclePhotos).toBeDefined();
        expect(updated?.vehiclePhotos.length).toBeGreaterThan(0);
    });

    it('upload_vehicle_photos - should throw if vehicle not found', async () => {
        const fileBuffer = Buffer.from('fake image content');

        try {
            await client
                .send({ cmd: 'upload_vehicle_photos' }, {
                    vehicleId: '12345678-1234-1234-1234-123456789012',
                    photos: [fileBuffer],
                })
                .toPromise();
            fail('Expected error');
        } catch (err: any) {
            expect(err.message).toContain('Vehicle ID is not valid');
        }
    });
});