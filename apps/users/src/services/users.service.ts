import { Injectable, BadRequestException, OnModuleInit, Inject } from '@nestjs/common';
import { UploadProfilePhotoDto, UserDto } from '../dtos/users.dto';
import { User } from '../entities/user.entity';
import { UserMapper } from '../mappers/users.mappers';
import { PasswordService } from './password.service';
import { PhoneVerificationService } from './phoneverification.service';
import { RpcException } from '@nestjs/microservices';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RolesService } from './roles.service';
import { KioskProfileDto } from '../dtos/kioskprofile.dto';
import { KioskProfileService } from './kioskprofile.service';
import type { ClientGrpc } from "@nestjs/microservices";
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {
    private photosService: any;

    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        private readonly passwordService: PasswordService,
        private readonly phoneVerificationService: PhoneVerificationService,
        private readonly roleService: RolesService,
        private readonly kioskProfileService: KioskProfileService,
        @Inject('PHOTOS_PACKAGE') private client: ClientGrpc,
    ) {
        this.photosService = this.client.getService('PhotosService');
    }

    async createUser(dto: UserDto): Promise<User> {
        await this.validateUser(dto);
        const user = UserMapper.toEntity(dto)
        user.password = await this.passwordService.hashPassword(dto.password);

        return this.userRepo.save(user);
    }

    async createOAuthUser(data: { email: string; username: string; }): Promise<User> {
        const { email, username } = data;

        const existingUser = await this.findUserByEmail(email);
        if (existingUser) return existingUser;

        const user = new User();
        user.email = email;
        user.username = username;

        return this.userRepo.save(user)
    }

    async addRoleToUser(userId: string, roleId: number): Promise<boolean> {
        const user = await this.findUserById(userId);
        if (!user || !this.isUserActive(user)) {
            throw new RpcException('User not found');
        }

        const role = await this.roleService.getRole(roleId);
        if (!role) {
            throw new RpcException('Role not found');
        }

        // assign rol
        user.role = role;
        await this.userRepo.save(user);

        // create profile
        switch (role.name) {
            case 'SELLER':
                const dto: KioskProfileDto = {
                    userId: user.user_id,
                    fullLegalName: '',
                    idNumber: '',
                    kioskName: '',
                };
                await this.kioskProfileService.create(dto);
                break;
        }

        return true;
    }

    async deleteUserRole(userId: string): Promise<boolean> {
        const user = await this.findUserById(userId);
        if (!user || !this.isUserActive(user)) {
            throw new RpcException('User not found')
        }
        if (!user.role) {
            throw new RpcException('Users role not found')
        }
        user.role = null;
        await this.userRepo.save(user)
        return true
    }

    async resetPassword(userId: string, newPassword: string, duplicatedNewPassword: string, otp: string) {
        const existingUser = await this.findUserById(userId)
        if (!existingUser || !this.isUserActive(existingUser)) {
            throw new RpcException('User not found')
        }
        if (existingUser.phone == null) {
            throw new RpcException('You do not have a phone registered. Please register it to be able to reset your password.')
        }
        const phoneverification = await this.phoneVerificationService.verifyOtp(existingUser.phone, otp);
        if (!phoneverification) {
            throw new RpcException('Restauration code does not match')
        }
        if (!this.validatePassword(newPassword)) {
            throw new RpcException('Password does not meet security requirements');
        }
        if (!this.validatePassword(duplicatedNewPassword)) {
            throw new RpcException('Password confirmation is invalid');
        }
        if (newPassword != duplicatedNewPassword) {
            throw new RpcException('Passwords do not match')
        }
        existingUser.password = await this.passwordService.hashPassword(newPassword);
        await this.userRepo.save(existingUser);
        return { message: 'Password has been reset' }
    }

    async updateUserContactInfo(userId: string, user: UpdateUserDto, password: string) {
        const existingUser = await this.findUserById(userId);
        if (!existingUser || !this.isUserActive(existingUser)) {
            throw new RpcException('User not found');
        }
        if (!user.email && !user.phone) {
            throw new RpcException('Invalid credentials')
        }
        if (existingUser.password && !(await this.passwordService.comparePassword(password, existingUser.password))) {
            throw new RpcException('Invalid password')
        }
        if (user.email) {
            const userWithSameEmail = await this.findUserByEmail(user.email);
            if (
                userWithSameEmail &&
                userWithSameEmail.user_id !== existingUser.user_id
            ) {
                throw new RpcException('Email already in use');
            }
            existingUser.email = user.email;
        }
        if (user.phone) {
            const userWithSamePhone = await this.userRepo.findOne({ where: { phone: user.phone } });
            if (
                userWithSamePhone &&
                userWithSamePhone.user_id !== existingUser.user_id
            ) {
                throw new RpcException('Phone already in use');
            }
            existingUser.phone = user.phone;
        }
        await this.userRepo.save(existingUser);
        return { message: 'Info has been updated' }
    }

    async updateUserUsername(userId: string, username: string) {
        const existingUser = await this.findUserById(userId);
        if (!existingUser || !this.isUserActive(existingUser)) {
            throw new RpcException('User not found');
        }
        if (!existingUser.username) {
            throw new RpcException('Invalid username')
        }
        existingUser.username = username;
        await this.userRepo.save(existingUser);
        return { message: 'Username has been updated' }
    }

    async deleteUser(userId: string): Promise<{ recoverUntil: Date }> {
        const existingUser = await this.findUserById(userId);
        if (!existingUser || !this.isUserActive(existingUser)) {
            throw new RpcException('User not found');
        }
        existingUser.deletedAt = new Date();
        await this.userRepo.save(existingUser);
        const recoverUntil = this.getRecoveryDate(existingUser.deletedAt);

        return { recoverUntil };
    }

    async recoverAccount(userId: string) {
        const existingUser = await this.userRepo.findOne({
            where: { user_id: userId },
            withDeleted: true,
        }); if (!existingUser) {
            throw new RpcException('User not found');
        }
        if (this.isUserActive(existingUser)) {
            return;
        }
        existingUser.deletedAt = null;
        await this.userRepo.save(existingUser);
    }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async anonymizeUsers() {
        const users: User[] = await this.userRepo.find();

        for (const user of users) {
            if (user.deletedAt === null) continue;
            if (user.email === null && user.phone === null && user.password === null) {
                continue;
            }

            const recoverUntil = this.getRecoveryDate(user.deletedAt);
            if (new Date() > recoverUntil) {
                user.username = 'anonymous';
                user.email = null;
                user.phone = null;
                user.password = null;
                user.profile_photo = null;
                await this.userRepo.save(user);
            }
        }
    }

    // profile photo

    async uploadProfilePhoto(dto: UploadProfilePhotoDto): Promise<boolean> {
        const user = await this.findUserById(dto.userId);
        if (!user) {
            throw new RpcException("User ID is not valid");
        }
        const file = dto.photo
        const photoId = await this.photosService.upload({ file });

        user.profile_photo = photoId;
        await this.userRepo.save(user);

        return true;
    }
    // helper methods

    async validateUser(user: UserDto): Promise<void> {
        const requiredFields = ['email', 'password', 'phone', 'username'];
        for (const field of requiredFields) {
            if (!user[field as keyof UserDto]) {
                throw new RpcException(`${field} is required`);
            }
        }

        if (user.email) {
            const existingUserByEmail = await this.findUserByEmail(user.email);
            if (existingUserByEmail) {
                throw new RpcException('Email already in use');
            }
        }
        const existingUserByPhone = await this.userRepo.findOne({ where: { phone: user.phone } });
        if (existingUserByPhone) {
            throw new RpcException('Phone already in use');
        }

        const phoneVerified = await this.phoneVerificationService.verifyOtp(user.phone, user.otp);
        if (!phoneVerified) {
            throw new RpcException('Phone not verified');
        }

        if (!this.validatePassword(user.password)) {
            throw new RpcException('Password doesnt meet requirements');
        }
    }

    validatePassword(password: string): boolean {
        return /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z]).{8,}$/.test(password);
    }


    async findUserByEmail(email: string): Promise<User | null> {
        return this.userRepo.findOneBy({ email });
    }
        async findUserByPhone(phone: string): Promise<User | null> {
        return this.userRepo.findOneBy({ phone });
    }

    async findUserById(user_id: string): Promise<User | null> {
        return this.userRepo.findOneBy({ user_id });
    }

    isUserActive(user: User): boolean {
        return user.deletedAt === null;
    }

    getRecoveryDate(deletedAt: Date): Date {
        const recoveryDays = 30;
        return new Date(deletedAt.getTime() + recoveryDays * 24 * 60 * 60 * 1000);
    }



}
