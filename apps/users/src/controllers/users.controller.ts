import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from '../services/users.service';
import { UserDto } from '../dtos/users.dto';
import { User } from '../entities/user.entity';
import { PhoneVerificationService } from '../services/phoneverification.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService,
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

  @MessagePattern({cmd: 'request_otp'})
  async request_otp(@Payload() phone: string){
    await this.phoneVerificationService.sendOtp(phone)
    return {message: 'OTP sent'}
  }

  @MessagePattern({ cmd: 'register_user' })
  async register(@Payload() dto: UserDto): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.createUser(dto);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  @MessagePattern({cmd: 'reset_password'})
  async resetPassword(@Payload() payload: {userId: number; newPassword: string; duplicatedNewPassword: string; otp: string;}) { 
      const { userId, newPassword, duplicatedNewPassword, otp } = payload;
      return await this.usersService.resetPassword(userId, newPassword, duplicatedNewPassword, otp)
  }
}
