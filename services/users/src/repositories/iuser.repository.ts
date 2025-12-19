import { User } from "../entities/user.entity";

export abstract class IUserRepository {
  abstract findByEmail(email: string): Promise<User | null>;
  abstract findByPhone(phone: string): Promise<User | null>;
  abstract findByUser_Id(user_id: number): Promise<User | null>;
  abstract findByUsername(username: string): Promise <User | null>;
  abstract save(user: User): Promise<User>; 
}