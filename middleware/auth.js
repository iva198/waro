// middleware/auth.js - Authentication middleware
const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  // Look for token in Authorization header (Bearer token)
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer TOKEN" format

  if (!token) {
    return res.status(401).json({ 
      error: req.t('auth.invalid_credentials') || 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key', (err, user) => {
    if (err) {
      return res.status(401).json({ 
        error: req.t('auth.invalid_credentials') || 'Invalid or expired token' 
      });
    }

    // Add user info to request object
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };