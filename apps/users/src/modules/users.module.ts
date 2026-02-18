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
import { KioskProfileController } from '../controllers/kioskprofile.controller';
import { KioskProfileService } from '../services/kioskprofile.service';
import { KioskProfileRepository } from '../repositories/impl/kioskprofile.repository';
import { KioskProfile } from '../entities/kiosk_profile.entity';
import { DocumentsValidationService } from '../services/documents-validation.service';

@Module({
  imports: [
        ClientsModule.register([
      {
        name: 'DOCUMENTS_GRPC',
        transport: Transport.GRPC,
        options: {
          url: 'documents:50051',
          package: 'documents',
          protoPath: join(process.cwd(), 'contracts/documents.proto'),
        },
      },
    ]),
    TypeOrmModule.forFeature([User, Permission, Role, RolePermission, KioskProfile]),
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
        RolesService, 
        KioskProfileService,
        KioskProfileRepository,
        DocumentsValidationService
  ],
  controllers: [UsersController, RolesController, PermissionController, KioskProfileController],
  exports: [UsersService, PasswordService, PermissionService, RolesService, KioskProfileService, DocumentsValidationService],
})
export class UsersModule {}
