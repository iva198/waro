// routes/products.js - Products API routes
const express = require('express');
const router = express.Router();

// Placeholder for future product routes
// Based on the SPEC.md requirements, we'll implement:
// - Product catalog (GET /v1/products)
// - Product creation (POST /v1/products)
// - Product updates (PUT /v1/products/:id)

// Temporary placeholder route
router.get('/', (req, res) => {
  res.status(200).json({ 
    message: req.t('products not implemented yet') 
  });
});

module.exports = router;