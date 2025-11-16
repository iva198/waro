// routes/__tests__/inventory.test.js - Product Inventory API tests
const request = require('supertest');
const app = require('../../server');
const { query } = require('../../db/connection');
const { closePool } = require('../../db/connection');

describe('Product Inventory API Endpoints', () => {
  afterAll(async () => {
    await closePool();
  });

  describe('GET /v1/inventory/products', () => {
    let token;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `inventest_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Inventory Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;
    });

    test('should return all products for authenticated user', async () => {
      const response = await request(app)
        .get('/v1/inventory/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Produk berhasil diambil');
      expect(response.body).toHaveProperty('products');
      expect(Array.isArray(response.body.products)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('total');
    });
  });

  describe('POST /v1/inventory/products', () => {
    let token;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `addprod_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Add Product Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;
    });

    test('should create a new product successfully', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newProduct = {
        sku: `testsku${randomSuffix}`,
        name: `Test Product ${randomSuffix}`,
        price_cents: 15000,
        category: 'CONSUMER_GOODS',
        uom: 'pcs',
        cost_cents: 12000,
        min_stock_threshold: 5,
        max_stock_threshold: 100
      };

      const response = await request(app)
        .post('/v1/inventory/products')
        .set('Authorization', `Bearer ${token}`)
        .send(newProduct)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('berhasil dibuat');
      expect(response.body).toHaveProperty('product');
      expect(response.body.product.name).toBe(newProduct.name);
      expect(response.body.product.sku).toBe(newProduct.sku);
      expect(response.body.product.price_cents).toBe(newProduct.price_cents);
    });

    test('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/v1/inventory/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          // Missing required fields: name, price_cents
        })
        .expect(400);

      expect(response.body.error).toContain('Kolom ini wajib diisi');
    });
  });

  describe('GET /v1/inventory/products/:id', () => {
    let token;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `getprod_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Get Product Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;
    });

    test('should return a specific product', async () => {
      // First create a product to get its ID
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newProduct = {
        sku: `getprod${randomSuffix}`,
        name: `Get Product Test ${randomSuffix}`,
        price_cents: 20000,
        category: 'FOOD',
        uom: 'pcs'
      };

      // Create the product first
      const createResponse = await request(app)
        .post('/v1/inventory/products')
        .set('Authorization', `Bearer ${token}`)
        .send(newProduct)
        .expect(201);

      const productId = createResponse.body.product.id;

      // Now fetch the product
      const response = await request(app)
        .get(`/v1/inventory/products/${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('product');
      expect(response.body.product.id).toBe(productId);
      expect(response.body.product.name).toBe(newProduct.name);
    });
  });

  describe('PUT /v1/inventory/products/:id', () => {
    let token;
    let productId;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `updateprod_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Update Product Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;

      // Create a product to update
      const productResponse = await request(app)
        .post('/v1/inventory/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: `updateprod${randomSuffix}`,
          name: `Update Product Test ${randomSuffix}`,
          price_cents: 25000,
          category: 'BEVERAGE',
          uom: 'bottle'
        })
        .expect(201);

      productId = productResponse.body.product.id;
    });

    test('should update a product successfully', async () => {
      const updatedProduct = {
        name: 'Updated Product Name',
        price_cents: 30000,
        min_stock_threshold: 10
      };

      const response = await request(app)
        .put(`/v1/inventory/products/${productId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedProduct)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('berhasil diperbarui');
      expect(response.body).toHaveProperty('product');
      expect(response.body.product.name).toBe(updatedProduct.name);
      expect(response.body.product.price_cents).toBe(updatedProduct.price_cents);
    });
  });

  describe('POST /v1/inventory/stock-adjustment', () => {
    let token;
    let productId;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `stockadj_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Stock Adjustment Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;

      // Create a product for stock adjustment
      const productResponse = await request(app)
        .post('/v1/inventory/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: `stockadj${randomSuffix}`,
          name: `Stock Adjustment Test ${randomSuffix}`,
          price_cents: 18000,
          category: 'CONSUMER_GOODS',
          uom: 'box'
        })
        .expect(201);

      productId = productResponse.body.product.id;
    });

    test('should adjust product stock successfully', async () => {
      const adjustment = {
        product_id: productId,
        quantity: 50,  // Adding 50 units of stock
        reason: 'RESTOCK_PURCHASE',
        notes: 'Initial stock increase'
      };

      const response = await request(app)
        .post('/v1/inventory/stock-adjustment')
        .set('Authorization', `Bearer ${token}`)
        .send(adjustment)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Stok berhasil disesuaikan');
      expect(response.body).toHaveProperty('product');
      expect(response.body).toHaveProperty('movement');
      expect(response.body.product.quantity_adjusted).toBe(adjustment.quantity);
    });

    test('should return error for invalid quantity', async () => {
      const adjustment = {
        product_id: productId,
        quantity: "not_an_integer",  // Invalid quantity type
        reason: 'RESTOCK_PURCHASE'
      };

      const response = await request(app)
        .post('/v1/inventory/stock-adjustment')
        .set('Authorization', `Bearer ${token}`)
        .send(adjustment)
        .expect(400);

      expect(response.body.error).toContain('Format tidak valid');
    });
  });

  describe('GET /v1/inventory/low-stock', () => {
    let token;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `lowstock_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Low Stock Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;
    });

    test('should return products with low stock', async () => {
      const response = await request(app)
        .get('/v1/inventory/low-stock')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Produk dengan stok rendah berhasil diambil');
      expect(response.body).toHaveProperty('low_stock_products');
      expect(Array.isArray(response.body.low_stock_products)).toBe(true);
    });
  });

  describe('GET /v1/inventory/movements', () => {
    let token;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `movements_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Movements Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;
    });

    test('should return inventory movement history', async () => {
      const response = await request(app)
        .get('/v1/inventory/movements')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Pergerakan inventaris berhasil diambil');
      expect(response.body).toHaveProperty('movements');
      expect(Array.isArray(response.body.movements)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });
  });
});