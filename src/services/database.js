/**
 * PostgreSQL Database Utility
 * Provides a shared connection pool and helper methods for executing queries
 * and transactions against the customer context database.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { config } = require('../config');
const { logger } = require('../utils/logger');

let pool = null;
let encryptionKeyCache = null;

/**
 * Resolve SSL configuration for the PostgreSQL client.
 * Supports Azure-hosted databases that require TLS connections.
 */
function resolveSslConfiguration() {
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
    try {
      const absolutePath = path.isAbsolute(sslOptions.caPath)
        ? sslOptions.caPath
        : path.join(process.cwd(), sslOptions.caPath);
      sslConfig.ca = fs.readFileSync(absolutePath, 'utf8');
      hasConfig = true;
    } catch (error) {
      logger.warn('database_ssl_ca_load_failed', {
        message: error.message,
        caPath: sslOptions.caPath
      });
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

/**
 * Lazily create (or return) the shared Pool instance.
 */
function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString =
    config.database?.connectionString ||
    process.env.PG_CONNECTION_STRING ||
    process.env.POSTGRES_CONNECTION_STRING ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'PG_CONNECTION_STRING (or equivalent) is not configured. Unable to connect to customer context database.'
    );
  }

  const poolConfig = {
    connectionString,
    max: parseInt(process.env.PG_POOL_MAX, 10) || 10,
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS, 10) || 5000
  };

  const sslConfig = resolveSslConfiguration();
  if (sslConfig !== undefined) {
    poolConfig.ssl = sslConfig;
  }

  pool = new Pool(poolConfig);

  pool.on('error', error => {
    logger.error('database_pool_error', {
      message: error.message,
      stack: error.stack
    });
  });

  logger.info('database_pool_initialized', {
    hasSsl: !!poolConfig.ssl,
    maxConnections: poolConfig.max
  });

  return pool;
}

function getEncryptionKey() {
  if (encryptionKeyCache) {
    return encryptionKeyCache;
  }

  const key = process.env.DB_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('DB_ENCRYPTION_KEY is not configured. Unable to encrypt/decrypt secrets.');
  }

  encryptionKeyCache = key;
  return encryptionKeyCache;
}

async function encryptSecret(plainText, client) {
  if (plainText === undefined || plainText === null) {
    return null;
  }

  const executor = client || getPool();
  const { rows } = await executor.query('SELECT pgp_sym_encrypt($1::text, $2)::bytea AS encrypted', [
    plainText,
    getEncryptionKey()
  ]);

  return rows[0]?.encrypted || null;
}

async function decryptSecret(encryptedValue, client) {
  if (!encryptedValue) {
    return null;
  }

  const executor = client || getPool();
  const { rows } = await executor.query('SELECT pgp_sym_decrypt($1::bytea, $2)::text AS decrypted', [
    encryptedValue,
    getEncryptionKey()
  ]);

  return rows[0]?.decrypted || null;
}

/**
 * Execute a parameterised query using the shared pool.
 */
async function query(text, params = []) {
  const start = Date.now();
  const client = getPool();
  const result = await client.query(text, params);

  logger.debug('database_query', {
    text: text.split('\n')[0]?.trim().slice(0, 120),
    durationMs: Date.now() - start,
    rowCount: result.rowCount
  });

  return result;
}

/**
 * Execute a function within a transaction boundary.
 */
async function withTransaction(handler) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close the shared connection pool.
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  closePool,
  encryptSecret,
  decryptSecret
};
