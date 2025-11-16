// routes/auth.js - Authentication API routes
const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Middleware for input validation
const validateRegister = (req, res, next) => {
  const { email, password, full_name, phone, username, registration_method } = req.body;

  // Registration method determines which fields are required
  if (!registration_method) {
    return res.status(400).json({
      error: req.t('validation.required') + ': registration_method (google, phone, email)'
    });
  }

  if (registration_method === 'email') {
    // Email registration needs email, password, and full_name
    if (!email || !password || !full_name) {
      return res.status(400).json({
        error: req.t('validation.required') + ': email, password, full_name for email registration'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: req.t('validation.invalidFormat') + ': email'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        error: req.t('validation.mustBePositive') + ': password must be at least 6 characters'
      });
    }
  } else if (registration_method === 'phone') {
    // Phone registration needs phone number
    if (!phone || !full_name) {
      return res.status(400).json({
        error: req.t('validation.required') + ': phone, full_name for phone registration'
      });
    }

    // Validate phone format (Indonesian format)
    const phoneRegex = /^(\+62|0)[2-9]\d{7,14}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        error: req.t('validation.invalidFormat') + ': phone'
      });
    }
  } else if (registration_method === 'google') {
    // Google registration only needs full_name (Google will provide email and other details)
    if (!full_name) {
      return res.status(400).json({
        error: req.t('validation.required') + ': full_name for Google registration'
      });
    }
  } else {
    return res.status(400).json({
      error: req.t('validation.invalidFormat') + ': registration_method must be google, phone, or email'
    });
  }

  next();
};

// Function to detect input type
const detectInputType = (input) => {
  if (!input) return null;

  // Check if it's an email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(input)) return 'email';

  // Check if it's an Indonesian phone number
  const phoneRegex = /^(\+62|0)[2-9]\d{7,14}$/;
  if (phoneRegex.test(input)) return 'phone';

  // If it contains @, it's likely intended to be an email
  if (input.includes('@')) return 'email';

  // Otherwise assume it's a username
  return 'username';
};

const validateLogin = (req, res, next) => {
  const { email, username, phone, password, input } = req.body;

  // If 'input' is provided, detect what type it is
  if (input) {
    const inputType = detectInputType(input);

    if (inputType === 'email') {
      req.body.email = input;
      req.body.login_type = 'email';
    } else if (inputType === 'phone') {
      req.body.phone = input;
      req.body.login_type = 'phone';
    } else if (inputType === 'username') {
      req.body.username = input;
      req.body.login_type = 'username';
    }
  }

  // At least one identifier is required
  if (!email && !username && !phone) {
    return res.status(400).json({
      error: req.t('validation.required') + ': email, username, or phone (or input field)'
    });
  }

  // Password is required for password-based login
  if (!password && (email || username)) {
    return res.status(400).json({
      error: req.t('validation.required') + ': password'
    });
  }

  next();
};

// POST /v1/auth/register - Register a new user with different methods
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { email, password, full_name, phone, username, registration_method } = req.body;

    // Use the registration method to determine which fields are required
    let userId = uuidv4();
    let tenantId = uuidv4(); // Each user gets their own tenant
    let hashedPassword = null;
    let emailVerificationCode = null;
    let emailVerificationExpires = null;
    let phoneVerificationCode = null;
    let phoneVerificationExpires = null;

    // Hash the password if provided
    if (password) {
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(password, saltRounds);
    }

    // Handle different registration methods
    if (registration_method === 'email') {
      // Check if email already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          error: req.t('auth.email_exists') || 'Email already registered'
        });
      }

      // Generate email verification code
      emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
      emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    }
    else if (registration_method === 'phone') {
      // Check if phone already exists
      if (phone) {
        const existingUser = await query(
          'SELECT id FROM users WHERE phone = $1',
          [phone]
        );

        if (existingUser.rows.length > 0) {
          return res.status(409).json({
            error: req.t('auth.phone_exists') || 'Phone number already registered'
          });
        }
      }
    }
    else if (registration_method === 'google') {
      // For Google registration, we expect the user to be validated via Google login
      // Additional validation would happen in the Google auth endpoint
    }

    // Create user with a generated tenant_id
    const userResult = await query(
      `INSERT INTO users (
        id, tenant_id, role, full_name, email, phone, username, password_hash,
        email_verification_code, email_verification_expires, phone_verification_code, phone_verification_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, tenant_id, full_name, email, username, phone, role, created_at`,
      [
        userId, tenantId, 'OWNER', full_name,
        email || null, phone || null, username || null, hashedPassword,
        emailVerificationCode, emailVerificationExpires, phoneVerificationCode, phoneVerificationExpires
      ]
    );

    // Create a default store for the user
    const storeResult = await query(
      `INSERT INTO stores (
        id, tenant_id, name
      ) VALUES ($1, $2, $3)
      RETURNING id, name`,
      [uuidv4(), tenantId, `${full_name}'s Store`]
    );

    // Generate JWT token for immediate use after registration
    // If email verification is required, the user will need to verify separately
    const token = jwt.sign(
      {
        userId: userResult.rows[0].id,
        tenantId: userResult.rows[0].tenant_id,
        email: userResult.rows[0].email,
        phone: userResult.rows[0].phone,
        username: userResult.rows[0].username
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    const response = {
      message: req.t('auth.register_success') || 'Registration successful',
      token,
      user: userResult.rows[0],
      store: storeResult.rows[0],
      registration_method: registration_method
    };

    // If email registration is used, send verification email (simulated here)
    if (registration_method === 'email' && email) {
      response.email_verification_required = true;
      response.message = req.t('auth.email_verification_sent') || 'Verification code sent to your email. Please verify to activate your account.';
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      error: req.t('auth.register_error') || 'Registration failed',
      details: error.message
    });
  }
});

