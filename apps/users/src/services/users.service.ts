import { Injectable, BadRequestException, OnModuleInit, Inject } from '@nestjs/common';
import { UserDto } from '../dtos/users.dto';
import { User } from '../entities/user.entity';
import { UserMapper } from '../mappers/users.mappers';
import { UserRepository } from '../repositories/impl/users.repository';
import { PasswordService } from './password.service';
import { PhoneVerificationService } from './phoneverification.service';
import { RpcException } from '@nestjs/microservices';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RolesService } from './roles.service';
import type { ClientGrpc } from '@nestjs/microservices';
import { DocumentServiceGrpc } from '../grpc/documents.interface';
import { lastValueFrom } from 'rxjs';


@Injectable()
export class UsersService implements OnModuleInit {

    private documentsService: DocumentServiceGrpc;

    constructor(
        private readonly userRepo: UserRepository,
        private readonly passwordService: PasswordService,
        private readonly phoneVerificationService: PhoneVerificationService,
        private readonly roleService: RolesService,
        @Inject('DOCUMENTS_GRPC') private readonly client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.documentsService =
        this.client.getService<DocumentServiceGrpc>('DocumentService');
    }

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

    async addRoleToUser(userId: number, roleId: number): Promise<boolean>{
        const user = await this.findUserById(userId);
        if (!user || !this.isUserActive(user)){
            throw new RpcException('User not found')
        }
        const role = await this.roleService.getRole(roleId);
        if (!role){
            throw new RpcException('Role not found')
        }
        user.role = role;
        await this.userRepo.save(user)
        return true
    }

    async deleteUserRole(userId: number): Promise<boolean>{
        const user = await this.findUserById(userId);
        if (!user || !this.isUserActive(user)){
            throw new RpcException('User not found')
        }
        if (!user.role){
            throw new RpcException('Users role not found')
        }
        user.role = null;
        await this.userRepo.save(user)
        return true
    }

    async resetPassword(userId: number, newPassword: string, duplicatedNewPassword: string, otp: string) {
        const existingUser = await this.findUserById(userId)
        if (!existingUser || !this.isUserActive(existingUser)){
            throw new RpcException('User not found')
        }
        if (existingUser.phone==null){
            throw new RpcException('You do not have a phone registered. Please register it to be able to reset your password.')
        }
        const phoneverification = await this.phoneVerificationService.verifyOtp(existingUser.phone, otp);
        if(!phoneverification){
            throw new RpcException('Restauration code does not match')
        }
        if (!this.validatePassword(newPassword)) {
            throw new RpcException('Password does not meet security requirements');
        }
        if (!this.validatePassword(duplicatedNewPassword)) {
            throw new RpcException('Password confirmation is invalid');
        }
        if(newPassword != duplicatedNewPassword){
            throw new RpcException('Passwords do not match')
        }
        existingUser.password = await this.passwordService.hashPassword(newPassword);
        await this.userRepo.save(existingUser);
        return {message: 'Password has been reset'}
    }

    async updateUserContactInfo(userId: number, user: UpdateUserDto, password: string) {
        const existingUser = await this.findUserById(userId);
        if (!existingUser || !this.isUserActive(existingUser)){
            throw new RpcException('User not found');
        }
        if (!user.email && !user.phone){
            throw new RpcException('Invalid credentials')
        }
        if (existingUser.password && !(await this.passwordService.comparePassword(password, existingUser.password))){
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
            const userWithSamePhone = await this.findUserByPhone(user.phone);
            if (
            userWithSamePhone &&
            userWithSamePhone.user_id !== existingUser.user_id
            ) {
            throw new RpcException('Phone already in use');
            }
            existingUser.phone = user.phone;
        }
        await this.userRepo.save(existingUser);
        return {message: 'Info has been updated'}
    }

    async updateUserUsername(userId: number, username: string) {
        const existingUser = await this.findUserById(userId);
        if (!existingUser || !this.isUserActive(existingUser)){
            throw new RpcException('User not found');
        }
        if (!existingUser.username){
            throw new RpcException('Invalid username')
        }
        existingUser.username=username;
        await this.userRepo.save(existingUser);
        return {message: 'Username has been updated'}
    }

    async deleteUser(userId: number): Promise<{ recoverUntil: Date }> {
        const existingUser = await this.findUserById(userId);
        if (!existingUser || !this.isUserActive(existingUser)) {
            throw new RpcException('User not found');
        }
        existingUser.deletedAt = new Date();
        await this.userRepo.save(existingUser);
        const recoverUntil = this.getRecoveryDate(existingUser.deletedAt);

        return { recoverUntil };
    }

    async recoverAccount(userId: number){
        const existingUser = await this.userRepo.findUserByIdIncludingDeleted(userId);
        if (!existingUser) {
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
        const users: User[] = await this.userRepo.findAll();

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
                user.profile_photo_url = null;
                await this.userRepo.save(user);
            }
        }
    }

    // validate document (integration with documents service)
    async validateDocument(userId: string, docTypeId: string, files: Buffer[], selfie?: Buffer) {
    
        const request: any = {user_id: userId, doc_type_id: docTypeId, files};
        if (selfie) {
            request.selfie = selfie;
        }

        const response = await lastValueFrom(this.documentsService.ValidateDocument(request));

        return response;
    }


    // helper methods

    async validateUser(user: UserDto): Promise<void> {
        const requiredFields = ['email', 'password', 'phone', 'username'];
        for (const field of requiredFields) {
        if (!user[field as keyof UserDto]) {
            throw new RpcException(`${field} is required`);
        }
        }

        if (user.email){
        const existingUserByEmail = await this.findUserByEmail(user.email);
        if (existingUserByEmail) {
            throw new RpcException('Email already in use');
        }
    }
        const existingUserByPhone = await this.findUserByPhone(user.phone);    
        if (existingUserByPhone){
            throw new RpcException('Phone already in use');
        }

        const phoneVerified = await this.phoneVerificationService.verifyOtp(user.phone, user.otp);
        if (!phoneVerified) {
            throw new RpcException('Phone not verified');
        }

        if (!this.validatePassword(user.password)){
            throw new RpcException('Password doesnt meet requirements');
        }
    }

    validatePassword(password: string): boolean {
    return /^(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z]).{8,}$/.test(password);
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

    isUserActive(user: User): boolean {
    return user.deletedAt === null;
    }

    getRecoveryDate(deletedAt: Date): Date {
        const recoveryDays = 30;
        return new Date(deletedAt.getTime() + recoveryDays * 24 * 60 * 60 * 1000);
    }

}
