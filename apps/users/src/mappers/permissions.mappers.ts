import { PermissionDto } from "../dtos/permission.dto";
import { Permission } from "../entities/permission.entity";

export class PermissionMapper {
static toResponse(permission: Permission): Partial<PermissionDto> {
  return {
    name: permission.name,
    description: permission.description ?? '',
  };
}
  static toEntity(dto: PermissionDto): Permission {
    const permission = new Permission();
    permission.name = dto.name;
    permission.description = dto.description ?? '';
    return permission;
  };
}