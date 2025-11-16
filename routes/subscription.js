// routes/subscription.js - Subscription API routes
const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

// Middleware to ensure user is authenticated
const { authenticateToken } = require('../middleware/auth');

// GET /v1/subscription/plans - Get all available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await query(
      `SELECT 
         id, name, plan_type, description, 
         monthly_price_cents, annual_price_cents, 
         max_cashiers, max_stores, payment_methods_allowed,
         offline_access, cloud_sync, analytics, inventory_management, 
         customer_management, reporting, api_access, support_level,
         active, created_at, updated_at
       FROM subscription_plans 
       WHERE active = TRUE 
       ORDER BY CASE plan_type
         WHEN 'FREE_OFFLINE' THEN 1
         WHEN 'STARTER_CLOUD' THEN 2
         WHEN 'PROFESSIONAL' THEN 3
         WHEN 'ENTERPRISE' THEN 4
         ELSE 5
       END`,
      []
    );

    res.json({
      message: req.t('subscription.plans_fetched') || 'Subscription plans retrieved successfully',
      plans: plans.rows
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({
      error: req.t('subscription.subscription_error') || 'Failed to fetch subscription plans',
      details: error.message
    });
  }
});

// POST /v1/subscription/subscribe - Subscribe to a plan
router.post('/subscribe', authenticateToken, async (req, res) => {
  try {
    const { plan_id, payment_method, auto_renew = true, duration = 'monthly' } = req.body;
    const userId = req.user.userId;
    
    // Validate required fields
    if (!plan_id) {
      return res.status(400).json({
        error: req.t('validation.required') + ': plan_id'
      });
    }

    // Get user's current subscription
    const currentSubscription = await query(
      `SELECT id, plan_id, status, end_date 
       FROM user_subscriptions 
       WHERE user_id = $1 AND status = 'ACTIVE' AND soft_delete = FALSE 
       ORDER BY end_date DESC LIMIT 1`,
      [userId]
    );
    
    // If user already has an active subscription, they might need to upgrade/downgrade
    if (currentSubscription.rows.length > 0) {
      return res.status(400).json({
        error: req.t('subscription.already_subscribed') || 'User already has an active subscription'
      });
    }

    // Get the selected plan details
    const planResult = await query(
      `SELECT id, plan_type, monthly_price_cents, annual_price_cents, 
         max_cashiers, max_stores, payment_methods_allowed,
         offline_access, cloud_sync
       FROM subscription_plans 
       WHERE id = $1 AND active = TRUE`,
      [plan_id]
    );
    
    if (planResult.rows.length === 0) {
      return res.status(404).json({
        error: req.t('subscription.plan_not_found') || 'Subscription plan not found'
      });
    }
    
    const selectedPlan = planResult.rows[0];
    
    // Determine price based on duration
    const priceCents = duration === 'annual' ? selectedPlan.annual_price_cents : selectedPlan.monthly_price_cents;
    
    // For free plan, no payment is required
    if (priceCents === 0 && !payment_method) {
      // Allow subscription to free plan without payment
    } else {
      // For paid plans, payment method is required
      if (!payment_method) {
        return res.status(400).json({
          error: req.t('subscription.payment_required') || 'Payment method required for paid plans'
        });
      }
    }
    
    // Get user's tenant_id
    const userResult = await query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: req.t('auth.invalid_credentials') || 'User not found'
      });
    }
    
    const tenantId = userResult.rows[0].tenant_id;
    
    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();
    if (duration === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    
    // Create subscription record
    const subscriptionResult = await query(
      `INSERT INTO user_subscriptions (
         user_id, tenant_id, plan_id, status, start_date, end_date,
         auto_renew, payment_method_used, amount_paid_cents, currency
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id, status, start_date, end_date, auto_renew, created_at`,
      [
        userId, tenantId, plan_id, 'ACTIVE', startDate, endDate,
        auto_renew, payment_method, priceCents, 'IDR'
      ]
    );

    res.json({
      message: req.t('subscription.subscription_success') || 'Subscription created successfully',
      subscription: subscriptionResult.rows[0]
    });
  } catch (error) {
    console.error('Error subscribing to plan:', error);
    res.status(500).json({
      error: req.t('subscription.subscription_error') || 'Failed to subscribe to plan',
      details: error.message
    });
  }
});

// GET /v1/subscription/my-plan - Get current user's subscription
router.get('/my-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get current active subscription
    const currentSubscription = await query(
      `SELECT 
         us.id, us.status, us.start_date, us.end_date, us.auto_renew,
         sp.id as plan_id, sp.name as plan_name, sp.plan_type, 
         sp.description, sp.max_cashiers, sp.max_stores, sp.payment_methods_allowed,
         sp.offline_access, sp.cloud_sync, sp.analytics, sp.inventory_management,
         sp.customer_management, sp.reporting, sp.api_access, sp.support_level
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1 AND us.status = 'ACTIVE' AND us.soft_delete = FALSE
       ORDER BY us.created_at DESC LIMIT 1`,
      [userId]
    );
    
    if (currentSubscription.rows.length === 0) {
      return res.json({
        message: req.t('subscription.subscription_error') || 'No active subscription found',
        subscription: null
      });
    }
    
    res.json({
      message: req.t('subscription.plans_fetched') || 'Current subscription retrieved successfully',
      subscription: currentSubscription.rows[0]
    });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({
      error: req.t('subscription.subscription_error') || 'Failed to fetch subscription',
      details: error.message
    });
  }
});

