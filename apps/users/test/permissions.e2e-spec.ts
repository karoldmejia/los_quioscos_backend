import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config({ path: '.env' });

const generatePermissionName = () => `PERM_${Date.now()}`;

describe('Permissions Microservice (TCP) - e2e', () => {
  let app: INestMicroservice;
  let client: ClientProxy;

  const validPermission = {
    name: generatePermissionName(),
    description: 'Permission to read users',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3004 },
    });
    await app.listen();

    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3004 },
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


  it('create_permission - should create a new permission', async () => {
    const permission = await client.send({ cmd: 'create_permission' }, validPermission).toPromise();

    expect(permission).toHaveProperty('id');
    expect(permission).toHaveProperty('name', validPermission.name);
    expect(permission).toHaveProperty('description', validPermission.description);
  });

  it('create_permission - should fail if name already exists', async () => {
    await client.send({ cmd: 'create_permission' }, validPermission).toPromise();

    try {
      await client.send({ cmd: 'create_permission' }, validPermission).toPromise();
      fail('Expected create_permission to throw');
    } catch (err: any) {
      expect(err.message).toContain('Permissions name already exists');
    }
  });

    it('get_permission - should return permission by id', async () => {
    const permissionName = generatePermissionName();
    const permission = await client
        .send({ cmd: 'create_permission' }, { name: permissionName, description: 'desc' })
        .toPromise();


    const fetchedPermission = await client.send({ cmd: 'get_permission' }, permission.id).toPromise();

    expect(fetchedPermission).toHaveProperty('id', permission.id);
    expect(fetchedPermission).toHaveProperty('name', permissionName);
    });


  it('get_permission - should fail if permission does not exist', async () => {
    try {
      await client.send({ cmd: 'get_permission' }, 999).toPromise();
      fail('Expected get_permission to throw');
    } catch (err: any) {
      expect(err.message).toContain('Permission not found');
    }
  });

  it('update_permission - should update permission successfully', async () => {
    const permission = await client.send({ cmd: 'create_permission' }, validPermission).toPromise();

    const updatedPermission = await client
      .send(
        { cmd: 'update_permission' },
        { permId: permission.id, dto: { name: 'WRITE_USERS', description: 'Write users permission' } },
      )
      .toPromise();

    expect(updatedPermission).toHaveProperty('name', 'WRITE_USERS');
    expect(updatedPermission).toHaveProperty('description', 'Write users permission');
  });

  it('delete_permission - should delete permission successfully', async () => {
    const permission = await client.send({ cmd: 'create_permission' }, validPermission).toPromise();

    await client.send({ cmd: 'delete_permission' }, permission.id).toPromise();

    try {
      await client.send({ cmd: 'get_permission' }, permission.id).toPromise();
      fail('Expected get_permission to throw');
    } catch (err: any) {
      expect(err.message).toContain('Permission not found');
    }
  });
});
