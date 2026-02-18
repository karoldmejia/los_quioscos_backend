import { Permission } from "../entities/permission.entity";
import { Role } from "../entities/role.entity";
import { RolePermission } from "../entities/role_permission.entity";

export abstract class IRolePermissionRepository {
    abstract findOneByIds(roleId: number, permId: number): Promise<RolePermission | null>;
    abstract findPermissionsByRole(roleId: number): Promise<Permission[]>;
    abstract findRolesByPermission(permId: number): Promise<Role[]>;

    abstract assign(roleId: number, permId: number): Promise<RolePermission>;
    abstract remove(roleId: number, permId: number): Promise<boolean>;
    abstract removePermissionsByRole(roleId: number): Promise<number>;
    abstract removePermissionFromRole(permId: number): Promise<number>;
}