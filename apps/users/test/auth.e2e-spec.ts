import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { UsersService } from '../src/services/users.service';
import { PasswordService } from '../src/services/password.service';

dotenv.config({ path: '.env' });

describe('Auth Microservice (TCP) - e2e', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let dataSource: DataSource;

  const mockUsersService = {
    findUserByUsername: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByPhone: jest.fn(),
    createOAuthUser: jest.fn(),
    getRecoveryDate: jest.fn(() => new Date()),
  };

  const mockPasswordService = {
    comparePassword: jest.fn(),
  };

  const validUser = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    phone: '3001234567',
    password: 'hashedpassword',
  };

  const oauthUser = {
    id: 2,
    email: 'googleuser@example.com',
    username: 'googleuser',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UsersService)
      .useValue(mockUsersService)
      .overrideProvider(PasswordService)
      .useValue(mockPasswordService)
      .compile();

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

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  afterEach(async () => {
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(
        `TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`,
      );
    }
    jest.clearAllMocks();
  });

  it('auth.login - should login successfully', async () => {
    mockUsersService.findUserByEmail.mockResolvedValue({
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com',
      deletedAt: null,
      password: 'hashed',
    });

    mockPasswordService.comparePassword.mockResolvedValue(true);

    const response = await client
      .send({ cmd: 'auth.login' }, {
        email: 'test@example.com',
        password: 'Password1!',
      })
      .toPromise();

    expect(response).toHaveProperty('access_token');
  });


  it('auth.login - should fail with wrong password', async () => {
    mockUsersService.findUserByUsername.mockResolvedValue(validUser);
    mockPasswordService.comparePassword.mockResolvedValue(false);

    const loginDto = { username: 'testuser', password: 'wrongpassword' };

    try {
      await client.send({ cmd: 'auth.login' }, loginDto).toPromise();
      fail('Expected login to throw an error');
    } catch (err: any) {
      expect(err.message).toContain('Invalid credentials');
    }
  });

  it('auth.login - should fail if user does not exist', async () => {
    mockUsersService.findUserByUsername.mockResolvedValue(null);

    const loginDto = { username: 'nonexistent', password: '12345678' };

    try {
      await client.send({ cmd: 'auth.login' }, loginDto).toPromise();
      fail('Expected login to throw an error');
    } catch (err: any) {
      expect(err.message).toContain('Invalid credentials');
    }
  });

  it('auth.oauth - should login/create user via OAuth', async () => {
    mockUsersService.createOAuthUser.mockResolvedValue(oauthUser);

    const response = await client.send({ cmd: 'auth.oauth' }, { email: 'googleuser@example.com', name: 'Google User' }).toPromise();

    expect(response).toHaveProperty('access_token');
  });
});
