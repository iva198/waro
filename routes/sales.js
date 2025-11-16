// routes/sales.js - Sales API routes
const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

// Middleware to validate request body for sales
const validateSale = (req, res, next) => {
  const { tenant_id, store_id, cashier_user_id, sale_items, subtotal_cents, total_cents } = req.body;

  // Basic validation
  if (!tenant_id || !store_id || !sale_items || !Array.isArray(sale_items) || sale_items.length === 0) {
    return res.status(400).json({
      error: req.t('sales.missingRequiredFields')
    });
  }

  // Validate each sale item
  for (const item of sale_items) {
    if (!item.product_id || !item.qty || !item.unit_price_cents) {
      return res.status(400).json({
        error: req.t('sales.invalidSaleItems')
      });
    }
  }

  next();
};

// POST /v1/sales - Create a new sale
router.post('/', validateSale, async (req, res) => {
  try {
    const { tenant_id, store_id, cashier_user_id, sale_items, subtotal_cents, discount_cents = 0, tax_cents = 0, total_cents, payment_method = 'CASH' } = req.body;

    // Generate a unique sale number
    const sale_no = `SALE-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // Begin transaction to insert sale and sale items
    const saleId = uuidv4();

    // Insert the sale record
    const saleResult = await query(
      `INSERT INTO sales (
        id, tenant_id, store_id, cashier_user_id, sale_no,
        subtotal_cents, discount_cents, tax_cents, total_cents, payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, created_at`,
      [
        saleId, tenant_id, store_id, cashier_user_id, sale_no,
        subtotal_cents, discount_cents, tax_cents, total_cents, 'PENDING'
      ]
    );

    // Insert sale items
    const saleItemPromises = sale_items.map(item => {
      const itemTotal = item.qty * item.unit_price_cents - (item.discount_cents || 0);
      return query(
        `INSERT INTO sale_items (
          id, sale_id, product_id, qty, unit_price_cents, discount_cents, total_cents
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), saleId, item.product_id, item.qty, item.unit_price_cents, item.discount_cents || 0, itemTotal]
      );
    });

    await Promise.all(saleItemPromises);

    // If payment method is not CASH (i.e., QRIS/EWALLET), we need to create a payment record
    if (payment_method !== 'CASH') {
      await query(
        `INSERT INTO payments (
          id, tenant_id, sale_id, method, provider, amount_cents, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [uuidv4(), tenant_id, saleId, payment_method, req.body.provider || null, total_cents, 'PENDING']
      );
    }

    // Return the created sale
    res.status(201).json({
      id: saleResult.rows[0].id,
      tenant_id,
      store_id,
      cashier_user_id,
      sale_no,
      subtotal_cents,
      discount_cents,
      tax_cents,
      total_cents,
      payment_status: 'PENDING',
      created_at: saleResult.rows[0].created_at,
      sale_items: sale_items,
      message: req.t('sales.created')
    });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({
      error: req.t('sales.createError'),
      details: error.message
    });
  }
});

// GET /v1/sales/:id - Get a specific sale
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        error: req.t('validation.invalidFormat')
      });
    }

    // Fetch the sale
    const saleResult = await query(
      `SELECT * FROM sales
       WHERE id = $1 AND soft_delete = FALSE`,
      [id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: req.t('sales.notFound') });
    }

    const sale = saleResult.rows[0];

    // Fetch sale items
    const itemsResult = await query(
      `SELECT * FROM sale_items
       WHERE sale_id = $1 AND soft_delete = FALSE`,
      [id]
    );

    res.json({
      ...sale,
      sale_items: itemsResult.rows
    });
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({
      error: req.t('sales.fetchError'),
      details: error.message
    });
  }
});

// GET /v1/sales - Get sales for a tenant/store
router.get('/', async (req, res) => {
  try {
    const { tenant_id, store_id, limit = 50, offset = 0 } = req.query;

    if (!tenant_id) {
      return res.status(400).json({ error: req.t('validation.required') + ': tenant_id' });
    }

    let queryText = `SELECT * FROM sales WHERE tenant_id = $1 AND soft_delete = FALSE`;
    let queryParams = [tenant_id];
    let paramIndex = 2;

    if (store_id) {
      queryText += ` AND store_id = $${paramIndex}`;
      queryParams.push(store_id);
      paramIndex++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, queryParams);

    res.json({
      sales: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: result.rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({
      error: req.t('sales.fetchError'),
      details: error.message
    });
  }
});

module.exports = router;