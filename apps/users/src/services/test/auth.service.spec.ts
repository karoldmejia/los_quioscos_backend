import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { UsersService } from '../users.service';
import { PasswordService } from '../password.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../entities/user.entity';
import { AuthDto } from '../../dtos/auth.dto';
import { RpcException } from '@nestjs/microservices';

describe('AuthService', () => {
  let service: AuthService;

  let usersService: Record<string, jest.Mock>;
  let passwordService: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;

  beforeEach(async () => {
    usersService = {
      findUserByEmail: jest.fn(),
      findUserByPhone: jest.fn(),
      recoverAccount: jest.fn(),
      getRecoveryDate: jest.fn(),
      createOAuthUser: jest.fn(),
    };

    passwordService = {
      comparePassword: jest.fn(),
    };

    jwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: PasswordService, useValue: passwordService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // validateUser

  describe('validateUser', () => {
    const mockUser: User = {
      user_id: 1,
      email: 'test@example.com',
      username: 'testuser',
      phone: '1234567890',
      password: 'hashedpassword',
      deletedAt: null,
    } as User;

    it('should return user without password if credentials are valid', async () => {
      usersService.findUserByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(true);

      const dto: AuthDto = {
        email: 'test@example.com',
        password: '1234',
      };

      const result = await service.validateUser(dto);

      expect(result).toEqual({
        user_id: mockUser.user_id,
        email: mockUser.email,
        username: mockUser.username,
        phone: mockUser.phone,
        deletedAt: null,
      });
    });

    it('should return null if user is not found', async () => {
      usersService.findUserByEmail.mockResolvedValue(null);

      const dto: AuthDto = { email: 'noone@mail.com', password: '1234' };
      const result = await service.validateUser(dto);

      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      usersService.findUserByEmail.mockResolvedValue(mockUser);
      passwordService.comparePassword.mockResolvedValue(false);

      const dto: AuthDto = { email: 'test@example.com', password: 'wrong' };
      const result = await service.validateUser(dto);

      expect(result).toBeNull();
    });
  });

  // login

  describe('login', () => {
    it('should login active user and return JWT', async () => {
      const user = {
        user_id: 1,
        email: 'test@mail.com',
        username: 'test',
        phone: '123',
        deletedAt: null,
      } as Omit<User, 'password'>;

      jwtService.sign.mockReturnValue('jwt.token');

      const result = await service.login(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.user_id,
        email: user.email,
        phone: user.phone,
        username: user.username,
      });
      expect(result).toEqual({ access_token: 'jwt.token' });
    });

    it('should recover account automatically if within recovery period', async () => {
      const deletedAt = new Date();
      const recoverUntil = new Date(Date.now() + 1000 * 60 * 60);

      const user = {
        user_id: 1,
        email: 'test@mail.com',
        username: 'test',
        phone: '123',
        deletedAt,
      } as Omit<User, 'password'>;

      usersService.getRecoveryDate.mockReturnValue(recoverUntil);
      jwtService.sign.mockReturnValue('jwt.token');

      const result = await service.login(user);

      expect(usersService.recoverAccount).toHaveBeenCalledWith(user.user_id);
      expect(result).toEqual({ access_token: 'jwt.token' });
    });

    it('should throw Invalid credentials if recovery period expired', async () => {
      const deletedAt = new Date();
      const recoverUntil = new Date(Date.now() - 1000);

      const user = {
        user_id: 1,
        email: 'test@mail.com',
        username: 'test',
        phone: '123',
        deletedAt,
      } as Omit<User, 'password'>;

      usersService.getRecoveryDate.mockReturnValue(recoverUntil);

      await expect(service.login(user)).rejects.toThrow(RpcException);
    });
  });

  // validateOAuthUser

  describe('validateOAuthUser', () => {
    it('should create oauth user and login', async () => {
      const googleUser = { email: 'oauth@mail.com' };

      const mockUser = {
        user_id: 2,
        email: 'oauth@mail.com',
        username: 'oauth',
        phone: null,
        deletedAt: null,
      } as Omit<User, 'password'>;

      usersService.createOAuthUser.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('oauth.jwt');

      const result = await service.validateOAuthUser(googleUser);

      expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: googleUser.email,
        username: 'oauth',
      });
      expect(result).toEqual({ access_token: 'oauth.jwt' });
    });
  });

  // validatePassword

  describe('validatePassword', () => {
    it('should delegate to PasswordService.comparePassword', async () => {
      passwordService.comparePassword.mockResolvedValue(true);

      const result = await service.validatePassword('hashed', 'plain');

      expect(passwordService.comparePassword).toHaveBeenCalledWith(
        'plain',
        'hashed',
      );
      expect(result).toBe(true);
    });
  });
});
