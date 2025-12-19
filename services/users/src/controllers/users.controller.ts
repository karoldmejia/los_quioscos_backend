import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { UserDto } from '../dtos/users.dto';
import { User } from '../entities/user.entity';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() dto: UserDto): Promise<Omit<User, 'password'>> {
    const user = await this.usersService.createUser(dto);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
