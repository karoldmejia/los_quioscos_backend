import { Injectable } from "@nestjs/common";
import { IRoleRepository } from "../irole.repository";
import { Role } from "../../entities/role.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class RoleRepository extends IRoleRepository {

  constructor(
    @InjectRepository(Role)
    private readonly repo: Repository<Role>,
  ) {
      super();
  }

  async findById(id: number): Promise<Role | null> {
    return this.repo.findOne({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.repo.findOne({
      where: { name },
    });
  }

  async save(role: Role): Promise<Role> {
    return this.repo.save(role);
  }
  
  async findAll(): Promise<Role[]> {
    return this.repo.find();
  }

  async delete(roleId: number): Promise<void> {
    await this.repo.delete(roleId);
  }

}
