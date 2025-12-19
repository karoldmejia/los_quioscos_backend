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
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user_role.entity';
import { RolePermission } from '../entities/role_permission.entity';
import { Permission } from '../entities/permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserRole, RolePermission, Permission]),
    RedisModule
  ],
  providers: [UsersService,
        UserRepository,
        TwilioService,
        PhoneVerificationService,
        PasswordService,
  ],
  controllers: [UsersController],
  exports: [UsersService, PasswordService],
})
export class UsersModule {}
