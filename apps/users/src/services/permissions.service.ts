import { Injectable } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { RolePermissionRepository } from "../repositories/impl/rolepermission.repository";
import { Permission } from "../entities/permission.entity";
import { PermissionRepository } from "../repositories/impl/permissions.repository";
import { PermissionDto } from "../dtos/permission.dto";
import { PermissionMapper } from "../mappers/permissions.mappers";

@Injectable()
export class PermissionService {
    constructor(
        private readonly permissionRepo: PermissionRepository,
        private readonly rolePermissionRepo: RolePermissionRepository,
    ) {}

    async createPermission(dto: PermissionDto): Promise<Permission> {
        if(!await this.validatePermission(dto)){
            throw new RpcException('Invalid credentials');
        }
        const permission = PermissionMapper.toEntity(dto)

        return await this.permissionRepo.save(permission);
    }

    async deletePermission(permId: number): Promise<void> {
        const role = await this.permissionRepo.findById(permId);

        if (!role) {
            throw new RpcException('Permission not found');
        }

        await this.rolePermissionRepo.removePermissionFromRole(permId);
        await this.permissionRepo.delete(permId);
    }

    async updatePermission(permId: number, dto: PermissionDto): Promise<Permission> {
        const permission = await this.permissionRepo.findById(permId);
        if (!permission) throw new RpcException('Permission not found');

        if (dto.name && dto.name !== permission.name) {
        const exists = await this.permissionRepo.findByName(dto.name);
        if (exists) throw new RpcException('Permission name already exists');
        permission.name = dto.name;
        }

        if (dto.description && dto.description !== undefined) {
        permission.description = dto.description;
        }

        return await this.permissionRepo.save(permission);
    }

    async getPermission(permId: number): Promise<Permission> {
        const permission = await this.permissionRepo.findById(permId);
        if (!permission) throw new RpcException('Permission not found');
        return permission;
    }


    // helper methods

    async validatePermission(permission: PermissionDto): Promise<boolean>{
        if(!permission.name){
        throw new RpcException('Permission name is required');
        }

        if(await this.permissionRepo.findByName(permission.name)!==null){
            throw new RpcException('Permissions name already exists');
        }
        return true;
    }

}