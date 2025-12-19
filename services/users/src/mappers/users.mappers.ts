import { User } from '../entities/user.entity';
import { UserDto } from '../dtos/users.dto';

export class UserMapper {
  static toResponse(user: User): Partial<UserDto> {
    return {
      email: user.email,
      phone: user.phone,
      username: user.username,
    };
}

  static toEntity(dto: UserDto): User {
    const user = new User();
    user.username = dto.username;
    user.email = dto.email;
    user.password = dto.password;
    user.phone = dto.phone;
    return user;
  };
}