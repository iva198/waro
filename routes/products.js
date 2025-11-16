// routes/products.js - Products API routes for finished goods vs raw materials
const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// POST /v1/products - Create a finished goods product for sale
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { 
      sku, name, barcode, category, product_type, uom, 
      price_cents, cost_cents, tax_rate,
      min_stock_threshold, max_stock_threshold, supplier_id
    } = req.body;
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
          error: req.t('products.already_exists') || 'Product SKU already exists'
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

    // Determine product type if not provided (default to FINISHED_GOOD)
    const finalProductType = product_type || 'FINISHED_GOOD';

    // Create the finished goods product
    const productResult = await query(
      `INSERT INTO products (
         id, tenant_id, sku, name, barcode, category, product_type, uom, 
         price_cents, cost_cents, tax_rate, stock_quantity,
         min_stock_threshold, max_stock_threshold, supplier_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, sku, name, barcode, category, product_type, uom, 
                price_cents, cost_cents, tax_rate, stock_quantity,
                min_stock_threshold, max_stock_threshold, supplier_id, active, created_at, updated_at`,
      [
        uuidv4(), tenantId, sku || null, name, barcode || null, category || 'OTHER',
        finalProductType, uom || 'pcs', price_cents, cost_cents || null,
        tax_rate || 0, 0, // Initial stock quantity is 0
        min_stock_threshold || 0, max_stock_threshold || null,
        supplier_id || null
      ]
    );

    res.status(201).json({
      message: req.t('products.created') || 'Product created successfully',
      product: productResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      error: req.t('products.error') || 'Failed to create product',
      details: error.message
    });
  }
});

// POST /v1/products/raw-materials - Create a raw material/product for ingredients
router.post('/raw-materials', authenticateToken, async (req, res) => {
  try {
    const { 
      sku, name, barcode, category, uom, 
      cost_cents, tax_rate, min_stock_threshold, max_stock_threshold, supplier_id
    } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!name || !cost_cents) {
      return res.status(400).json({
        error: req.t('validation.required') + ': name, cost_cents'
      });
    }

    // Validate cost value
    if (cost_cents < 0) {
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
          error: req.t('products.already_exists') || 'Raw material SKU already exists'
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

    // Create the raw material product (with price_cents set to cost_cents for valuation)
    const productResult = await query(
      `INSERT INTO products (
         id, tenant_id, sku, name, barcode, category, product_type, uom, 
         price_cents, cost_cents, tax_rate, stock_quantity,
         min_stock_threshold, max_stock_threshold, supplier_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, sku, name, barcode, category, product_type, uom, 
                price_cents, cost_cents, tax_rate, stock_quantity,
                min_stock_threshold, max_stock_threshold, supplier_id, active, created_at, updated_at`,
      [
        uuidv4(), tenantId, sku || null, name, barcode || null, category || 'RAW_MATERIALS',
        'RAW_MATERIAL', uom || 'pcs', cost_cents, cost_cents, // Use cost as price for raw materials
        tax_rate || 0, 0, // Initial stock quantity is 0
        min_stock_threshold || 0, max_stock_threshold || null,
        supplier_id || null
      ]
    );

    res.status(201).json({
      message: req.t('products.created') || 'Raw material created successfully',
      product: productResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating raw material:', error);
    res.status(500).json({
      error: req.t('products.error') || 'Failed to create raw material',
      details: error.message
    });
  }
});

// POST /v1/products/recipes - Create a recipe for food/beverage businesses
router.post('/recipes', authenticateToken, async (req, res) => {
  try {
    const { name, description, selling_price_cents, ingredients } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!name || selling_price_cents === undefined || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        error: req.t('validation.required') + ': name, selling_price_cents, ingredients[]'
      });
    }

    // Validate ingredients structure
    for (const ingredient of ingredients) {
      if (!ingredient.product_id || !ingredient.qty_required) {
        return res.status(400).json({
          error: req.t('validation.required') + ': Each ingredient must have product_id and qty_required'
        });
      }
    }

    // Verify user exists and get tenant_id
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

    // Create the finished goods product for this recipe
    const recipeProductResult = await query(
      `INSERT INTO products (
         id, tenant_id, name, category, product_type, uom,
         price_cents, tax_rate, stock_quantity,
         min_stock_threshold, max_stock_threshold
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, category, product_type, price_cents, created_at`,
      [
        uuidv4(), tenantId, name, 'FOOD', 'FINISHED_GOOD', 'pcs',
        selling_price_cents, 0, 0, // No initial stock, calculated from ingredients
        0, null // Default thresholds
      ]
    );

    // In a real system, you would link ingredients to this recipe in a separate table
    // For now, just return the recipe product info
    
    res.status(201).json({
      message: req.t('products.created') || 'Recipe created successfully',
      product: recipeProductResult.rows[0],
      ingredients: ingredients
    });
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({
      error: req.t('products.error') || 'Failed to create recipe',
      details: error.message
    });
  }
});

