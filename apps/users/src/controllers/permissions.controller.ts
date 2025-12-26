import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PermissionService } from '../services/permissions.service';
import { PermissionDto } from '../dtos/permission.dto';
import { Permission } from '../entities/permission.entity';

@Controller()
export class PermissionController {
  constructor(private readonly permissionsService: PermissionService,
  ) {}

  @MessagePattern({ cmd: 'get_permission' })
  async getPermission(@Payload() permId: number){
    return await this.permissionsService.getPermission(permId)
  }

  @MessagePattern({ cmd: 'create_permission' })
  async createPermission(@Payload() dto: PermissionDto): Promise<Permission> {
    return await this.permissionsService.createPermission(dto);
  }

  @MessagePattern({ cmd: 'delete_permission' })
  async deletePermission(@Payload() permId: number) {
    return await this.permissionsService.deletePermission(permId);
  }

  @MessagePattern({ cmd: 'update_permission' })
  async updatePermission(@Payload() payload: {permId: number; dto: PermissionDto;}) { 
    const {permId, dto} = payload;
    return await this.permissionsService.updatePermission(permId, dto);
  }
}
