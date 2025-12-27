import { Test } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { UserRepository } from '../../repositories/impl/users.repository';
import { PasswordService } from '../password.service';
import { PhoneVerificationService } from '../phoneverification.service';
import { UserDto } from '../../dtos/users.dto';
import { RpcException } from '@nestjs/microservices';
import { User } from '../../entities/user.entity';
import { RolesService } from '../roles.service';

describe('UsersService', () => {
  let service: UsersService;

  const userRepoMock = {
    findByUser_Id: jest.fn(),
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    save: jest.fn(),
    findUserByIdIncludingDeleted: jest.fn(),
  };

  const passwordServiceMock = {
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
  };

  const phoneVerificationMock = {
    verifyOtp: jest.fn(),
  };

  const roleServiceMock = {
  getRole: jest.fn(),
};

  const validDto: UserDto = {
    email: 'test@mail.com',
    password: 'Password1!',
    phone: '+573000000000',
    otp: '123456',
    username: 'test',
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: userRepoMock },
        { provide: PasswordService, useValue: passwordServiceMock },
        { provide: PhoneVerificationService, useValue: phoneVerificationMock },
        { provide: RolesService, useValue: roleServiceMock },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
    jest.clearAllMocks();
  });


  // createUser

  it('should throw if required data is missing', async () => {
    const dto = { ...validDto, phone: undefined };

    await expect(service.createUser(dto as any)).rejects.toThrow(RpcException);
  });

  it('should throw if email already exists', async () => {
    userRepoMock.findByEmail.mockResolvedValue({ user_id: 1 });

    await expect(service.createUser(validDto)).rejects.toThrow(
      'Email already in use',
    );
  });

  it('should throw if phone already exists', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.findByPhone.mockResolvedValue({ user_id: 1 });

    await expect(service.createUser(validDto)).rejects.toThrow(
      'Phone already in use',
    );
  });

  it('should throw if otp is invalid', async () => {
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
    userRepoMock.save.mockResolvedValue({ user_id: 1 });

    const result = await service.createUser(validDto);

    expect(passwordServiceMock.hashPassword).toHaveBeenCalledWith('Password1!');
    expect(userRepoMock.save).toHaveBeenCalled();
    expect(result).toEqual({ user_id: 1 });
  });

  // createOAuthUser

  describe('createOAuthUser', () => {
    it('should return existing user if email already exists', async () => {
      const existingUser = { user_id: 1, email: 'oauth@mail.com' };
      service.findUserByEmail = jest.fn().mockResolvedValue(existingUser);

      const result = await service.createOAuthUser({
        email: 'oauth@mail.com',
        username: 'oauth',
      });

      expect(service.findUserByEmail).toHaveBeenCalledWith('oauth@mail.com');
      expect(userRepoMock.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingUser);
    });

    it('should create a new user if email does not exist', async () => {
      service.findUserByEmail = jest.fn().mockResolvedValue(null);
      userRepoMock.save.mockResolvedValue({
        user_id: 2,
        email: 'new@mail.com',
        username: 'newuser',
      });

      const result = await service.createOAuthUser({
        email: 'new@mail.com',
        username: 'newuser',
      });

      expect(userRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual({
        user_id: 2,
        email: 'new@mail.com',
        username: 'newuser',
      });
    });
  });

  // add role to user

  describe('addRoleToUser', () => {
    it('should throw if user does not exist', async () => {
      service.findUserById = jest.fn().mockResolvedValue(null);

      await expect(service.addRoleToUser(1, 1)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw if user is deleted', async () => {
      service.findUserById = jest.fn().mockResolvedValue({
        user_id: 1,
        deletedAt: new Date(),
      });

      await expect(service.addRoleToUser(1, 1)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw if role does not exist', async () => {
      service.findUserById = jest.fn().mockResolvedValue({
        user_id: 1,
        deletedAt: null,
      });
      roleServiceMock.getRole.mockResolvedValue(null);

      await expect(service.addRoleToUser(1, 99)).rejects.toThrow(
        'Role not found',
      );
    });

    it('should assign role successfully', async () => {
      const user = { user_id: 1, deletedAt: null, role: null };
      const role = { id: 2, name: 'Admin' };

      service.findUserById = jest.fn().mockResolvedValue(user);
      roleServiceMock.getRole.mockResolvedValue(role);
      userRepoMock.save.mockResolvedValue(user);

      const result = await service.addRoleToUser(1, 2);

      expect(user.role).toBe(role);
      expect(userRepoMock.save).toHaveBeenCalledWith(user);
      expect(result).toBe(true);
    });
  });

  // delete user role

  describe('deleteUserRole', () => {
    it('should throw if user does not exist', async () => {
      service.findUserById = jest.fn().mockResolvedValue(null);

      await expect(service.deleteUserRole(1)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw if user is deleted', async () => {
      service.findUserById = jest.fn().mockResolvedValue({
        user_id: 1,
        deletedAt: new Date(),
      });

      await expect(service.deleteUserRole(1)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw if user has no role', async () => {
      service.findUserById = jest.fn().mockResolvedValue({
        user_id: 1,
        deletedAt: null,
        role: null,
      });

      await expect(service.deleteUserRole(1)).rejects.toThrow(
        'Users role not found',
      );
    });

    it('should remove role successfully', async () => {
      const user = { user_id: 1, deletedAt: null, role: { id: 2 } };

      service.findUserById = jest.fn().mockResolvedValue(user);
      userRepoMock.save.mockResolvedValue(user);

      const result = await service.deleteUserRole(1);

      expect(user.role).toBeNull();
      expect(userRepoMock.save).toHaveBeenCalledWith(user);
      expect(result).toBe(true);
    });
  });

  // resetPassword

  describe('resetPassword', () => {
    const userId = 1;
    const validPassword = 'Password1!';

    it('should throw if user does not exist', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue(null);

      await expect(
        service.resetPassword(userId, validPassword, validPassword, '123456'),
      ).rejects.toThrow('User not found');
    });

    it('should throw if user has no phone registered', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue({
        user_id: 1,
        phone: null,
        deletedAt: null,
      });

      await expect(
        service.resetPassword(userId, validPassword, validPassword, '123456'),
      ).rejects.toThrow('You do not have a phone registered');
    });

    it('should throw if otp is invalid', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue({
        user_id: 1,
        phone: '+573001234567',
        deletedAt: null,
      });
      phoneVerificationMock.verifyOtp.mockResolvedValue(false);

      await expect(
        service.resetPassword(userId, validPassword, validPassword, '123456'),
      ).rejects.toThrow('Restauration code does not match');
    });

    it('should reset password successfully', async () => {
      userRepoMock.findByUser_Id.mockResolvedValue({
        user_id: 1,
        phone: '+573001234567',
        password: 'old-hash',
        deletedAt: null,
      });
      phoneVerificationMock.verifyOtp.mockResolvedValue(true);
      passwordServiceMock.hashPassword.mockResolvedValue('new-hash');

      const result = await service.resetPassword(
        userId,
        validPassword,
        validPassword,
        '123456',
      );

      expect(passwordServiceMock.hashPassword).toHaveBeenCalledWith(validPassword);
      expect(userRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Password has been reset' });
    });
  });


  // updateUserContactInfo

  describe('updateUserContactInfo', () => {
    it('should throw if user does not exist', async () => {
      service.findUserById = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateUserContactInfo(1, { email: 'a@mail.com' }, 'pass'),
      ).rejects.toThrow('User not found');
    });

    it('should throw if password is invalid', async () => {
      service.findUserById = jest.fn().mockResolvedValue({
        password: 'hash',
        deletedAt: null,
      });
      passwordServiceMock.comparePassword.mockResolvedValue(false);

      await expect(
        service.updateUserContactInfo(1, { email: 'a@mail.com' }, 'wrong'),
      ).rejects.toThrow('Invalid password');
    });

    it('should update contact info successfully', async () => {
      const user = { user_id: 1, password: 'hash', deletedAt: null,};
      service.findUserById = jest.fn().mockResolvedValue(user);
      passwordServiceMock.comparePassword.mockResolvedValue(true);
      service.findUserByEmail = jest.fn().mockResolvedValue(null);

      const result = await service.updateUserContactInfo(
        1,
        { email: 'new@mail.com' },
        'pass',
      );

      expect(userRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Info has been updated' });
    });
  });

  // updateUserUsername

  describe('updateUserUsername', () => {
    it('should throw if user does not exist', async () => {
      service.findUserById = jest.fn().mockResolvedValue(null);

      await expect(
        service.updateUserUsername(1, 'newname'),
      ).rejects.toThrow('User not found');
    });

    it('should update username successfully', async () => {
      service.findUserById = jest.fn().mockResolvedValue({ user_id: 1, username: 'oldname', deletedAt: null,});
      userRepoMock.save.mockResolvedValue(true);

      const result = await service.updateUserUsername(1, 'newname');

      expect(userRepoMock.save).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Username has been updated' });
    });
  });

  // deleteUser

  describe('deleteUser', () => {
    it('should throw if user does not exist', async () => {
      service.findUserById = jest.fn().mockResolvedValue(null);

      await expect(service.deleteUser(1)).rejects.toThrow('User not found');
    });

    it('should soft delete user and return recovery date', async () => {
      const now = new Date('2025-11-23T03:10:51.757Z');
      jest.useFakeTimers().setSystemTime(now);

      const user = {
        user_id: 1,
        deletedAt: null,
      };

      service.findUserById = jest.fn().mockResolvedValue(user);
      userRepoMock.save.mockResolvedValue(user);

      const result = await service.deleteUser(1);

      expect(user.deletedAt).toEqual(now);
      expect(userRepoMock.save).toHaveBeenCalledWith(user);

      const expectedRecoverUntil = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
      );

      expect(result.recoverUntil.getTime()).toBe(
        expectedRecoverUntil.getTime(),
      );

      jest.useRealTimers();
    });
  });


  // recoverAccount

  describe('recoverAccount', () => {
    it('should throw if user does not exist', async () => {
      userRepoMock.findUserByIdIncludingDeleted
        .mockResolvedValue(null);

      await expect(service.recoverAccount(1))
        .rejects
        .toThrow('User not found');
    });

    it('should do nothing if user is already active', async () => {
      const activeUser = { user_id: 1, deletedAt: null };

      userRepoMock.findUserByIdIncludingDeleted
        .mockResolvedValue(activeUser);

      await service.recoverAccount(1);

      expect(userRepoMock.save).not.toHaveBeenCalled();
    });

    it('should restore deleted user', async () => {
      const deletedUser = { user_id: 1, deletedAt: new Date() };

      userRepoMock.findUserByIdIncludingDeleted
        .mockResolvedValue(deletedUser);

      await service.recoverAccount(1);

      expect(deletedUser.deletedAt).toBeNull();
      expect(userRepoMock.save).toHaveBeenCalledWith(deletedUser);
    });

  });

  // helper methods

  describe('helper methods', () => {
    it('isUserActive should return true if deletedAt is null', () => {
      const user = { deletedAt: null } as User;
      expect(service.isUserActive(user)).toBe(true);
    });

    it('isUserActive should return false if deletedAt is not null', () => {
      const user = { deletedAt: new Date() } as User;
      expect(service.isUserActive(user)).toBe(false);
    });

    it('getRecoveryDate should return date 30 days later', () => {
      const deletedAt = new Date('2025-01-01');
      const recoveryDate = service.getRecoveryDate(deletedAt);

      const expected = new Date('2025-01-31');
      expect(recoveryDate.getTime()).toBe(expected.getTime());
    });
  });

});
