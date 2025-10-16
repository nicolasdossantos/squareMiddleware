// shared/config.js
/**
 * Environment-specific configuration management
 */

const environment = process.env.NODE_ENV || 'development';

const config = {
  development: {
    // Cache TTLs (shorter for development)
    CATALOG_TTL: 5 * 60 * 1000, // 5 minutes
    BARBER_TTL: 5 * 60 * 1000, // 5 minutes
    AVAIL_TTL: 30 * 1000, // 30 seconds

    // Rate limiting (more lenient for development)
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 200, // 200 requests per minute

    // Logging
    LOG_LEVEL: 'debug',
    ENABLE_DETAILED_LOGGING: true,

    // Square API
    SQUARE_ENVIRONMENT: 'sandbox',

    // Security
    ENABLE_RATE_LIMITING: false, // Disabled for local development
    ENABLE_CORS: true,
    CORS_ORIGINS: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://api.elevenlabs.io',
      'https://elevenlabs.io'
    ]
  },

  staging: {
    // Cache TTLs
    CATALOG_TTL: 12 * 60 * 60 * 1000, // 12 hours
    BARBER_TTL: 12 * 60 * 60 * 1000, // 12 hours
    AVAIL_TTL: 60 * 1000, // 1 minute

    // Rate limiting
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 100, // 100 requests per minute

    // Logging
    LOG_LEVEL: 'info',
    ENABLE_DETAILED_LOGGING: true,

    // Square API
    SQUARE_ENVIRONMENT: 'sandbox',

    // Security
    ENABLE_RATE_LIMITING: true,
    ENABLE_CORS: true,
    CORS_ORIGINS: ['https://api.elevenlabs.io', 'https://elevenlabs.io', 'https://api.retellai.com']
  },

  production: {
    // Cache TTLs (longer for production efficiency)
    CATALOG_TTL: 24 * 60 * 60 * 1000, // 24 hours
    BARBER_TTL: 24 * 60 * 60 * 1000, // 24 hours
    AVAIL_TTL: 60 * 1000, // 1 minute

    // Rate limiting (stricter for production)
    RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: 60, // 60 requests per minute

    // Logging
    LOG_LEVEL: 'warn',
    ENABLE_DETAILED_LOGGING: false,

    // Square API
    SQUARE_ENVIRONMENT: 'production',

    // Security
    ENABLE_RATE_LIMITING: true,
    ENABLE_CORS: true,
    CORS_ORIGINS: ['https://api.elevenlabs.io', 'https://elevenlabs.io', 'https://api.retellai.com']
  }
};

// Get current environment configuration
const currentConfig = config[environment] || config.development;

// Override with environment variables if provided
const getConfig = () => ({
  ...currentConfig,

  // Allow environment variable overrides
  CATALOG_TTL: process.env.CATALOG_TTL ? parseInt(process.env.CATALOG_TTL) : currentConfig.CATALOG_TTL,
  BARBER_TTL: process.env.BARBER_TTL ? parseInt(process.env.BARBER_TTL) : currentConfig.BARBER_TTL,
  AVAIL_TTL: process.env.AVAIL_TTL ? parseInt(process.env.AVAIL_TTL) : currentConfig.AVAIL_TTL,

  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS
    ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)
    : currentConfig.RATE_LIMIT_MAX_REQUESTS,

  ENABLE_RATE_LIMITING:
    process.env.ENABLE_RATE_LIMITING === 'true' ? true : currentConfig.ENABLE_RATE_LIMITING,

  // CORS configuration - allow environment variable override
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : currentConfig.CORS_ORIGINS,

  // Required environment variables
  SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
  SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID,
  APPLICATIONINSIGHTS_CONNECTION_STRING: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,

  // Email configuration
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_TO: process.env.EMAIL_TO,
  EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST,
  EMAIL_SMTP_PORT: process.env.EMAIL_SMTP_PORT ? parseInt(process.env.EMAIL_SMTP_PORT) : 587,
  EMAIL_SMTP_USER: process.env.EMAIL_SMTP_USER,
  EMAIL_SMTP_PASS: process.env.EMAIL_SMTP_PASS,

  // ElevenLabs webhook configuration
  ELEVENLABS_WEBHOOK_SECRET: process.env.ELEVENLABS_WEBHOOK_SECRET,

  // Optional with defaults
  TZ: process.env.TZ || 'America/New_York',
  NODE_ENV: environment
});

module.exports = {
  getConfig,
  environment,
  isProduction: () => environment === 'production',
  isStaging: () => environment === 'staging',
  isDevelopment: () => environment === 'development'
};
