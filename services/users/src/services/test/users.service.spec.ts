import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from '../users.service';
import { UserRepository } from 'src/repositories/impl/users.repository';
import { PasswordService } from '../password.service';
import { PhoneVerificationService } from '../phoneverification.service';
import { UserDto } from 'src/dtos/users.dto';

describe('UsersService', () => {
  let service: UsersService;

  const userRepoMock = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
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
    password: '123456',
    phone: '+573000000000',
    otp: '123456',
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
      BadRequestException,
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

    expect(passwordServiceMock.hashPassword).toHaveBeenCalledWith('123456');
    expect(userRepoMock.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 1 });
  });
});
