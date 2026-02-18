import { Permission } from "../entities/permission.entity";

export abstract class IPermissionRepository {
  abstract findById(id: number): Promise<Permission | null>;
  abstract findByName(name: string): Promise<Permission | null>;
  abstract findAll(): Promise<Permission[]>; 

  abstract save(permission: Permission): Promise<Permission>; 
  abstract delete(permId: number): Promise<void>;
}