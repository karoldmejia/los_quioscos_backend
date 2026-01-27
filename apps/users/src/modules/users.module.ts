import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from '../services/users.service';
import { UsersController } from '../controllers/users.controller';
import { UserRepository } from '../repositories/impl/users.repository';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { TwilioService } from '../services/twilio.service';
import { PhoneVerificationService } from '../services/phoneverification.service';
import { PasswordService } from '../services/password.service';
import { RedisModule } from './redis.module';
import { Role } from '../entities/role.entity';
import { RolePermission } from '../entities/role_permission.entity';
import { Permission } from '../entities/permission.entity';
import { RoleRepository } from '../repositories/impl/roles.repository';
import { PermissionRepository } from '../repositories/impl/permissions.repository';
import { PermissionService } from '../services/permissions.service';
import { RolesService } from '../services/roles.service';
import { RolePermissionRepository } from '../repositories/impl/rolepermission.repository';
import { RolesController } from '../controllers/roles.controller';
import { PermissionController } from '../controllers/permissions.controller';

@Module({
  imports: [
        ClientsModule.register([
      {
        name: 'DOCUMENTS_GRPC',
        transport: Transport.GRPC,
        options: {
          url: 'documents:50051',
          package: 'documents',
          protoPath: join(
            __dirname,
            'contracts/documents.proto',
          ),
        },
      },
    ]),
    TypeOrmModule.forFeature([User, Permission, Role, RolePermission]),
    RedisModule
  ],
  providers: [UsersService,
        UserRepository,
        TwilioService,
        PhoneVerificationService,
        PasswordService,
        RoleRepository,
        PermissionRepository,
        RolePermissionRepository,
        PermissionService,
        RolesService
  ],
  controllers: [UsersController, RolesController, PermissionController],
  exports: [UsersService, PasswordService, PermissionService, RolesService],
})
export class UsersModule {}
