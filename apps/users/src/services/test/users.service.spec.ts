import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { UserRepository } from '../../repositories/impl/users.repository';
import { PasswordService } from '../password.service';
import { PhoneVerificationService } from '../phoneverification.service';
import { UserDto } from '../../dtos/users.dto';
import { RpcException } from '@nestjs/microservices';

describe('UsersService', () => {
  let service: UsersService;

  const userRepoMock = {
    findByUser_Id: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    findByUsername: jest.fn(), 
    save: jest.fn(),
  };

  const passwordServiceMock = {
    hashPassword: jest.fn(),
  };

  const phoneVerificationMock = {
    verifyOtp: jest.fn(),
  };

  const validDto: UserDto = {
    email: 'test@mail.com',
    password: 'Password1!',
    phone: '+573000000000',
    otp: '123456',
    username: 'test'
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: userRepoMock },
        { provide: PasswordService, useValue: passwordServiceMock },
        { provide: PhoneVerificationService, useValue: phoneVerificationMock },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    jest.clearAllMocks();
  });

  it('should throw and error if required data is missing', async () => {
    const dto = { ...validDto, phone: undefined };

    await expect(service.createUser(dto as any)).rejects.toThrow(
      RpcException,
    );
  });

  it('should throw an error if email already exists', async () => {
    userRepoMock.findByEmail.mockResolvedValue({ id: 1 });

    await expect(service.createUser(validDto)).rejects.toThrow(
      'Email already in use',
    );
  });

  it('should throw an error if phone already exists', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.findByPhone.mockResolvedValue({ id: 1 });

    await expect(service.createUser(validDto)).rejects.toThrow(
      'Phone already in use',
    );
  });

  it('should throw an error is otp is not valid', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.findByPhone.mockResolvedValue(null);
    phoneVerificationMock.verifyOtp.mockResolvedValue(false);

    await expect(service.createUser(validDto)).rejects.toThrow(
      'Phone not verified',
    );
  });

  it('should create user correctly', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.findByPhone.mockResolvedValue(null);
    phoneVerificationMock.verifyOtp.mockResolvedValue(true);
    passwordServiceMock.hashPassword.mockResolvedValue('hashed-password');
    userRepoMock.save.mockResolvedValue({ id: 1 });

    const result = await service.createUser(validDto);

    expect(passwordServiceMock.hashPassword).toHaveBeenCalledWith('Password1!');
    expect(userRepoMock.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 1 });
  });

  describe('createOAuthUser', () => {
  it('should return existing user if email already exists', async () => {
    const existingUser = { id: 1, email: 'oauth@mail.com', username: 'oauth' };
    service.findUserByEmail = jest.fn().mockResolvedValue(existingUser);
    userRepoMock.save.mockResolvedValue({ id: 2 });

    const result = await service.createOAuthUser({ email: 'oauth@mail.com', username: 'oauth' });

    expect(service.findUserByEmail).toHaveBeenCalledWith('oauth@mail.com');
    expect(userRepoMock.save).not.toHaveBeenCalled();
    expect(result).toEqual(existingUser);
  });

  it('should create a new user if email does not exist', async () => {
    service.findUserByEmail = jest.fn().mockResolvedValue(null);
    userRepoMock.save.mockResolvedValue({ id: 2, email: 'new@mail.com', username: 'newuser' });

    const result = await service.createOAuthUser({ email: 'new@mail.com', username: 'newuser' });

    expect(service.findUserByEmail).toHaveBeenCalledWith('new@mail.com');
    expect(userRepoMock.save).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@mail.com',
      username: 'newuser',
    }));
    expect(result).toEqual({ id: 2, email: 'new@mail.com', username: 'newuser' });
  });
});

  describe('resetPassword', () => {

    const userId = 1;
    const baseUser = {
      id: 1,
      phone: '+573001234567',
    } as any;
    const validPassword = 'Password1!';

    it('should throw if user has no phone registered', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue({
        id: 1,
        phone: null,
      });

      await expect(
        service.resetPassword(userId, validPassword, validPassword, '123456')
      ).rejects.toThrow(
        'You do not have a phone registered'
      );
    });

    it('should throw if otp is invalid', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue(baseUser);
      phoneVerificationMock.verifyOtp.mockResolvedValue(false);

      await expect(
        service.resetPassword(userId, validPassword, validPassword, '123456')
      ).rejects.toThrow(
        'Restauration code does not match'
      );
    });

    it('should throw if new password is invalid', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue(baseUser);
      phoneVerificationMock.verifyOtp.mockResolvedValue(true);

      await expect(
        service.resetPassword(userId, 'weak', 'weak', '123456')
      ).rejects.toThrow(
        'Password does not meet security requirements'
      );
    });

    it('should throw if password confirmation is invalid', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue(baseUser);
      phoneVerificationMock.verifyOtp.mockResolvedValue(true);

      await expect(
        service.resetPassword(userId, validPassword, 'weak', '123456')
      ).rejects.toThrow(
        'Password confirmation is invalid'
      );
    });

    it('should throw if passwords do not match', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue(baseUser);
      phoneVerificationMock.verifyOtp.mockResolvedValue(true);

      await expect(
        service.resetPassword(userId, validPassword, 'Password2!', '123456')
      ).rejects.toThrow(
        'Passwords do not match'
      );
    });

    it('should reset password successfully when all data is valid', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue(baseUser);
      phoneVerificationMock.verifyOtp.mockResolvedValue(true);

      await expect(
        service.resetPassword(userId, validPassword, validPassword, '123456')
      ).resolves.not.toThrow();
    });

  });



});
