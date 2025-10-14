/**
 * Health Controller Unit Tests
 */

const healthController = require('../../../src/controllers/healthController');
const healthService = require('../../../src/services/healthService');
const { sendSuccess, sendError } = require('../../../src/utils/responseBuilder');
const { logEvent } = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/services/healthService');
jest.mock('../../../src/utils/responseBuilder');
jest.mock('../../../src/utils/logger');

describe('Health Controller', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      correlationId: 'test-correlation-id'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    // Mock process environment and methods
    process.env.npm_package_version = '2.1.0';
    process.env.NODE_ENV = 'test';
    jest.spyOn(process, 'uptime').mockReturnValue(3600);
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      heapUsed: 50 * 1024 * 1024, // 50MB
      heapTotal: 100 * 1024 * 1024 // 100MB
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('basicHealthCheck', () => {
    it('should return basic health status successfully', async () => {
      await healthController.basicHealthCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('health_check', {
        correlationId: 'test-correlation-id',
        type: 'basic',
        status: 'healthy'
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          status: 'healthy',
          timestamp: expect.any(String),
          version: '2.1.0',
          environment: 'test',
          uptime: 3600
        },
        'Service is healthy'
      );
    });

    it('should handle errors gracefully', async () => {
      // Force an error by mocking Date constructor
      const originalDate = global.Date;
      global.Date = jest.fn(() => {
        throw new Error('Date construction failed');
      });

      await healthController.basicHealthCheck(mockReq, mockRes);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Health check failed', 500, 'Date construction failed');

      // Restore
      global.Date = originalDate;
    });

    it('should use default values when environment variables are missing', async () => {
      delete process.env.npm_package_version;
      delete process.env.NODE_ENV;

      await healthController.basicHealthCheck(mockReq, mockRes);

      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          version: '2.0.0',
          environment: 'development'
        }),
        'Service is healthy'
      );
    });
  });

  describe('detailedHealthCheck', () => {
    it('should return detailed health status when all dependencies are healthy', async () => {
      const mockHealthStatus = {
        dependencies: [
          { name: 'square', status: 'healthy', responseTime: 50 },
          { name: 'database', status: 'healthy', responseTime: 30 }
        ]
      };
      healthService.getDetailedHealth.mockResolvedValue(mockHealthStatus);

      await healthController.detailedHealthCheck(mockReq, mockRes);

      expect(healthService.getDetailedHealth).toHaveBeenCalled();

      expect(logEvent).toHaveBeenCalledWith('health_check', {
        correlationId: 'test-correlation-id',
        type: 'detailed',
        status: 'healthy',
        dependencyCount: 2,
        healthyDependencies: 2
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          status: 'healthy',
          timestamp: expect.any(String),
          version: '2.1.0',
          environment: 'test',
          uptime: 3600,
          memory: {
            used: '50 MB',
            total: '100 MB'
          },
          dependencies: mockHealthStatus.dependencies
        },
        'Service and dependencies are healthy'
      );
    });

    it('should return degraded status when some dependencies are unhealthy', async () => {
      const mockHealthStatus = {
        dependencies: [
          { name: 'square', status: 'healthy', responseTime: 50 },
          { name: 'database', status: 'unhealthy', responseTime: null, error: 'Connection timeout' }
        ]
      };
      healthService.getDetailedHealth.mockResolvedValue(mockHealthStatus);

      await healthController.detailedHealthCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('health_check', {
        correlationId: 'test-correlation-id',
        type: 'detailed',
        status: 'degraded',
        dependencyCount: 2,
        healthyDependencies: 1
      });

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service is degraded',
        data: expect.objectContaining({
          status: 'degraded',
          dependencies: mockHealthStatus.dependencies
        }),
        timestamp: expect.any(String)
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Health service failed');
      healthService.getDetailedHealth.mockRejectedValue(error);

      await healthController.detailedHealthCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('health_check_error', {
        correlationId: 'test-correlation-id',
        type: 'detailed',
        error: 'Health service failed'
      });

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Detailed health check failed', 500, 'Health service failed');
    });
  });

  describe('readinessCheck', () => {
    it('should return ready status when service is ready', async () => {
      healthService.checkReadiness.mockResolvedValue(true);

      await healthController.readinessCheck(mockReq, mockRes);

      expect(healthService.checkReadiness).toHaveBeenCalled();

      expect(logEvent).toHaveBeenCalledWith('readiness_check', {
        correlationId: 'test-correlation-id',
        ready: true
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          ready: true,
          timestamp: expect.any(String)
        },
        'Service is ready'
      );
    });

    it('should return not ready status when service is not ready', async () => {
      healthService.checkReadiness.mockResolvedValue(false);

      await healthController.readinessCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('readiness_check', {
        correlationId: 'test-correlation-id',
        ready: false
      });

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service is not ready',
        data: {
          ready: false,
          timestamp: expect.any(String)
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle readiness check errors', async () => {
      const error = new Error('Readiness check failed');
      healthService.checkReadiness.mockRejectedValue(error);

      await healthController.readinessCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('readiness_check_error', {
        correlationId: 'test-correlation-id',
        error: 'Readiness check failed'
      });

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Readiness check failed', 503, 'Readiness check failed');
    });
  });

  describe('livenessCheck', () => {
    it('should return alive status when service is alive', async () => {
      healthService.checkLiveness.mockResolvedValue(true);

      await healthController.livenessCheck(mockReq, mockRes);

      expect(healthService.checkLiveness).toHaveBeenCalled();

      expect(logEvent).toHaveBeenCalledWith('liveness_check', {
        correlationId: 'test-correlation-id',
        alive: true,
        uptime: 3600
      });

      expect(sendSuccess).toHaveBeenCalledWith(
        mockRes,
        {
          alive: true,
          timestamp: expect.any(String),
          uptime: 3600
        },
        'Service is alive'
      );
    });

    it('should return not alive status when service is not alive', async () => {
      healthService.checkLiveness.mockResolvedValue(false);

      await healthController.livenessCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('liveness_check', {
        correlationId: 'test-correlation-id',
        alive: false,
        uptime: 3600
      });

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service is not responding',
        data: {
          alive: false,
          timestamp: expect.any(String),
          uptime: 3600
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle liveness check errors', async () => {
      const error = new Error('Liveness check failed');
      healthService.checkLiveness.mockRejectedValue(error);

      await healthController.livenessCheck(mockReq, mockRes);

      expect(logEvent).toHaveBeenCalledWith('liveness_check_error', {
        correlationId: 'test-correlation-id',
        error: 'Liveness check failed'
      });

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Liveness check failed', 503, 'Liveness check failed');
    });
  });
});
