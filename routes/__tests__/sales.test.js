// routes/__tests__/sales.test.js - Sales API tests
const request = require('supertest');
const app = require('../../server');
const { query, closePool } = require('../../db/connection');

describe('Sales API Endpoints', () => {
  beforeAll(async () => {
    // Set environment to test
    process.env.NODE_ENV = 'test';
  });

  // Helper function to set up test data
  const setupTestData = async () => {
    // Create a tenant and store for testing
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const storeId = '22222222-2222-2222-2222-222222222222';
    const cashierId = '33333333-3333-3333-3333-333333333333';

    // Create a test store
    await query(
      `INSERT INTO stores (id, tenant_id, name, address)
       VALUES ($1, $2, 'Test Store', 'Test Address')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
      [storeId, tenantId]
    );

    // Create a test user
    await query(
      `INSERT INTO users (id, tenant_id, role, full_name)
       VALUES ($1, $2, 'CASHIER', 'Test Cashier')
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name`,
      [cashierId, tenantId]
    );

    return { tenantId, storeId, cashierId };
  };

  afterAll(async () => {
    await closePool();
  });

  describe('POST /v1/sales', () => {
    test('should create a new sale successfully', async () => {
      const { tenantId, storeId, cashierId } = await setupTestData();

      const newSale = {
        tenant_id: tenantId,
        store_id: storeId,
        cashier_user_id: cashierId,
        subtotal_cents: 15000,
        total_cents: 15000,
        sale_items: [
          {
            product_id: '44444444-4444-4444-4444-444444444444', // Valid UUID for testing
            qty: 2,
            unit_price_cents: 5000
          },
          {
            product_id: '55555555-5555-5555-5555-555555555555', // Valid UUID for testing
            qty: 1,
            unit_price_cents: 5000
          }
        ]
      };

      const response = await request(app)
        .post('/v1/sales')
        .send(newSale)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.tenant_id).toBe(tenantId);
      expect(response.body.total_cents).toBe(15000);
      expect(response.body.sale_items).toHaveLength(2);
      expect(response.body.payment_status).toBe('PENDING');
      expect(response.body.message).toBeDefined();
    });

    test('should return 400 for missing required fields', async () => {
      const invalidSale = {
        // Missing required fields
      };

      const response = await request(app)
        .post('/v1/sales')
        .send(invalidSale)
        .expect(400);

      expect(response.body.error).toBeDefined();
      // The error should be in Indonesian
      expect(response.body.error).toContain('Kolom wajib tidak boleh kosong');
    });

    test('should return 400 for invalid sale items', async () => {
      const { tenantId, storeId, cashierId } = await setupTestData();

      const newSale = {
        tenant_id: tenantId,
        store_id: storeId,
        cashier_user_id: cashierId,
        subtotal_cents: 15000,
        total_cents: 15000,
        sale_items: [
          {
            // Missing required fields in sale item
          }
        ]
      };

      const response = await request(app)
        .post('/v1/sales')
        .send(newSale)
        .expect(400);

      expect(response.body.error).toBeDefined();
      // The error should be in Indonesian
      expect(response.body.error).toContain('Setiap item penjualan harus memiliki');
    });

    test('should create a sale with payment record for non-cash methods', async () => {
      const { tenantId, storeId, cashierId } = await setupTestData();

      const newSale = {
        tenant_id: tenantId,
        store_id: storeId,
        cashier_user_id: cashierId,
        subtotal_cents: 20000,
        total_cents: 20000,
        payment_method: 'QRIS',
        provider: 'MIDTRANS',
        sale_items: [
          {
            product_id: '99999999-9999-9999-9999-999999999999', // Valid UUID for testing
            qty: 4,
            unit_price_cents: 5000
          }
        ]
      };

      const response = await request(app)
        .post('/v1/sales')
        .send(newSale)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.payment_status).toBe('PENDING');
      expect(response.body.message).toBeDefined();

      // Verify that a payment record was created
      const paymentCheck = await query(
        'SELECT * FROM payments WHERE sale_id = $1',
        [response.body.id]
      );
      expect(paymentCheck.rows).toHaveLength(1);
      expect(paymentCheck.rows[0].method).toBe('QRIS');
    });
  });

  describe('GET /v1/sales/:id', () => {
    let testSaleId;

    beforeEach(async () => {
      // Set up test data
      const { tenantId, storeId, cashierId } = await setupTestData();

      // Create a test sale first using a unique ID for this test
      const saleId = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';
      const result = await query(
        `INSERT INTO sales (
          id, tenant_id, store_id, cashier_user_id, sale_no,
          subtotal_cents, total_cents, payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET sale_no = EXCLUDED.sale_no
        RETURNING id`,
        [saleId, tenantId, storeId, cashierId,
         'SALE-TEST-002', 10000, 10000, 'PAID']
      );

      testSaleId = result.rows[0].id;

      // Add a sale item
      await query(
        `INSERT INTO sale_items (
          id, sale_id, product_id, qty, unit_price_cents, total_cents
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET qty = EXCLUDED.qty`,
        ['f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2', testSaleId, 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 1, 10000, 10000]
      );
    });

    test('should return a specific sale with its items', async () => {
      const response = await request(app)
        .get(`/v1/sales/${testSaleId}`)
        .expect(200);

      expect(response.body.id).toBe(testSaleId);
      expect(response.body.sale_items).toHaveLength(1);
      expect(response.body.sale_items[0].product_id).toBe('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2');
    });

    test('should return 404 for non-existent sale', async () => {
      const response = await request(app)
        .get('/v1/sales/99999999-9999-9999-9999-999999999999')  // Valid UUID format but doesn't exist
        .expect(404);

      expect(response.body.error).toContain('tidak ditemukan'); // Indonesian for 'not found'
    });

    test('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/v1/sales/invalid-id-format')  // Invalid UUID format
        .expect(400);

      expect(response.body.error).toContain('Format tidak valid'); // Indonesian for 'invalid format'
    });
  });

  describe('GET /v1/sales', () => {
    test('should return sales for a specific tenant', async () => {
      const response = await request(app)
        .get('/v1/sales?tenant_id=11111111-1111-1111-1111-111111111111')
        .expect(200);

      expect(response.body).toHaveProperty('sales');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.sales)).toBe(true);
    });

    test('should return 400 when tenant_id is missing', async () => {
      const response = await request(app)
        .get('/v1/sales')
        .expect(400);

      expect(response.body.error).toContain('tenant_id');
    });
  });
});