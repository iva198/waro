// db/__tests__/connection.test.js - Database connection tests
const { connectDB, testConnection, query, closePool } = require('../connection');

describe('Database Connection', () => {
  beforeAll(async () => {
    // Set environment to test
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    await closePool();
  });

  test('should connect to the database successfully', async () => {
    // This will use the .env.testing configuration
    const connected = await testConnection();
    expect(connected).toBe(true);
  });

  test('should execute a simple query successfully', async () => {
    const result = await query('SELECT 1 as test_value');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].test_value).toBe(1);
  });

  test('should handle parameterized queries', async () => {
    const result = await query('SELECT $1::text as message', ['Hello, World!']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].message).toBe('Hello, World!');
  });

  test('should properly handle errors', async () => {
    await expect(query('SELECT * FROM non_existent_table')).rejects.toThrow();
  });
});