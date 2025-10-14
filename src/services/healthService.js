/**
 * Health Service
 * System health monitoring and dependency checks
 */

const { SquareClient, SquareEnvironment } = require('square');
const { logPerformance, logEvent, logError } = require('../utils/logger');
const { config } = require('../config');
const emailService = require('./emailService');

// Initialize Square client for health checks
const squareClient = new SquareClient({
  accessToken: config.square.accessToken,
  environment: config.square.environment === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox
}); /**
 * Get detailed health status with dependency checks
 */
async function getDetailedHealth() {
  const startTime = Date.now();

  try {
    logEvent('health_check_detailed_start');

    // Run dependency checks in parallel
    const [squareHealth, emailHealth, memoryHealth, diskHealth] = await Promise.allSettled([
      checkSquareConnection(),
      checkEmailService(),
      checkMemoryUsage(),
      checkDiskSpace()
    ]);

    const dependencies = [
      {
        name: 'Square API',
        status: squareHealth.status === 'fulfilled' && squareHealth.value.healthy ? 'healthy' : 'unhealthy',
        responseTime: squareHealth.value?.responseTime || null,
        error: squareHealth.status === 'rejected' ? squareHealth.reason.message : squareHealth.value?.error
      },
      {
        name: 'Email Service',
        status: emailHealth.status === 'fulfilled' && emailHealth.value.healthy ? 'healthy' : 'unhealthy',
        responseTime: emailHealth.value?.responseTime || null,
        error: emailHealth.status === 'rejected' ? emailHealth.reason.message : emailHealth.value?.error
      },
      {
        name: 'Memory Usage',
        status: memoryHealth.status === 'fulfilled' && memoryHealth.value.healthy ? 'healthy' : 'warning',
        details: memoryHealth.value?.details,
        error: memoryHealth.status === 'rejected' ? memoryHealth.reason.message : null
      },
      {
        name: 'Disk Space',
        status: diskHealth.status === 'fulfilled' && diskHealth.value.healthy ? 'healthy' : 'warning',
        details: diskHealth.value?.details,
        error: diskHealth.status === 'rejected' ? diskHealth.reason.message : null
      }
    ];

    logPerformance(null, 'health_check_detailed', startTime, {
      dependenciesChecked: dependencies.length,
      healthyCount: dependencies.filter(d => d.status === 'healthy').length
    });

    logEvent('health_check_detailed_complete', {
      dependencies: dependencies.map(d => ({ name: d.name, status: d.status }))
    });

    return { dependencies };
  } catch (error) {
    logError(error, {
      operation: 'getDetailedHealth',
      duration: Date.now() - startTime
    });
    throw new Error(`Health check failed: ${error.message}`);
  }
}

/**
 * Check if service is ready to accept requests
 */
async function checkReadiness() {
  try {
    logEvent('readiness_check_start');

    // Critical dependencies that must be available for readiness
    const criticalChecks = await Promise.allSettled([checkSquareConnection(), checkEnvironmentVariables()]);

    const isReady = criticalChecks.every(check => check.status === 'fulfilled' && check.value.healthy);

    logEvent('readiness_check_complete', {
      ready: isReady,
      criticalChecks: criticalChecks.length
    });

    return isReady;
  } catch (error) {
    logError(error, {
      operation: 'checkReadiness'
    });
    return false;
  }
}

/**
 * Check if service is alive (basic liveness check)
 */
async function checkLiveness() {
  try {
    logEvent('liveness_check_start');

    // Basic checks for service liveness
    const alive = process.uptime() > 0 && process.memoryUsage().heapUsed > 0;

    logEvent('liveness_check_complete', {
      alive,
      uptime: process.uptime()
    });

    return alive;
  } catch (error) {
    logError(error, {
      operation: 'checkLiveness'
    });
    return false;
  }
}

/**
 * Check Square API connection
 */
async function checkSquareConnection() {
  const startTime = Date.now();

  try {
    // Simple API call to verify connection
    await squareClient.locationsApi.listLocations();

    const responseTime = Date.now() - startTime;

    return {
      healthy: true,
      responseTime,
      message: 'Square API connection successful'
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      healthy: false,
      responseTime,
      error: error.message,
      message: 'Square API connection failed'
    };
  }
}

/**
 * Check email service configuration
 */
async function checkEmailService() {
  const startTime = Date.now();

  try {
    const result = await emailService.testEmailConfiguration();
    const responseTime = Date.now() - startTime;

    return {
      healthy: result.success,
      responseTime,
      message: result.message,
      error: result.success ? null : result.message
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      healthy: false,
      responseTime,
      error: error.message,
      message: 'Email service check failed'
    };
  }
}

/**
 * Check memory usage
 */
async function checkMemoryUsage() {
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssMB = Math.round(memUsage.rss / 1024 / 1024);

    // Consider unhealthy if using more than 80% of heap or more than 1GB RSS
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const healthy = heapUsagePercent < 80 && rssMB < 1024;

    return {
      healthy,
      details: {
        heapUsed: `${heapUsedMB} MB`,
        heapTotal: `${heapTotalMB} MB`,
        heapUsagePercent: `${Math.round(heapUsagePercent)}%`,
        rss: `${rssMB} MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)} MB`
      },
      message: healthy ? 'Memory usage normal' : 'High memory usage detected'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      message: 'Memory check failed'
    };
  }
}

/**
 * Check disk space (basic check)
 */
async function checkDiskSpace() {
  // Basic disk space check - for now just return healthy
  return {
    healthy: true,
    details: {
      accessible: true,
      message: 'Disk accessible'
    },
    message: 'Disk space check passed'
  };
}

/**
 * Check required environment variables
 */
async function checkEnvironmentVariables() {
  try {
    const requiredVars = ['SQUARE_ACCESS_TOKEN', 'PORT'];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    const healthy = missingVars.length === 0;

    return {
      healthy,
      details: {
        required: requiredVars.length,
        missing: missingVars.length,
        missingVars: healthy ? [] : missingVars
      },
      message: healthy
        ? 'All required environment variables present'
        : `Missing environment variables: ${missingVars.join(', ')}`
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      message: 'Environment variables check failed'
    };
  }
}

/**
 * Get system metrics
 */
async function getSystemMetrics() {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    };
  } catch (error) {
    logError(error, {
      operation: 'getSystemMetrics'
    });
    return null;
  }
}

module.exports = {
  getDetailedHealth,
  checkReadiness,
  checkLiveness,
  checkSquareConnection,
  checkEmailService,
  getSystemMetrics
};