// GET /v1/products - List all finished goods products
router.get('/', authenticateToken, async (req, res) => {
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

    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const lowStockOnly = req.query.low_stock_only === 'true'; // Get products with stock below threshold
    const productType = req.query.product_type || 'FINISHED_GOOD'; // Default to finished goods
    
    // Build base query with filters
    let queryText = `
      SELECT 
        id, sku, name, barcode, category, product_type, uom,
        price_cents, cost_cents, tax_rate, stock_quantity,
        min_stock_threshold, max_stock_threshold, supplier_id,
        active, created_at, updated_at
      FROM products 
      WHERE tenant_id = $1 AND soft_delete = FALSE AND product_type = $2`;

    const params = [tenantId, productType];
    let paramIndex = 3;

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
    let countQuery = `SELECT COUNT(*) as total FROM products WHERE tenant_id = $1 AND soft_delete = FALSE AND product_type = $2`;
    const countParams = [tenantId, productType];
    let countParamIndex = 3;

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
      message: req.t('products.fetched') || 'Products retrieved successfully',
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
      error: req.t('products.error') || 'Failed to fetch products',
      details: error.message
    });
  }
});

// GET /v1/products/raw-materials - List all raw materials
router.get('/raw-materials', authenticateToken, async (req, res) => {
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

    // Parse query parameters for pagination and filtering
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const lowStockOnly = req.query.low_stock_only === 'true'; // Get products with stock below threshold

    // Build base query for raw materials only
    let queryText = `
      SELECT 
        id, sku, name, barcode, category, product_type, uom,
        price_cents, cost_cents, tax_rate, stock_quantity,
        min_stock_threshold, max_stock_threshold, supplier_id,
        active, created_at, updated_at
      FROM products 
      WHERE tenant_id = $1 AND soft_delete = FALSE AND product_type = 'RAW_MATERIAL'`;

    const params = [tenantId];
    let paramIndex = 2;

    // Add search filter
    if (search) {
      queryText += ` AND (name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex} OR barcode ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
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
    let countQuery = `SELECT COUNT(*) as total FROM products WHERE tenant_id = $1 AND soft_delete = FALSE AND product_type = 'RAW_MATERIAL'`;
    const countParams = [tenantId];
    let countParamIndex = 2;

    // Add search filter to count query
    if (search) {
      countQuery += ` AND (name ILIKE $${countParamIndex} OR sku ILIKE $${countParamIndex} OR barcode ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    // Add low stock filter to count query
    if (lowStockOnly) {
      countQuery += ` AND stock_quantity < min_stock_threshold`;
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      message: req.t('products.fetched') || 'Raw materials retrieved successfully',
      raw_materials: productsResult.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching raw materials:', error);
    res.status(500).json({
      error: req.t('products.error') || 'Failed to fetch raw materials',
      details: error.message
    });
  }
});

// GET /v1/products/:id - Get a specific product
router.get('/:productId', authenticateToken, async (req, res) => {
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
         id, sku, name, barcode, category, product_type, uom,
         price_cents, cost_cents, tax_rate, stock_quantity,
         min_stock_threshold, max_stock_threshold, supplier_id,
         active, created_at, updated_at
       FROM products
       WHERE id = $1 AND tenant_id = $2 AND soft_delete = FALSE`,
      [productId, tenantId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        error: req.t('products.not_found') || 'Product not found'
      });
    }

    res.json({
      message: req.t('products.fetched') || 'Product retrieved successfully',
      product: productResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      error: req.t('products.error') || 'Failed to fetch product',
      details: error.message
    });
  }
});

// PUT /v1/products/:id - Update a finished goods product
router.put('/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      sku, name, barcode, category, product_type, uom,
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
      `SELECT id, sku, barcode, stock_quantity, product_type
       FROM products
       WHERE id = $1 AND tenant_id = $2 AND soft_delete = FALSE`,
      [productId, tenantId]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        error: req.t('products.not_found') || 'Product not found'
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
          error: req.t('products.already_exists') || 'Product SKU already exists'
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

    if (product_type !== undefined) {
      updateFields.push(`product_type = $${paramIndex}`);
      updateValues.push(product_type);
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
        id, sku, name, barcode, category, product_type, uom,
        price_cents, cost_cents, tax_rate, stock_quantity,
        min_stock_threshold, max_stock_threshold, supplier_id,
        active, created_at, updated_at`;

    const updatedProduct = await query(updateQuery, updateValues);

    res.json({
      message: req.t('products.updated') || 'Product updated successfully',
      product: updatedProduct.rows[0]
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      error: req.t('products.error') || 'Failed to update product',
      details: error.message
    });
  }
});

// DELETE /v1/products/:id - Delete/Deactivate a product
router.delete('/:productId', authenticateToken, async (req, res) => {
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
        error: req.t('products.not_found') || 'Product not found'
      });
    }

    res.json({
      message: req.t('products.deleted') || 'Product deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating product:', error);
    res.status(500).json({
      error: req.t('products.error') || 'Failed to deactivate product',
      details: error.message
    });
  }
});

module.exports = router;