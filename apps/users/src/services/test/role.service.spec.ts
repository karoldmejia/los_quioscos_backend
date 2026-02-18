import { Test } from '@nestjs/testing';
import { RolesService } from '../../services/roles.service';
import { RoleRepository } from '../../repositories/impl/roles.repository';
import { RolePermissionRepository } from '../../repositories/impl/rolepermission.repository';
import { PermissionRepository } from '../../repositories/impl/permissions.repository';
import { RpcException } from '@nestjs/microservices';

describe('RolesService', () => {
  let service: RolesService;

  const roleRepoMock = {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    findByName: jest.fn(),
  };

  const rolePermissionRepoMock = {
    removePermissionsByRole: jest.fn(),
    findPermissionsByRole: jest.fn(),
    assign: jest.fn(),
    remove: jest.fn(),
  };

  const permissionRepoMock = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: RoleRepository, useValue: roleRepoMock },
        { provide: RolePermissionRepository, useValue: rolePermissionRepoMock },
        { provide: PermissionRepository, useValue: permissionRepoMock },
      ],
    }).compile();

    service = moduleRef.get(RolesService);
    jest.clearAllMocks();
  });


  // create role
  it('should create a role successfully', async () => {
    const dto = { name: 'Admin', description: 'Admin role' };

    roleRepoMock.findByName.mockResolvedValue(null);
    roleRepoMock.save.mockResolvedValue({ id: 1, ...dto });

    const result = await service.createRole(dto);

    expect(roleRepoMock.findByName).toHaveBeenCalledWith('Admin');
    expect(roleRepoMock.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should throw if role name is missing', async () => {
    await expect(
      service.createRole({ name: '', description: '' })
    ).rejects.toThrow(RpcException);
  });

  it('should throw if role name already exists', async () => {
    roleRepoMock.findByName.mockResolvedValue({ id: 1, name: 'Admin' });

    await expect(
      service.createRole({ name: 'Admin', description: '' })
    ).rejects.toThrow('Role name already exists');
  });

  // delete role
  it('should delete role and its permissions', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1 });

    await service.deleteRole(1);

    expect(roleRepoMock.findById).toHaveBeenCalledWith(1);
    expect(rolePermissionRepoMock.removePermissionsByRole).toHaveBeenCalledWith(1);
    expect(roleRepoMock.delete).toHaveBeenCalledWith(1);
  });

  it('should throw when deleting non existing role', async () => {
    roleRepoMock.findById.mockResolvedValue(null);

    await expect(service.deleteRole(1)).rejects.toThrow('Role not found');
  });

  // update role
  it('should update role successfully', async () => {
    const role = { id: 1, name: 'User', description: 'Normal user' };

    roleRepoMock.findById.mockResolvedValue(role);
    roleRepoMock.findByName.mockResolvedValue(null);
    roleRepoMock.save.mockResolvedValue({ ...role, name: 'Admin' });

    const result = await service.updateRole(1, { name: 'Admin' });

    expect(result.name).toBe('Admin');
  });

  it('should throw if updating non existing role', async () => {
    roleRepoMock.findById.mockResolvedValue(null);

    await expect(service.updateRole(1, { name: 'X' }))
      .rejects.toThrow('Role not found');
  });

  it('should throw if updating to an existing name', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1, name: 'User' });
    roleRepoMock.findByName.mockResolvedValue({ id: 2, name: 'Admin' });

    await expect(service.updateRole(1, { name: 'Admin' }))
      .rejects.toThrow('Role name already exists');
  });

  // get permissions
  it('should return permissions for role', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1 });
    rolePermissionRepoMock.findPermissionsByRole.mockResolvedValue([]);

    const result = await service.getPermissionsByRole(1);

    expect(result).toEqual([]);
  });

  it('should throw when role not found (permissions)', async () => {
    roleRepoMock.findById.mockResolvedValue(null);

    await expect(service.getPermissionsByRole(1))
      .rejects.toThrow('Role not found');
  });

  //get role
  it('should return role', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1, name: 'Admin' });

    const result = await service.getRole(1);

    expect(result.id).toBe(1);
  });

  it('should throw when role not found', async () => {
    roleRepoMock.findById.mockResolvedValue(null);

    await expect(service.getRole(1))
      .rejects.toThrow('Role not found');
  });

  // assign permission
  it('should assign permission to role', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1 });
    permissionRepoMock.findById.mockResolvedValue({ id: 10 });

    rolePermissionRepoMock.assign.mockResolvedValue({
      roleId: 1,
      permId: 10,
    });

    const result = await service.assignPermissionToRole(1, 10);

    expect(result).toEqual({ roleId: 1, permId: 10 });
  });

  it('should throw if role not found when assigning', async () => {
    roleRepoMock.findById.mockResolvedValue(null);

    await expect(service.assignPermissionToRole(1, 10))
      .rejects.toThrow('Role not found');
  });

  it('should throw if permission not found when assigning', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1 });
    permissionRepoMock.findById.mockResolvedValue(null);

    await expect(service.assignPermissionToRole(1, 10))
      .rejects.toThrow('Permission not found');
  });

  // remove permission
  it('should remove permission from role', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1 });
    permissionRepoMock.findById.mockResolvedValue({ id: 10 });

    rolePermissionRepoMock.remove.mockResolvedValue(true);

    const result = await service.removePermissionFromRole(1, 10);

    expect(result).toBe(true);
  });

  it('should throw if role not found when removing', async () => {
    roleRepoMock.findById.mockResolvedValue(null);

    await expect(service.removePermissionFromRole(1, 10))
      .rejects.toThrow('Role not found');
  });

  it('should throw if permission not found when removing', async () => {
    roleRepoMock.findById.mockResolvedValue({ id: 1 });
    permissionRepoMock.findById.mockResolvedValue(null);

    await expect(service.removePermissionFromRole(1, 10))
      .rejects.toThrow('Permission not found');
  });

});