// POST /v1/auth/login - Login with email/username/phone + password
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, username, phone, password } = req.body;

    // Build query based on provided identifier
    let queryText = `SELECT id, tenant_id, full_name, email, username, phone, password_hash, role, status
                     FROM users WHERE `;
    let queryParams = [];

    if (email) {
      queryText += 'email = $1';
      queryParams = [email];
    } else if (username) {
      queryText += 'username = $1';
      queryParams = [username];
    } else if (phone) {
      queryText += 'phone = $1';
      queryParams = [phone];
    }

    const userResult = await query(queryText, queryParams);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: req.t('auth.invalid_credentials') || 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // Check if user account is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        error: req.t('auth.account_inactive') || 'Account is inactive'
      });
    }

    // Check if user has a password (for password-based login)
    if (!user.password_hash) {
      return res.status(401).json({
        error: req.t('auth.invalid_credentials') || 'No password set for this account'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: req.t('auth.invalid_credentials') || 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        phone: user.phone,
        username: user.username
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    // Get store information for the user
    const storeResult = await query(
      `SELECT id, name, address, created_at
       FROM stores WHERE tenant_id = $1`,
      [user.tenant_id]
    );

    res.json({
      message: req.t('auth.login_success') || 'Login successful',
      token,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role
      },
      store: storeResult.rows[0] || null
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({
      error: req.t('auth.login_error') || 'Login failed',
      details: error.message
    });
  }
});

// POST /v1/auth/google - Login with Google account
router.post('/google', async (req, res) => {
  try {
    if (!client) {
      return res.status(500).json({
        error: req.t('auth.google_login_failed') || 'Google authentication not configured'
      });
    }

    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        error: req.t('validation.required') + ': credential'
      });
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload['sub'];
    const email = payload['email'];
    const full_name = payload['name'];
    const picture = payload['picture'];

    // Check if user already exists with this Google ID
    let userResult = await query(
      'SELECT id, tenant_id, full_name, email, username, phone, role, status FROM users WHERE google_id = $1',
      [googleId]
    );

    let user;
    let isNewUser = false;

    if (userResult.rows.length === 0) {
      // Create new user if doesn't exist
      const userId = uuidv4();
      const tenantId = uuidv4();

      userResult = await query(
        `INSERT INTO users (
          id, tenant_id, role, full_name, email, google_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, tenant_id, full_name, email, username, phone, role, created_at`,
        [userId, tenantId, 'OWNER', full_name, email, googleId]
      );

      // Create a default store for the new user
      await query(
        `INSERT INTO stores (
          id, tenant_id, name
        ) VALUES ($1, $2, $3)`,
        [uuidv4(), tenantId, `${full_name}'s Store`]
      );

      user = userResult.rows[0];
      isNewUser = true;
    } else {
      user = userResult.rows[0];

      // Update user info from Google if needed
      await query(
        `UPDATE users SET
          full_name = $1,
          email = $2
         WHERE google_id = $3`,
        [full_name, email, googleId]
      );
    }

    // Check if user account is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        error: req.t('auth.account_inactive') || 'Account is inactive'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        googleId: googleId
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    // Get store information for the user
    const storeResult = await query(
      `SELECT id, name, address, created_at
       FROM stores WHERE tenant_id = $1`,
      [user.tenant_id]
    );

    res.json({
      message: req.t('auth.login_success') || 'Login successful',
      token,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role,
        isNewUser: isNewUser
      },
      store: storeResult.rows[0] || null
    });
  } catch (error) {
    console.error('Error with Google login:', error);
    res.status(500).json({
      error: req.t('auth.google_login_failed') || 'Google login failed',
      details: error.message
    });
  }
});

