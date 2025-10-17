/**
 * Health Controller
 * System health and monitoring endpoints
 */

const { sendSuccess, sendError } = require('../utils/responseBuilder');
const { logEvent } = require('../utils/logger');
const healthService = require('../services/healthService');

/**
 * Basic health check - FAST for Azure health probes
 * No external API calls, just process status
 */
async function basicHealthCheck(req, res) {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: Math.round(process.uptime())
    };

    // Fast response for health probes - no logging overhead
    res.status(200).json({
      success: true,
      message: 'Service is healthy',
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
}

/**
 * Detailed health check with dependencies
 */
async function detailedHealthCheck(req, res) {
  const { correlationId } = req;

  try {
    const healthStatus = await healthService.getDetailedHealth();

    // Determine overall status
    const isHealthy = healthStatus.dependencies.every(dep => dep.status === 'healthy');
    const overallStatus = isHealthy ? 'healthy' : 'degraded';

    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`
      },
      dependencies: healthStatus.dependencies
    };

    logEvent('health_check', {
      correlationId,
      type: 'detailed',
      status: overallStatus,
      dependencyCount: healthStatus.dependencies.length,
      healthyDependencies: healthStatus.dependencies.filter(d => d.status === 'healthy').length
    });

    const statusCode = isHealthy ? 200 : 503;

    if (isHealthy) {
      sendSuccess(res, health, 'Service and dependencies are healthy');
    } else {
      res.status(statusCode).json({
        success: false,
        message: 'Service is degraded',
        data: health,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logEvent('health_check_error', {
      correlationId,
      type: 'detailed',
      error: error.message
    });

    sendError(res, 'Detailed health check failed', 500, error.message);
  }
}

/**
 * Readiness probe for Kubernetes/containers
 */
async function readinessCheck(req, res) {
  const { correlationId } = req;

  try {
    const isReady = await healthService.checkReadiness();

    const status = {
      ready: isReady,
      timestamp: new Date().toISOString()
    };

    logEvent('readiness_check', {
      correlationId,
      ready: isReady
    });

    if (isReady) {
      sendSuccess(res, status, 'Service is ready');
    } else {
      res.status(503).json({
        success: false,
        message: 'Service is not ready',
        data: status,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logEvent('readiness_check_error', {
      correlationId,
      error: error.message
    });

    sendError(res, 'Readiness check failed', 503, error.message);
  }
}

/**
 * Liveness probe for Kubernetes/containers
 */
async function livenessCheck(req, res) {
  const { correlationId } = req;

  try {
    const isAlive = await healthService.checkLiveness();

    const status = {
      alive: isAlive,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    logEvent('liveness_check', {
      correlationId,
      alive: isAlive,
      uptime: process.uptime()
    });

    if (isAlive) {
      sendSuccess(res, status, 'Service is alive');
    } else {
      res.status(503).json({
        success: false,
        message: 'Service is not responding',
        data: status,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logEvent('liveness_check_error', {
      correlationId,
      error: error.message
    });

    sendError(res, 'Liveness check failed', 503, error.message);
  }
}

module.exports = {
  basicHealthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck
};
