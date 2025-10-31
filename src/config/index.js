/**
 * Configuration Management
 * Centralized configuration with environment variable validation
 */

const path = require('path');

// Load environment variables - prioritize .env.local (with secrets) over .env (template)
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Application configuration object
 */
const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
    timezone: process.env.TZ || 'America/New_York'
  },

  // Square API configuration
  square: {
    accessToken: process.env.SQUARE_ACCESS_TOKEN,
    applicationId: process.env.SQUARE_APPLICATION_ID,
    applicationSecret: process.env.SQUARE_APPLICATION_SECRET,
    locationId: process.env.SQUARE_LOCATION_ID,
    environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    webhookSignatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY
  },

  // Azure configuration
  azure: {
    applicationInsights: {
      connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
      instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY
    }
  },

  // Azure Function HTTP triggers (email/SMS offloading)
  azureFunctions: {
    email: {
      url: process.env.AZURE_EMAIL_FUNCTION_URL || process.env.AZURE_FUNCTION_EMAIL_URL,
      key: process.env.AZURE_EMAIL_FUNCTION_KEY || process.env.AZURE_FUNCTION_EMAIL_KEY,
      timeout: parseInt(process.env.AZURE_EMAIL_FUNCTION_TIMEOUT_MS, 10) || 5000
    },
    sms: {
      url: process.env.AZURE_SMS_FUNCTION_URL || process.env.AZURE_FUNCTION_SMS_URL,
      key: process.env.AZURE_SMS_FUNCTION_KEY || process.env.AZURE_FUNCTION_SMS_KEY,
      timeout: parseInt(process.env.AZURE_SMS_FUNCTION_TIMEOUT_MS, 10) || 5000
    },
    phoneNumbers: {
      url: process.env.AZURE_PHONE_FUNCTION_URL || process.env.PHONE_NUMBER_FUNCTION_URL,
      key: process.env.AZURE_PHONE_FUNCTION_KEY || process.env.PHONE_NUMBER_FUNCTION_KEY,
      timeout: parseInt(process.env.AZURE_PHONE_FUNCTION_TIMEOUT_MS, 10) || 10000
    },
    issueDetection: {
      url: process.env.AZURE_ISSUE_FUNCTION_URL || process.env.ISSUE_DIAGNOSTICS_FUNCTION_URL,
      key: process.env.AZURE_ISSUE_FUNCTION_KEY || process.env.ISSUE_DIAGNOSTICS_FUNCTION_KEY,
      timeout: parseInt(process.env.AZURE_ISSUE_FUNCTION_TIMEOUT_MS, 10) || 8000,
      retries: parseInt(process.env.AZURE_ISSUE_FUNCTION_RETRIES, 10) || 1
    }
  },

  // ElevenLabs configuration
  elevenlabs: {
    webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET
  },

  // Retell AI configuration
  retell: {
    apiKey: process.env.RETELL_API_KEY
  },

  // Twilio configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
    smsFrom: process.env.TWILIO_SMS_FROM || '+12675130090', // Regular SMS from number
    businessOwnerWhatsapp:
      process.env.BUSINESS_OWNER_WHATSAPP || process.env.BARBERSHOP_OWNER_WHATSAPP || 'whatsapp:+12678040148',
    businessMessagesTo:
      process.env.BUSINESS_MESSAGES_TO || process.env.BARBERSHOP_MESSAGES_TO || '+12677210098' // SMS format
  },

  // Email configuration
  email: {
    host: process.env.EMAIL_SMTP_HOST,
    port: parseInt(process.env.EMAIL_SMTP_PORT, 10) || 587,
    secure: process.env.EMAIL_SMTP_PORT === '465',
    user: process.env.EMAIL_SMTP_USER,
    password: process.env.EMAIL_SMTP_PASS,
    from: process.env.EMAIL_FROM,
    staffNotificationEmail: process.env.EMAIL_TO
  },

  // Database configuration
  database: {
    connectionString:
      process.env.PG_CONNECTION_STRING ||
      process.env.PG_CONN_STRING ||
      process.env.POSTGRES_CONNECTION_STRING ||
      process.env.DATABASE_URL,
    ssl: {
      mode: process.env.PG_SSL_MODE || null,
      caPath: process.env.PG_SSL_CA_PATH || null,
      ca: process.env.PG_SSL_CA || null,
      rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false'
    }
  },

  // Security configuration
  security: {
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000,
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000
  },

  // Cache configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 300, // 5 minutes default
    maxSize: parseInt(process.env.CACHE_MAX_SIZE, 10) || 1000
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  // Authentication configuration
  auth: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET,
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
    accessTokenTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL || '30d',
    passwordSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12
  }
};

/**
 * Validate required configuration
 *
 * In production, Square credentials are managed per-agent via Key Vault.
 * Only validate in development/local environments.
 */
function validateConfig() {
  const authRequired = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'DB_ENCRYPTION_KEY'];
  const authMissing = authRequired.filter(key => !process.env[key]);

  if (authMissing.length > 0) {
    throw new Error(`Missing required authentication environment variables: ${authMissing.join(', ')}`);
  }

  // Only skip Square credential validation in production; auth secrets are always required
  if (process.env.NODE_ENV === 'production') {
    return true;
  }

  const squareRequired = ['SQUARE_ACCESS_TOKEN', 'SQUARE_LOCATION_ID'];
  const squareMissing = squareRequired.filter(key => !process.env[key]);

  if (squareMissing.length > 0) {
    throw new Error(`Missing required Square environment variables: ${squareMissing.join(', ')}`);
  }

  return true;
}

/**
 * Get configuration for specific service
 */
function getConfig(service) {
  if (service && config[service]) {
    return config[service];
  }
  return config;
}

// Validate configuration on load (except in test/production environment)
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}

module.exports = {
  config,
  getConfig,
  validateConfig
};
