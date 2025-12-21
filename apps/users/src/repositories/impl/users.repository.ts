import { Injectable } from "@nestjs/common";
import { InjectRepository } from '@nestjs/typeorm';
import { IUserRepository } from "../iuser.repository";
import { Repository } from "typeorm";
import { User } from "../../entities/user.entity";

@Injectable()
export class UserRepository extends IUserRepository {

  constructor(
    @InjectRepository(User) // tells typeorm to give the typeorm repo for user entity
    private readonly repo: Repository<User>,
  ) {
      super();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
      return this.repo.findOne({
          where: { phone },
      });
  }
  async findByUser_Id(user_id: number): Promise<User | null> {
      return this.repo.findOne({
          where: { user_id },
      });  
    }

  async findByUsername(username: string): Promise<User | null> {
      return this.repo.findOne({
          where: { username },
      });    }

  async save(user: User): Promise<User> {
      return this.repo.save(user);
  }
}
