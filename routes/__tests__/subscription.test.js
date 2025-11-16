// routes/__tests__/subscription.test.js - Subscription API tests
const request = require('supertest');
const app = require('../../server');
const { query, closePool } = require('../../db/connection');

describe('Subscription API Endpoints', () => {
  afterAll(async () => {
    await closePool();
  });

  describe('GET /v1/subscription/plans', () => {
    test('should return all available subscription plans', async () => {
      const response = await request(app)
        .get('/v1/subscription/plans')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Daftar paket langganan berhasil diambil');
      expect(response.body).toHaveProperty('plans');
      expect(Array.isArray(response.body.plans)).toBe(true);
      expect(response.body.plans.length).toBeGreaterThan(0);
      
      // Check that each plan has required properties
      response.body.plans.forEach(plan => {
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('plan_type');
        expect(plan).toHaveProperty('description');
        expect(plan).toHaveProperty('max_cashiers');
        expect(plan).toHaveProperty('max_stores');
      });
    });
  });

  describe('POST /v1/subscription/subscribe', () => {
    let userId, token, planId;

    beforeAll(async () => {
      // Get a subscription plan ID for testing
      const planResult = await query(
        'SELECT id FROM subscription_plans WHERE plan_type = \'FREE_OFFLINE\' LIMIT 1'
      );
      if (planResult.rows.length > 0) {
        planId = planResult.rows[0].id;
      }
      
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `subtest_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Subscription Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      userId = registerResponse.body.user.id;
      token = registerResponse.body.token;
    });

    test('should subscribe to a free plan successfully', async () => {
      const response = await request(app)
        .post('/v1/subscription/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plan_id: planId,
          duration: 'monthly' // Free plan doesn't need payment method
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Berhasil berlangganan');
      expect(response.body).toHaveProperty('subscription');
      expect(response.body.subscription).toHaveProperty('status', 'ACTIVE');
      expect(response.body.subscription).toHaveProperty('user_id', userId);
    });

    test('should not allow multiple active subscriptions', async () => {
      const freePlanResult = await query(
        'SELECT id FROM subscription_plans WHERE plan_type = \'FREE_OFFLINE\' LIMIT 1'
      );
      const freePlanId = freePlanResult.rows[0].id;

      const response = await request(app)
        .post('/v1/subscription/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send({
          plan_id: freePlanId,
          duration: 'monthly'
        })
        .expect(400);

      expect(response.body.error).toContain('sudah memiliki langganan aktif');
    });
  });

  describe('GET /v1/subscription/my-plan', () => {
    let token;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `myplan_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `My Plan Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);
      
      token = registerResponse.body.token;
    });

    test('should return current subscription if exists', async () => {
      const response = await request(app)
        .get('/v1/subscription/my-plan')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('subscription');
    });
  });

  describe('GET /v1/subscription/check-permissions', () => {
    let token;
    let planId;

    beforeAll(async () => {
      // Register a test user
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `permission_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Permission Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      token = registerResponse.body.token;

      // Get a free plan ID for subscription
      const planResult = await query(
        'SELECT id FROM subscription_plans WHERE plan_type = \'FREE_OFFLINE\' LIMIT 1'
      );

      if (planResult.rows.length > 0) {
        planId = planResult.rows[0].id;
      }
    });

    test('should return current subscription permissions', async () => {
      // Subscribe to a free plan first
      if (planId) {
        await request(app)
          .post('/v1/subscription/subscribe')
          .set('Authorization', `Bearer ${token}`)
          .send({
            plan_id: planId,
            duration: 'monthly'
          })
          .expect(200);
      }

      const response = await request(app)
        .get('/v1/subscription/check-permissions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('permissions');
      if (response.body.permissions) {
        expect(response.body.permissions).toHaveProperty('max_cashiers');
        expect(response.body.permissions).toHaveProperty('max_stores');
        expect(response.body.permissions).toHaveProperty('current_cashiers');
        expect(response.body.permissions).toHaveProperty('current_stores');
        expect(response.body.permissions).toHaveProperty('allowed_payment_methods');
        expect(response.body.permissions).toHaveProperty('offline_access');
        expect(response.body.permissions).toHaveProperty('cloud_sync');
      }
    });
  });
});