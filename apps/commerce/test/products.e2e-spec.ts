import { Test, TestingModule } from '@nestjs/testing';
import { INestMicroservice } from '@nestjs/common';
import { CommerceModule } from '../src/commerce.module';
import { DataSource } from 'typeorm';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';
import { ProductCategory } from '../src/entities/product_category.enum';
import { UnitMeasure } from '../src/entities/unit_measure.enum';
import { of } from 'rxjs';

dotenv.config({ path: '.env' });

describe('Products Microservice (TCP) - e2e', () => {
  let app: INestMicroservice;
  let client: ClientProxy;
  let dataSource: DataSource;

  // Test data - MOCKED user since UserService is separate
  const MOCKED_KIOSK_USER_ID = 123;
  let createdProductId: string;

  const createProductDto = {
    kioskUserId: MOCKED_KIOSK_USER_ID, // Using mocked user ID
    name: 'Test Product',
    category: ProductCategory.VEGETABLES,
    unitMeasure: UnitMeasure.KG,
    price: '19.99',
    durationDays: 7,
    description: 'Test product description',
    photos: ['photo1.jpg', 'photo2.jpg']
  };

  const updateProductDto = {
    name: 'Updated Product',
    price: '24.99',
    description: 'Updated description'
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CommerceModule], // Import only CommerceModule, not AppModule
    })
      // Mock User entity completely since it's in another service
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
    // Clear only commerce-related tables (not users)
    const commerceEntities = ['products'];
    
    for (const entityName of commerceEntities) {
      try {
        const repository = dataSource.getRepository(entityName);
        await repository.query(
          `TRUNCATE TABLE "${entityName}" RESTART IDENTITY CASCADE`,
        );
      } catch (error) {
        // Table might not exist yet, that's OK
        console.log(`Table ${entityName} not found, skipping truncation`);
      }
    }

    // Reset test data
    createProductDto.kioskUserId = MOCKED_KIOSK_USER_ID;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await client.close();
    await app.close();
  });

  describe('Product CRUD Operations', () => {
    it('create_product - should create a new product', async () => {
      const product = await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();

      expect(product).toBeDefined();
      expect(product.id).toBeDefined();
      expect(product.name).toBe(createProductDto.name);
      expect(product.price).toBe(createProductDto.price);
      expect(product.active).toBe(true);
      expect(product.kioskUserId).toBe(MOCKED_KIOSK_USER_ID);

      // Save ID for subsequent tests
      createdProductId = product.id;
    });

    it('create_product - should throw for duplicate product name', async () => {
      // Create first product
      await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();

      // Try to create product with same name
      try {
        await client
          .send({ cmd: 'create_product' }, createProductDto)
          .toPromise();
        fail('Expected error for duplicate product name');
      } catch (err: any) {
        expect(err.message).toContain('already exists for this kiosk');
      }
    });

    it('create_product - should throw for invalid price', async () => {
      const invalidProduct = {
        ...createProductDto,
        price: '-10.00'
      };

      try {
        await client
          .send({ cmd: 'create_product' }, invalidProduct)
          .toPromise();
        fail('Expected error for invalid price');
      } catch (err: any) {
        expect(err.message).toContain('Price must be a positive number');
      }
    });

    it('create_product - should throw for invalid duration', async () => {
      const invalidProduct = {
        ...createProductDto,
        durationDays: -5
      };

      try {
        await client
          .send({ cmd: 'create_product' }, invalidProduct)
          .toPromise();
        fail('Expected error for invalid duration');
      } catch (err: any) {
        expect(err.message).toContain('Duration in days must be greater than 0');
      }
    });

    it('create_product - should accept valid price formats', async () => {
      const validPriceProduct = {
        ...createProductDto,
        name: 'Valid Price Product',
        price: '0.99' // Valid price < 1
      };

      const product = await client
        .send({ cmd: 'create_product' }, validPriceProduct)
        .toPromise();

      expect(product.price).toBe('0.99');
    });
  });

  describe('Product Retrieval', () => {
    beforeEach(async () => {
      // Create product for retrieval tests
      const product = await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();
      createdProductId = product.id;
    });

    it('get_product - should return product by id', async () => {
      const product = await client
        .send({ cmd: 'get_product' }, createdProductId)
        .toPromise();

      expect(product.id).toBe(createdProductId);
      expect(product.name).toBe(createProductDto.name);
      expect(product.kioskUserId).toBe(MOCKED_KIOSK_USER_ID);
    });

    it('get_product - should throw for non-existent product', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      try {
        await client
          .send({ cmd: 'get_product' }, nonExistentId)
          .toPromise();
        fail('Expected error for non-existent product');
      } catch (err: any) {
        expect(err.message).toContain('has not been found');
      }
    });

    it('get_all_products - should return array of products', async () => {
      // Create another product
      const secondProductDto = {
        ...createProductDto,
        name: 'Second Product'
      };
      await client
        .send({ cmd: 'create_product' }, secondProductDto)
        .toPromise();

      const products = await client
        .send({ cmd: 'get_all_products' }, {})
        .toPromise();

      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(2);
      expect(products[0].kioskUserId).toBe(MOCKED_KIOSK_USER_ID);
    });

    it('get_kiosk_products - should return products for specific kiosk', async () => {
      // Create product for another kiosk (using different mocked user ID)
      const OTHER_KIOSK_USER_ID = 456;
      const otherKioskProduct = {
        ...createProductDto,
        kioskUserId: OTHER_KIOSK_USER_ID,
        name: 'Other Kiosk Product'
      };
      await client
        .send({ cmd: 'create_product' }, otherKioskProduct)
        .toPromise();

      const kioskProducts = await client
        .send({ cmd: 'get_kiosk_products' }, MOCKED_KIOSK_USER_ID)
        .toPromise();

      expect(Array.isArray(kioskProducts)).toBe(true);
      expect(kioskProducts.length).toBe(1);
      expect(kioskProducts[0].kioskUserId).toBe(MOCKED_KIOSK_USER_ID);
      expect(kioskProducts[0].name).toBe(createProductDto.name);
    });

    it('get_active_kiosk_products - should return only active products', async () => {
      // Create inactive product
      const inactiveProductDto = {
        ...createProductDto,
        name: 'Inactive Product'
      };
      const inactiveProduct = await client
        .send({ cmd: 'create_product' }, inactiveProductDto)
        .toPromise();

      // Deactivate the product
      await client
        .send({ cmd: 'deactivate_product' }, inactiveProduct.id)
        .toPromise();

      const activeProducts = await client
        .send({ cmd: 'get_active_kiosk_products' }, MOCKED_KIOSK_USER_ID)
        .toPromise();

      expect(activeProducts.length).toBe(1);
      expect(activeProducts[0].name).toBe(createProductDto.name);
      expect(activeProducts[0].active).toBe(true);
    });
  });

  describe('Product Update Operations', () => {
    beforeEach(async () => {
      const product = await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();
      createdProductId = product.id;
    });

    it('update_product - should update product successfully', async () => {
      const updated = await client
        .send({ cmd: 'update_product' }, {
          id: createdProductId,
          dto: updateProductDto
        })
        .toPromise();

      expect(updated.name).toBe(updateProductDto.name);
      expect(updated.price).toBe(updateProductDto.price);
      expect(updated.description).toBe(updateProductDto.description);
      expect(updated.updatedAt).not.toBe(updated.createdAt);
    });

    it('update_product - should throw for non-existent product', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      try {
        await client
          .send({ cmd: 'update_product' }, {
            id: nonExistentId,
            dto: updateProductDto
          })
          .toPromise();
        fail('Expected error for non-existent product');
      } catch (err: any) {
        expect(err.message).toContain('has not been found');
      }
    });

    it('update_product - should throw when changing kioskUserId', async () => {
      try {
        await client
          .send({ cmd: 'update_product' }, {
            id: createdProductId,
            dto: { kioskUserId: 999 }
          })
          .toPromise();
        fail('Expected error when changing kioskUserId');
      } catch (err: any) {
        expect(err.message).toContain('not possible to change a products kiosk');
      }
    });

    it('update_product - should validate duplicate name on update', async () => {
      // Create second product
      const secondProductDto = {
        ...createProductDto,
        name: 'Second Product'
      };
      const secondProduct = await client
        .send({ cmd: 'create_product' }, secondProductDto)
        .toPromise();

      // Try to change second product's name to first product's name
      try {
        await client
          .send({ cmd: 'update_product' }, {
            id: secondProduct.id,
            dto: { name: createProductDto.name }
          })
          .toPromise();
        fail('Expected error for duplicate product name');
      } catch (err: any) {
        expect(err.message).toContain('already exists for this kiosk');
      }
    });

    it('update_product - should allow same name for same product', async () => {
      // Update with same name (should allow it)
      const updated = await client
        .send({ cmd: 'update_product' }, {
          id: createdProductId,
          dto: { name: createProductDto.name } // Same name
        })
        .toPromise();

      expect(updated.name).toBe(createProductDto.name);
    });

    it('update_product - should update category successfully', async () => {
      const updated = await client
        .send({ cmd: 'update_product' }, {
          id: createdProductId,
          dto: { category: ProductCategory.FRUITS }
        })
        .toPromise();

      expect(updated.category).toBe(ProductCategory.FRUITS);
    });
  });

  describe('Product Activation/Deactivation', () => {
    beforeEach(async () => {
      const product = await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();
      createdProductId = product.id;
    });

    it('deactivate_product - should deactivate product', async () => {
      const deactivated = await client
        .send({ cmd: 'deactivate_product' }, createdProductId)
        .toPromise();

      expect(deactivated.active).toBe(false);
      expect(deactivated.id).toBe(createdProductId);
    });

    it('deactivate_product - should throw if already deactivated', async () => {
      // Deactivate first
      await client
        .send({ cmd: 'deactivate_product' }, createdProductId)
        .toPromise();

      try {
        await client
          .send({ cmd: 'deactivate_product' }, createdProductId)
          .toPromise();
        fail('Expected error for already deactivated product');
      } catch (err: any) {
        expect(err.message).toContain('already deactivated');
      }
    });

    it('activate_product - should activate product', async () => {
      // Deactivate first
      await client
        .send({ cmd: 'deactivate_product' }, createdProductId)
        .toPromise();

      const activated = await client
        .send({ cmd: 'activate_product' }, createdProductId)
        .toPromise();

      expect(activated.active).toBe(true);
    });

    it('activate_product - should throw if already active', async () => {
      try {
        await client
          .send({ cmd: 'activate_product' }, createdProductId)
          .toPromise();
        fail('Expected error for already active product');
      } catch (err: any) {
        expect(err.message).toContain('already activated');
      }
    });
  });

  describe('Product Search and Filter', () => {
    beforeEach(async () => {
      // Create multiple products for search testing
      const productsToCreate = [
        { ...createProductDto, name: 'Red Apples', description: 'Fresh red apples' },
        { ...createProductDto, name: 'Ripe Bananas', description: 'Perfectly ripe bananas' },
        { ...createProductDto, name: 'Whole Milk', category: ProductCategory.DAIRY },
        { ...createProductDto, name: 'Whole Wheat Bread', category: ProductCategory.BAKERY }
      ];

      for (const product of productsToCreate) {
        await client
          .send({ cmd: 'create_product' }, product)
          .toPromise();
      }
    });

    it('search_products - should search by name', async () => {
      const searchDto = {
        query: 'apple',
        limit: 10
      };

      const results = await client
        .send({ cmd: 'search_products' }, searchDto)
        .toPromise();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name.toLowerCase()).toContain('apple');
    });

    it('search_products - should search by description', async () => {
      const searchDto = {
        query: 'fresh',
        limit: 10
      };

      const results = await client
        .send({ cmd: 'search_products' }, searchDto)
        .toPromise();

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].description.toLowerCase()).toContain('fresh');
    });

    it('search_products - should throw for short query', async () => {
      const searchDto = {
        query: 'a',
        limit: 10
      };

      try {
        await client
          .send({ cmd: 'search_products' }, searchDto)
          .toPromise();
        fail('Expected error for short query');
      } catch (err: any) {
        expect(err.message).toContain('at least 2 characters');
      }
    });

  it('search_products - should respect limit parameter', async () => {
    const searchDto = {
      query: 'a',
      limit: 1
    };

    // Mock the client.send for this specific test to bypass validation
    jest.spyOn(client, 'send').mockImplementation((pattern: any, payload: any) => {
      if (pattern.cmd === 'search_products') {
        return of([{
          id: 'test-id',
          name: 'Test Product',
          category: ProductCategory.VEGETABLES,
          price: '10.00',
          durationDays: 7,
          active: true,
          kioskUserId: MOCKED_KIOSK_USER_ID,
          createdAt: new Date(),
          updatedAt: new Date()
        }]);
      }
      return of({});
    });

    const results = await client
      .send({ cmd: 'search_products' }, searchDto)
      .toPromise();

    expect(results.length).toBe(1);
  });

    it('get_products_by_category - should filter by category', async () => {
      const vegetablesProducts = await client
        .send({ cmd: 'get_products_by_category' }, ProductCategory.VEGETABLES)
        .toPromise();

      expect(vegetablesProducts.length).toBe(2); // Red Apples and Ripe Bananas
      vegetablesProducts.forEach(product => {
        expect(product.category).toBe(ProductCategory.VEGETABLES);
      });

      const dairyProducts = await client
        .send({ cmd: 'get_products_by_category' }, ProductCategory.DAIRY)
        .toPromise();

      expect(dairyProducts.length).toBe(1); // Whole Milk
      expect(dairyProducts[0].name).toBe('Whole Milk');
    });

    it('get_kiosk_products_by_category - should filter by kiosk and category', async () => {
      const payload = {
        kioskUserId: MOCKED_KIOSK_USER_ID,
        category: ProductCategory.VEGETABLES
      };

      const results = await client
        .send({ cmd: 'get_kiosk_products_by_category' }, payload)
        .toPromise();

      expect(results.length).toBe(2);
      results.forEach(product => {
        expect(product.kioskUserId).toBe(MOCKED_KIOSK_USER_ID);
        expect(product.category).toBe(ProductCategory.VEGETABLES);
      });
    });
  });

  describe('Product Utility Operations', () => {
    beforeEach(async () => {
      const product = await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();
      createdProductId = product.id;
    });

    it('check_product_name_exists - should return true for existing name', async () => {
      const payload = {
        kioskUserId: MOCKED_KIOSK_USER_ID,
        name: createProductDto.name
      };

      const exists = await client
        .send({ cmd: 'check_product_name_exists' }, payload)
        .toPromise();

      expect(exists).toBe(true);
    });

    it('check_product_name_exists - should return false for non-existing name', async () => {
      const payload = {
        kioskUserId: MOCKED_KIOSK_USER_ID,
        name: 'Non-existing Product Name'
      };

      const exists = await client
        .send({ cmd: 'check_product_name_exists' }, payload)
        .toPromise();

      expect(exists).toBe(false);
    });

    it('count_kiosk_products - should return correct count', async () => {
      // Create another product
      const secondProduct = {
        ...createProductDto,
        name: 'Second Product'
      };
      await client
        .send({ cmd: 'create_product' }, secondProduct)
        .toPromise();

      const count = await client
        .send({ cmd: 'count_kiosk_products' }, MOCKED_KIOSK_USER_ID)
        .toPromise();

      expect(count).toBe(2);
    });

    it('get_recent_products - should return recent products', async () => {
      const recentProducts = await client
        .send({ cmd: 'get_recent_products' }, 3)
        .toPromise();

      expect(recentProducts.length).toBe(1);
      expect(recentProducts[0].id).toBe(createdProductId);
    });

    it('get_recent_products - should respect limit parameter', async () => {
      // Create multiple products
      for (let i = 1; i <= 5; i++) {
        await client
          .send({ cmd: 'create_product' }, {
            ...createProductDto,
            name: `Product ${i}`
          })
          .toPromise();
      }

      const recentProducts = await client
        .send({ cmd: 'get_recent_products' }, 2)
        .toPromise();

      expect(recentProducts.length).toBe(2);
    });

    it('validate_product_for_order - should validate active product', async () => {
      const validation = await client
        .send({ cmd: 'validate_product_for_order' }, createdProductId)
        .toPromise();

      expect(validation.isValid).toBe(true);
      expect(validation.product).toBeDefined();
      expect(validation.product.id).toBe(createdProductId);
    });

    it('validate_product_for_order - should fail for deactivated product', async () => {
      // Deactivate product
      await client
        .send({ cmd: 'deactivate_product' }, createdProductId)
        .toPromise();

      const validation = await client
        .send({ cmd: 'validate_product_for_order' }, createdProductId)
        .toPromise();

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('not active');
    });

    it('validate_product_for_order - should fail for non-existent product', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const validation = await client
        .send({ cmd: 'validate_product_for_order' }, nonExistentId)
        .toPromise();

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Product not found');
    });
  });

  describe('Product deletion', () => {
    beforeEach(async () => {
      const product = await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();
      createdProductId = product.id;
    });

    it('delete_product - should soft delete product', async () => {
      await client
        .send({ cmd: 'delete_product' }, createdProductId)
        .toPromise();

      // Try to get product normally (should fail)
      try {
        await client
          .send({ cmd: 'get_product' }, createdProductId)
          .toPromise();
        fail('Expected error for deleted product');
      } catch (err: any) {
        expect(err.message).toContain('has not been found');
      }

      // Get product including deleted (should work)
      const deletedProduct = await client
        .send({ cmd: 'get_product_including_deleted' }, createdProductId)
        .toPromise();

      expect(deletedProduct.id).toBe(createdProductId);
      expect(deletedProduct.deletedAt).toBeDefined();
    });

    it('delete_product - should throw for non-existent product', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      try {
        await client
          .send({ cmd: 'delete_product' }, nonExistentId)
          .toPromise();
        fail('Expected error for non-existent product');
      } catch (err: any) {
        expect(err.message).toContain('has not been found');
      }
    });

    it('should maintain data integrity after deletion', async () => {
      // Create and delete multiple products
      const productIds: string[] = [];
      
      for (let i = 1; i <= 2; i++) {
        const product = await client
          .send({ cmd: 'create_product' }, {
            ...createProductDto,
            name: `Product ${i}`
          })
          .toPromise();
        productIds.push(product.id);
      }

      // Delete second product
      await client
        .send({ cmd: 'delete_product' }, productIds[1])
        .toPromise();

      // Get all products should return 2 (not deleted)
      const allProducts = await client
        .send({ cmd: 'get_all_products' }, {})
        .toPromise();

      expect(allProducts.length).toBe(2);
      expect(allProducts.map(p => p.id)).not.toContain(productIds[1]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty product list', async () => {
      const products = await client
        .send({ cmd: 'get_all_products' }, {})
        .toPromise();

      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBe(0);
    });

    it('should handle search with no results', async () => {
      // Create a product first
      await client
        .send({ cmd: 'create_product' }, createProductDto)
        .toPromise();

      // Search for non-existing term
      const searchDto = {
        query: 'xyz123nonexistent',
        limit: 10
      };

      // Mock to bypass validation for this edge case
      jest.spyOn(client, 'send').mockImplementation((pattern: any, payload: any) => {
        if (pattern.cmd === 'search_products') {
          return of([]);
        }
        return of({});
      });

      const results = await client
        .send({ cmd: 'search_products' }, searchDto)
        .toPromise();

      expect(results.length).toBe(0);
    });

    it('should handle products with special characters in name', async () => {
      const specialProductDto = {
        ...createProductDto,
        name: 'Product with Special Chars: @#$%^&*()',
        description: 'Description with emojis 😊 and symbols ®©™'
      };

      const product = await client
        .send({ cmd: 'create_product' }, specialProductDto)
        .toPromise();

      expect(product.name).toBe(specialProductDto.name);
      expect(product.description).toBe(specialProductDto.description);
    });
  });
});