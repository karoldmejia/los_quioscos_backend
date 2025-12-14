import { Controller, Get } from '@nestjs/common';
import { UsersService } from '../services/users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

}
