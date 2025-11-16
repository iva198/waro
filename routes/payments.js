// routes/payments.js - Payments API routes
const express = require('express');
const router = express.Router();

// Placeholder for future payment routes
// Based on the SPEC.md requirements, we'll implement:
// - Payment creation (POST /v1/payments)
// - Payment status updates (PUT /v1/payments/:id)
// - Webhook handling (POST /v1/webhooks/:provider)

// Temporary placeholder route
router.get('/', (req, res) => {
  res.status(200).json({ 
    message: req.t('payments not implemented yet') 
  });
});

module.exports = router;