// POST /v1/auth/smart-login - Smart login that detects input type automatically
router.post('/smart-login', async (req, res) => {
  try {
    const { input, password, otp, credential } = req.body;

    if (!input && !credential) {
      return res.status(400).json({
        error: req.t('validation.required') + ': input or credential required'
      });
    }

    // If credential is provided, assume it's Google login
    if (credential) {
      // Forward to Google login logic
      if (!client) {
        return res.status(500).json({
          error: req.t('auth.google_login_failed') || 'Google authentication not configured'
        });
      }

      try {
        const ticket = await client.verifyIdToken({
          idToken: credential,
          audience: CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const googleId = payload['sub'];
        const email = payload['email'];
        const full_name = payload['name'];
        const picture = payload['picture'];

        // Check if user already exists with this Google ID
        let userResult = await query(
          'SELECT id, tenant_id, full_name, email, username, phone, role, status FROM users WHERE google_id = $1',
          [googleId]
        );

        let user;
        let isNewUser = false;

        if (userResult.rows.length === 0) {
          // Check if email already exists with another account
          const existingEmailResult = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
          );

          if (existingEmailResult.rows.length > 0) {
            return res.status(409).json({
              error: req.t('auth.email_exists') || 'Email already registered with another account'
            });
          }

          // Create new user if doesn't exist
          const userId = uuidv4();
          const tenantId = uuidv4();

          userResult = await query(
            `INSERT INTO users (
              id, tenant_id, role, full_name, email, google_id
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, tenant_id, full_name, email, username, phone, role, created_at`,
            [userId, tenantId, 'OWNER', full_name, email, googleId]
          );

          // Create a default store for the new user
          await query(
            `INSERT INTO stores (
              id, tenant_id, name
            ) VALUES ($1, $2, $3)`,
            [uuidv4(), tenantId, `${full_name}'s Store`]
          );

          user = userResult.rows[0];
          isNewUser = true;
        } else {
          user = userResult.rows[0];

          // Update user info from Google if needed
          await query(
            `UPDATE users SET
              full_name = $1,
              email = $2
             WHERE google_id = $3`,
            [full_name, email, googleId]
          );
        }

        // Check if user account is active
        if (user.status !== 'ACTIVE') {
          return res.status(401).json({
            error: req.t('auth.account_inactive') || 'Account is inactive'
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            userId: user.id,
            tenantId: user.tenant_id,
            email: user.email,
            googleId: googleId
          },
          process.env.JWT_SECRET || 'fallback_secret_key',
          { expiresIn: '24h' }
        );

        // Get store information for the user
        const storeResult = await query(
          `SELECT id, name, address, created_at
           FROM stores WHERE tenant_id = $1`,
          [user.tenant_id]
        );

        return res.json({
          message: req.t('auth.login_success') || 'Login successful',
          token,
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            username: user.username,
            role: user.role
          },
          store: storeResult.rows[0] || null,
          isNewUser: isNewUser
        });
      } catch (error) {
        console.error('Error with Google login:', error);
        return res.status(401).json({
          error: req.t('auth.google_login_failed') || 'Invalid Google credential'
        });
      }
    }

    // If input is provided, detect its type and handle accordingly
    if (input) {
      const inputType = detectInputType(input);

      if (inputType === 'email') {
        // Email login requires password
        if (!password) {
          return res.status(400).json({
            error: req.t('validation.required') + ': password required for email login'
          });
        }

        // Login with email and password
        const userResult = await query(
          `SELECT id, tenant_id, full_name, email, username, phone, password_hash, role, status
           FROM users WHERE email = $1`,
          [input]
        );

        if (userResult.rows.length === 0) {
          return res.status(401).json({
            error: req.t('auth.invalid_credentials') || 'Account does not exist'
          });
        }

        const user = userResult.rows[0];

        // Check if user account is active
        if (user.status !== 'ACTIVE') {
          return res.status(401).json({
            error: req.t('auth.account_inactive') || 'Account is inactive'
          });
        }

        // Check if user has a password (for password-based login)
        if (!user.password_hash) {
          return res.status(401).json({
            error: req.t('auth.invalid_credentials') || 'No password set for this account'
          });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({
            error: req.t('auth.invalid_credentials') || 'Invalid credentials'
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            userId: user.id,
            tenantId: user.tenant_id,
            email: user.email,
            phone: user.phone,
            username: user.username
          },
          process.env.JWT_SECRET || 'fallback_secret_key',
          { expiresIn: '24h' }
        );

        // Get store information for the user
        const storeResult = await query(
          `SELECT id, name, address, created_at
           FROM stores WHERE tenant_id = $1`,
          [user.tenant_id]
        );

        return res.json({
          message: req.t('auth.login_success') || 'Login successful',
          token,
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            username: user.username,
            role: user.role
          },
          store: storeResult.rows[0] || null
        });
      }
      else if (inputType === 'phone') {
        // Phone login either with OTP or password
        if (otp) {
          // Verify OTP
          const userResult = await query(
            `SELECT id, tenant_id, full_name, email, username, phone, role, status
             FROM users WHERE phone = $1 AND phone_verification_code = $2 AND phone_verification_expires > NOW()`,
            [input, otp]
          );

          if (userResult.rows.length === 0) {
            return res.status(401).json({
              error: req.t('auth.invalid_otp') || 'Invalid or expired OTP'
            });
          }

          const user = userResult.rows[0];

          // Check if user account is active
          if (user.status !== 'ACTIVE') {
            return res.status(401).json({
              error: req.t('auth.account_inactive') || 'Account is inactive'
            });
          }

          // Clear the OTP after successful verification
          await query(
            `UPDATE users SET
              phone_verification_code = NULL,
              phone_verification_expires = NULL
             WHERE phone = $1`,
            [input]
          );

          // Generate JWT token
          const token = jwt.sign(
            {
              userId: user.id,
              tenantId: user.tenant_id,
              email: user.email,
              phone: user.phone,
              username: user.username
            },
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '24h' }
          );

          // Get store information for the user
          const storeResult = await query(
            `SELECT id, name, address, created_at
             FROM stores WHERE tenant_id = $1`,
            [user.tenant_id]
          );

          return res.json({
            message: req.t('auth.login_success') || 'Login successful',
            token,
            user: {
              id: user.id,
              tenant_id: user.tenant_id,
              full_name: user.full_name,
              email: user.email,
              phone: user.phone,
              username: user.username,
              role: user.role
            },
            store: storeResult.rows[0] || null
          });
        } else {
          // If no OTP provided, user needs to get OTP first
          return res.status(400).json({
            error: req.t('validation.required') + ': OTP required for phone login. Please send OTP first.'
          });
        }
      }
      else if (inputType === 'username') {
        // Username login requires password
        if (!password) {
          return res.status(400).json({
            error: req.t('validation.required') + ': password required for username login'
          });
        }

        // Login with username and password
        const userResult = await query(
          `SELECT id, tenant_id, full_name, email, username, phone, password_hash, role, status
           FROM users WHERE username = $1`,
          [input]
        );

        if (userResult.rows.length === 0) {
          return res.status(401).json({
            error: req.t('auth.invalid_credentials') || 'Account does not exist'
          });
        }

        const user = userResult.rows[0];

        // Check if user account is active
        if (user.status !== 'ACTIVE') {
          return res.status(401).json({
            error: req.t('auth.account_inactive') || 'Account is inactive'
          });
        }

        // Check if user has a password (for password-based login)
        if (!user.password_hash) {
          return res.status(401).json({
            error: req.t('auth.invalid_credentials') || 'No password set for this account'
          });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
          return res.status(401).json({
            error: req.t('auth.invalid_credentials') || 'Invalid credentials'
          });
        }

        // Generate JWT token
        const token = jwt.sign(
          {
            userId: user.id,
            tenantId: user.tenant_id,
            email: user.email,
            phone: user.phone,
            username: user.username
          },
          process.env.JWT_SECRET || 'fallback_secret_key',
          { expiresIn: '24h' }
        );

        // Get store information for the user
        const storeResult = await query(
          `SELECT id, name, address, created_at
           FROM stores WHERE tenant_id = $1`,
          [user.tenant_id]
        );

        return res.json({
          message: req.t('auth.login_success') || 'Login successful',
          token,
          user: {
            id: user.id,
            tenant_id: user.tenant_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            username: user.username,
            role: user.role
          },
          store: storeResult.rows[0] || null
        });
      }
    }

    return res.status(400).json({
      error: req.t('validation.invalidFormat') + ': Unrecognized input format'
    });

  } catch (error) {
    console.error('Error in smart login:', error);
    res.status(500).json({
      error: req.t('auth.login_error') || 'Login failed',
      details: error.message
    });
  }
});

