import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: '.env' });

  const validRole = {
    name: 'Admin',
    description: 'Administrator role',
  };


describe('Roles Microservice (TCP) - e2e', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3003 },
    });
    await app.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3003 },
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  afterEach(async () => {
    const entities = app.get(DataSource).entityMetadatas;
    for (const entity of entities) {
        const repository = app.get(DataSource).getRepository(entity.name);
        await repository.query(
        `TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE`,
        );
    }
  });

  it('create_role - should create a new role', async () => {
    const role = await client.send({ cmd: 'create_role' }, validRole).toPromise();

    expect(role).toHaveProperty('id');
    expect(role).toHaveProperty('name', validRole.name);
    expect(role).toHaveProperty('description', validRole.description);
  });

  it('create_role - should fail if name already exists', async () => {
    await client.send({ cmd: 'create_role' }, validRole).toPromise();

    try {
      await client.send({ cmd: 'create_role' }, validRole).toPromise();
      fail('Expected create_role to throw');
    } catch (err: any) {
      expect(err.message).toContain('Role name already exists');
    }
  });

  it('get_role - should return a role by id', async () => {
    const role = await client.send({ cmd: 'create_role' }, validRole).toPromise();

    const fetchedRole = await client.send({ cmd: 'get_role' }, role.id).toPromise();

    expect(fetchedRole).toHaveProperty('id', role.id);
    expect(fetchedRole).toHaveProperty('name', validRole.name);
  });

  it('get_role - should fail if role does not exist', async () => {
    try {
      await client.send({ cmd: 'get_role' }, 999).toPromise();
      fail('Expected get_role to throw');
    } catch (err: any) {
      expect(err.message).toContain('Role not found');
    }
  });

  it('update_role - should update role successfully', async () => {
    const role = await client.send({ cmd: 'create_role' }, validRole).toPromise();

    const updatedRole = await client
      .send(
        { cmd: 'update_role' },
        { roleId: role.id, dto: { name: 'SuperAdmin', description: 'Super admin role' } },
      )
      .toPromise();

    expect(updatedRole).toHaveProperty('name', 'SuperAdmin');
    expect(updatedRole).toHaveProperty('description', 'Super admin role');
  });

  it('delete_role - should delete a role successfully', async () => {
    const role = await client.send({ cmd: 'create_role' }, validRole).toPromise();

    await client.send({ cmd: 'delete_role' }, role.id).toPromise();

    try {
      await client.send({ cmd: 'get_role' }, role.id).toPromise();
      fail('Expected get_role to throw');
    } catch (err: any) {
      expect(err.message).toContain('Role not found');
    }
  });

  it('assign_permission_to_role - should assign permission to role', async () => {
    const role = await client.send({ cmd: 'create_role' }, validRole).toPromise();
    const permission = await client.send({ cmd: 'create_permission' }, {name: 'READ_USER', description: 'Read users',}).toPromise();
    const assignment = await client
      .send({ cmd: 'assign_permission_to_role' }, { roleId: role.id, permId: permission.id})
      .toPromise();

    expect(assignment).toHaveProperty('role_id', role.id);
    expect(assignment).toHaveProperty('permission_id', permission.id);
  });

  it('remove_permission_from_role - should remove permission from role', async () => {
    const role = await client.send({ cmd: 'create_role' }, validRole).toPromise();
    const permission = await client.send({ cmd: 'create_permission' }, {name: 'READ_USER', description: 'Read users',}).toPromise();
    
    await client.send({ cmd: 'assign_permission_to_role' }, { roleId: role.id, permId: permission.id }).toPromise();

    const removed = await client
      .send({ cmd: 'remove_permission_from_role' }, { roleId: role.id, permId: permission.id })
      .toPromise();

    expect(removed).toBe(true);
  });
});
