import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { AuthService } from '../src/services/auth.service';
import { UsersService } from '../src/services/users.service';
import { AuthGuard } from '@nestjs/passport';
import { PasswordService } from '../src/services/password.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const mockUsersService = {
    findUserByUsername: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByPhone: jest.fn(),
    createOAuthUser: jest.fn(),
  };

  const mockPasswordService = {
    comparePassword: jest.fn(),
  };

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(UsersService)
    .useValue(mockUsersService)
    .overrideProvider(PasswordService)
    .useValue(mockPasswordService)
    .overrideGuard(AuthGuard('google'))
    .useValue({
      canActivate: (context) => {
        const req = context.switchToHttp().getRequest();
        req.user = { email: 'googleuser@example.com', providerId: '123', name: 'Google User' };
        return true;
      },
    })
    .compile();

  app = moduleFixture.createNestApplication();
  await app.init();

  dataSource = app.get(DataSource);
});

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`);
    }
  });

  describe('/auth/login (POST)', () => {
    it('should login successfully with valid credentials', async () => {
      const validUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        phone: '3001234567',
        password: 'hashedpassword',
      };

      mockUsersService.findUserByUsername.mockResolvedValue(validUser);
      mockPasswordService.comparePassword.mockResolvedValue(true)
      const loginDto = { username: 'testuser', password: '12345678' };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
    });

    it('should fail login with wrong password', async () => {
      const validUser = {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        phone: '3001234567',
        password: 'hashedpassword',
      };

      mockUsersService.findUserByUsername.mockResolvedValue(validUser);
      mockPasswordService.comparePassword = jest.fn().mockResolvedValue(false);

      const loginDto = { username: 'testuser', password: 'wrongpassword' };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });

    it('should fail login if user does not exist', async () => {
      mockUsersService.findUserByUsername.mockResolvedValue(null);

      const loginDto = { username: 'nonexistent', password: '12345678' };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });
  });

    describe('/auth/google/callback (GET)', () => {
    it('should login/create user via OAuth', async () => {
        const oauthUser = {
        id: 2,
        email: 'googleuser@example.com',
        username: 'googleuser',
        };

        mockUsersService.createOAuthUser.mockResolvedValue(oauthUser);

        const response = await request(app.getHttpServer())
        .get('/auth/google/callback')
        .expect(200);

        expect(response.body).toHaveProperty('access_token');
    });
    });

});
