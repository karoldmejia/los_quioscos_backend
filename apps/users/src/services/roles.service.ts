import { Injectable } from "@nestjs/common";
import { RoleRepository } from "../repositories/impl/roles.repository";
import { RoleDto } from "../dtos/role.dto";
import { Role } from "../entities/role.entity";
import { RpcException } from "@nestjs/microservices";
import { RoleMapper } from "../mappers/roles.mappers";
import { RolePermissionRepository } from "../repositories/impl/rolepermission.repository";
import { Permission } from "../entities/permission.entity";
import { PermissionRepository } from "../repositories/impl/permissions.repository";
import { RolePermission } from "../entities/role_permission.entity";

@Injectable()
export class RolesService {
    constructor(
        private readonly roleRepo: RoleRepository,
        private readonly rolePermissionRepo: RolePermissionRepository,
        private readonly permissionRepo: PermissionRepository,
    ) {}

    async createRole(dto: RoleDto): Promise<Role> {
        if(!await this.validateRole(dto)){
            throw new RpcException('Invalid credentials');
        }
        const role = RoleMapper.toEntity(dto)

        return await this.roleRepo.save(role);
    }

    async deleteRole(roleId: number): Promise<void> {
        const role = await this.roleRepo.findById(roleId);

        if (!role) {
            throw new RpcException('Role not found');
        }

        await this.rolePermissionRepo.removePermissionsByRole(role.id);
        await this.roleRepo.delete(role.id);
    }

    async updateRole(roleId: number, dto: RoleDto): Promise<Role> {
        const role = await this.roleRepo.findById(roleId);
        if (!role) throw new RpcException('Role not found');

        if (dto.name && dto.name !== role.name) {
        const exists = await this.roleRepo.findByName(dto.name);
        if (exists) throw new RpcException('Role name already exists');
        role.name = dto.name;
        }

        if (dto.description && dto.description !== undefined) {
        role.description = dto.description;
        }

        return await this.roleRepo.save(role);
    }

    async getPermissionsByRole(roleId: number): Promise<Permission[]> {
        const role = await this.roleRepo.findById(roleId);
        if (!role) throw new RpcException('Role not found');
        const permissions = await this.rolePermissionRepo.findPermissionsByRole(roleId);
        return permissions;
    }

    async getRole(roleId: number): Promise<Role>{
        const role = await this.roleRepo.findById(roleId);
        if (!role) throw new RpcException('Role not found');
        return role;
    }

    async assignPermissionToRole(roleId: number, permId: number): Promise<RolePermission>{
        if (!await this.roleRepo.findById(roleId)) {throw new RpcException('Role not found')};
        if (!await this.permissionRepo.findById(permId)) {throw new RpcException('Permission not found')};

        return await this.rolePermissionRepo.assign(roleId, permId);
    }

    async removePermissionFromRole(roleId: number, permId: number): Promise<boolean>{
        if (!await this.roleRepo.findById(roleId)) {throw new RpcException('Role not found')};
        if (!await this.permissionRepo.findById(permId)) {throw new RpcException('Permission not found')};

        return await this.rolePermissionRepo.remove(roleId, permId);
    }

    // helper methods

    async validateRole(role: RoleDto): Promise<boolean>{
        if(!role.name){
        throw new RpcException('Role name is required');
        }

        const exists = await this.roleRepo.findByName(role.name);
        if (exists) throw new RpcException('Role name already exists');

        return true;
    }

}