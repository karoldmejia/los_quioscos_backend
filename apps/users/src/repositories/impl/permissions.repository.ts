import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IPermissionRepository } from "../ipermission.repository";
import { Permission } from "../../entities/permission.entity";

@Injectable()
export class PermissionRepository extends IPermissionRepository {

  constructor(
    @InjectRepository(Permission)
    private readonly repo: Repository<Permission>,
  ) {
      super();
  }

  async findById(id: number): Promise<Permission | null> {
    return this.repo.findOne({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Permission | null> {
    return this.repo.findOne({
      where: { name },
    });
  }

  async save(role: Permission): Promise<Permission> {
    return this.repo.save(role);
  }
  
  async findAll(): Promise<Permission[]> {
    return this.repo.find();
  }

  async delete(roleId: number): Promise<void> {
    await this.repo.delete(roleId);
  }

}
