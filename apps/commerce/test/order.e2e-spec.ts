import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { CommerceModule } from '../src/commerce.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { ProductCategory } from '../src/enums/product-category.enum';
import { UnitMeasure } from '../src/enums/unit-measure.enum';
import { OrderStatus } from '../src/enums/order-status.enum';
import { randomUUID } from 'crypto';
import { ReservationStatus } from '../src/enums/reservation-status.enum';
import { CheckoutSessionStatus } from '../src/enums/checkout-session-status.enum';

dotenv.config({ path: '.env' });

describe('Order Microservice (TCP) - e2e', () => {
    let app: INestMicroservice;
    let client: ClientProxy;
    let dataSource: DataSource;

    const MOCKED_KIOSK_USER_ID = 123;
    const TEST_USER_ID = randomUUID();
    const TEST_CHECKOUT_SESSION_ID = randomUUID();

    let createdProductId: string;
    let createdBatchId: string;
    let createdOrderId: string;
    let createdOrderItemId: string;

    const createProductDto = {
        kioskUserId: MOCKED_KIOSK_USER_ID,
        name: 'Test Product for Order',
        category: ProductCategory.VEGETABLES,
        unitMeasure: UnitMeasure.KG,
        price: '19.99',
        durationDays: 7,
        description: 'Test product for order creation',
        photos: ['photo1.jpg']
    };

    const createBatchDto = {
        productId: '',
        productionDate: new Date().toISOString(),
        initialQuantity: 100
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
            options: { host: '127.0.0.1', port: 3005 },
        });

        await app.listen();

        client = ClientProxyFactory.create({
            transport: Transport.TCP,
            options: { host: '127.0.0.1', port: 3005 },
        });
        await client.connect();

        dataSource = moduleFixture.get(DataSource);
    });

    beforeEach(async () => {
        const tables = [
            'batch_reservations',
            'order_items',
            'orders',
            'checkout_sessions',
            'cart_items',
            'carts',
            'batches',
            'stock_movements',
            'products'
        ];

        for (const tableName of tables) {
            try {
                await dataSource.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
            } catch (error) {
                console.log(`Table ${tableName} not found, skipping truncation`);
            }
        }
        await dataSource.query(`
            INSERT INTO checkout_sessions (
                id, 
                "userId", 
                status, 
                "totalAmount", 
                "createdAt", 
                "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $5)
        `, [
            TEST_CHECKOUT_SESSION_ID,
            TEST_USER_ID,
            CheckoutSessionStatus.PENDING,
            0,
            new Date()
        ]);

        const product = await client.send({ cmd: 'create_product' }, createProductDto).toPromise();
        createdProductId = product.id;

        createBatchDto.productId = createdProductId;
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

    // Tests for orders creations with reservations

    describe('Order creation with reservations', () => {
        it('create_order_with_items_and_reserve_stock - should create order and reserve stock', async () => {
            const orderData = {

                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBeDefined();
            expect(order.userId).toBe(TEST_USER_ID);
            expect(order.kioskUserId).toBe(MOCKED_KIOSK_USER_ID);
            expect(order.status).toBe(OrderStatus.PENDING_KIOSK_CONFIRMATION);
            expect(order.items).toBeDefined();
            expect(order.items.length).toBe(1);
            expect(order.items[0].productId).toBe(createdProductId);
            expect(order.items[0].quantity).toBe(10);

            createdOrderId = order.id;
            createdOrderItemId = order.items[0].id;

            const reservations = await dataSource.query(
                `SELECT * FROM batch_reservations WHERE "orderId" = $1`,
                [createdOrderId]
            );
            expect(reservations.length).toBeGreaterThan(0);
            expect(reservations[0].status).toBe(ReservationStatus.ACTIVE);

            const batch = await dataSource.query(
                `SELECT "reservedQuantity" FROM batches WHERE id = $1`,
                [createdBatchId]
            );
            expect(parseInt(batch[0].reservedQuantity)).toBeGreaterThan(0);
        });

        it('create_order_with_items_and_reserve_stock - should fail with insufficient stock', async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '9999.00'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 150,
                unitPrice: '19.99',
                totalPrice: '2998.50'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            try {
                await client
                    .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                    .toPromise();
                fail('Expected error for insufficient stock');
            } catch (err: any) {
                expect(err.message).toContain('Insufficient stock');
            }

            const orders = await dataSource.query(
                `SELECT * FROM orders WHERE "userId" = $1`,
                [TEST_USER_ID]
            );
            expect(orders.length).toBe(0);
        });

it('create_order_with_items_and_reserve_stock - should fail with invalid product', async () => {
    const invalidProductId = randomUUID();
        
    const orderData = {
        userId: TEST_USER_ID,
        checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
        kioskUserId: MOCKED_KIOSK_USER_ID,
        totalPrice: '199.90'
    };

    const itemsData = [{
        productId: invalidProductId,
        productSnapshot: {
            name: 'Invalid Product',
            price: '19.99'
        },
        quantity: 10,
        unitPrice: '19.99',
        totalPrice: '199.90'
    }];

    const payload = {
        orderData,
        itemsData,
        expiresInMinutes: 15
    };

    try {
        await client
            .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
            .toPromise();
        fail('Expected error for invalid product');
    } catch (err: any) {
        expect(err.message).toContain('Failed to create order and reserve stock');
    }
});
    });

    // Tests for orders acceptance

    describe('Order acceptance', () => {
        beforeEach(async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            createdOrderId = order.id;
        });

        it('accept_order - should accept pending order', async () => {
            const order = await client
                .send({ cmd: 'accept_order' }, createdOrderId)
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBe(createdOrderId);
            expect(order.status).toBe(OrderStatus.ACCEPTED);

            const reservations = await dataSource.query(
                `SELECT "expiresAt" FROM batch_reservations WHERE "orderId" = $1`,
                [createdOrderId]
            );
            expect(reservations.length).toBeGreaterThan(0);

            const originalExpiration = new Date();
            originalExpiration.setMinutes(originalExpiration.getMinutes() + 15);

            const reservationExpiration = new Date(reservations[0].expiresAt);
            expect(reservationExpiration.getTime()).toBeGreaterThan(originalExpiration.getTime());
        });

        it('accept_order - should fail for already accepted order', async () => {
            await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();

            try {
                await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();
                fail('Expected error for already accepted order');
            } catch (err: any) {
                expect(err.message).toContain('cannot be accepted in status');
            }
        });

        it('accept_order - should fail for non-existent order', async () => {
            const nonExistentOrderId = randomUUID();

            try {
                await client.send({ cmd: 'accept_order' }, nonExistentOrderId).toPromise();
                fail('Expected error for non-existent order');
            } catch (err: any) {
                expect(err.message).toContain('Order not found');
            }
        });
    });

    // Tests for orders rejection

    describe('Order rejection', () => {
        beforeEach(async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            createdOrderId = order.id;
        });

        it('reject_order - should reject pending order', async () => {
            const order = await client
                .send({ cmd: 'reject_order' }, createdOrderId)
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBe(createdOrderId);
            expect(order.status).toBe(OrderStatus.REJECTED);

            const reservations = await dataSource.query(
                `SELECT status FROM batch_reservations WHERE "orderId" = $1`,
                [createdOrderId]
            );
            expect(reservations.length).toBeGreaterThan(0);
            expect(reservations[0].status).toBe(ReservationStatus.RELEASED);

            const batch = await dataSource.query(
                `SELECT "reservedQuantity" FROM batches WHERE id = $1`,
                [createdBatchId]
            );
            expect(parseInt(batch[0].reservedQuantity)).toBe(0);
        });

        it('reject_order - should fail for already processed order', async () => {
            await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();

            try {
                await client.send({ cmd: 'reject_order' }, createdOrderId).toPromise();
                fail('Expected error for already accepted order');
            } catch (err: any) {
                expect(err.message).toContain('cannot be rejected in status');
            }
        });
    });

    // Tests for marking as ready for payment

    describe('Mark order ready for payment', () => {
        beforeEach(async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            createdOrderId = order.id;

            await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();
        });

        it('mark_order_ready_for_payment - should mark accepted order as ready for payment', async () => {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 20);

            await client
                .send({ cmd: 'mark_order_ready_for_payment' }, {
                    orderId: createdOrderId,
                    expiresAt: expiresAt.toISOString()
                })
                .toPromise();

            const order = await dataSource.query(
                `SELECT status, "expiresAt" FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.READY_FOR_PAYMENT);
            expect(new Date(order[0].expiresAt).getTime()).toBeCloseTo(expiresAt.getTime(), -1000);
        });

        it('mark_order_ready_for_payment - should fail for non-accepted order', async () => {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 20);

            try {
                await client
                    .send({ cmd: 'mark_order_ready_for_payment' }, {
                        orderId: createdOrderId,
                        expiresAt: expiresAt.toISOString()
                    })
                    .toPromise();
            } catch (err: any) {
                expect(err.message).toContain('must be ACCEPTED');
            }
        });
    });

    // Tests for mark as paid

    describe('Mark order as paid', () => {
        beforeEach(async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            createdOrderId = order.id;

            await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();

            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 20);
            await client.send({ cmd: 'mark_order_ready_for_payment' }, {
                orderId: createdOrderId,
                expiresAt: expiresAt.toISOString()
            }).toPromise();
        });

        it('mark_order_as_paid - should mark order as paid and consume reservations', async () => {
            const paymentInfo = {
                transactionId: randomUUID(),
                method: 'credit_card',
                amount: '199.90'
            };

            const order = await client
                .send({ cmd: 'mark_order_as_paid' }, {
                    orderId: createdOrderId,
                    paymentInfo
                })
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBe(createdOrderId);
            expect(order.status).toBe(OrderStatus.PAID);
            expect(order.paidAt).toBeDefined();
            expect(order.paymentInfo).toEqual(paymentInfo);

            const reservations = await dataSource.query(
                `SELECT status FROM batch_reservations WHERE "orderId" = $1`,
                [createdOrderId]
            );
            expect(reservations.length).toBeGreaterThan(0);
            expect(reservations[0].status).toBe(ReservationStatus.CONSUMED);

            const batch = await dataSource.query(
                `SELECT "currentQuantity", "reservedQuantity" FROM batches WHERE id = $1`,
                [createdBatchId]
            );
            expect(parseInt(batch[0].currentQuantity)).toBe(90); // 100 - 10
            expect(parseInt(batch[0].reservedQuantity)).toBe(0);
        });

        it('mark_order_as_paid - should work from ACCEPTED status directly', async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '99.95'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 5,
                unitPrice: '19.99',
                totalPrice: '99.95'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const newOrder = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            await client.send({ cmd: 'accept_order' }, newOrder.id).toPromise();

            const paidOrder = await client
                .send({ cmd: 'mark_order_as_paid' }, {
                    orderId: newOrder.id,
                    paymentInfo: { transactionId: randomUUID() }
                })
                .toPromise();

            expect(paidOrder.status).toBe(OrderStatus.PAID);
        });
    });

    // Tests for cancellations

    describe('Order cancellations', () => {
        beforeEach(async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            createdOrderId = order.id;
        });

        it('order_cancellation_requested - should cancel pending order and release reservations', async () => {
            await client
                .send({ cmd: 'order_cancellation_requested' }, createdOrderId)
                .toPromise();

            const order = await dataSource.query(
                `SELECT status FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.CANCELLED);

            const reservations = await dataSource.query(
                `SELECT status FROM batch_reservations WHERE "orderId" = $1`,
                [createdOrderId]
            );
            expect(reservations.length).toBeGreaterThan(0);
            expect(reservations[0].status).toBe(ReservationStatus.RELEASED);
        });

        it('order_cancellation_requested - should mark paid order as cancel requested', async () => {
            await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();
            await client.send({ cmd: 'mark_order_as_paid' }, {
                orderId: createdOrderId,
                paymentInfo: { transactionId: randomUUID() }
            }).toPromise();

            await client
                .send({ cmd: 'order_cancellation_requested' }, createdOrderId)
                .toPromise();

            const order = await dataSource.query(
                `SELECT status FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.CANCEL_REQUESTED);
        });

        it('cancel_order_final - should cancel order after cancel requested', async () => {
            await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();
            await client.send({ cmd: 'mark_order_as_paid' }, {
                orderId: createdOrderId,
                paymentInfo: { transactionId: randomUUID() }
            }).toPromise();
            await client.send({ cmd: 'order_cancellation_requested' }, createdOrderId).toPromise();

            await client
                .send({ cmd: 'cancel_order_final' }, createdOrderId)
                .toPromise();

            const order = await dataSource.query(
                `SELECT status FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.CANCELLED);
        });
    });

    // Tests for auto-rect for timeout

    describe('Auto reject timeout', () => {
        beforeEach(async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            createdOrderId = order.id;
        });

        it('auto_reject_order_timeout - should auto-reject pending order', async () => {
            await client
                .send({ cmd: 'auto_reject_order_timeout' }, createdOrderId)
                .toPromise();

            const order = await dataSource.query(
                `SELECT status FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.AUTO_REJECTED_TIMEOUT);

            const reservations = await dataSource.query(
                `SELECT status FROM batch_reservations WHERE "orderId" = $1`,
                [createdOrderId]
            );
            expect(reservations.length).toBeGreaterThan(0);
            expect(reservations[0].status).toBe(ReservationStatus.RELEASED);
        });

        it('auto_reject_order_timeout - should ignore non-pending orders', async () => {
            await client.send({ cmd: 'accept_order' }, createdOrderId).toPromise();

            await client
                .send({ cmd: 'auto_reject_order_timeout' }, createdOrderId)
                .toPromise();

            const order = await dataSource.query(
                `SELECT status FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.ACCEPTED);
        });
    });

    // Tests for finders

    describe('Order finders', () => {
        beforeEach(async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '199.90'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 10,
                unitPrice: '19.99',
                totalPrice: '199.90'
            }];

            const payload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload)
                .toPromise();

            createdOrderId = order.id;
            createdOrderItemId = order.items[0].id;
        });

        it('get_order_by_id - should return order by id', async () => {
            const order = await client
                .send({ cmd: 'get_order_by_id' }, createdOrderId)
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBe(createdOrderId);
            expect(order.userId).toBe(TEST_USER_ID);
            expect(order.status).toBe(OrderStatus.PENDING_KIOSK_CONFIRMATION);
        });

        it('get_order_by_id - should return null for non-existent order', async () => {
            const nonExistentOrderId = randomUUID();

            const order = await client
                .send({ cmd: 'get_order_by_id' }, nonExistentOrderId)
                .toPromise();

            expect(order).toBeNull();
        });

        it('get_order_with_items - should return order with items', async () => {
            const order = await client
                .send({ cmd: 'get_order_with_items' }, createdOrderId)
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBe(createdOrderId);
            expect(order.items).toBeDefined();
            expect(order.items.length).toBe(1);
            expect(order.items[0].id).toBe(createdOrderItemId);
            expect(order.items[0].productId).toBe(createdProductId);
            expect(order.items[0].quantity).toBe(10);
        });

        it('get_order_items - should return order items', async () => {
            const items = await client
                .send({ cmd: 'get_order_items' }, createdOrderId)
                .toPromise();

            expect(Array.isArray(items)).toBe(true);
            expect(items.length).toBe(1);
            expect(items[0].id).toBe(createdOrderItemId);
            expect(items[0].orderId).toBe(createdOrderId);
            expect(items[0].productId).toBe(createdProductId);
        });
    });

    // Tests for complete flow integration

    describe('Integration flow scenarios', () => {
        it('should handle complete order flow: create -> accept -> pay', async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '99.95'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 5,
                unitPrice: '19.99',
                totalPrice: '99.95'
            }];

            const createPayload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, createPayload)
                .toPromise();

            expect(order.status).toBe(OrderStatus.PENDING_KIOSK_CONFIRMATION);

            const acceptedOrder = await client
                .send({ cmd: 'accept_order' }, order.id)
                .toPromise();

            expect(acceptedOrder.status).toBe(OrderStatus.ACCEPTED);

            const reservationsBefore = await dataSource.query(
                `SELECT status, quantity FROM batch_reservations WHERE "orderId" = $1`,
                [order.id]
            );
            expect(reservationsBefore.length).toBeGreaterThan(0);
            expect(reservationsBefore[0].status).toBe(ReservationStatus.ACTIVE);

            const paymentInfo = {
                transactionId: randomUUID(),
                method: 'credit_card',
                amount: '99.95'
            };

            const paidOrder = await client
                .send({ cmd: 'mark_order_as_paid' }, {
                    orderId: order.id,
                    paymentInfo
                })
                .toPromise();

            expect(paidOrder.status).toBe(OrderStatus.PAID);
            expect(paidOrder.paidAt).toBeDefined();

            const reservationsAfter = await dataSource.query(
                `SELECT status FROM batch_reservations WHERE "orderId" = $1`,
                [order.id]
            );
            expect(reservationsAfter[0].status).toBe(ReservationStatus.CONSUMED);

            const batch = await dataSource.query(
                `SELECT "currentQuantity", "reservedQuantity" FROM batches WHERE id = $1`,
                [createdBatchId]
            );
            expect(parseInt(batch[0].currentQuantity)).toBe(95);
            expect(parseInt(batch[0].reservedQuantity)).toBe(0);
        });

        it('should handle order cancellation flow', async () => {
            const orderData = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '99.95'
            };

            const itemsData = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 5,
                unitPrice: '19.99',
                totalPrice: '99.95'
            }];

            const createPayload = {
                orderData,
                itemsData,
                expiresInMinutes: 15
            };

            const order = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, createPayload)
                .toPromise();

            await client
                .send({ cmd: 'order_cancellation_requested' }, order.id)
                .toPromise();

            const cancelledOrder = await client
                .send({ cmd: 'get_order_by_id' }, order.id)
                .toPromise();

            expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);

            const reservations = await dataSource.query(
                `SELECT status FROM batch_reservations WHERE "orderId" = $1`,
                [order.id]
            );
            expect(reservations[0].status).toBe(ReservationStatus.RELEASED);

            const batch = await dataSource.query(
                `SELECT "currentQuantity", "reservedQuantity" FROM batches WHERE id = $1`,
                [createdBatchId]
            );
            expect(parseInt(batch[0].currentQuantity)).toBe(100);
            expect(parseInt(batch[0].reservedQuantity)).toBe(0);
        });

        it('should handle multiple orders with same product', async () => {
            const order1Data = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '99.95'
            };

            const items1Data = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 50,
                unitPrice: '19.99',
                totalPrice: '999.50'
            }];

            const payload1 = {
                orderData: order1Data,
                itemsData: items1Data,
                expiresInMinutes: 15
            };

            const order1 = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload1)
                .toPromise();

            const order2Data = {
                userId: TEST_USER_ID,
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                totalPrice: '999.50'
            };

            const items2Data = [{
                productId: createdProductId,
                productSnapshot: {
                    name: 'Test Product',
                    price: '19.99'
                },
                quantity: 60,
                unitPrice: '19.99',
                totalPrice: '1199.40'
            }];

            const payload2 = {
                orderData: order2Data,
                itemsData: items2Data,
                expiresInMinutes: 15
            };

            try {
                await client
                    .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload2)
                    .toPromise();
                fail('Expected error for insufficient stock');
            } catch (err: any) {
                expect(err.message).toContain('Insufficient stock');
            }

            await client
                .send({ cmd: 'order_cancellation_requested' }, order1.id)
                .toPromise();

            const order2 = await client
                .send({ cmd: 'create_order_with_items_and_reserve_stock' }, payload2)
                .toPromise();

            expect(order2).toBeDefined();
            expect(order2.items[0].quantity).toBe(60);
        });
    });
});