// routes/inventory.js - Inventory management API routes
const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// POST /v1/inventory/products - Create a new product with inventory tracking
router.post('/products', authenticateToken, async (req, res) => {
  try {
    const { sku, name, barcode, category, uom, price_cents, cost_cents, tax_rate, min_stock_threshold, max_stock_threshold, supplier_id } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!name || price_cents === undefined) {
      return res.status(400).json({
        error: req.t('validation.required') + ': name, price_cents'
      });
    }

    // Validate price and cost values
    if (price_cents < 0) {
      return res.status(400).json({
        error: req.t('validation.mustBePositive') + ': price_cents must be positive'
      });
    }

    if (cost_cents !== undefined && cost_cents < 0) {
      return res.status(400).json({
        error: req.t('validation.mustBePositive') + ': cost_cents must be positive'
      });
    }

    // Validate numerical thresholds
    if (min_stock_threshold !== undefined && min_stock_threshold < 0) {
      return res.status(400).json({
        error: req.t('validation.mustBePositive') + ': min_stock_threshold must be non-negative'
      });
    }

    if (max_stock_threshold !== undefined && max_stock_threshold < 0) {
      return res.status(400).json({
        error: req.t('validation.mustBePositive') + ': max_stock_threshold must be non-negative'
      });
    }

    // Check for duplicates
    if (sku) {
      const existingSku = await query(
        'SELECT id FROM products WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = $1) AND sku = $2 AND soft_delete = FALSE',
        [userId, sku]
      );
      if (existingSku.rows.length > 0) {
        return res.status(409).json({
          error: req.t('inventory.sku_exists') || 'SKU already exists'
        });
      }
    }

    if (barcode) {
      const existingBarcode = await query(
        'SELECT id FROM products WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = $1) AND barcode = $2 AND soft_delete = FALSE',
        [userId, barcode]
      );
      if (existingBarcode.rows.length > 0) {
        return res.status(409).json({
          error: req.t('inventory.barcode_exists') || 'Barcode already exists'
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

    // Determine whether it's a raw material (ingredient) or finished good based on category
    let productType = 'FINISHED_GOOD';
    if (category && (category.includes('RAW') || category.includes('INGREDIENT'))) {
      productType = 'RAW_MATERIAL';
    } else if (category && category.includes('COMPONENT')) {
      productType = 'COMPONENT';
    } else if (category && category.includes('SERVICE')) {
      productType = 'SERVICE';
    }

    // Create the product
    const productResult = await query(
      `INSERT INTO products (
         id, tenant_id, sku, name, barcode, category, product_type, uom,
         price_cents, cost_cents, tax_rate, stock_quantity,
         min_stock_threshold, max_stock_threshold, supplier_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, sku, name, barcode, category, product_type, uom,
                price_cents, cost_cents, tax_rate, stock_quantity,
                min_stock_threshold, max_stock_threshold, supplier_id, created_at, updated_at`,
      [
        uuidv4(), tenantId, sku || null, name, barcode || null, category || 'OTHER',
        productType, uom || 'pcs', price_cents, cost_cents || null,
        tax_rate || 0, 0, // Initial stock quantity is 0
        min_stock_threshold || 0, max_stock_threshold || null,
        supplier_id || null
      ]
    );

    res.status(201).json({
      message: req.t('inventory.product_created') || 'Product created successfully',
      product: productResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to create product',
      details: error.message
    });
  }
});

// GET /v1/inventory/products - List all products with inventory
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
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
    
    // Parse query parameters for pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const lowStockOnly = req.query.low_stock_only === 'true'; // Get products with stock below threshold
    
    // Build base query with filters
    let queryText = `
      SELECT 
        id, sku, name, barcode, category, uom,
        price_cents, cost_cents, tax_rate, stock_quantity,
        min_stock_threshold, max_stock_threshold, supplier_id,
        active, created_at, updated_at
      FROM products 
      WHERE tenant_id = $1 AND soft_delete = FALSE`;
    
    const params = [tenantId];
    let paramIndex = 2;
    
    // Add search filter
    if (search) {
      queryText += ` AND (name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Add category filter
    if (category) {
      queryText += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    // Add low stock filter
    if (lowStockOnly) {
      queryText += ` AND stock_quantity < min_stock_threshold`;
    }
    
    // Add ordering and pagination
    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const productsResult = await query(queryText, params);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM products WHERE tenant_id = $1 AND soft_delete = FALSE`;
    const countParams = [tenantId];
    let countParamIndex = 2;
    
    // Add search filter to count query
    if (search) {
      countQuery += ` AND (name ILIKE $${countParamIndex} OR sku ILIKE $${countParamIndex} OR barcode ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    
    // Add category filter to count query
    if (category) {
      countQuery += ` AND category = $${countParamIndex}`;
      countParams.push(category);
      countParamIndex++;
    }
    
    // Add low stock filter to count query
    if (lowStockOnly) {
      countQuery += ` AND stock_quantity < min_stock_threshold`;
    }
    
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      message: req.t('inventory.products_listed') || 'Products retrieved successfully',
      products: productsResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to fetch products',
      details: error.message
    });
  }
});

// GET /v1/inventory/products/:id - Get a specific product
router.get('/products/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.userId;
    
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
    
    // Get the product
    const productResult = await query(
      `SELECT 
         id, sku, name, barcode, category, uom,
         price_cents, cost_cents, tax_rate, stock_quantity,
         min_stock_threshold, max_stock_threshold, supplier_id,
         active, created_at, updated_at
       FROM products 
       WHERE id = $1 AND tenant_id = $2 AND soft_delete = FALSE`,
      [productId, tenantId]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: req.t('inventory.product_not_found') || 'Product not found'
      });
    }
    
    res.json({
      message: req.t('inventory.product_info') || 'Product information retrieved',
      product: productResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to fetch product',
      details: error.message
    });
  }
});

// PUT /v1/inventory/products/:id - Update a product
router.put('/products/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const { 
      sku, name, barcode, category, uom, 
      price_cents, cost_cents, tax_rate, 
      min_stock_threshold, max_stock_threshold, 
      supplier_id, active 
    } = req.body;
    const userId = req.user.userId;
    
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
    
    // Check if product exists
    const existingProduct = await query(
      `SELECT id, sku, barcode, stock_quantity
       FROM products 
       WHERE id = $1 AND tenant_id = $2 AND soft_delete = FALSE`,
      [productId, tenantId]
    );
    
    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        error: req.t('inventory.product_not_found') || 'Product not found'
      });
    }
    
    // Check for SKU conflicts (if changing SKU)
    if (sku && sku !== existingProduct.rows[0].sku) {
      const existingSku = await query(
        'SELECT id FROM products WHERE tenant_id = $1 AND sku = $2 AND id != $3 AND soft_delete = FALSE',
        [tenantId, sku, productId]
      );
      if (existingSku.rows.length > 0) {
        return res.status(409).json({
          error: req.t('inventory.sku_exists') || 'SKU already exists'
        });
      }
    }
    
    // Check for barcode conflicts (if changing barcode)
    if (barcode && barcode !== existingProduct.rows[0].barcode) {
      const existingBarcode = await query(
        'SELECT id FROM products WHERE tenant_id = $1 AND barcode = $2 AND id != $3 AND soft_delete = FALSE',
        [tenantId, barcode, productId]
      );
      if (existingBarcode.rows.length > 0) {
        return res.status(409).json({
          error: req.t('inventory.barcode_exists') || 'Barcode already exists'
        });
      }
    }
    
    // Prepare update fields and parameters
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }
    
    if (sku !== undefined) {
      updateFields.push(`sku = $${paramIndex}`);
      updateValues.push(sku || null);
      paramIndex++;
    }
    
    if (barcode !== undefined) {
      updateFields.push(`barcode = $${paramIndex}`);
      updateValues.push(barcode || null);
      paramIndex++;
    }
    
    if (category !== undefined) {
      updateFields.push(`category = $${paramIndex}`);
      updateValues.push(category);
      paramIndex++;
    }
    
    if (uom !== undefined) {
      updateFields.push(`uom = $${paramIndex}`);
      updateValues.push(uom);
      paramIndex++;
    }
    
    if (price_cents !== undefined) {
      if (price_cents < 0) {
        return res.status(400).json({
          error: req.t('validation.mustBePositive') + ': price_cents must be positive'
        });
      }
      updateFields.push(`price_cents = $${paramIndex}`);
      updateValues.push(price_cents);
      paramIndex++;
    }
    
    if (cost_cents !== undefined) {
      if (cost_cents < 0) {
        return res.status(400).json({
          error: req.t('validation.mustBePositive') + ': cost_cents must be positive'
        });
      }
      updateFields.push(`cost_cents = $${paramIndex}`);
      updateValues.push(cost_cents);
      paramIndex++;
    }
    
    if (tax_rate !== undefined) {
      updateFields.push(`tax_rate = $${paramIndex}`);
      updateValues.push(tax_rate);
      paramIndex++;
    }
    
    if (min_stock_threshold !== undefined) {
      if (min_stock_threshold < 0) {
        return res.status(400).json({
          error: req.t('validation.mustBePositive') + ': min_stock_threshold must be non-negative'
        });
      }
      updateFields.push(`min_stock_threshold = $${paramIndex}`);
      updateValues.push(min_stock_threshold);
      paramIndex++;
    }
    
    if (max_stock_threshold !== undefined) {
      if (max_stock_threshold < 0) {
        return res.status(400).json({
          error: req.t('validation.mustBePositive') + ': max_stock_threshold must be non-negative'
        });
      }
      updateFields.push(`max_stock_threshold = $${paramIndex}`);
      updateValues.push(max_stock_threshold);
      paramIndex++;
    }
    
    if (supplier_id !== undefined) {
      updateFields.push(`supplier_id = $${paramIndex}`);
      updateValues.push(supplier_id);
      paramIndex++;
    }
    
    if (active !== undefined) {
      updateFields.push(`active = $${paramIndex}`);
      updateValues.push(active);
      paramIndex++;
    }
    
    // Add updated_at
    updateFields.push(`updated_at = NOW()`);
    
    if (updateFields.length === 1) { // Only updated_at field, nothing else to update
      return res.status(400).json({
        error: req.t('validation.no_changes') || 'No fields to update provided'
      });
    }
    
    // Add the WHERE parameters to the values array
    updateValues.push(productId, tenantId);
    
    // Build and execute update query
    const updateQuery = `
      UPDATE products 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}
      RETURNING 
        id, sku, name, barcode, category, uom,
        price_cents, cost_cents, tax_rate, stock_quantity,
        min_stock_threshold, max_stock_threshold, supplier_id,
        active, created_at, updated_at`;
    
    const updatedProduct = await query(updateQuery, updateValues);
    
    res.json({
      message: req.t('inventory.product_updated') || 'Product updated successfully',
      product: updatedProduct.rows[0]
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to update product',
      details: error.message
    });
  }
});

// DELETE /v1/inventory/products/:id - Delete/Deactivate a product
router.delete('/products/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user.userId;
    
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
    
    // Perform soft delete
    const result = await query(
      `UPDATE products 
       SET soft_delete = TRUE, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND soft_delete = FALSE
       RETURNING id`,
      [productId, tenantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: req.t('inventory.product_not_found') || 'Product not found'
      });
    }
    
    res.json({
      message: req.t('inventory.product_deleted') || 'Product deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating product:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to deactivate product',
      details: error.message
    });
  }
});

// POST /v1/inventory/stock-adjustment - Adjust product stock (for inventory corrections)
router.post('/stock-adjustment', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity, reason, notes } = req.body;
    const userId = req.user.userId;
    
    if (!product_id || quantity === undefined || !reason) {
      return res.status(400).json({
        error: req.t('validation.required') + ': product_id, quantity, reason'
      });
    }
    
    // Validate quantity is an integer
    if (!Number.isInteger(quantity)) {
      return res.status(400).json({
        error: req.t('validation.invalidFormat') + ': quantity must be an integer'
      });
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
    
    // Get the product to verify it exists in the tenant
    const productResult = await query(
      `SELECT id, name, stock_quantity 
       FROM products 
       WHERE id = $1 AND tenant_id = $2 AND soft_delete = FALSE`,
      [product_id, tenantId]
    );
    
    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: req.t('inventory.product_not_found') || 'Product not found'
      });
    }
    
    const currentStock = productResult.rows[0].stock_quantity || 0;
    const newStock = currentStock + quantity;
    
    // Prevent negative stock unless explicitly allowed for adjustments
    if (newStock < 0) {
      return res.status(400).json({
        error: req.t('inventory.negative_stock_error') || 'Stock cannot be negative after adjustment'
      });
    }
    
    // Update product stock
    await query(
      `UPDATE products
       SET stock_quantity = $1, updated_at = NOW()
       WHERE id = $2`,
      [newStock, product_id]
    );

    // Validate and map the reason to appropriate enum value
    const validReasons = ['SALE', 'PURCHASE', 'ADJUSTMENT'];
    let movementReason = reason.toUpperCase();

    // Map common variations to valid enum values
    if (movementReason.includes('SALE')) {
      movementReason = 'SALE';
    } else if (movementReason.includes('PURCHASE') || movementReason.includes('RESTOCK') || movementReason.includes('BUY')) {
      movementReason = 'PURCHASE';
    } else if (movementReason.includes('ADJUST') || movementReason.includes('CORRECT') || movementReason.includes('TRANSFER')) {
      movementReason = 'ADJUSTMENT';
    }

    // Final validation to ensure the reason is one of the allowed enum values
    if (!validReasons.includes(movementReason)) {
      movementReason = 'ADJUSTMENT'; // default to ADJUSTMENT if not recognized
    }

    // Record the inventory movement
    const movementResult = await query(
      `INSERT INTO inventory_movements (
         id, tenant_id, store_id, product_id, qty_change,
         reason, notes, ts
       ) VALUES ($1, $2, (SELECT tenant_id FROM users WHERE id = $3 LIMIT 1), $4, $5, $6, $7, $8)
       RETURNING id, product_id, qty_change, reason, notes, ts`,
      [uuidv4(), tenantId, userId, product_id, quantity, movementReason, notes || '', new Date()]
    );
    
    res.json({
      message: req.t('inventory.stock_adjusted') || 'Stock adjusted successfully',
      product: {
        id: product_id,
        name: productResult.rows[0].name,
        new_stock_quantity: newStock,
        old_stock_quantity: currentStock,
        quantity_adjusted: quantity
      },
      movement: movementResult.rows[0]
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to adjust stock',
      details: error.message
    });
  }
});

// GET /v1/inventory/low-stock - Get products with low stock
router.get('/low-stock', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
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
    
    // Get products where stock is below minimum threshold
    const lowStockResult = await query(
      `SELECT 
         id, sku, name, barcode, category, uom,
         price_cents, cost_cents, stock_quantity, min_stock_threshold
       FROM products 
       WHERE tenant_id = $1 
         AND soft_delete = FALSE 
         AND active = TRUE
         AND stock_quantity < min_stock_threshold
       ORDER BY stock_quantity ASC`,
      [tenantId]
    );
    
    res.json({
      message: req.t('inventory.low_stock_listed') || 'Low stock products retrieved successfully',
      low_stock_products: lowStockResult.rows
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to fetch low stock products',
      details: error.message
    });
  }
});

// GET /v1/inventory/movements - Get inventory movements history
router.get('/movements', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
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
    
    // Parse query parameters for filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const productId = req.query.product_id || '';
    const reason = req.query.reason || '';
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';
    
    // Build base query with filters
    let queryText = `
      SELECT 
        im.id, im.product_id, im.qty_change, im.reason, im.notes,
        im.ref_type, im.ref_id, im.ts,
        p.name as product_name, p.sku as product_sku
      FROM inventory_movements im
      JOIN products p ON im.product_id = p.id
      WHERE im.tenant_id = $1`;
    
    const params = [tenantId];
    let paramIndex = 2;
    
    // Add product filter
    if (productId) {
      queryText += ` AND im.product_id = $${paramIndex}`;
      params.push(productId);
      paramIndex++;
    }
    
    // Add reason filter
    if (reason) {
      queryText += ` AND im.reason = $${paramIndex}`;
      params.push(reason);
      paramIndex++;
    }
    
    // Add date range filters
    if (dateFrom) {
      queryText += ` AND im.ts >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }
    
    if (dateTo) {
      queryText += ` AND im.ts <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }
    
    // Add ordering and pagination
    queryText += ` ORDER BY im.ts DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const movementsResult = await query(queryText, params);
    
    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM inventory_movements im WHERE im.tenant_id = $1`;
    const countParams = [tenantId];
    let countParamIndex = 2;
    
    // Add filters to count query
    if (productId) {
      countQuery += ` AND im.product_id = $${countParamIndex}`;
      countParams.push(productId);
      countParamIndex++;
    }
    
    if (reason) {
      countQuery += ` AND im.reason = $${countParamIndex}`;
      countParams.push(reason);
      countParamIndex++;
    }
    
    if (dateFrom) {
      countQuery += ` AND im.ts >= $${countParamIndex}`;
      countParams.push(dateFrom);
      countParamIndex++;
    }
    
    if (dateTo) {
      countQuery += ` AND im.ts <= $${countParamIndex}`;
      countParams.push(dateTo);
      countParamIndex++;
    }
    
    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    res.json({
      message: req.t('inventory.movements_listed') || 'Inventory movements retrieved successfully',
      movements: movementsResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching inventory movements:', error);
    res.status(500).json({
      error: req.t('inventory.operation_error') || 'Failed to fetch inventory movements',
      details: error.message
    });
  }
});

module.exports = router;