// PUT /v1/subscription/change - Change subscription plan (upgrade/downgrade)
router.put('/change', authenticateToken, async (req, res) => {
  try {
    const { new_plan_id, payment_method } = req.body;
    const userId = req.user.userId;
    
    if (!new_plan_id) {
      return res.status(400).json({
        error: req.t('validation.required') + ': new_plan_id'
      });
    }
    
    // Get current active subscription
    const currentSubscription = await query(
      `SELECT id, plan_id, status, end_date 
       FROM user_subscriptions 
       WHERE user_id = $1 AND status = 'ACTIVE' AND soft_delete = FALSE 
       ORDER BY end_date DESC LIMIT 1`,
      [userId]
    );
    
    if (currentSubscription.rows.length === 0) {
      return res.status(400).json({
        error: req.t('subscription.subscription_error') || 'No active subscription to change'
      });
    }
    
    const currentSub = currentSubscription.rows[0];
    
    // Get new plan details
    const newPlanResult = await query(
      `SELECT id, plan_type, monthly_price_cents, annual_price_cents, 
         max_cashiers, max_stores, payment_methods_allowed
       FROM subscription_plans 
       WHERE id = $1 AND active = TRUE`,
      [new_plan_id]
    );
    
    if (newPlanResult.rows.length === 0) {
      return res.status(404).json({
        error: req.t('subscription.plan_not_found') || 'New subscription plan not found'
      });
    }
    
    // Cancel current subscription
    await query(
      `UPDATE user_subscriptions SET status = 'CANCELLED' WHERE id = $1`,
      [currentSub.id]
    );
    
    // Create new subscription (this mirrors the subscribe logic)
    const newPlan = newPlanResult.rows[0];
    const priceCents = newPlan.monthly_price_cents; // Using monthly price for simplicity in this example
    
    if (priceCents > 0 && !payment_method) {
      return res.status(400).json({
        error: req.t('subscription.payment_required') || 'Payment method required for paid plans'
      });
    }
    
    // Get user's tenant_id
    const userResult = await query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [userId]
    );
    
    const tenantId = userResult.rows[0].tenant_id;
    
    // Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
    // Create new subscription record
    const newSubscriptionResult = await query(
      `INSERT INTO user_subscriptions (
         user_id, tenant_id, plan_id, status, start_date, end_date, 
         auto_renew, payment_method_used, amount_paid_cents, currency
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, status, start_date, end_date, auto_renew, created_at`,
      [
        userId, tenantId, new_plan_id, 'ACTIVE', startDate, endDate,
        true, payment_method, priceCents, 'IDR'
      ]
    );
    
    res.json({
      message: req.t('subscription.subscription_updated') || 'Subscription changed successfully',
      subscription: newSubscriptionResult.rows[0]
    });
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    res.status(500).json({
      error: req.t('subscription.subscription_error') || 'Failed to change subscription plan',
      details: error.message
    });
  }
});

// GET /v1/subscription/check-permissions - Check if user has permission to perform certain actions
router.get('/check-permissions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get current subscription and plan details
    const currentSubscription = await query(
      `SELECT 
         us.id, us.status, us.start_date, us.end_date,
         sp.max_cashiers, sp.max_stores, sp.payment_methods_allowed,
         sp.offline_access, sp.cloud_sync, sp.analytics, sp.inventory_management,
         sp.customer_management, sp.reporting, sp.api_access, sp.support_level
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.user_id = $1 AND us.status = 'ACTIVE' AND us.soft_delete = FALSE
       ORDER BY us.created_at DESC LIMIT 1`,
      [userId]
    );
    
    if (currentSubscription.rows.length === 0) {
      return res.status(400).json({
        error: req.t('subscription.subscription_error') || 'No active subscription found'
      });
    }
    
    const sub = currentSubscription.rows[0];
    
    // Check number of cashiers in current tenant
    const userResult = await query(
      'SELECT tenant_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: req.t('auth.invalid_credentials') || 'User not found'
      });
    }

    const tenantId = userResult.rows[0].tenant_id;

    const cashiersResult = await query(
      `SELECT COUNT(*) as count FROM users
       WHERE tenant_id = $1 AND role = 'CASHIER'`,
      [tenantId]
    );
    
    const cashierCount = parseInt(cashiersResult.rows[0].count);
    
    // Check number of stores in current tenant
    const storesResult = await query(
      `SELECT COUNT(*) as count FROM stores
       WHERE tenant_id = $1`,
      [tenantId]
    );

    const storeCount = parseInt(storesResult.rows[0].count);
    
    const permissions = {
      max_cashiers: sub.max_cashiers,
      current_cashiers: cashierCount,
      cashiers_available: sub.max_cashiers - cashierCount,
      max_stores: sub.max_stores,
      current_stores: storeCount,
      stores_available: sub.max_stores - storeCount,
      allowed_payment_methods: sub.payment_methods_allowed,
      offline_access: sub.offline_access,
      cloud_sync: sub.cloud_sync,
      analytics: sub.analytics,
      inventory_management: sub.inventory_management,
      customer_management: sub.customer_management,
      reporting: sub.reporting,
      api_access: sub.api_access,
      support_level: sub.support_level
    };
    
    res.json({
      message: req.t('subscription.plans_fetched') || 'Permission check completed',
      permissions: permissions
    });
  } catch (error) {
    console.error('Error checking permissions:', error);
    res.status(500).json({
      error: req.t('subscription.subscription_error') || 'Failed to check permissions',
      details: error.message
    });
  }
});

module.exports = router;