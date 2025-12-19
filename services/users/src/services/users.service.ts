import { Injectable, BadRequestException } from '@nestjs/common';
import { UserDto } from '../dtos/users.dto';
import { User } from '../entities/user.entity';
import { UserMapper } from '../mappers/users.mappers';
import { UserRepository } from '../repositories/impl/users.repository';
import { PasswordService } from './password.service';
import { PhoneVerificationService } from './phoneverification.service';

@Injectable()
export class UsersService {

    constructor(private readonly userRepo: UserRepository,
        private readonly passwordService: PasswordService,
        private readonly phoneVerificationService: PhoneVerificationService
    ) {}

    async createUser(dto: UserDto): Promise<User> {
        await this.validateUser(dto);
        const user = UserMapper.toEntity(dto)
        user.password = await this.passwordService.hashPassword(dto.password);

        return this.userRepo.save(user);
    }

    async createOAuthUser(data: {email: string; username: string; }): Promise<User> {
        const {email, username} = data;

        const existingUser = await this.findUserByEmail(email);
        if (existingUser) return existingUser;

        const user = new User();
        user.email = email;
        user.username = username;

        return this.userRepo.save(user)
    }

    // helper methods

    async validateUser(user: UserDto): Promise<void> {
        const requiredFields = ['email', 'password', 'phone', 'username'];
        for (const field of requiredFields) {
        if (!user[field as keyof UserDto]) {
            throw new BadRequestException(`${field} is required`);
        }
        }

        if (user.email){
        const existingUserByEmail = await this.findUserByEmail(user.email);
        if (existingUserByEmail) {
            throw new BadRequestException('Email already in use');
        }
    }

        const existingUserByUsername = await this.findUserByUsername(user.username);    
        if (existingUserByUsername){
            throw new BadRequestException('Username already in use');
        }
        const existingUserByPhone = await this.findUserByPhone(user.phone);    
        if (existingUserByPhone){
            throw new BadRequestException('Phone already in use');
        }

        const phoneVerified = await this.phoneVerificationService.verifyOtp(user.phone, user.otp);
        if (!phoneVerified) {
            throw new BadRequestException('Phone not verified');
        }

    }

    async findUserByEmail(email: string): Promise<User | null> {
        return this.userRepo.findByEmail(email);
    }

    async findUserById(user_id: number): Promise<User | null> {
        return this.userRepo.findByUser_Id(user_id);
    }

    async findUserByPhone(phone: string): Promise<User | null> {
        return this.userRepo.findByPhone(phone);
    }

    async findUserByUsername(username: string): Promise<User | null> {
        return this.userRepo.findByUsername(username);
    }
}
