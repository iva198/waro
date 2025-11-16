// routes/sync.js - Synchronization API routes
const express = require('express');
const router = express.Router();

// Placeholder for future synchronization routes
// Based on the SPEC.md requirements for offline-first architecture:
// - Batch sync (POST /v1/sync/batch)
// - Get changes (GET /v1/sync/changes)

// Temporary placeholder route
router.get('/', (req, res) => {
  res.status(200).json({ 
    message: req.t('sync not implemented yet') 
  });
});

module.exports = router;