import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IRolePermissionRepository } from "../irolepermission.repository";
import { RolePermission } from "../../entities/role_permission.entity";
import { Permission } from "../../entities/permission.entity";
import { Role } from "../../entities/role.entity";

@Injectable()
export class RolePermissionRepository extends IRolePermissionRepository {

    constructor(
    @InjectRepository(RolePermission)
    private readonly repo: Repository<RolePermission>,
    ) {
        super();
    }

    async findOneByIds(roleId: number, permId: number): Promise<RolePermission | null> {
        return this.repo.findOne({
        where: {
            role_id: roleId,
            permission_id: permId,
        },
        });
    }

    async findPermissionsByRole(roleId: number): Promise<Permission[]> {
        const relations = await this.repo.find({
        where: { role_id: roleId},
        relations: {permission: true}
        });

    return relations.map(rp => rp.permission);

    }

    async findRolesByPermission(permId: number): Promise<Role[]> {
        const relations = await this.repo.find({
        where: {permission_id: permId},
        relations: { role: true }
        });

        return relations.map(rp => rp.role)
    }

    async assign(roleId: number, permId: number): Promise<RolePermission> {
        return this.repo.save({
        role_id: roleId,
        permission_id: permId,
        });
    }

    async remove(roleId: number, permId: number): Promise<boolean> {
        const result = await this.repo.delete({
            role_id: roleId,
            permission_id: permId,
        });
        return (result.affected ?? 0) > 0;
    }

    async removePermissionsByRole(roleId: number): Promise<number> {
        const result = await this.repo.delete({
            role_id: roleId,
        });

        return result.affected ?? 0;
    }

    async removePermissionFromRole(permId: number): Promise<number> {
        const result = await this.repo.delete({
            permission_id: permId,
        });

        return result.affected ?? 0;
    }

}
