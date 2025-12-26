import { Test } from '@nestjs/testing';
import { PermissionService } from '../permissions.service';
import { PermissionRepository } from '../../repositories/impl/permissions.repository';
import { RolePermissionRepository } from '../../repositories/impl/rolepermission.repository';
import { RpcException } from '@nestjs/microservices';

describe('PermissionService', () => {
  let service: PermissionService;

  const permissionRepoMock = {
    save: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
    findByName: jest.fn(),
  };

  const rolePermissionRepoMock = {
    removePermissionFromRole: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: PermissionRepository, useValue: permissionRepoMock },
        { provide: RolePermissionRepository, useValue: rolePermissionRepoMock },
      ],
    }).compile();

    service = moduleRef.get(PermissionService);
    jest.clearAllMocks();
  });

  // create permission
  it('should create a permission successfully', async () => {
    const dto = { name: 'READ_USER', description: 'allows reading user info' };

    permissionRepoMock.findByName.mockResolvedValue(null);
    permissionRepoMock.save.mockResolvedValue({ id: 1, ...dto });

    const result = await service.createPermission(dto);

    expect(permissionRepoMock.findByName).toHaveBeenCalledWith('READ_USER');
    expect(permissionRepoMock.save).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, ...dto });
  });

  it('should throw if permission name is missing', async () => {
    await expect(
      service.createPermission({ name: '', description: '' })
    ).rejects.toThrow(RpcException);
  });

  it('should throw if permission name already exists', async () => {
    permissionRepoMock.findByName.mockResolvedValue({ id: 1 });

    await expect(
      service.createPermission({ name: 'READ', description: '' })
    ).rejects.toThrow('Permissions name already exists');
  });

  // delete permission
  it('should delete permission and its relations', async () => {
    permissionRepoMock.findById.mockResolvedValue({ id: 1 });

    await service.deletePermission(1);

    expect(permissionRepoMock.findById).toHaveBeenCalledWith(1);
    expect(rolePermissionRepoMock.removePermissionFromRole).toHaveBeenCalledWith(1);
    expect(permissionRepoMock.delete).toHaveBeenCalledWith(1);
  });

  it('should throw when deleting non existing permission', async () => {
    permissionRepoMock.findById.mockResolvedValue(null);

    await expect(service.deletePermission(1))
      .rejects.toThrow('Permission not found');
  });

  // update permission
  it('should update permission successfully', async () => {
    const permission = { id: 1, name: 'READ', description: 'old' };

    permissionRepoMock.findById.mockResolvedValue(permission);
    permissionRepoMock.findByName.mockResolvedValue(null);
    permissionRepoMock.save.mockResolvedValue({ ...permission, name: 'READ_ALL' });

    const result = await service.updatePermission(1, { name: 'READ_ALL' });

    expect(result.name).toBe('READ_ALL');
  });

  it('should throw if updating non existing permission', async () => {
    permissionRepoMock.findById.mockResolvedValue(null);

    await expect(service.updatePermission(1, { name: 'X' }))
      .rejects.toThrow('Permission not found');
  });

  it('should throw if updating to a name that already exists', async () => {
    permissionRepoMock.findById.mockResolvedValue({ id: 1, name: 'READ' });
    permissionRepoMock.findByName.mockResolvedValue({ id: 2, name: 'READ_ALL' });

    await expect(service.updatePermission(1, { name: 'READ_ALL' }))
      .rejects.toThrow('Permission name already exists');
  });

  // get permission
  it('should return permission', async () => {
    permissionRepoMock.findById.mockResolvedValue({ id: 1, name: 'READ' });

    const result = await service.getPermission(1);

    expect(result.id).toBe(1);
  });

  it('should throw when permission not found', async () => {
    permissionRepoMock.findById.mockResolvedValue(null);

    await expect(service.getPermission(1))
      .rejects.toThrow('Permission not found');
  });
});
