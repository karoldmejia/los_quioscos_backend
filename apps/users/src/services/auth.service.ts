import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../services/users.service';
import { User } from '../entities/user.entity';
import { PasswordService } from './password.service';
import { AuthDto } from '../dtos/auth.dto';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AuthService{

    constructor (
        private usersService: UsersService,
        private jwtService: JwtService,
        private passwordService: PasswordService

    ) {}

    async validateUser(dto: AuthDto): Promise<Omit<User, 'password'> | null> {
        const { username, email, phone, password } = dto;

        const checks: Promise<User | null>[] = [];

        if (email) checks.push(this.usersService.findUserByEmail(email));
        if (phone) checks.push(this.usersService.findUserByPhone(phone));

        const results = await Promise.all(checks);
        const user = results.find(u => u != null);

        if(!user) return null

        if (user.password) {
            if (!password) return null;
            const passwordValid = await this.passwordService.comparePassword(
            password,
            user.password,
            );
            if (!passwordValid) return null;
        } 
    
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;

    }

    async login(user: Omit<User, 'password'>){
        const maxRecovDate = this.usersService.getRecoveryDate(user.deletedAt);
        if (user.deletedAt){
            if (new Date()<=maxRecovDate){
                await this.usersService.recoverAccount(user.user_id);
            } else {
                throw new RpcException('Invalid credentials');
            }
        }
        const payload = {sub: user.id, email: user.email, phone: user.phone, username: user.username}
        return {
            access_token: this. jwtService.sign(payload)
        }
    }

    async validateOAuthUser(googleUser: any) {
        const user = await this.usersService.createOAuthUser({
            email: googleUser.email,
            username: googleUser.email.split('@')[0],
        });
        return this.login(user);
    }


    //helper methods
    async validatePassword(userPassword: string, password: string): Promise<boolean> {
        return this.passwordService.comparePassword(password, userPassword);
    }


}