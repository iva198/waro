// migrate.js - Database migration runner
const { Pool } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: process.env.NODE_ENV === 'test' ? '.env.testing' : '.env' });

async function runMigrations() {
  // Create a connection pool
  const connectionString = `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}?schema=public`;
  const pool = new Pool({ connectionString });

  try {
    console.log('Connected to database');

    // Create a migrations table to track applied migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Get applied migrations
    const appliedMigrationsResult = await pool.query(
      'SELECT name FROM schema_migrations ORDER BY name'
    );
    const appliedMigrations = appliedMigrationsResult.rows.map(row => row.name);

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);
    console.log(`Already applied ${appliedMigrations.length} migrations`);

    // Apply pending migrations
    for (const file of migrationFiles) {
      if (appliedMigrations.includes(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}`);

      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      // Execute the migration
      await pool.query('BEGIN');
      await pool.query(migrationSQL);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');

      console.log(`Successfully applied migration: ${file}`);
    }

    console.log('All migrations completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };