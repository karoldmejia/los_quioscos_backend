import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { PhoneVerificationService } from '../src/services/phoneverification.service';

dotenv.config({ path: '.env' });

describe('Users Microservice (TCP) - e2e', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let dataSource: DataSource;

  const validUser = {
    email: 'test@mail.com',
    password: 'Password1!',
    phone: '+573000000000',
    otp: '123456',
    username: 'testuser'
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PhoneVerificationService)
      .useValue({
        sendOtp: jest.fn(),
        verifyOtp: jest.fn().mockResolvedValue(true),
      })
      .compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3001 },
    });
    await app.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3001 },
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
  });

  it('register_user - should create a new user', async () => {
    const user = await client
      .send({ cmd: 'register_user' }, validUser)
      .toPromise();

    expect(user).toHaveProperty('user_id');
    expect(user).toHaveProperty('email', validUser.email);
    expect(user).toHaveProperty('username', validUser.username);
    expect(user).not.toHaveProperty('password');
  });

  it('register_user - should fail if email already exists', async () => {
    await client.send({ cmd: 'register_user' }, validUser).toPromise();

    try {
      await client.send({ cmd: 'register_user' }, validUser).toPromise();
      fail('Expected register_user to throw an error');
    } catch (err: any) {
    }
  });


  it('register_user - should fail if required field is missing', async () => {
    const invalidUser = { ...validUser } as any;
    delete invalidUser.password;

    try {
      await client.send({ cmd: 'register_user' }, invalidUser).toPromise();
      fail('Expected register_user to throw an error');
    } catch (err: any) {
      expect(err.message).toContain('password is required');
    }
  });

  it('request_otp - should send otp successfully', async () => {
  const response = await client
    .send({ cmd: 'request_otp' }, '+573001234567')
    .toPromise();

  expect(response).toEqual({ message: 'OTP sent' });
});

it('reset_password - should reset password successfully', async () => {
  const user = await client
    .send({ cmd: 'register_user' }, validUser)
    .toPromise();

  const response = await client
    .send(
      { cmd: 'reset_password' },
      {
        userId: user.user_id,
        newPassword: 'NewPassword1!',
        duplicatedNewPassword: 'NewPassword1!',
        otp: '123456',
      }
    )
    .toPromise();

  expect(response).toEqual({
    message: 'Password has been reset',
  });
});

it('reset_password - should fail if user does not exist', async () => {
  try {
    await client
      .send(
        { cmd: 'reset_password' },
        {
          userId: 999,
          newPassword: 'NewPassword1!',
          duplicatedNewPassword: 'NewPassword1!',
          otp: '123456',
        }
      )
      .toPromise();

    fail('Expected reset_password to throw');
  } catch (err: any) {
    expect(err.message).toContain('User not found');
  }
});


it('reset_password - should fail if otp is invalid', async () => {
  const phoneService = app.get(PhoneVerificationService);
  const user = await client
    .send({ cmd: 'register_user' }, validUser)
    .toPromise();

    (phoneService.verifyOtp as jest.Mock).mockResolvedValueOnce(false);

  try {
    await client
      .send(
        { cmd: 'reset_password' },
        {
          userId: user.user_id,
          newPassword: 'NewPassword1!',
          duplicatedNewPassword: 'NewPassword1!',
          otp: '000000',
        }
      )
      .toPromise();

    fail('Expected reset_password to throw');
  } catch (err: any) {
    expect(err.message).toContain('Restauration code does not match');
  }
});

it('reset_password - should fail if password is weak', async () => {
  const user = await client
    .send({ cmd: 'register_user' }, validUser)
    .toPromise();

  try {
    await client
      .send(
        { cmd: 'reset_password' },
        {
          userId: user.user_id,
          newPassword: 'weak',
          duplicatedNewPassword: 'weak',
          otp: '123456',
        }
      )
      .toPromise();

    fail('Expected reset_password to throw');
  } catch (err: any) {
    expect(err.message).toContain(
      'Password does not meet security requirements'
    );
  }
});

it('reset_password - should fail if passwords do not match', async () => {
  const user = await client
    .send({ cmd: 'register_user' }, validUser)
    .toPromise();

  try {
    await client
      .send(
        { cmd: 'reset_password' },
        {
          userId: user.user_id,
          newPassword: 'NewPassword1!',
          duplicatedNewPassword: 'OtherPassword1!',
          otp: '123456',
        }
      )
      .toPromise();

    fail('Expected reset_password to throw');
  } catch (err: any) {
    expect(err.message).toContain('Passwords do not match');
  }
});


});
