import { Injectable } from "@nestjs/common";
import { InjectRepository } from '@nestjs/typeorm';
import { IUserRepository } from "../iuser.repository";
import { IsNull, Repository } from "typeorm";
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
      where: { email, deletedAt: IsNull() },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
      return this.repo.findOne({
          where: { phone, deletedAt: IsNull() },
      });
  }
  async findByUser_Id(user_id: number): Promise<User | null> {
      return this.repo.findOne({
          where: { user_id, deletedAt: IsNull() },
      });  
    }

  async findByUsername(username: string): Promise<User | null> {
      return this.repo.findOne({
          where: { username, deletedAt: IsNull() },
      });    }

  async save(user: User): Promise<User> {
      return this.repo.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.repo.find();
  }

  async findUserByIdIncludingDeleted(user_id: number): Promise<User | null> {
    return this.repo.findOne({
        where: { user_id },
    });
  }


}
