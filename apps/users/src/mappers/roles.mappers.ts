import { RoleDto } from '../dtos/role.dto';
import { Role } from '../entities/role.entity';

export class RoleMapper {
static toResponse(role: Role): Partial<RoleDto> {
  return {
    name: role.name,
    description: role.description ?? '',
  };
}
  static toEntity(dto: RoleDto): Role {
    const role = new Role();
    role.name = dto.name;
    role.description = dto.description ?? '';
    return role;
  };
}