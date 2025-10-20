/**
 * Error Handler Middleware Unit Tests
 */

const { errorHandler, notFoundHandler, asyncHandler } = require('../../../src/middlewares/errorHandler');
const { logError } = require('../../../src/utils/logger');
const { sendError } = require('../../../src/utils/responseBuilder');

// Mock dependencies
jest.mock('../../../src/utils/logger');
jest.mock('../../../src/utils/responseBuilder');

describe('Error Handler Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      correlationId: 'test-correlation-id',
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      get: jest.fn(header => {
        if (header === 'user-agent') return 'test-browser';
        return null;
      })
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle ValidationError with 400 status', () => {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = { field: 'required' };

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(logError).toHaveBeenCalledWith(error, {
        correlationId: 'test-correlation-id',
        method: 'GET',
        url: '/test',
        statusCode: 400,
        userAgent: 'test-browser',
        ip: '127.0.0.1'
      });

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Validation Error', 400, { field: 'required' }, 'test-correlation-id');
    });

    it('should handle UnauthorizedError with 401 status', () => {
      const error = new Error('Unauthorized access');
      error.name = 'UnauthorizedError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Unauthorized', 401, null, 'test-correlation-id');
    });

    it('should handle ForbiddenError with 403 status', () => {
      const error = new Error('Access forbidden');
      error.name = 'ForbiddenError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Forbidden', 403, null, 'test-correlation-id');
    });

    it('should handle NotFoundError with 404 status', () => {
      const error = new Error('Resource not found');
      error.name = 'NotFoundError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Not Found', 404, null, 'test-correlation-id');
    });

    it('should handle errors with statusCode property', () => {
      const error = new Error('Custom error');
      error.statusCode = 422;

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Custom error', 422, null, 'test-correlation-id');
    });

    it('should handle errors with status property', () => {
      const error = new Error('Status error');
      error.status = 409;

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Status error', 409, null, 'test-correlation-id');
    });

    it('should prioritize statusCode over status', () => {
      const error = new Error('Priority test');
      error.statusCode = 422;
      error.status = 409;

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Priority test', 422, null, 'test-correlation-id');
    });

    it('should handle generic errors with 500 status', () => {
      const error = new Error('Generic error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Generic error', 500, null, 'test-correlation-id');
    });

    it('should use default message for errors without message', () => {
      const error = {};

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Internal Server Error', 500, null, 'test-correlation-id');
    });

    it('should hide details in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = { secret: 'hidden' };

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Validation Error', 400, null, 'test-correlation-id');

      process.env.NODE_ENV = originalEnv;
    });

    it('should show details in non-production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.details = { field: 'visible' };

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(sendError).toHaveBeenCalledWith(mockRes, 'Validation Error', 400, { field: 'visible' }, 'test-correlation-id');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle requests without correlation ID', () => {
      delete mockReq.correlationId;

      const error = new Error('Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(logError).toHaveBeenCalledWith(error, {
        correlationId: undefined,
        method: 'GET',
        url: '/test',
        statusCode: 500,
        userAgent: 'test-browser',
        ip: '127.0.0.1'
      });
    });

    it('should handle requests without user agent', () => {
      mockReq.get.mockReturnValue(null);

      const error = new Error('Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(logError).toHaveBeenCalledWith(error, {
        correlationId: 'test-correlation-id',
        method: 'GET',
        url: '/test',
        statusCode: 500,
        userAgent: null,
        ip: '127.0.0.1'
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should create NotFoundError and pass to next middleware', () => {
      notFoundHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route not found: GET /test',
          name: 'NotFoundError',
          statusCode: 404
        })
      );
    });

    it('should handle different HTTP methods and URLs', () => {
      mockReq.method = 'POST';
      mockReq.url = '/api/users';

      notFoundHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Route not found: POST /api/users'
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass async errors to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle synchronous functions that return promises', async () => {
      const syncFn = jest.fn().mockReturnValue(Promise.resolve('sync success'));
      const wrappedFn = asyncHandler(syncFn);

      await wrappedFn(mockReq, mockRes, mockNext);

      expect(syncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle functions that call next with error', async () => {
      const asyncFn = jest.fn((req, res, next) => {
        next(new Error('Function called next'));
      });
      const wrappedFn = asyncHandler(asyncFn);

      await wrappedFn(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      // The function itself calls next, not the wrapper catching an error
    });
  });
});