// POST /v1/auth/otp/send - Send OTP to phone number
router.post('/otp/send', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        error: req.t('validation.required') + ': phone'
      });
    }

    // Validate phone format
    const phoneRegex = /^(\+62|0)[2-9]\d{7,14}$/; // Indonesian phone format
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        error: req.t('validation.invalidFormat') + ': phone'
      });
    }

    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // In a real app, you would send the SMS here using a service like Twilio
    // For now, we'll just store the code in the database

    // Check if user exists with this phone number
    const userResult = await query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (userResult.rows.length > 0) {
      // Update existing user with OTP
      await query(
        `UPDATE users SET
          phone_verification_code = $1,
          phone_verification_expires = $2
        WHERE phone = $3`,
        [code, expiresAt, phone]
      );
    } else {
      // Create a temporary record for OTP validation
      await query(
        `INSERT INTO users (id, tenant_id, role, full_name, phone, phone_verification_code, phone_verification_expires)
         VALUES ($1, $2, 'OWNER', $3, $4, $5, $6)`,
        [uuidv4(), uuidv4(), `Temp User ${phone}`, phone, code, expiresAt]
      );
    }

    // In a real application, send actual SMS here
    console.log(`OTP for ${phone}: ${code}`);

    res.json({
      message: req.t('auth.otp_sent') || 'OTP sent successfully',
      phone
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      error: req.t('auth.login_error') || 'Failed to send OTP',
      details: error.message
    });
  }
});

