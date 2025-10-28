/**
 * Server Entry Point
 * World-class Express.js server with graceful shutdown and monitoring
 */

// Load environment variables FIRST - prioritize .env.local (with secrets) over .env (template)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// Initialize Application Insights BEFORE any other imports if configured
// This MUST be first to properly instrument dependencies
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  require('applicationinsights')
    .setup()
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .start();
}

// Now load application modules
const createApp = require('./express-app');
const { logger } = require('./utils/logger');
const sessionStore = require('./services/sessionStore');
const { validateStartup, isConfigurationCritical } = require('./utils/configValidator');

/**
 * Validate configuration before starting the application
 * Fails fast if critical configuration is missing
 */
const configValidation = validateStartup(logger);
if (isConfigurationCritical(configValidation)) {
  console.error('\n❌ FATAL: Application cannot start with invalid configuration.\n');
  process.exit(1);
}

const app = createApp();
const port = process.env.PORT || 3000;
const environment = process.env.NODE_ENV || 'development';

/**
 * Start the server with graceful shutdown handling
 */
function startServer() {
  const server = app.listen(port, () => {
    logger.info('Square Booking API Started', {
      port,
      environment,
      timezone: process.env.TZ || 'UTC',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      uptime: process.uptime(),
      configurationStatus: configValidation.valid ? '✅ Valid' : '⚠️ Warnings',
      configurationWarnings: configValidation.warnings.length
    });

    if (environment === 'development') {
      logger.info('Development endpoints available', {
        healthCheck: `http://localhost:${port}/api/health`,
        apiDocs: `http://localhost:${port}/api/docs`
      });
    }
  });

  // Graceful shutdown handling
  const gracefulShutdown = signal => {
    logger.info(`${signal} received, shutting down gracefully`, { signal });

    // Cleanup session store intervals
    sessionStore.shutdown();

    server.close(err => {
      if (err) {
        logger.error('Error during server shutdown', err);
        process.exit(1);
      }

      logger.info('Server closed successfully');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle various shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart

  // Handle uncaught exceptions
  process.on('uncaughtException', err => {
    logger.error('Uncaught Exception', err);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    process.exit(1);
  });

  return server;
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
