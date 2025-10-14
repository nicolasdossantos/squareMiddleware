/**
 * Server Entry Point
 * World-class Express.js server with graceful shutdown and monitoring
 */

const createApp = require('./express-app');
const { logger } = require('./utils/logger');

// Load environment variables - prioritize .env.local (with secrets) over .env (template)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// Initialize Application Insights if configured
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

const app = createApp();
const port = process.env.PORT || 3000;
const environment = process.env.NODE_ENV || 'development';

/**
 * Start the server with graceful shutdown handling
 */
function startServer() {
  const server = app.listen(port, () => {
    logger.info('🚀 Square Booking API Started', {
      port,
      environment,
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });

    console.log('🚀🚀🚀 Square Booking API Started 🚀🚀🚀');
    console.log(`📡 Server running on port ${port}`);
    console.log(`🌍 Environment: ${environment}`);
    console.log(`⏰ Timezone: ${process.env.TZ || 'UTC'}`);
    console.log(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    console.log('✅ No cold starts - always warm with Express.js!');

    if (environment === 'development') {
      console.log(`🔗 Health Check: http://localhost:${port}/api/health`);
      console.log(`📚 API Docs: http://localhost:${port}/api/docs`);
    }
  });

  // Graceful shutdown handling
  const gracefulShutdown = signal => {
    logger.info(`🛑 ${signal} received, shutting down gracefully`);
    console.log(`🛑 ${signal} received, shutting down gracefully`);

    server.close(err => {
      if (err) {
        logger.error('Error during server shutdown', err);
        process.exit(1);
      }

      logger.info('✅ Server closed successfully');
      console.log('✅ Server closed successfully');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('⚠️ Forcing shutdown after timeout');
      console.error('⚠️ Forcing shutdown after timeout');
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
    console.error('💥 Uncaught Exception:', err);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  return server;
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
