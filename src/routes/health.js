/**
 * Health Check Routes
 * System health and monitoring endpoints
 */

const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const healthController = require('../controllers/healthController');

const router = express.Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', asyncHandler(healthController.basicHealthCheck));

/**
 * GET /api/health/detailed
 * Detailed health check with dependencies
 */
router.get('/detailed', asyncHandler(healthController.detailedHealthCheck));

/**
 * GET /api/health/ready
 * Readiness probe for Kubernetes/containers
 */
router.get('/ready', asyncHandler(healthController.readinessCheck));

/**
 * GET /api/health/live
 * Liveness probe for Kubernetes/containers
 */
router.get('/live', asyncHandler(healthController.livenessCheck));

module.exports = router;
