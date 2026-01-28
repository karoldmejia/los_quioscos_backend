import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from '../services/users.service';
import { UserDto } from '../dtos/users.dto';
import { User } from '../entities/user.entity';
import { PhoneVerificationService } from '../services/phoneverification.service';
import { UpdateUserDto } from '../dtos/update-user.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService,
    private readonly phoneVerificationService: PhoneVerificationService,
  ) {}

  @MessagePattern({ cmd: 'get_user' })
  async getUser(@Payload() userId: number){
    return await this.usersService.findUserById(userId)
  }

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

  @MessagePattern({cmd: 'add_role_to_user'})
  async addRoleToUser(@Payload() payload: {userId: number; roleId: number;}) { 
      const { userId, roleId } = payload;
      return await this.usersService.addRoleToUser(userId, roleId)
  }

  @MessagePattern({ cmd: 'delete_user_role' })
  async deleteUserRole(@Payload() userId: number) {
    return await this.usersService.deleteUserRole(userId);
  }


  @MessagePattern({cmd: 'reset_password'})
  async resetPassword(@Payload() payload: {userId: number; newPassword: string; duplicatedNewPassword: string; otp: string;}) { 
      const { userId, newPassword, duplicatedNewPassword, otp } = payload;
      return await this.usersService.resetPassword(userId, newPassword, duplicatedNewPassword, otp)
  }

  @MessagePattern({ cmd: 'update_contact_info' })
  async updateContactInfo(@Payload() payload: {userId: number; updatedUser: UpdateUserDto; password: string;}) { 
    const { userId, updatedUser, password } = payload;
    return await this.usersService.updateUserContactInfo(userId, updatedUser, password)
  }

  @MessagePattern({ cmd: 'update_username' })
  async updateUsername(@Payload() payload: {userId: number; username: string;}) { 
    const { userId, username } = payload;
    return await this.usersService.updateUserUsername(userId, username)
  }

  @MessagePattern({ cmd: 'delete_user' })
  async deleteUser(@Payload() userId: number){
    return await this.usersService.deleteUser(userId)
  }

  @MessagePattern({ cmd: 'recover_account' })
  async recoverAccount(@Payload() userId: number){
    return await this.usersService.recoverAccount(userId)
  }

}
