// routes/health.js - Health check route
const express = require('express');
const router = express.Router();
const { testConnection } = require('../db/connection');

// GET /v1/health - Health check endpoint
router.get('/', async (req, res) => {
  try {
    // Test database connection
    const dbOk = await testConnection();

    // Basic health response
    res.status(200).json({
      status: req.t('success'),
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbOk ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
      message: 'Sistem berfungsi dengan baik'
    });
  } catch (error) {
    res.status(503).json({
      status: req.t('error'),
      timestamp: new Date().toISOString(),
      error: req.t('database.connectionError'),
      database: 'disconnected',
      message: 'Koneksi database gagal'
    });
  }
});

module.exports = router;