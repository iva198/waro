// server.js - Main server file for WarO API
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import database connection
const { connectDB } = require('./db/connection');

// Import i18n middleware
const { detectLanguage } = require('./utils/i18n');

// Import routes
const healthRoutes = require('./routes/health');
const salesRoutes = require('./routes/sales');
const paymentsRoutes = require('./routes/payments');
const productsRoutes = require('./routes/products');
const syncRoutes = require('./routes/sync');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Internationalization middleware
app.use(detectLanguage);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Language: ${req.language}`);
  next();
});

// Health check route (before auth middleware)
app.use('/v1/health', healthRoutes);

// Authentication middleware (to be implemented)
// const { authenticateToken } = require('./middleware/auth');

// API routes
app.use('/v1/sales', salesRoutes);
app.use('/v1/payments', paymentsRoutes);
app.use('/v1/products', productsRoutes);
app.use('/v1/sync', syncRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    console.log('Connected to database');
    
    app.listen(PORT, () => {
      console.log(`WarO API server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = app;