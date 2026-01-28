import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../src/entities/user.entity';


dotenv.config({ path: '.env' });

describe('KioskProfile Microservice (TCP) - e2e', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let dataSource: DataSource;

  const validProfile = {
    fullLegalName: 'Juan Perez',
    idNumber: '123456789',
    kioskName: 'Kiosko 1',
    kioskDescr: 'Descripcion',
  };

  let validUserId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3002 },
    });

    await app.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3002 },
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
    email: 'test@mail.com',
    password: 'hashedpassword',
    username: 'testuser',
    phone: '+573000000000',
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

  it('update_kiosk_profile - should throw if profile does not exist', async () => {
    const nonexistentUserId = 999999;

    try {
      await client
        .send({ cmd: 'update_kiosk_profile' }, { userId: nonexistentUserId, dto: validProfile })
        .toPromise();
      fail('Expected error');
    } catch (err: any) {
      expect(err.message).toContain("Kiosk's profile not found");
    }
  });

  it('create and update kiosk profile', async () => {
    const repo = dataSource.getRepository('kiosk_profiles');
    await repo.save({ ...validProfile, userId: validUserId, documentsStatus: { ID: 'PENDING' } });

    const updatedName = 'Kiosko updated';

    const updated = await client
      .send({ cmd: 'update_kiosk_profile' }, { userId: validUserId, dto: { kioskName: updatedName } })
      .toPromise();

    expect(updated.kioskName).toBe(updatedName);
  });

  it('get_kiosk_profile_by_user - should return profile', async () => {
    const repo = dataSource.getRepository('kiosk_profiles');
    await repo.save({ ...validProfile, userId: validUserId, documentsStatus: { ID: 'PENDING' } });

    const profile = await client
      .send({ cmd: 'get_kiosk_profile_by_user' }, validUserId)
      .toPromise();

    expect(profile.userId).toBe(validUserId);
    expect(profile.fullLegalName).toBe(validProfile.fullLegalName);
  });

  it('get_all_kiosk_profiles - should return array of profiles', async () => {
    const repo = dataSource.getRepository('kiosk_profiles');
    await repo.save({ ...validProfile, userId: validUserId, documentsStatus: { ID: 'PENDING' } });

    const profiles = await client
      .send({ cmd: 'get_all_kiosk_profiles' }, {})
      .toPromise();

    expect(Array.isArray(profiles)).toBe(true);
    expect(profiles.length).toBeGreaterThan(0);
  });

  it('upload_kiosk_id_document - should update document status', async () => {
    const repo = dataSource.getRepository('kiosk_profiles');
    await repo.save({ 
      ...validProfile, 
      userId: validUserId, 
      documentsStatus: { ID: 'PENDING' }, 
      declarationSignedAt: null, 
      canOperate: false 
    });

    jest.spyOn(client, 'send').mockImplementation((pattern: any, payload: any) => {
      if (pattern.cmd === 'upload_kiosk_id_document') {
        return of({ 
          profile: { 
            ...validProfile, 
            userId: validUserId,
            documentsStatus: { ID: 'VALID' },
            canOperate: false
          }, 
          validation: { is_valid: true } 
        });
      }
      return of({});
    });

    const fileBuffer = Buffer.from('fakefile');

    const result: any = await client
      .send({ cmd: 'upload_kiosk_id_document' }, { 
        userId: validUserId, 
        file: fileBuffer 
      })
      .toPromise();

    expect(result.profile.documentsStatus.ID).toBe('VALID');
  });

  it('sign_kiosk_declaration - should set declarationSignedAt and canOperate', async () => {
    const repo = dataSource.getRepository('kiosk_profiles');
    await repo.save({ 
      ...validProfile, 
      userId: validUserId, 
      documentsStatus: { ID: 'VALID' }, 
      declarationSignedAt: null, 
      canOperate: false 
    });

    const signed = await client
      .send({ cmd: 'sign_kiosk_declaration' }, validUserId)
      .toPromise();

    expect(signed.declarationSignedAt).toBeDefined();
    expect(signed.canOperate).toBe(true);
  });
});
