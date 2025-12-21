import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from '../services/users.service';
import { UserDto } from '../dtos/users.dto';
import { User } from '../entities/user.entity';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern({ cmd: 'register_user' })
  async register(@Payload() dto: UserDto): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.createUser(dto);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
