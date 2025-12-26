import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RolesService } from '../services/roles.service';
import { RoleDto } from '../dtos/role.dto';
import { Role } from '../entities/role.entity';

@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService,
  ) {}

  @MessagePattern({ cmd: 'get_role' })
  async getRole(@Payload() roleId: number){
    return await this.rolesService.getRole(roleId)
  }

  @MessagePattern({ cmd: 'get_permissions_by_role' })
  async getPermissionsByRole(@Payload() roleId: number){
    return await this.rolesService.getRole(roleId)
  }

  @MessagePattern({ cmd: 'create_role' })
  async createRole(@Payload() dto: RoleDto): Promise<Role> {
    return await this.rolesService.createRole(dto);
  }

  @MessagePattern({ cmd: 'delete_role' })
  async deleteRole(@Payload() roleId: number) {
    return await this.rolesService.deleteRole(roleId);
  }

  @MessagePattern({ cmd: 'update_role' })
  async updateRole(@Payload() payload: {roleId: number; dto: RoleDto;}) { 
    const {roleId, dto} = payload;
    return await this.rolesService.updateRole(roleId, dto);
  }

  @MessagePattern({ cmd: 'assign_permission_to_role' })
  async assignPermissionToRole(@Payload() payload: {roleId: number; permId: number;}) { 
    const {roleId, permId} = payload;
    return await this.rolesService.assignPermissionToRole(roleId, permId);
  }

  @MessagePattern({ cmd: 'remove_permission_from_role' })
  async removePermissionFromRole(@Payload() payload: {roleId: number; permId: number;}) { 
    const {roleId, permId} = payload;
    return await this.rolesService.removePermissionFromRole(roleId, permId);
  }
}
