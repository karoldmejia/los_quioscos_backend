import { Role } from "../entities/role.entity";

export abstract class IRoleRepository {
  abstract findById(id: number): Promise<Role | null>;
  abstract findByName(name: string): Promise<Role | null>;
  abstract findAll(): Promise<Role[]>; 

  abstract save(role: Role): Promise<Role>; 
  abstract delete(roleId: number): Promise<void>;
}