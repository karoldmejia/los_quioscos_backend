import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from '../services/users.service';
import { UsersController } from '../controllers/users.controller';
import { UserRepository } from '../repositories/impl/users.repository';
import { TwilioService } from '../services/twilio.service';
import { PhoneVerificationService } from '../services/phoneverification.service';
import { PasswordService } from '../services/password.service';
import { RedisModule } from './redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    RedisModule
  ],
  providers: [UsersService,
        UserRepository,
        TwilioService,
        PhoneVerificationService,
        PasswordService,
  ],
  controllers: [UsersController],
})
export class UsersModule {}
