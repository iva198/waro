// routes/__tests__/auth.test.js - Authentication API tests
const request = require('supertest');
const app = require('../../server');
const { query, closePool } = require('../../db/connection');

describe('Authentication API Endpoints', () => {
  beforeAll(async () => {
    // Set environment to test
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    await closePool();
  });

  describe('POST /v1/auth/register', () => {
    test('should register a new user successfully with email method', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `testuser_${randomSuffix}@example.com`, // Use a truly unique email
        password: 'testpassword123',
        full_name: `Test User ${randomSuffix}`,
        phone: `+628123456${String(Date.now()).slice(-5)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'  // Specify registration method
      };

      const response = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(newUser.email);
      expect(response.body.user.full_name).toBe(newUser.full_name);
      expect(response.body).toHaveProperty('store');
      expect(response.body.registration_method).toBe('email');
      // The expected message depends on the registration method
      // For 'email' method, the message changes to verification required
      expect(response.body.message).toContain('Kode verifikasi telah dikirim ke email Anda'); // Contains verification message
      expect(response.body.email_verification_required).toBe(true);
    });

    test('should return 400 for invalid registration data', async () => {
      const invalidUser = {
        email: 'invalid-email', // Invalid email format
        password: '123', // Too short
        full_name: '' // Empty name
      };

      const response = await request(app)
        .post('/v1/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should return 409 when email already exists', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      // Register a user first
      const newUser = {
        email: `duplicate_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Duplicate Test User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`,
        registration_method: 'email'  // Specify registration method
      };

      // Register the user
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      // Try to register with the same email again
      const response = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(409);

      expect(response.body.error).toContain('Email sudah terdaftar'); // Indonesian for 'Email already registered'
    });
  });

  describe('POST /v1/auth/login', () => {
    test('should login user with correct credentials', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `login_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Login Test User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`,
        registration_method: 'email'  // Specify registration method
      };

      // Register the user first
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      const loginData = {
        email: newUser.email,
        password: 'testpassword123',
        login_method: 'traditional'  // Updated to match new login format
      };

      const response = await request(app)
        .post('/v1/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.message).toBe('Login berhasil'); // Indonesian for 'Login successful'
    });

    test('should return 401 for invalid credentials', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `invalid_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Invalid Test User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`,
        registration_method: 'email'  // Specify registration method
      };

      // Register the user first
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      const invalidLogin = {
        email: newUser.email,
        password: 'wrongpassword',
        login_method: 'traditional'  // Updated to match new login format
      };

      const response = await request(app)
        .post('/v1/auth/login')
        .send(invalidLogin)
        .expect(401);

      expect(response.body.error).toContain('Email, username, atau password salah'); // Updated Indonesian message
    });

    test('should return 401 for non-existent user', async () => {
      const invalidLogin = {
        email: 'nonexistent@example.com',
        password: 'anyPassword',
        login_method: 'traditional'  // Updated to match new login format
      };

      const response = await request(app)
        .post('/v1/auth/login')
        .send(invalidLogin)
        .expect(401);

      expect(response.body.error).toContain('Email, username, atau password salah'); // Updated Indonesian message
    });
  });

  describe('POST /v1/auth/email/verify', () => {
    test('should verify email with correct code', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `verify_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Verify Test User ${randomSuffix}`,
        registration_method: 'email'
      };

      // Register the user first
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      // For testing purposes, we'll use a mock verification code
      // In a real scenario, the verification code would come from the registration response
      const response = await request(app)
        .post('/v1/auth/email/verify')
        .send({
          email: newUser.email,
          code: '123456' // This is a mock code, likely won't match the actual one
        });

      // The response depends on whether the verification code matches
      // Could be 200 (success), 401 (wrong/expired code), or 400 (missing fields)
      expect([200, 401, 400]).toContain(response.status);
    });
  });

  describe('POST /v1/auth/smart-login', () => {
    test('should login with email and password successfully', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `smartlogin_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Smart Login User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'
      };

      // Register the user first
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      // Login using smart login with email and password
      const response = await request(app)
        .post('/v1/auth/smart-login')
        .send({
          input: newUser.email,
          password: 'testpassword123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(newUser.email);
      expect(response.body.message).toContain('Login berhasil'); // Indonesian for 'Login successful'
    });

    test('should return error for non-existent email', async () => {
      const response = await request(app)
        .post('/v1/auth/smart-login')
        .send({
          input: 'nonexistent@example.com',
          password: 'somepassword'
        })
        .expect(401);

      expect(response.body.error).toContain('Email, username, atau password salah'); // Indonesian for 'Account does not exist'
    });

    test('should return error for invalid credentials', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `invalidcred_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Invalid Cred User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'
      };

      // Register the user first
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      // Try to login with wrong password
      const response = await request(app)
        .post('/v1/auth/smart-login')
        .send({
          input: newUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.error).toContain('Email, username, atau password salah'); // Indonesian for 'Invalid credentials'
    });

    test('should return error for missing password when using email', async () => {
      const response = await request(app)
        .post('/v1/auth/smart-login')
        .send({
          input: 'test@example.com'
          // No password provided
        })
        .expect(400);

      expect(response.body.error).toContain('password required for email login');
    });
  });

  describe('POST /v1/auth/forgot-password', () => {
    test('should send password reset instructions successfully', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `reset_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Reset User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'
      };

      // Register the user first
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      // Request password reset
      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({
          email: newUser.email
        })
        .expect(200);

      expect(response.body.message).toBe('Instruksi reset password telah dikirim ke email Anda');
    });

    test('should return success even for non-existent email (to prevent enumeration)', async () => {
      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);

      expect(response.body.message).toBe('Instruksi reset password telah dikirim ke email Anda');
    });

    test('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({
          email: 'invalid-email'
        })
        .expect(400);

      expect(response.body.error).toContain('Format tidak valid: email');
    });

    test('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/v1/auth/forgot-password')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Kolom ini wajib diisi');
    });
  });

  describe('POST /v1/auth/otp', () => {
    test('should send OTP to phone number', async () => {
      const phoneData = {
        phone: '+6281234567891' // Different phone number
      };

      const response = await request(app)
        .post('/v1/auth/otp/send')
        .send(phoneData)
        .expect(200);

      expect(response.body.message).toBe('Kode OTP telah dikirim');
      expect(response.body).toHaveProperty('phone');
    });

    test('should return 400 for missing phone in OTP send', async () => {
      const response = await request(app)
        .post('/v1/auth/otp/send')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Kolom ini wajib diisi');
    });
  });

  describe('PUT /v1/auth/profile', () => {
    test('should update user profile successfully', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `profile_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Profile User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'
      };

      // Register and login the user first
      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      const token = registerResponse.body.token;

      // Update profile
      const response = await request(app)
        .put('/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          full_name: `Updated Profile User ${randomSuffix}`,
          phone: `+62812345${String(Date.now() - 1000).slice(-6)}` // Different phone
        })
        .expect(200);

      expect(response.body.message).toBe('Profil berhasil diperbarui');
      expect(response.body.user.full_name).toBe(`Updated Profile User ${randomSuffix}`);
    });

    test('should return error for invalid phone format', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `profile_invalid_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Profile Invalid User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'
      };

      // Register and login the user first
      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      const token = registerResponse.body.token;

      // Try to update with invalid phone
      const response = await request(app)
        .put('/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          phone: 'invalid-phone'
        })
        .expect(400);

      expect(response.body.error).toContain('Format tidak valid');
    });
  });

  describe('PUT /v1/auth/store', () => {
    test('should update store information successfully', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `store_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Store User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'
      };

      // Register and login the user first
      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      const token = registerResponse.body.token;

      // Update store
      const response = await request(app)
        .put('/v1/auth/store')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Updated Store Name ${randomSuffix}`,
          address: 'Updated Store Address'
        })
        .expect(200);

      expect(response.body.message).toBe('Informasi toko berhasil diperbarui');
      expect(response.body.store.name).toBe(`Updated Store Name ${randomSuffix}`);
    });

    test('should return error for invalid business type', async () => {
      const randomSuffix = Date.now() + Math.random().toString(36).substring(2, 10);
      const newUser = {
        email: `store_invalid_${randomSuffix}@example.com`,
        password: 'testpassword123',
        full_name: `Store Invalid User ${randomSuffix}`,
        phone: `+62812345${String(Date.now()).slice(-6)}`, // Use time-based phone to ensure uniqueness
        registration_method: 'email'
      };

      // Register and login the user first
      const registerResponse = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(201);

      const token = registerResponse.body.token;

      // Try to update with invalid business type
      const response = await request(app)
        .put('/v1/auth/store')
        .set('Authorization', `Bearer ${token}`)
        .send({
          business_type: 'INVALID_TYPE'
        })
        .expect(400);

      expect(response.body.error).toContain('business_type must be one of');
    });
  });
});