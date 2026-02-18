import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { CommerceModule } from '../src/commerce.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { ProductCategory } from '../src/enums/product-category.enum';
import { UnitMeasure } from '../src/enums/unit-measure.enum';
import { BatchStatus } from '../src/enums/batch-status.enum';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env' });

describe('Batch Microservice (TCP) - e2e', () => {
    let app: INestMicroservice;
    let client: ClientProxy;
    let dataSource: DataSource;

    const MOCKED_KIOSK_USER_ID = 123;
    let createdProductId: string;
    let createdBatchId: string;

    const createProductDto = {
        kioskUserId: MOCKED_KIOSK_USER_ID,
        name: 'Test Product',
        category: ProductCategory.VEGETABLES,
        unitMeasure: UnitMeasure.KG,
        price: '19.99',
        durationDays: 7,
        description: 'Test product description',
        photos: ['photo1.jpg']
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [CommerceModule],
        })
            .overrideProvider('UserRepository')
            .useValue({})
            .compile();

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

        dataSource = moduleFixture.get(DataSource);
    });

    beforeEach(async () => {
        const tables = ['batches', 'stock_movements', 'products'];

        for (const tableName of tables) {
            try {
                await dataSource.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
            } catch (error) {
                console.log(`Table ${tableName} not found, skipping truncation`);
            }
        }

        const product = await client.send({ cmd: 'create_product' }, createProductDto).toPromise();
        createdProductId = product.id;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await client.close();
        await app.close();
    });

    describe('Batch CRUD Operations', () => {
        it('create_batch - should create a new batch', async () => {
            const createBatchDto = {
                productId: createdProductId,
                productionDate: new Date().toISOString(),
                initialQuantity: 100
            };

            const batch = await client
                .send({ cmd: 'create_batch' }, createBatchDto)
                .toPromise();

            expect(batch).toBeDefined();
            expect(batch.id).toBeDefined();
            expect(batch.productId).toBe(createdProductId);
            expect(batch.initialQuantity).toBe(100);
            expect(batch.currentQuantity).toBe(100);
            expect(batch.status).toBe(BatchStatus.ACTIVE);
            expect(batch.expirationDate).toBeDefined();

            createdBatchId = batch.id;
        });

        it('create_batch - should throw for invalid initial quantity', async () => {
            const invalidBatchDto = {
                productId: createdProductId,
                productionDate: new Date().toISOString(),
                initialQuantity: 0
            };

            try {
                await client.send({ cmd: 'create_batch' }, invalidBatchDto).toPromise();
                fail('Expected error for invalid initial quantity');
            } catch (err: any) {
                expect(err.message).toContain('initialQuantity must be greater than 0');
            }
        });

        it('create_batch - should throw for future production date', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);

            const invalidBatchDto = {
                productId: createdProductId,
                productionDate: futureDate.toISOString(),
                initialQuantity: 100
            };

            try {
                await client.send({ cmd: 'create_batch' }, invalidBatchDto).toPromise();
                fail('Expected error for future production date');
            } catch (err: any) {
                expect(err.message).toContain('productionDate must be a valid date not in the future');
            }
        });

        it('create_batch - should throw for non-existent product', async () => {
            const invalidBatchDto = {
                productId: '00000000-0000-0000-0000-000000000000',
                productionDate: new Date().toISOString(),
                initialQuantity: 100
            };

            try {
                await client.send({ cmd: 'create_batch' }, invalidBatchDto).toPromise();
                throw new Error('Expected error for non-existent product');
            } catch (err: any) {
                expect(err.message || err).toContain('Product with ID');
            }
        });
    });

    describe('Batch Retrieval', () => {
        beforeEach(async () => {
            const createBatchDto = {
                productId: createdProductId,
                productionDate: new Date().toISOString(),
                initialQuantity: 50
            };
            const batch = await client.send({ cmd: 'create_batch' }, createBatchDto).toPromise();
            createdBatchId = batch.id;
        });

        it('get_batch - should return batch by id', async () => {
            const batch = await client
                .send({ cmd: 'get_batch' }, createdBatchId)
                .toPromise();

            expect(batch.id).toBe(createdBatchId);
            expect(batch.productId).toBe(createdProductId);
            expect(batch.currentQuantity).toBe(50);
        });

        it('get_batch - should return null for non-existent batch', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000';

            const result = await client.send({ cmd: 'get_batch' }, nonExistentId).toPromise();
            expect(result).toBeNull();
        });


        it('get_active_batches_by_product - should return active batches', async () => {
            const batches = await client
                .send({ cmd: 'get_active_batches_by_product' }, createdProductId)
                .toPromise();

            expect(Array.isArray(batches)).toBe(true);
            expect(batches.length).toBe(1);
            expect(batches[0].productId).toBe(createdProductId);
            expect(batches[0].status).toBe(BatchStatus.ACTIVE);
        });

        it('get_total_stock_by_product - should return total stock', async () => {
            const totalStock = await client
                .send({ cmd: 'get_total_stock_by_product' }, createdProductId)
                .toPromise();

            expect(totalStock).toBe(50);
        });

        it('get_product_stock_summary - should return summary', async () => {
            const summary = await client
                .send({ cmd: 'get_product_stock_summary' }, createdProductId)
                .toPromise();

            expect(summary.totalStock).toBe(50);
            expect(Array.isArray(summary.activeBatches)).toBe(true);
            expect(Array.isArray(summary.expiringSoon)).toBe(true);
            expect(summary.activeBatches.length).toBe(1);
        });
    });

    describe('Batch Updates', () => {
        beforeEach(async () => {
            const createBatchDto = {
                productId: createdProductId,
                productionDate: new Date().toISOString(),
                initialQuantity: 100
            };
            const batch = await client.send({ cmd: 'create_batch' }, createBatchDto).toPromise();
            createdBatchId = batch.id;
        });

        it('update_batch_quantity - should increase quantity', async () => {
            const payload = { batchId: createdBatchId, delta: 20 };

            const updatedBatch = await client
                .send({ cmd: 'update_batch_quantity' }, payload)
                .toPromise();

            expect(updatedBatch.currentQuantity).toBe(120);
        });

        it('update_batch_quantity - should decrease quantity', async () => {
            const payload = { batchId: createdBatchId, delta: -30 };

            const updatedBatch = await client
                .send({ cmd: 'update_batch_quantity' }, payload)
                .toPromise();

            expect(updatedBatch.currentQuantity).toBe(70);
        });

        it('update_batch_quantity - should throw for insufficient stock', async () => {
            const payload = { batchId: createdBatchId, delta: -150 };

            try {
                await client.send({ cmd: 'update_batch_quantity' }, payload).toPromise();
                fail('Expected error for insufficient stock');
            } catch (err: any) {
                expect(err.message).toContain('Insufficient stock');
            }
        });

        it('update_batch_quantity - should throw for zero delta', async () => {
            const payload = { batchId: createdBatchId, delta: 0 };

            try {
                await client.send({ cmd: 'update_batch_quantity' }, payload).toPromise();
                fail('Expected error for zero delta');
            } catch (err: any) {
                expect(err.message).toContain('Delta cannot be zero');
            }
        });

        it('mark_batch_as_depleted - should mark batch as depleted', async () => {
            const payload = { batchId: createdBatchId, reason: 'Test depletion' };

            const depletedBatch = await client
                .send({ cmd: 'mark_batch_as_depleted' }, payload)
                .toPromise();

            expect(depletedBatch.currentQuantity).toBe(0);
            expect(depletedBatch.status).toBe(BatchStatus.DEPLETED);
        });

        it('mark_batch_as_depleted - should throw for already depleted batch', async () => {
            const payload = { batchId: createdBatchId, reason: 'Test' };
            await client.send({ cmd: 'mark_batch_as_depleted' }, payload).toPromise();

            try {
                await client.send({ cmd: 'mark_batch_as_depleted' }, payload).toPromise();
                fail('Expected error for already depleted batch');
            } catch (err: any) {
                expect(err.message).toContain('Batch is already depleted');
            }
        });

        it('mark_product_as_out_of_stock - should mark all batches as out of stock', async () => {
            const payload = { productId: createdProductId, reason: 'No stock' };

            await client
                .send({ cmd: 'mark_product_as_out_of_stock' }, payload)
                .toPromise();

            const batches = await client
                .send({ cmd: 'get_active_batches_by_product' }, createdProductId)
                .toPromise();

            expect(batches.length).toBe(0);
        });

        it('refresh_batch_status - should refresh batch status', async () => {
            const refreshedBatch = await client
                .send({ cmd: 'refresh_batch_status' }, createdBatchId)
                .toPromise();

            expect(refreshedBatch.status).toBe(BatchStatus.ACTIVE);
        });

        it('refresh_all_batch_statuses - should refresh all batches', async () => {
            await client
                .send({ cmd: 'refresh_all_batch_statuses' }, {})
                .toPromise();

            const batch = await client.send({ cmd: 'get_batch' }, createdBatchId).toPromise();
            expect(batch).toBeDefined();
        });
    });

    describe('Batch History and Deletion', () => {
        beforeEach(async () => {
            const createBatchDto = {
                productId: createdProductId,
                productionDate: new Date().toISOString(),
                initialQuantity: 50
            };
            const batch = await client.send({ cmd: 'create_batch' }, createBatchDto).toPromise();
            createdBatchId = batch.id;
        });

        it('get_batch_history - should return history by product', async () => {
            const payload = { productId: createdProductId };

            const history = await client
                .send({ cmd: 'get_batch_history' }, payload)
                .toPromise();

            expect(Array.isArray(history)).toBe(true);
            expect(history.length).toBe(1);
            expect(history[0].productId).toBe(createdProductId);
        });

        it('get_batch_history - should return history by batch', async () => {
            const payload = { batchId: createdBatchId };

            const history = await client
                .send({ cmd: 'get_batch_history' }, payload)
                .toPromise();

            expect(Array.isArray(history)).toBe(true);
            expect(history[0].id).toBe(createdBatchId);
        });

        it('delete_batch - should throw for active batch', async () => {
            const payload = { batchId: createdBatchId, reason: 'Should fail' };

            try {
                await client.send({ cmd: 'delete_batch' }, payload).toPromise();
                fail('Expected error for deleting active batch');
            } catch (err: any) {
                expect(err.message).toContain('Batch can only be deleted if DEPLETED or EXPIRED');
            }
        });
    });
});