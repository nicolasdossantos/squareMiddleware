#!/usr/bin/env node

/**
 * Simple migration runner for PostgreSQL.
 *
 * Usage:
 *   PG_CONNECTION_STRING="..." node scripts/runMigrations.js
 *
 * The script looks for SQL files in db/migrations and applies any that
 * have not yet been recorded in the schema_migrations table.
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { config } = require('../src/config');

const migrationsDir = path.join(__dirname, '../db/migrations');

function resolveSslOptions() {
  if (process.env.PG_SSL_DISABLE === 'true') {
    return false;
  }

  const sslOptions = config.database?.ssl || {};
  const sslConfig = {};
  let hasConfig = false;

  if (sslOptions?.ca) {
    sslConfig.ca = sslOptions.ca;
    hasConfig = true;
  } else if (sslOptions?.caPath) {
    const absolutePath = path.isAbsolute(sslOptions.caPath)
      ? sslOptions.caPath
      : path.join(process.cwd(), sslOptions.caPath);
    try {
      sslConfig.ca = fs.readFileSync(absolutePath, 'utf8');
      hasConfig = true;
    } catch (error) {
      console.warn(`⚠️  Failed to read SSL CA file at ${absolutePath}: ${error.message}`);
    }
  }

  if (sslOptions?.rejectUnauthorized === false || process.env.PG_SSL_REJECT_UNAUTHORIZED === 'false') {
    sslConfig.rejectUnauthorized = false;
    hasConfig = true;
  }

  if (process.env.PG_SSL_REQUIRE === 'true' || sslOptions?.mode === 'require') {
    hasConfig = true;
  }

  return hasConfig ? sslConfig : undefined;
}

async function runMigrations() {
  const connectionString =
    config.database?.connectionString ||
    process.env.PG_CONNECTION_STRING ||
    process.env.POSTGRES_CONNECTION_STRING ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ PG_CONNECTION_STRING (or equivalent) is not set. Aborting migrations.');
    process.exit(1);
  }

  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: resolveSslOptions()
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const migrationName = file;

      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1 LIMIT 1', [
        migrationName
      ]);

      if (applied.rows.length > 0) {
        console.log(`➡️  Skipping already applied migration: ${migrationName}`);
        continue;
      }

      const migrationSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`⚙️  Applying migration: ${migrationName}`);

      try {
        await client.query('BEGIN');
        await client.query(migrationSql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migrationName]);
        await client.query('COMMIT');
        console.log(`✅ Migration applied: ${migrationName}`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed: ${migrationName}`);
        console.error(error.message);
        throw error;
      }
    }

    console.log('🎉 All migrations complete');
  } finally {
    await client.end();
  }
}

runMigrations().catch(error => {
  console.error('Migration runner encountered an error:', error);
  process.exit(1);
});
