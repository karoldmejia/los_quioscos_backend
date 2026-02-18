import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { CommerceModule } from '../src/commerce.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { CheckoutSessionStatus } from '../src/enums/checkout-session-status.enum';
import { OrderStatus } from '../src/enums/order-status.enum';
import { CartStatus } from '../src/enums/cart-status.enum';
import { ProductCategory } from '../src/enums/product-category.enum';
import { UnitMeasure } from '../src/enums/unit-measure.enum';
import { ReservationStatus } from '../src/enums/reservation-status.enum';

dotenv.config({ path: '.env' });

describe('Checkout Microservice (TCP) - e2e', () => {
    let app: INestMicroservice;
    let client: ClientProxy;
    let dataSource: DataSource;

    const MOCKED_KIOSK_USER_ID = 123;
    const TEST_USER_ID = randomUUID();
    let TEST_CART_ID = randomUUID();
    let TEST_CHECKOUT_SESSION_ID = randomUUID();

    let createdProductId: string;
    let createdBatchId: string;
    let createdOrderId: string;
    let createdCartItemId: string;

    const createProductDto = {
        kioskUserId: MOCKED_KIOSK_USER_ID,
        name: 'Test Product for Checkout',
        category: ProductCategory.VEGETABLES,
        unitMeasure: UnitMeasure.KG,
        price: '19.99',
        durationDays: 7,
        description: 'Test product for checkout',
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
            options: { host: '127.0.0.1', port: 3006 },
        });

        await app.listen();

        client = ClientProxyFactory.create({
            transport: Transport.TCP,
            options: { host: '127.0.0.1', port: 3006 },
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
            }
        }

        // Create test product and batch
        const product = await client.send({ cmd: 'create_product' }, createProductDto).toPromise();
        createdProductId = product.id;

        createBatchDto.productId = createdProductId;
        const batch = await client.send({ cmd: 'create_batch' }, createBatchDto).toPromise();
        createdBatchId = batch.id;

        const cart = await client
            .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID)
            .toPromise();

        const realCartId = cart.id;

        await client.send({ cmd: 'add_item_to_cart' }, {
            userId: TEST_USER_ID,
            productId: createdProductId,
            quantity: 5
        }).toPromise();

        TEST_CART_ID = realCartId;

        const cartItems = await dataSource.query(
            `SELECT id FROM cart_items WHERE "cartId" = $1`,
            [TEST_CART_ID]
        );
        if (cartItems.length > 0) {
            createdCartItemId = cartItems[0].id;
        }
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await client.close();
        await app.close();
    });

    // Tests for create_checkout_from_cart
    describe('create_checkout_from_cart', () => {
        it('should create checkout session and orders from valid cart', async () => {
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID,
                shippingInfo: {
                    address: 'Test Address',
                    city: 'Test City'
                },
                contactInfo: {
                    email: 'test@example.com',
                    phone: '123456789'
                },
                paymentMethod: 'card'
            };

            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();

            expect(result).toBeDefined();
            expect(result.session).toBeDefined();
            expect(result.orders).toBeDefined();
            expect(result.orders.length).toBe(1);

            // Verify session
            expect(result.session.userId).toBe(TEST_USER_ID);
            expect(result.session.cartId).toBe(TEST_CART_ID);
            expect(result.session.status).toBe(CheckoutSessionStatus.PENDING);
            expect(parseFloat(result.session.totalAmount)).toBeGreaterThan(0);

            // Verify order
            const order = result.orders[0];
            expect(order.kioskUserId).toBe(MOCKED_KIOSK_USER_ID);
            expect(order.status).toBe(OrderStatus.PENDING_KIOSK_CONFIRMATION);
            expect(order.items).toBeDefined();
            expect(order.items.length).toBe(1);
            expect(order.items[0].productId).toBe(createdProductId);
            expect(order.items[0].quantity).toBe(5);

            // Verify cart status updated
            const cart = await dataSource.query(
                `SELECT status FROM carts WHERE id = $1`,
                [TEST_CART_ID]
            );
            expect(cart[0].status).toBe(CartStatus.CHECKOUT);

            // Verify stock reservations created
            const reservations = await dataSource.query(
                `SELECT * FROM batch_reservations WHERE "orderId" = $1`,
                [order.id]
            );
            expect(reservations.length).toBeGreaterThan(0);
            expect(reservations[0].status).toBe(ReservationStatus.ACTIVE);
        });

        it('should fail with non-existent cart', async () => {
            const invalidCartId = randomUUID();
            const dto = {
                userId: TEST_USER_ID,
                cartId: invalidCartId
            };

            try {
                await client
                    .send({ cmd: 'create_checkout_from_cart' }, dto)
                    .toPromise();
                fail('Expected error for non-existent cart');
            } catch (err: any) {
                expect(err.message).toContain('Cart not found');
            }
        });

        it('should fail with cart from different user', async () => {
            const differentUserId = randomUUID();
            const dto = {
                userId: differentUserId,
                cartId: TEST_CART_ID
            };

            try {
                await client
                    .send({ cmd: 'create_checkout_from_cart' }, dto)
                    .toPromise();
                fail('Expected error for cart belonging to different user');
            } catch (err: any) {
                expect(err.message).toContain('Cart does not belong to user');
            }
        });

        it('should fail with empty cart', async () => {
            const emptyCartUserId = randomUUID();
            const emptyCart = await client
                .send({ cmd: 'get_or_create_cart' }, emptyCartUserId)
                .toPromise();

            const dto = {
                userId: emptyCartUserId,
                cartId: emptyCart.id
            };

            try {
                await client
                    .send({ cmd: 'create_checkout_from_cart' }, dto)
                    .toPromise();
                fail('Expected error for empty cart');
            } catch (err: any) {
                expect(err.message).toContain('Cart is empty');
            }
        });

        it('should fail with inactive cart', async () => {
            // Mark cart as inactive
            await dataSource.query(
                `UPDATE carts SET status = $1 WHERE id = $2`,
                [CartStatus.ABANDONED, TEST_CART_ID]
            );

            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };

            try {
                await client
                    .send({ cmd: 'create_checkout_from_cart' }, dto)
                    .toPromise();
                fail('Expected error for inactive cart');
            } catch (err: any) {
                expect(err.message).toContain('Cart is not active');
            }
        });

        it('should create multiple orders for multiple kiosks', async () => {
            // Create second product with different kiosk
            const secondKioskUserId = 456;
            const secondProductDto = {
                ...createProductDto,
                kioskUserId: secondKioskUserId,
                name: 'Second Product'
            };
            const secondProduct = await client
                .send({ cmd: 'create_product' }, secondProductDto)
                .toPromise();

            await client.send({ cmd: 'create_batch' }, {
                productId: secondProduct.id,
                productionDate: new Date().toISOString(),
                initialQuantity: 100
            }).toPromise();

            await client.send({ cmd: 'add_item_to_cart' }, {
                userId: TEST_USER_ID,
                productId: secondProduct.id,
                quantity: 3
            }).toPromise();

            // Create checkout
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };

            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();

            expect(result.orders.length).toBe(2);

            const kioskUserIds = result.orders.map(o => o.kioskUserId);

            expect(kioskUserIds).toContain(MOCKED_KIOSK_USER_ID);
            expect(kioskUserIds).toContain(secondKioskUserId);
        });
    });

    // Tests for process_kiosk_response
    describe('process_kiosk_response', () => {
        beforeEach(async () => {
            // Create checkout session and order first
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };
            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();
            createdOrderId = result.orders[0].id;
            TEST_CHECKOUT_SESSION_ID = result.session.id;
        });

        it('should accept order when kiosk accepts', async () => {
            const payload = {
                orderId: createdOrderId,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                accept: true
            };

            const order = await client
                .send({ cmd: 'process_kiosk_response' }, payload)
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBe(createdOrderId);
            expect(order.status).toBe(OrderStatus.ACCEPTED);

            // Verify reservation expiration extended
            const reservations = await dataSource.query(
                `SELECT "expiresAt" FROM batch_reservations WHERE "orderId" = $1`,
                [createdOrderId]
            );
            expect(reservations.length).toBeGreaterThan(0);
        });

        it('should reject order when kiosk rejects', async () => {
            const payload = {
                orderId: createdOrderId,
                kioskUserId: MOCKED_KIOSK_USER_ID,
                accept: false
            };

            const order = await client
                .send({ cmd: 'process_kiosk_response' }, payload)
                .toPromise();

            expect(order).toBeDefined();
            expect(order.id).toBe(createdOrderId);
            expect(order.status).toBe(OrderStatus.REJECTED);

            // Verify reservations released
            const reservations = await dataSource.query(
                `SELECT * FROM batch_reservations WHERE "orderId" = $1 AND status = $2`,
                [createdOrderId, ReservationStatus.ACTIVE]
            );
            expect(reservations.length).toBe(0);

            // Verify stock released back
            const batch = await dataSource.query(
                `SELECT "reservedQuantity" FROM batches WHERE id = $1`,
                [createdBatchId]
            );
            expect(parseInt(batch[0].reservedQuantity)).toBe(0);
        });

        it('should fail with wrong kiosk user', async () => {
            const wrongKioskUserId = 999;
            const payload = {
                orderId: createdOrderId,
                kioskUserId: wrongKioskUserId,
                accept: true
            };

            try {
                await client
                    .send({ cmd: 'process_kiosk_response' }, payload)
                    .toPromise();
                fail('Expected error for wrong kiosk user');
            } catch (err: any) {
                expect(err.message).toContain('Order does not belong to kiosk');
            }
        });

        it('should fail for already processed order', async () => {
            // First accept
            await client
                .send({ cmd: 'process_kiosk_response' }, {
                    orderId: createdOrderId,
                    kioskUserId: MOCKED_KIOSK_USER_ID,
                    accept: true
                })
                .toPromise();

            // Try to accept again
            try {
                await client
                    .send({ cmd: 'process_kiosk_response' }, {
                        orderId: createdOrderId,
                        kioskUserId: MOCKED_KIOSK_USER_ID,
                        accept: true
                    })
                    .toPromise();
                fail('Expected error for already processed order');
            } catch (err: any) {
                expect(err.message).toBe('Order cannot be accepted in status: ACCEPTED');
            }
        });
    });

    // Tests for process_payment_success
    describe('process_payment_success', () => {
        beforeEach(async () => {
            // Create checkout session and accept order
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };
            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();
            createdOrderId = result.orders[0].id;
            TEST_CHECKOUT_SESSION_ID = result.session.id;

            await client
                .send({ cmd: 'process_kiosk_response' }, {
                    orderId: createdOrderId,
                    kioskUserId: MOCKED_KIOSK_USER_ID,
                    accept: true
                })
                .toPromise();
        });

        it('should process payment successfully when all orders accepted', async () => {
            const payload = {
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                paymentInfo: {
                    transactionId: 'txn_123456',
                    paymentMethod: 'card',
                    amount: '99.95'
                }
            };

            const session = await client
                .send({ cmd: 'process_payment_success' }, payload)
                .toPromise();

            expect(session).toBeDefined();
            expect(session.id).toBe(TEST_CHECKOUT_SESSION_ID);
            expect(session.status).toBe(CheckoutSessionStatus.COMPLETED);

            // Verify orders marked as paid
            const order = await dataSource.query(
                `SELECT status, "paidAt", "paymentInfo" FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.PAID);
            expect(order[0].paymentInfo).toBeDefined();
        });

        it('should fail if orders are not accepted', async () => {
            const newUserId = randomUUID();
            const newCart = await client
                .send({ cmd: 'get_or_create_cart' }, newUserId)
                .toPromise();

            await client.send({ cmd: 'add_item_to_cart' }, {
                userId: newUserId,
                productId: createdProductId,
                quantity: 2
            }).toPromise();

            const checkoutResult = await client
                .send({ cmd: 'create_checkout_from_cart' }, {
                    userId: newUserId,
                    cartId: newCart.id
                })
                .toPromise();

            const payload = {
                checkoutSessionId: checkoutResult.session.id,
                paymentInfo: {
                    transactionId: 'test_txn_456',
                    paymentMethod: 'card',
                    amount: '39.98'
                }
            };

            try {
                await client
                    .send({ cmd: 'process_payment_success' }, payload)
                    .toPromise();
                fail('Expected error for orders not accepted');
            } catch (err: any) {
                expect(err.message).toContain('not accepted');
            }
        });

        it('should fail for non-existent session', async () => {
            const payload = {
                checkoutSessionId: randomUUID(),
                paymentInfo: {}
            };

            try {
                await client
                    .send({ cmd: 'process_payment_success' }, payload)
                    .toPromise();
                fail('Expected error for non-existent session');
            } catch (err: any) {
                expect(err.message).toContain('Checkout session not found');
            }
        });
    });

    // Tests for cancel_checkout_session
    describe('cancel_checkout_session', () => {
        beforeEach(async () => {
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };
            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();
            TEST_CHECKOUT_SESSION_ID = result.session.id;
            createdOrderId = result.orders[0].id;
        });

        it('should cancel entire checkout session', async () => {
            const payload = {
                checkoutSessionId: TEST_CHECKOUT_SESSION_ID,
                reason: 'Customer changed mind'
            };

            const session = await client
                .send({ cmd: 'cancel_checkout_session' }, payload)
                .toPromise();

            expect(session).toBeDefined();
            expect(session.id).toBe(TEST_CHECKOUT_SESSION_ID);
            expect(session.status).toBe(CheckoutSessionStatus.CANCELLED);

            // Verify orders cancelled
            const order = await dataSource.query(
                `SELECT status FROM orders WHERE id = $1`,
                [createdOrderId]
            );
            expect(order[0].status).toBe(OrderStatus.CANCELLED);

            // Verify reservations released
            const reservations = await dataSource.query(
                `SELECT * FROM batch_reservations WHERE "orderId" = $1 AND status = $2`,
                [createdOrderId, ReservationStatus.ACTIVE]
            );
            expect(reservations.length).toBe(0);
        });

        it('should fail for non-existent session', async () => {
            const payload = {
                checkoutSessionId: randomUUID()
            };

            try {
                await client
                    .send({ cmd: 'cancel_checkout_session' }, payload)
                    .toPromise();
                fail('Expected error for non-existent session');
            } catch (err: any) {
                expect(err.message).toContain('Checkout session not found');
            }
        });
    });

    // Tests for get_checkout_session_details
    describe('get_checkout_session_details', () => {
        beforeEach(async () => {
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };
            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();
            TEST_CHECKOUT_SESSION_ID = result.session.id;
        });

        it('should get session with complete details', async () => {
            const session = await client
                .send({ cmd: 'get_checkout_session_details' }, TEST_CHECKOUT_SESSION_ID)
                .toPromise();

            expect(session).toBeDefined();
            expect(session.id).toBe(TEST_CHECKOUT_SESSION_ID);
            expect(session.orders).toBeDefined();
            expect(session.orders.length).toBe(1);
            expect(session.orders[0].items).toBeDefined();
        });

        it('should fail for non-existent session', async () => {
            const nonExistentId = randomUUID();

            try {
                await client
                    .send({ cmd: 'get_checkout_session_details' }, nonExistentId)
                    .toPromise();
                fail('Expected error for non-existent session');
            } catch (err: any) {
                expect(err.message).toContain('Checkout session not found');
            }
        });
    });

    // Tests for get_user_active_sessions
    describe('get_user_active_sessions', () => {
        it('should return active sessions for user', async () => {
            // Create multiple sessions
            for (let i = 0; i < 3; i++) {
                const sessionUserId = randomUUID();
                const cart = await client
                    .send({ cmd: 'get_or_create_cart' }, sessionUserId)
                    .toPromise();

                await client.send({ cmd: 'add_item_to_cart' }, {
                    userId: sessionUserId,
                    productId: createdProductId,
                    quantity: 1
                }).toPromise();

                await client
                    .send({ cmd: 'create_checkout_from_cart' }, {
                        userId: sessionUserId,
                        cartId: cart.id
                    })
                    .toPromise();
            }
            const sessions = await client
                .send({ cmd: 'get_user_active_sessions' }, TEST_USER_ID)
                .toPromise();

            expect(sessions).toBeDefined();
            expect(Array.isArray(sessions)).toBe(true);
        });

        it('should return empty array for user with no active sessions', async () => {
            const newUserId = randomUUID();
            const sessions = await client
                .send({ cmd: 'get_user_active_sessions' }, newUserId)
                .toPromise();

            expect(sessions).toBeDefined();
            expect(sessions.length).toBe(0);
        });
    });

    // Tests for get_user_completed_sessions
    describe('get_user_completed_sessions', () => {
        it('should return completed sessions for user', async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID)
                .toPromise();

            await client.send({ cmd: 'add_item_to_cart' }, {
                userId: TEST_USER_ID,
                productId: createdProductId,
                quantity: 1
            }).toPromise();

            const checkout = await client
                .send({ cmd: 'create_checkout_from_cart' }, {
                    userId: TEST_USER_ID,
                    cartId: cart.id
                })
                .toPromise();

            await client
                .send({ cmd: 'process_kiosk_response' }, {
                    orderId: checkout.orders[0].id,
                    kioskUserId: MOCKED_KIOSK_USER_ID,
                    accept: true
                })
                .toPromise();

            await client
                .send({ cmd: 'process_payment_success' }, {
                    checkoutSessionId: checkout.session.id,
                    paymentInfo: {
                        transactionId: 'test_txn_123',
                        paymentMethod: 'card',
                        amount: '19.99'
                    }
                })
                .toPromise();

            const sessions = await client
                .send({ cmd: 'get_user_completed_sessions' }, TEST_USER_ID)
                .toPromise();

            expect(sessions).toBeDefined();
            expect(sessions.length).toBeGreaterThan(0);

            const foundSession = sessions.find(s => s.id === checkout.session.id);
            expect(foundSession).toBeDefined();
            expect(foundSession.status).toBe(CheckoutSessionStatus.COMPLETED);

            sessions.forEach(session => {
                expect([
                    CheckoutSessionStatus.COMPLETED,
                    CheckoutSessionStatus.CANCELLED,
                    CheckoutSessionStatus.EXPIRED,
                    CheckoutSessionStatus.FAILED
                ]).toContain(session.status);
            });
        });
    });

    // Tests for validate_cart_for_checkout
    describe('validate_cart_for_checkout', () => {
        it('should return valid true for valid cart', async () => {
            const payload = {
                cartId: TEST_CART_ID,
                userId: TEST_USER_ID
            };

            const result = await client
                .send({ cmd: 'validate_cart_for_checkout' }, payload)
                .toPromise();

            expect(result).toBeDefined();
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
        });

        it('should return valid false with errors for invalid cart', async () => {
            const payload = {
                cartId: randomUUID(),
                userId: TEST_USER_ID
            };

            const result = await client
                .send({ cmd: 'validate_cart_for_checkout' }, payload)
                .toPromise();

            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    // Tests for get_session_status_summary
    describe('get_session_status_summary', () => {
        beforeEach(async () => {
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };
            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();
            TEST_CHECKOUT_SESSION_ID = result.session.id;
        });

        it('should return status summary for session', async () => {
            const summary = await client
                .send({ cmd: 'get_session_status_summary' }, TEST_CHECKOUT_SESSION_ID)
                .toPromise();

            expect(summary).toBeDefined();
            expect(summary.sessionId).toBe(TEST_CHECKOUT_SESSION_ID);
            expect(summary.status).toBe(CheckoutSessionStatus.PENDING);
            expect(summary.totalAmount).toBeDefined();
            expect(summary.ordersCount).toBe(1);
            expect(summary.ordersByStatus).toBeDefined();
            expect(summary.ordersByStatus[OrderStatus.PENDING_KIOSK_CONFIRMATION]).toBe(1);
        });

        it('should fail for non-existent session', async () => {
            try {
                await client
                    .send({ cmd: 'get_session_status_summary' }, randomUUID())
                    .toPromise();
                fail('Expected error for non-existent session');
            } catch (err: any) {
                expect(err.message).toContain('Checkout session not found');
            }
        });
    });

    // Tests for process_expired_sessions
    describe('process_expired_sessions', () => {
        it('should process expired sessions', async () => {
            // Create session with expired date
            const dto = {
                userId: TEST_USER_ID,
                cartId: TEST_CART_ID
            };
            const result = await client
                .send({ cmd: 'create_checkout_from_cart' }, dto)
                .toPromise();

            // Manually expire the session
            await dataSource.query(
                `UPDATE checkout_sessions SET "expiresAt" = $1 WHERE id = $2`,
                [new Date(Date.now() - 3600000), result.session.id]
            );

            const response = await client
                .send({ cmd: 'process_expired_sessions' }, {})
                .toPromise();

            expect(response).toBeDefined();
            expect(response.processedCount).toBeGreaterThan(0);

            // Verify session is expired
            const session = await dataSource.query(
                `SELECT status FROM checkout_sessions WHERE id = $1`,
                [result.session.id]
            );
            expect(session[0].status).toBe(CheckoutSessionStatus.EXPIRED);

            // Verify order is auto-rejected
            const order = await dataSource.query(
                `SELECT status FROM orders WHERE id = $1`,
                [result.orders[0].id]
            );
            expect(order[0].status).toBe(OrderStatus.AUTO_REJECTED_TIMEOUT);
        });

        it('should handle zero expired sessions gracefully', async () => {
            const response = await client
                .send({ cmd: 'process_expired_sessions' }, {})
                .toPromise();

            expect(response).toBeDefined();
            expect(response.processedCount).toBe(0);
        });
    });
});