import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { UsersService } from '../users.service';
import { PasswordService } from '../password.service';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../entities/user.entity';
import { AuthDto } from '../../dtos/auth.dto';

describe('AuthService', () => {
  let service: AuthService;

  let usersService: Record<string, jest.Mock>;
  let passwordService: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;

  beforeEach(async () => {
    usersService = {
      findUserByEmail: jest.fn(),
      findUserByUsername: jest.fn(),
      findUserByPhone: jest.fn(),
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

    describe('validateUser', () => {
    const mockUser: User = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        phone: '1234567890',
        password: 'hashedpassword',
    } as unknown as User;

    it('should return user without password if valid', async () => {
        usersService.findUserByEmail.mockResolvedValue(mockUser);
        passwordService.comparePassword.mockResolvedValue(true);

        const dto: AuthDto = { email: 'test@example.com', password: '1234', username: undefined };
        const result = await service.validateUser(dto);

        expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        phone: mockUser.phone,
        });
    });

    it('should return null if user not found', async () => {
        usersService.findUserByEmail.mockResolvedValue(null);

        const dto: AuthDto = { email: 'noone@example.com', password: '1234', username: undefined };
        const result = await service.validateUser(dto);

        expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
        usersService.findUserByEmail.mockResolvedValue(mockUser);
        passwordService.comparePassword.mockResolvedValue(false);

        const dto: AuthDto = { email: 'test@example.com', password: 'wrong', username: undefined };
        const result = await service.validateUser(dto);

        expect(result).toBeNull();
    });
    });


    describe('login', () => {
    it('should return JWT access token', async () => {
        const mockUser: User = {
            id: 1,
            email: 'test@example.com',
            username: 'testuser',
            phone: '1234567890',
            password: 'hashedpassword',
        } as unknown as User;

        jwtService.sign.mockReturnValue('mocked.jwt.token');

        const result = await service.login(mockUser);
        expect(result).toEqual({ access_token: 'mocked.jwt.token' });
    });
    });

    describe('validatePassword', () => {
    it('should call PasswordService.comparePassword', async () => {
        passwordService.comparePassword.mockResolvedValue(true);

        const result = await service.validatePassword('hashed', 'plain');
        expect(result).toBe(true);
        expect(passwordService.comparePassword).toHaveBeenCalledWith('plain', 'hashed');
    });
    });

    describe('validateOAuthUser', () => {
    it('should create or return existing user and return JWT', async () => {
        const googleUser = { email: 'oauth@example.com' };
        const mockUser: Omit<User, 'password'> = {
        id: 2,
        email: 'oauth@example.com',
        username: 'oauth',
        phone: null,
        } as unknown as Omit<User, 'password'>;

        usersService.createOAuthUser = jest.fn().mockResolvedValue(mockUser);
        jwtService.sign = jest.fn().mockReturnValue('mocked.jwt.oauth.token');

        const result = await service.validateOAuthUser(googleUser);

        expect(usersService.createOAuthUser).toHaveBeenCalledWith({
        email: googleUser.email,
        username: googleUser.email.split('@')[0],
        });
        expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        phone: mockUser.phone,
        username: mockUser.username,
        });
        expect(result).toEqual({ access_token: 'mocked.jwt.oauth.token' });
    });
    });


});
