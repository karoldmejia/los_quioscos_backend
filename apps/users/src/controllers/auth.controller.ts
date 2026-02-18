import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { AuthService } from '../services/auth.service';
import { AuthDto } from '../dtos/auth.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'auth.login' })
  async login(@Payload() dto: AuthDto) {
    const user = await this.authService.validateUser(dto);

    if (!user) {
      throw new RpcException('Invalid credentials');
    }

    return this.authService.login(user);
  }

  @MessagePattern({ cmd: 'auth.oauth' })
  async oauth(@Payload() googleUser: any) {
    const token= this.authService.validateOAuthUser(googleUser);
    return token
  }
}
