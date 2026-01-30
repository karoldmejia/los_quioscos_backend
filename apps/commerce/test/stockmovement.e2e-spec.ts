import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { CommerceModule } from '../src/commerce.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { ProductCategory } from '../src/enums/product-category.enum';
import { UnitMeasure } from '../src/enums/unit-measure.enum';
import { StockMovementType } from '../src/enums/stock-movement-type.enum';

dotenv.config({ path: '.env' });

describe('StockMovement Microservice (TCP) - e2e', () => {
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
        const tables = ['stock_movements', 'batches', 'products'];

        for (const tableName of tables) {
            try {
                await dataSource.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
            } catch (error) {
                console.log(`Table ${tableName} not found, skipping truncation`);
            }
        }

        const product = await client.send({ cmd: 'create_product' }, createProductDto).toPromise();
        createdProductId = product.id;

        const createBatchDto = {
            productId: createdProductId,
            productionDate: new Date().toISOString(),
            initialQuantity: 100
        };
        const batch = await client.send({ cmd: 'create_batch' }, createBatchDto).toPromise();
        createdBatchId = batch.id;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await client.close();
        await app.close();
    });

    describe('Basic Movement Operations', () => {
        it('create_movement - should create a movement record', async () => {
            const createDto = {
                batchId: createdBatchId,
                type: StockMovementType.ADJUSTMENT,
                delta: -10
            };

            const movement = await client
                .send({ cmd: 'create_movement' }, createDto)
                .toPromise();

            expect(movement).toBeDefined();
            expect(movement.batchId).toBe(createdBatchId);
            expect(movement.type).toBe(StockMovementType.ADJUSTMENT);
            expect(movement.delta).toBe(-10);
        });

        it('create_movement - should throw for zero delta', async () => {
            const createDto = {
                batchId: createdBatchId,
                type: StockMovementType.ADJUSTMENT,
                delta: 0
            };

            try {
                await client.send({ cmd: 'create_movement' }, createDto).toPromise();
                fail('Expected error for zero delta');
            } catch (err: any) {
                expect(err.message).toContain('Delta cannot be zero');
            }
        });

        it('apply_movement - should apply movement and update batch', async () => {
            const createDto = {
                batchId: createdBatchId,
                type: StockMovementType.SALE,
                delta: -20
            };

            const result = await client
                .send({ cmd: 'apply_movement' }, createDto)
                .toPromise();

            expect(result.movement).toBeDefined();
            expect(result.batch).toBeDefined();
            expect(result.movement.delta).toBe(-20);
            expect(result.batch.currentQuantity).toBe(80);
        });

        it('apply_movement - should throw for insufficient stock', async () => {
            const createDto = {
                batchId: createdBatchId,
                type: StockMovementType.SALE,
                delta: -150
            };

            try {
                await client.send({ cmd: 'apply_movement' }, createDto).toPromise();
                fail('Expected error for insufficient stock');
            } catch (err: any) {
                expect(err.message).toContain('Insufficient stock');
            }
        });
    });

    describe('Stock Adjustment Operations', () => {
        it('adjust_stock - should adjust stock positively', async () => {
            const payload = { batchId: createdBatchId, delta: 30 };

            const result = await client
                .send({ cmd: 'adjust_stock' }, payload)
                .toPromise();

            expect(result.movement.type).toBe(StockMovementType.ADJUSTMENT);
            expect(result.movement.delta).toBe(30);
            expect(result.batch.currentQuantity).toBe(130);
        });

        it('adjust_stock - should adjust stock negatively', async () => {
            const payload = { batchId: createdBatchId, delta: -40 };

            const result = await client
                .send({ cmd: 'adjust_stock' }, payload)
                .toPromise();

            expect(result.movement.delta).toBe(-40);
            expect(result.batch.currentQuantity).toBe(60);
        });

        it('adjust_stock - should throw for zero delta', async () => {
            const payload = { batchId: createdBatchId, delta: 0 };

            try {
                await client.send({ cmd: 'adjust_stock' }, payload).toPromise();
                fail('Expected error for zero delta');
            } catch (err: any) {
                expect(err.message).toContain('Delta cannot be zero');
            }
        });

        it('restock_batch - should restock batch', async () => {
            const payload = { batchId: createdBatchId, quantity: 50 };

            const result = await client
                .send({ cmd: 'restock_batch' }, payload)
                .toPromise();

            expect(result.movement.type).toBe(StockMovementType.RESTOCK);
            expect(result.movement.delta).toBe(50);
            expect(result.batch.currentQuantity).toBe(150);
        });

        it('restock_batch - should throw for zero quantity', async () => {
            const payload = { batchId: createdBatchId, quantity: 0 };

            try {
                await client.send({ cmd: 'restock_batch' }, payload).toPromise();
                fail('Expected error for zero quantity');
            } catch (err: any) {
                expect(err.message).toContain('Restock quantity must be greater than 0');
            }
        });

        it('restock_batch - should throw for expired batch', async () => {
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 10);

            const expiredBatchDto = {
                productId: createdProductId,
                productionDate: expiredDate.toISOString(),
                initialQuantity: 50
            };
            const expiredBatch = await client.send({ cmd: 'create_batch' }, expiredBatchDto).toPromise();

            const payload = { batchId: expiredBatch.id, quantity: 10 };

            try {
                await client.send({ cmd: 'restock_batch' }, payload).toPromise();
                throw new Error('Expected error for expired batch');
            } catch (err: any) {
                expect(err.message || err).toContain('Cannot restock expired batch');
            }

        });
    });

    describe('Stock Consumption Operations', () => {
        it('consume_stock_fefo - should consume stock from multiple batches', async () => {
            const secondBatchDto = {
                productId: createdProductId,
                productionDate: new Date().toISOString(),
                initialQuantity: 50
            };
            const secondBatch = await client.send({ cmd: 'create_batch' }, secondBatchDto).toPromise();

            const payload = {
                productId: createdProductId,
                requestedQuantity: 120,
                orderId: 'ORDER-123'
            };

            const result = await client
                .send({ cmd: 'consume_stock_fefo' }, payload)
                .toPromise();

            expect(result.success).toBe(true);
            expect(result.consumedQuantity).toBe(120);
            expect(result.remainingQuantity).toBe(0);
            expect(result.batchesConsumed.length).toBeGreaterThan(0);
            expect(result.movements.length).toBeGreaterThan(0);
        });

        it('consume_stock_fefo - should handle partial consumption', async () => {
            const payload = {
                productId: createdProductId,
                requestedQuantity: 50,
                orderId: 'ORDER-456'
            };

            const result = await client
                .send({ cmd: 'consume_stock_fefo' }, payload)
                .toPromise();

            expect(result.success).toBe(true);
            expect(result.consumedQuantity).toBe(50);

            const batch = await client.send({ cmd: 'get_batch' }, createdBatchId).toPromise();
            expect(batch.currentQuantity).toBe(50);
        });

        it('consume_stock_fefo - should throw for insufficient stock', async () => {
            const payload = {
                productId: createdProductId,
                requestedQuantity: 200,
                orderId: 'ORDER-789'
            };

            try {
                await client.send({ cmd: 'consume_stock_fefo' }, payload).toPromise();
                fail('Expected error for insufficient stock');
            } catch (err: any) {
                expect(err.message).toContain('Insufficient stock');
            }
        });

        it('consume_stock_fefo - should throw for zero quantity', async () => {
            const payload = {
                productId: createdProductId,
                requestedQuantity: 0,
                orderId: 'ORDER-999'
            };

            try {
                await client.send({ cmd: 'consume_stock_fefo' }, payload).toPromise();
                fail('Expected error for zero quantity');
            } catch (err: any) {
                expect(err.message).toContain('Requested quantity must be greater than 0');
            }
        });

        it('register_expired_removal - should register expired removal', async () => {
            const expiredDate = new Date();
            expiredDate.setDate(expiredDate.getDate() - 10);

            const expiredBatchDto = {
                productId: createdProductId,
                productionDate: expiredDate.toISOString(),
                initialQuantity: 50
            };
            const expiredBatch = await client.send({ cmd: 'create_batch' }, expiredBatchDto).toPromise();

            const result = await client.send({ cmd: 'register_expired_removal' }, expiredBatch.id).toPromise();

            expect(result.movement.type).toBe(StockMovementType.EXPIRED_REMOVAL);
            expect(result.batch.currentQuantity).toBe(0);
            expect(result.batch.status).toBe('EXPIRED');
        });
    });

    describe('Movement Retrieval Operations', () => {
        beforeEach(async () => {
            const createDto = {
                batchId: createdBatchId,
                type: StockMovementType.SALE,
                delta: -30
            };
            await client.send({ cmd: 'apply_movement' }, createDto).toPromise();
        });

        it('get_movements_by_batch - should return movements for batch', async () => {
            const movements = await client
                .send({ cmd: 'get_movements_by_batch' }, createdBatchId)
                .toPromise();

            expect(Array.isArray(movements)).toBe(true);
            expect(movements.length).toBeGreaterThan(0);
            expect(movements[0].batchId).toBe(createdBatchId);
        });

        it('get_movements_by_product - should return movements for product', async () => {
            const movements = await client
                .send({ cmd: 'get_movements_by_product' }, createdProductId)
                .toPromise();

            expect(Array.isArray(movements)).toBe(true);
            expect(movements.length).toBeGreaterThan(0);
        });

        it('get_product_movement_summary - should return product summary', async () => {
            const payload = { productId: createdProductId, days: 7 };

            const summary = await client
                .send({ cmd: 'get_product_movement_summary' }, payload)
                .toPromise();

            expect(summary.summary).toBeDefined();
            expect(summary.totals).toBeDefined();
            expect(summary.totals.in).toBe(100);
            expect(summary.totals.out).toBe(30);
            expect(summary.totals.net).toBe(70);
        });

        it('get_batch_movement_history - should return batch history', async () => {
            const payload = { batchId: createdBatchId, days: 7 };

            const history = await client
                .send({ cmd: 'get_batch_movement_history' }, payload)
                .toPromise();

            expect(history.movements).toBeDefined();
            expect(history.summary).toBeDefined();
            expect(Array.isArray(history.movements)).toBe(true);
            expect(history.movements[0].batchId).toBe(createdBatchId);
        });

        it('verify_stock_integrity - should verify integrity', async () => {
            const integrity = await client
                .send({ cmd: 'verify_stock_integrity' }, createdBatchId)
                .toPromise();

            expect(integrity).toBe(true);
        });

        it('verify_stock_integrity - should detect integrity issue', async () => {
            const manualDto = {
                batchId: createdBatchId,
                type: StockMovementType.MANUAL_OUT,
                delta: -50
            };
            await client.send({ cmd: 'apply_movement' }, manualDto).toPromise();

            const integrity = await client.send({ cmd: 'verify_stock_integrity' }, createdBatchId).toPromise();
            expect(integrity).toBe(true);
        });
    });

    describe('Multiple Batch Operations', () => {
        let secondBatchId: string;

        beforeEach(async () => {
            const secondBatchDto = {
                productId: createdProductId,
                productionDate: new Date().toISOString(),
                initialQuantity: 75
            };
            const secondBatch = await client.send({ cmd: 'create_batch' }, secondBatchDto).toPromise();
            secondBatchId = secondBatch.id;
        });

        it('should handle movements across multiple batches', async () => {
            const payload1 = { batchId: createdBatchId, delta: -25 };
            await client.send({ cmd: 'adjust_stock' }, payload1).toPromise();

            const payload2 = { batchId: secondBatchId, delta: -30 };
            await client.send({ cmd: 'adjust_stock' }, payload2).toPromise();

            const batch1 = await client.send({ cmd: 'get_batch' }, createdBatchId).toPromise();
            const batch2 = await client.send({ cmd: 'get_batch' }, secondBatchId).toPromise();

            expect(batch1.currentQuantity).toBe(75);
            expect(batch2.currentQuantity).toBe(45);

            const productMovements = await client
                .send({ cmd: 'get_movements_by_product' }, createdProductId)
                .toPromise();

            expect(productMovements.length).toBe(4);
        });
    });
});