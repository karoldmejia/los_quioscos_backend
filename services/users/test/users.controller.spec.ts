import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { PhoneVerificationService } from '../src/services/phoneverification.service';
dotenv.config({ path: '.env' });

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const validUser = {
    email: 'test@mail.com',
    password: '123456',
    phone: '+573000000000',
    otp: '123456',
    username: 'testuser'
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

    beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    })
        .overrideProvider(PhoneVerificationService)
        .useValue({
        sendOtp: jest.fn(),
        verifyOtp: jest.fn().mockResolvedValue(true), // siempre devuelve true
        })
        .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    });

  afterEach(async () => {
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`);
    }
  });

  it('/register (POST) - should create a new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/register')
      .send(validUser)
      .expect(201);

    expect(response.body).toHaveProperty('user_id');
    expect(response.body).toHaveProperty('email', validUser.email);
    expect(response.body).toHaveProperty('username', validUser.username);
    expect(response.body).not.toHaveProperty('password');
  });

  it('/register (POST) - should fail if email already exists', async () => {
    await request(app.getHttpServer()).post('/register').send(validUser);

    const response = await request(app.getHttpServer())
      .post('/register')
      .send(validUser)
      .expect(400);

    expect(response.body.message).toContain('Email already in use');
  });

  it('/register (POST) - should fail if required field is missing', async () => {
    const invalidUser = { ...validUser } as any;
    delete invalidUser.password;

    const response = await request(app.getHttpServer())
      .post('/register')
      .send(invalidUser)
      .expect(400);

    expect(response.body.message).toContain('password is required');
  });
});
