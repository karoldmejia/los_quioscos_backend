import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from '../services/users.service';
import { UsersController } from '../controllers/users.controller';
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
import { KioskProfile } from '../entities/kiosk_profile.entity';
import { DocumentsValidationService } from '../services/documents-validation.service';
import { CarrierDocument } from '../entities/carrier_document.entity';
import { CarrierProfile } from '../entities/carrier_profile.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { CarrierProfileService } from '../services/carrierprofile.service';
import { CarrierProfileController } from '../controllers/carrierprofile.controller';
import { SchedulesService } from '../services/schedules.service';
import { ScheduleController } from '../controllers/rest/schedule.rest.controller';
import { ProfileSchedules } from '../entities/profile_schedule.entity';
import { ScheduleGrpcController } from '../controllers/rpc/schedule.rpc.controller';
import { Address } from '@/entities/address.entity';
import { AddressService } from '@/services/address.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'DOCUMENTS_GRPC',
        transport: Transport.GRPC,
        options: {
          package: 'documents',
          protoPath: '/app/contracts/documents.proto',
          url: process.env.NODE_ENV === 'production'
            ? 'documents:50051'
            : 'localhost:50051',
        },
      },
    ]),
    ClientsModule.register([
      {
        name: 'PHOTOS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'photos',
          protoPath: '/app/contracts/photos.proto',
          url: process.env.NODE_ENV === 'production'
            ? 'photos:50052'
            : 'localhost:50052',
        },
      },
    ]),
    TypeOrmModule.forFeature([User, Permission, Role, RolePermission, KioskProfile, CarrierDocument, CarrierProfile, Vehicle, ProfileSchedules, Address]),
    RedisModule
  ],
  providers: [UsersService,
    TwilioService,
    PhoneVerificationService,
    PasswordService,
    RoleRepository,
    PermissionRepository,
    RolePermissionRepository,
    PermissionService,
    RolesService,
    KioskProfileService,
    DocumentsValidationService,
    CarrierProfileService,
    SchedulesService, 
    AddressService
  ],
  controllers: [UsersController, RolesController, PermissionController, KioskProfileController, CarrierProfileController, ScheduleController, ScheduleGrpcController],
  exports: [UsersService, PasswordService, PermissionService, RolesService, KioskProfileService, DocumentsValidationService, CarrierProfileService, SchedulesService, AddressService],
})
export class UsersModule { }