// POST /v1/auth/otp/verify - Verify OTP and login
router.post('/otp/verify', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        error: req.t('validation.required') + ': phone and otp'
      });
    }

    // Validate phone format
    const phoneRegex = /^(\+62|0)[2-9]\d{7,14}$/; // Indonesian phone format
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        error: req.t('validation.invalidFormat') + ': phone'
      });
    }

    // Check if OTP is valid and not expired
    const userResult = await query(
      `SELECT id, tenant_id, full_name, email, username, phone, role, status,
              phone_verification_code, phone_verification_expires
       FROM users
       WHERE phone = $1 AND phone_verification_code = $2`,
      [phone, otp]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: req.t('auth.invalid_otp') || 'Invalid OTP'
      });
    }

    const user = userResult.rows[0];

    // Check if OTP has expired
    const now = new Date();
    if (new Date(user.phone_verification_expires) < now) {
      return res.status(401).json({
        error: req.t('auth.otp_expired') || 'OTP has expired'
      });
    }

    // Check if user account is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({
        error: req.t('auth.account_inactive') || 'Account is inactive'
      });
    }

    // Update user to mark phone as verified and clear OTP
    await query(
      `UPDATE users SET
         phone_verified = TRUE,
         phone_verification_code = NULL,
         phone_verification_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        phone: user.phone
      },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' }
    );

    // Get store information for the user
    const storeResult = await query(
      `SELECT id, name, address, created_at
       FROM stores WHERE tenant_id = $1`,
      [user.tenant_id]
    );

    res.json({
      message: req.t('auth.login_success') || 'Login successful',
      token,
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role
      },
      store: storeResult.rows[0] || null
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      error: req.t('auth.login_error') || 'OTP verification failed',
      details: error.message
    });
  }
});

// POST /v1/auth/profile - Get user profile (requires authentication)
router.get('/profile', async (req, res) => {
  try {
    // This would require authentication middleware in a real implementation
    // For now, returning a placeholder
    res.json({
      message: req.t('auth.profile_info') || 'Profile information',
      user: {
        id: 'user-id-placeholder',
        full_name: 'User Full Name',
        email: 'user@example.com',
        phone: '+6281234567890',
        username: 'username',
        role: 'OWNER',
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: req.t('auth.profile_error') || 'Failed to fetch profile',
      details: error.message
    });
  }
});

// POST /v1/auth/email/verify - Verify email with the verification code
router.post('/email/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        error: req.t('validation.required') + ': email, code'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: req.t('validation.invalidFormat') + ': email'
      });
    }

    // Check if verification code is valid and not expired
    const userResult = await query(
      `SELECT id FROM users
       WHERE email = $1
       AND email_verification_code = $2
       AND email_verification_expires > NOW()`,
      [email, code]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: req.t('auth.invalid_verification_link') || 'Invalid or expired verification code'
      });
    }

    const userId = userResult.rows[0].id;

    // Update user to mark email as verified and clear verification fields
    await query(
      `UPDATE users SET
         email_verified = TRUE,
         email_verification_code = NULL,
         email_verification_expires = NULL
       WHERE id = $1`,
      [userId]
    );

    res.json({
      message: req.t('auth.email_verified') || 'Email verified successfully'
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      error: req.t('auth.email_verification_failed') || 'Email verification failed',
      details: error.message
    });
  }
});

module.exports = router;