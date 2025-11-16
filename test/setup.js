// test/setup.js - Jest setup file
const dotenv = require('dotenv');

// Load test environment variables
dotenv.config({ path: '.env.testing' });

// Set up any additional test configurations
process.env.NODE_ENV = 'test';

console.log('Jest test environment set up with test environment variables');