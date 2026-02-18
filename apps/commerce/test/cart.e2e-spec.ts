import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { CommerceModule } from '../src/commerce.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { ProductCategory } from '../src/enums/product-category.enum';
import { UnitMeasure } from '../src/enums/unit-measure.enum';
import { CartStatus } from '../src/enums/cart-status.enum';
import { randomUUID } from 'crypto';

dotenv.config({ path: '.env' });

describe('Cart Microservice (TCP) - e2e', () => {
    let app: INestMicroservice;
    let client: ClientProxy;
    let dataSource: DataSource;

    const MOCKED_KIOSK_USER_ID = 123;
    const TEST_USER_ID_1 = randomUUID();
    const TEST_USER_ID_2 = randomUUID();

    let createdProductId: string;
    let createdBatchId: string;
    let createdCartId: string;
    let createdCartItemId: string;

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
            options: { host: '127.0.0.1', port: 3004 },
        });

        await app.listen();

        client = ClientProxyFactory.create({
            transport: Transport.TCP,
            options: { host: '127.0.0.1', port: 3004 },
        });
        await client.connect();

        dataSource = moduleFixture.get(DataSource);
    });

    beforeEach(async () => {
        const tables = [
            'order_items',
            'orders',
            'checkout_sessions',
            'batch_reservations',
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

        // test product
        const product = await client.send({ cmd: 'create_product' }, createProductDto).toPromise();
        createdProductId = product.id;

        // batch for test product
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

    // carts management

    describe('Cart Management', () => {
        it('get_or_create_cart - should create new cart for user', async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            expect(cart).toBeDefined();
            expect(cart.id).toBeDefined();
            expect(cart.userId).toBe(TEST_USER_ID_1);
            expect(cart.status).toBe(CartStatus.ACTIVE);
            expect(cart.items).toBeDefined();
            expect(Array.isArray(cart.items)).toBe(true);
            expect(cart.items.length).toBe(0);

            createdCartId = cart.id;
        });

        it('get_or_create_cart - should return existing active cart', async () => {
            const firstCart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            createdCartId = firstCart.id;

            const sameCart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            expect(sameCart.id).toBe(createdCartId);
            expect(sameCart.userId).toBe(TEST_USER_ID_1);
        });

        it('get_or_create_cart - should create different carts for different users', async () => {
            const cart1 = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            const cart2 = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_2)
                .toPromise();

            expect(cart1.id).not.toBe(cart2.id);
            expect(cart1.userId).toBe(TEST_USER_ID_1);
            expect(cart2.userId).toBe(TEST_USER_ID_2);
        });

        it('update_cart_activity - should update last activity timestamp', async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            const initialActivity = cart.lastActivityAt;

            await client
                .send({ cmd: 'update_cart_activity' }, cart.id)
                .toPromise();

            const updatedCart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            expect(new Date(updatedCart.lastActivityAt).getTime())
                .toBeGreaterThan(new Date(initialActivity).getTime());
        });

        it('update_cart_status - should update cart status', async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            const updatedCart = await client
                .send({ cmd: 'update_cart_status' }, {
                    cartId: cart.id,
                    status: CartStatus.CHECKOUT
                })
                .toPromise();

            expect(updatedCart.status).toBe(CartStatus.CHECKOUT);
        });

        it('update_cart_status - should throw for non-existent cart', async () => {
            const nonExistentId = '00000000-0000-0000-0000-000000000000';

            try {
                await client.send({ cmd: 'update_cart_status' }, {
                    cartId: nonExistentId,
                    status: CartStatus.CHECKOUT
                }).toPromise();
                fail('Expected error for non-existent cart');
            } catch (err: any) {
                expect(err.message).toContain('Cart not found');
            }
        });
    });

    // items management

    describe('Cart Items Management', () => {
        beforeEach(async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();
            createdCartId = cart.id;
        });

        it('add_item_to_cart - should add item to cart', async () => {
            const payload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 5
            };

            const cart = await client
                .send({ cmd: 'add_item_to_cart' }, payload)
                .toPromise();

            expect(cart).toBeDefined();
            expect(cart.items.length).toBe(1);
            expect(cart.items[0].productId).toBe(createdProductId);
            expect(cart.items[0].quantity).toBe(5);

            createdCartItemId = cart.items[0].id;
        });

        it('add_item_to_cart - should increase quantity for existing item', async () => {
            const payload1 = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 3
            };

            await client.send({ cmd: 'add_item_to_cart' }, payload1).toPromise();

            const payload2 = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 2
            };

            const cart = await client
                .send({ cmd: 'add_item_to_cart' }, payload2)
                .toPromise();

            expect(cart.items.length).toBe(1);
            expect(cart.items[0].quantity).toBe(5);
        });

        it('add_item_to_cart - should throw for zero quantity', async () => {
            const payload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 0
            };

            try {
                await client.send({ cmd: 'add_item_to_cart' }, payload).toPromise();
                fail('Expected error for zero quantity');
            } catch (err: any) {
                expect(err.message).toContain('Quantity must be greater than zero');
            }
        });

        it('add_item_to_cart - should throw for negative quantity', async () => {
            const payload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: -1
            };

            try {
                await client.send({ cmd: 'add_item_to_cart' }, payload).toPromise();
                fail('Expected error for negative quantity');
            } catch (err: any) {
                expect(err.message).toContain('Quantity must be greater than zero');
            }
        });

        it('add_item_to_cart - should throw for insufficient stock', async () => {
            const payload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 150
            };

            try {
                await client.send({ cmd: 'add_item_to_cart' }, payload).toPromise();
                fail('Expected error for insufficient stock');
            } catch (err: any) {
                expect(err.message).toContain('Insufficient stock');
            }
        });

        it('add_item_to_cart - should throw for non-existent product', async () => {
            const nonExistentProductId = '00000000-0000-0000-0000-000000000000';

            const payload = {
                userId: TEST_USER_ID_1,
                productId: nonExistentProductId,
                quantity: 1
            };

            try {
                await client.send({ cmd: 'add_item_to_cart' }, payload).toPromise();
                fail('Expected error for non-existent product');
            } catch (err: any) {
                expect(err.message).toContain('Product not found or not available');
            }
        });

        it('update_item_quantity - should update item quantity', async () => {
            const addPayload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 5
            };

            const cart = await client.send({ cmd: 'add_item_to_cart' }, addPayload).toPromise();
            const itemId = cart.items[0].id;

            const updatePayload = {
                itemId: itemId,
                quantity: 10
            };

            const updatedItem = await client
                .send({ cmd: 'update_item_quantity' }, updatePayload)
                .toPromise();

            expect(updatedItem.quantity).toBe(10);
            expect(updatedItem.id).toBe(itemId);
        });

        it('update_item_quantity - should throw for non-existent item', async () => {
            const nonExistentItemId = '00000000-0000-0000-0000-000000000000';

            const payload = {
                itemId: nonExistentItemId,
                quantity: 10
            };

            try {
                await client.send({ cmd: 'update_item_quantity' }, payload).toPromise();
                fail('Expected error for non-existent item');
            } catch (err: any) {
                expect(err.message).toContain('Item not found in cart');
            }
        });

        it('remove_item_from_cart - should remove item from cart', async () => {
            const addPayload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 5
            };

            const cart = await client.send({ cmd: 'add_item_to_cart' }, addPayload).toPromise();
            const itemId = cart.items[0].id;

            let cartAfterAdd = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();
            expect(cartAfterAdd.items.length).toBe(1);

            await client
                .send({ cmd: 'remove_item_from_cart' }, itemId)
                .toPromise();

            cartAfterAdd = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();
            expect(cartAfterAdd.items.length).toBe(0);
        });

        it('remove_item_from_cart - should throw for non-existent item', async () => {
            const nonExistentItemId = '00000000-0000-0000-0000-000000000000';

            try {
                await client.send({ cmd: 'remove_item_from_cart' }, nonExistentItemId).toPromise();
                fail('Expected error for non-existent item');
            } catch (err: any) {
                expect(err.message).toContain('Item not found in cart');
            }
        });

        it('clear_cart - should remove all items from cart', async () => {
            const addPayload1 = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 5
            };
            await client.send({ cmd: 'add_item_to_cart' }, addPayload1).toPromise();

            const anotherProduct = await client.send({ cmd: 'create_product' }, {
                ...createProductDto,
                name: 'Another Product'
            }).toPromise();

            await client.send({ cmd: 'create_batch' }, {
                productId: anotherProduct.id,
                productionDate: new Date().toISOString(),
                initialQuantity: 50
            }).toPromise();

            const addPayload2 = {
                userId: TEST_USER_ID_1,
                productId: anotherProduct.id,
                quantity: 3
            };
            await client.send({ cmd: 'add_item_to_cart' }, addPayload2).toPromise();

            let cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();
            expect(cart.items.length).toBe(2);

            await client
                .send({ cmd: 'clear_cart' }, cart.id)
                .toPromise();

            cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();
            expect(cart.items.length).toBe(0);
        });

        it('get_cart_item - should return cart item by id', async () => {
            const addPayload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 5
            };

            const cart = await client.send({ cmd: 'add_item_to_cart' }, addPayload).toPromise();
            const itemId = cart.items[0].id;

            const item = await client
                .send({ cmd: 'get_cart_item' }, itemId)
                .toPromise();

            expect(item.id).toBe(itemId);
            expect(item.productId).toBe(createdProductId);
            expect(item.quantity).toBe(5);
            expect(item.cart).toBeDefined();
            expect(item.product).toBeDefined();
        });

        it('get_cart_item - should throw for non-existent item', async () => {
            const nonExistentItemId = '00000000-0000-0000-0000-000000000000';

            try {
                await client.send({ cmd: 'get_cart_item' }, nonExistentItemId).toPromise();
                fail('Expected error for non-existent item');
            } catch (err: any) {
                expect(err.message).toContain('Item not found');
            }
        });
    });

    // stock validation

    describe('Stock Validation', () => {
        beforeEach(async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();
            createdCartId = cart.id;
        });

        it('validate_cart_stock - should return true for valid stock', async () => {
            const addPayload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 50
            };

            await client.send({ cmd: 'add_item_to_cart' }, addPayload).toPromise();

            const isValid = await client
                .send({ cmd: 'validate_cart_stock' }, createdCartId)
                .toPromise();

            expect(isValid).toBe(true);
        });

        it('validate_cart_stock - should return false for insufficient stock', async () => {
            const addPayload = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 50
            };

            await client.send({ cmd: 'add_item_to_cart' }, addPayload).toPromise();

            await client.send({ cmd: 'update_batch_quantity' }, {
                batchId: createdBatchId,
                delta: -80
            }).toPromise();

            const isValid = await client
                .send({ cmd: 'validate_cart_stock' }, createdCartId)
                .toPromise();

            expect(isValid).toBe(false);
        });

        it('validate_cart_stock - should throw for non-existent cart', async () => {
            const nonExistentCartId = '00000000-0000-0000-0000-000000000000';

            try {
                await client.send({ cmd: 'validate_cart_stock' }, nonExistentCartId).toPromise();
                fail('Expected error for non-existent cart');
            } catch (err: any) {
                expect(err.message).toContain('Cart not found');
            }
        });

        it('get_product_current_quantity - should return available stock', async () => {
            const stock = await client
                .send({ cmd: 'get_product_current_quantity' }, createdProductId)
                .toPromise();

            expect(stock).toBe(100);
        });

        it('get_product_current_quantity - should return 0 for non-existent product', async () => {
            const nonExistentProductId = '00000000-0000-0000-0000-000000000000';

            const stock = await client
                .send({ cmd: 'get_product_current_quantity' }, nonExistentProductId)
                .toPromise();

            expect(stock).toBe(0);
        });
    });

    // tests for helper methods

    describe('helper methods', () => {
        beforeEach(async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();
            createdCartId = cart.id;

            const addPayload1 = {
                userId: TEST_USER_ID_1,
                productId: createdProductId,
                quantity: 3
            };
            await client.send({ cmd: 'add_item_to_cart' }, addPayload1).toPromise();

            const anotherProduct = await client.send({ cmd: 'create_product' }, {
                ...createProductDto,
                name: 'Another Product',
                price: '29.99'
            }).toPromise();

            await client.send({ cmd: 'create_batch' }, {
                productId: anotherProduct.id,
                productionDate: new Date().toISOString(),
                initialQuantity: 50
            }).toPromise();

            const addPayload2 = {
                userId: TEST_USER_ID_1,
                productId: anotherProduct.id,
                quantity: 2
            };
            await client.send({ cmd: 'add_item_to_cart' }, addPayload2).toPromise();
        });

        it('calculate_cart_total - should calculate total correctly', async () => {
            const total = await client
                .send({ cmd: 'calculate_cart_total' }, createdCartId)
                .toPromise();

            expect(total).toBeCloseTo(119.95, 2);
        });

        it('calculate_cart_total - should throw for non-existent cart', async () => {
            const nonExistentCartId = '00000000-0000-0000-0000-000000000000';

            try {
                await client.send({ cmd: 'calculate_cart_total' }, nonExistentCartId).toPromise();
                fail('Expected error for non-existent cart');
            } catch (err: any) {
                expect(err.message).toContain('Cart not found');
            }
        });

        it('count_cart_items - should count items correctly', async () => {
            const count = await client
                .send({ cmd: 'count_cart_items' }, createdCartId)
                .toPromise();

            expect(count).toBe(2);
        });

        it('is_cart_empty - should return false for non-empty cart', async () => {
            const isEmpty = await client
                .send({ cmd: 'is_cart_empty' }, createdCartId)
                .toPromise();

            expect(isEmpty).toBe(false);
        });

        it('is_cart_empty - should return true for empty cart', async () => {
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_2)
                .toPromise();

            const isEmpty = await client
                .send({ cmd: 'is_cart_empty' }, cart.id)
                .toPromise();

            expect(isEmpty).toBe(true);
        });

        it('get_cart_summary - should return complete summary', async () => {
            const summary = await client
                .send({ cmd: 'get_cart_summary' }, createdCartId)
                .toPromise();

            expect(summary.cartId).toBe(createdCartId);
            expect(summary.userId).toBe(TEST_USER_ID_1);
            expect(summary.status).toBe(CartStatus.ACTIVE);
            expect(summary.itemCount).toBe(2);
            expect(summary.total).toBeCloseTo(119.95, 2);
            expect(summary.isEmpty).toBe(false);
            expect(Array.isArray(summary.items)).toBe(true);
            expect(summary.items.length).toBe(2);

            summary.items.forEach(item => {
                expect(item.id).toBeDefined();
                expect(item.productId).toBeDefined();
                expect(item.productName).toBeDefined();
                expect(typeof item.quantity).toBe('number');
                expect(typeof item.price).toBe('number');
                expect(typeof item.subtotal).toBe('number');
                expect(item.subtotal).toBe(item.price * item.quantity);
            });
        });

        it('get_cart_summary - should throw for non-existent cart', async () => {
            const nonExistentCartId = '00000000-0000-0000-0000-000000000000';

            try {
                await client.send({ cmd: 'get_cart_summary' }, nonExistentCartId).toPromise();
                fail('Expected error for non-existent cart');
            } catch (err: any) {
                expect(err.message).toContain('Cart not found');
            }
        });

        it('sync_cart_item_prices - should sync prices and remove inactive products', async () => {
            await client.send({ cmd: 'deactivate_product' }, createdProductId).toPromise();

            await client
                .send({ cmd: 'sync_cart_item_prices' }, createdCartId)
                .toPromise();
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1)
                .toPromise();

            expect(cart.items.length).toBe(1);
            expect(cart.items[0].productId).not.toBe(createdProductId);
        });
    });

    // tests for status management

    describe('Status Management', () => {
        it('mark_abandoned_carts - should mark inactive carts as abandoned', async () => {
            await client.send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_1).toPromise();
            await client.send({ cmd: 'get_or_create_cart' }, TEST_USER_ID_2).toPromise();

            const oneHourAgo = new Date();
            oneHourAgo.setHours(oneHourAgo.getHours() - 1);

            await dataSource.query(
                `UPDATE carts SET "lastActivityAt" = $1 WHERE "userId" IN ($2, $3)`,
                [oneHourAgo, TEST_USER_ID_1, TEST_USER_ID_2]
            );

            const markedCount = await client
                .send({ cmd: 'mark_abandoned_carts' }, {})
                .toPromise();

            expect(markedCount).toBe(2);

            const carts = await dataSource.query(
                `SELECT status FROM carts WHERE "userId" IN ($1, $2)`,
                [TEST_USER_ID_1, TEST_USER_ID_2]
            );

            carts.forEach(cart => {
                expect(cart.status).toBe(CartStatus.ABANDONED);
            });
        });

        it('cleanup_old_abandoned_carts - should clean up old abandoned carts', async () => {
            const testUserId = randomUUID();
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 10);

            const cartId = randomUUID();
            await dataSource.query(`
        INSERT INTO carts (id, "userId", status, "lastActivityAt", "createdAt", "updatedAt", "deletedAt")
        VALUES ($1, $2, $3, $4, $5, $5, NULL)
    `, [
                cartId,
                testUserId,
                CartStatus.ABANDONED,
                oldDate,
                oldDate
            ]);

            const beforeResult = await dataSource.query(
                `SELECT COUNT(*) as count FROM carts WHERE "userId" = $1 AND "deletedAt" IS NULL`,
                [testUserId]
            );
            expect(parseInt(beforeResult[0].count)).toBe(1);

            const cleanedCount = await client
                .send({ cmd: 'cleanup_old_abandoned_carts' }, {})
                .toPromise();

            expect(cleanedCount).toBeGreaterThan(0);

            const afterResult = await dataSource.query(
                `SELECT COUNT(*) as count FROM carts WHERE "userId" = $1 AND "deletedAt" IS NULL`,
                [testUserId]
            );
            expect(parseInt(afterResult[0].count)).toBe(0);

            const deletedResult = await dataSource.query(
                `SELECT COUNT(*) as count FROM carts WHERE "userId" = $1 AND "deletedAt" IS NOT NULL`,
                [testUserId]
            );
            expect(parseInt(deletedResult[0].count)).toBe(1);
        });

        it('perform_cart_maintenance - should run both maintenance tasks', async () => {
            await expect(
                client.send({ cmd: 'perform_cart_maintenance' }, {}).toPromise()
            ).resolves.not.toThrow();
        });
    });


    describe('Integration Scenarios', () => {
        it('should handle complete cart workflow', async () => {
            const id = randomUUID();
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, id)
                .toPromise();

            await client.send({ cmd: 'add_item_to_cart' }, {
                userId: id,
                productId: createdProductId,
                quantity: 10
            }).toPromise();

            const isEmpty = await client
                .send({ cmd: 'is_cart_empty' }, cart.id)
                .toPromise();
            expect(isEmpty).toBe(false);

            const itemCount = await client
                .send({ cmd: 'count_cart_items' }, cart.id)
                .toPromise();
            expect(itemCount).toBe(1);

            const total = await client
                .send({ cmd: 'calculate_cart_total' }, cart.id)
                .toPromise();
            expect(total).toBeCloseTo(199.9, 1);

            const hasStock = await client
                .send({ cmd: 'validate_cart_stock' }, cart.id)
                .toPromise();
            expect(hasStock).toBe(true);

            const summary = await client
                .send({ cmd: 'get_cart_summary' }, cart.id)
                .toPromise();
            expect(summary.itemCount).toBe(1);
            expect(summary.total).toBeCloseTo(199.9, 1);

            await client.send({ cmd: 'clear_cart' }, cart.id).toPromise();

            const isEmptyAfterClear = await client
                .send({ cmd: 'is_cart_empty' }, cart.id)
                .toPromise();
            expect(isEmptyAfterClear).toBe(true);
        });

        it('should prevent adding more than available stock', async () => {
            const id = randomUUID();
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, id)
                .toPromise();

            try {
                await client.send({ cmd: 'add_item_to_cart' }, {
                    userId: id,
                    productId: createdProductId,
                    quantity: 150
                }).toPromise();
                fail('Should have thrown insufficient stock error');
            } catch (err: any) {
                expect(err.message).toContain('Insufficient stock');
            }

            const isEmpty = await client
                .send({ cmd: 'is_cart_empty' }, cart.id)
                .toPromise();
            expect(isEmpty).toBe(true);
        });

        it('should handle product deactivation gracefully', async () => {
            const id = randomUUID();
            const cart = await client
                .send({ cmd: 'get_or_create_cart' }, id)
                .toPromise();

            await client.send({ cmd: 'add_item_to_cart' }, {
                userId: id,
                productId: createdProductId,
                quantity: 5
            }).toPromise();

            await client.send({ cmd: 'deactivate_product' }, createdProductId).toPromise();

            await client.send({ cmd: 'sync_cart_item_prices' }, cart.id).toPromise();

            const isEmpty = await client
                .send({ cmd: 'is_cart_empty' }, cart.id)
                .toPromise();
            expect(isEmpty).toBe(true);
        });
    });
});