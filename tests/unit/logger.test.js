/**
 * Tests for structured logging utilities
 * Testing all log levels, Azure Functions integration, and log formatting
 */

const logger = require('../../src/utils/logger');

// Mock console.log to capture output
const originalConsoleLog = console.log;
const mockConsoleLog = jest.fn();

// Mock Date.now and Date.toISOString for consistent testing
const mockDate = new Date('2023-01-01T12:00:00.000Z');
const originalDateNow = Date.now;

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = mockConsoleLog;
    Date.now = jest.fn(() => mockDate.getTime());
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T12:00:00.000Z');

    // Reset log level for each test
    logger.resetLogLevel();
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    Date.now = originalDateNow;
    jest.restoreAllMocks();
  });

  describe('LOG_LEVELS', () => {
    test('should export correct log levels', () => {
      expect(logger.LOG_LEVELS).toEqual({
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
      });
    });
  });

  describe('debug', () => {
    test('should log debug message when LOG_LEVEL is DEBUG', () => {
      logger.setLogLevel('DEBUG');

      logger.debug('Test debug message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"DEBUG"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"message":"Test debug message"'));

      logger.resetLogLevel();
    });

    test('should not log debug message when LOG_LEVEL is INFO', () => {
      logger.setLogLevel('INFO');

      logger.debug('Test debug message');

      expect(mockConsoleLog).not.toHaveBeenCalled();

      logger.resetLogLevel();
    });

    test('should include metadata in debug log', () => {
      logger.setLogLevel('DEBUG');

      logger.debug('Test debug message', { user_id: '123', action: 'test' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"user_id":"123"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"action":"test"'));

      logger.resetLogLevel();
    });

    test('should use Azure Functions context when provided', () => {
      logger.setLogLevel('DEBUG');

      const mockContext = {
        invocationId: 'test-id',
        functionName: 'TestFunction',
        log: jest.fn()
      };

      logger.debug('Test debug message', { test: 'data' }, mockContext);

      expect(mockContext.log).toHaveBeenCalledWith(
        'Test debug message',
        expect.objectContaining({
          level: 'DEBUG',
          correlation_id: 'test-id',
          function_name: 'TestFunction',
          test: 'data'
        })
      );

      logger.resetLogLevel();
    });
  });

  describe('info', () => {
    test('should log info message', () => {
      logger.info('Test info message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"INFO"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"message":"Test info message"'));
    });

    test('should include metadata in info log', () => {
      logger.info('Test info message', { user_id: '456', operation: 'read' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"user_id":"456"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"operation":"read"'));
    });

    test('should use Azure Functions context when provided', () => {
      const mockContext = {
        invocationId: 'info-test-id',
        functionName: 'InfoFunction',
        log: jest.fn()
      };

      logger.info('Test info message', { test: 'info' }, mockContext);

      expect(mockContext.log).toHaveBeenCalledWith(
        'Test info message',
        expect.objectContaining({
          level: 'INFO',
          correlation_id: 'info-test-id',
          function_name: 'InfoFunction',
          test: 'info'
        })
      );
    });
  });

  describe('warn', () => {
    test('should log warn message', () => {
      logger.warn('Test warn message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"WARN"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"message":"Test warn message"'));
    });

    test('should use Azure Functions context warn method', () => {
      const mockContext = {
        invocationId: 'warn-test-id',
        functionName: 'WarnFunction',
        log: {
          warn: jest.fn()
        }
      };

      logger.warn('Test warn message', { warning: 'test' }, mockContext);

      expect(mockContext.log.warn).toHaveBeenCalledWith(
        'Test warn message',
        expect.objectContaining({
          level: 'WARN',
          correlation_id: 'warn-test-id',
          function_name: 'WarnFunction',
          warning: 'test'
        })
      );
    });
  });

  describe('error', () => {
    test('should log error message', () => {
      logger.error('Test error message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"ERROR"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"message":"Test error message"'));
    });

    test('should use Azure Functions context error method', () => {
      const mockContext = {
        invocationId: 'error-test-id',
        functionName: 'ErrorFunction',
        log: {
          error: jest.fn()
        }
      };

      logger.error('Test error message', { error: 'test' }, mockContext);

      expect(mockContext.log.error).toHaveBeenCalledWith(
        '❌ ERROR:',
        'Test error message',
        expect.objectContaining({
          level: 'ERROR',
          correlation_id: 'error-test-id',
          function_name: 'ErrorFunction',
          error: 'test'
        })
      );
    });
  });

  describe('logApiStart', () => {
    test('should log API start with debug level', () => {
      logger.setLogLevel('DEBUG');

      logger.logApiStart('GetAvailability', { location: 'test' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"DEBUG"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"message":"🚀 GetAvailability started"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"operation":"GetAvailability"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"location":"test"'));

      logger.resetLogLevel();
    });

    test('should not log API start when LOG_LEVEL is INFO', () => {
      logger.logApiStart('GetAvailability', { location: 'test' });

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('logApiSuccess', () => {
    test('should log API success with info level', () => {
      logger.logApiSuccess('GetAvailability', 150, { response_size: 42 });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"INFO"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"message":"✅ GetAvailability completed"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"operation":"GetAvailability"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"duration_ms":150'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"response_size":42'));
    });

    test('should use Azure Functions context for success logging', () => {
      const mockContext = {
        invocationId: 'success-test-id',
        functionName: 'SuccessFunction',
        log: jest.fn()
      };

      logger.logApiSuccess('GetAvailability', 200, { items: 5 }, mockContext);

      expect(mockContext.log).toHaveBeenCalledWith(
        '✅ GetAvailability completed',
        expect.objectContaining({
          level: 'INFO',
          operation: 'GetAvailability',
          duration_ms: 200,
          success: true,
          items: 5
        })
      );
    });
  });

  describe('logApiError', () => {
    test('should log API error with error level', () => {
      const testError = new Error('Test error');

      logger.logApiError('GetAvailability', 300, testError, { attempts: 3 });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"ERROR"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"message":"❌ GetAvailability failed"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"operation":"GetAvailability"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"duration_ms":300'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"error_message":"Test error"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"error_type":"Error"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"success":false'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"attempts":3'));
    });

    test('should use Azure Functions context for error logging', () => {
      const mockContext = {
        invocationId: 'error-test-id',
        functionName: 'ErrorFunction',
        log: {
          error: jest.fn()
        }
      };

      const testError = new TypeError('Type error');

      logger.logApiError('GetAvailability', 400, testError, { retry: false }, mockContext);

      expect(mockContext.log.error).toHaveBeenCalledWith(
        '❌ ERROR:',
        '❌ GetAvailability failed',
        expect.objectContaining({
          level: 'ERROR',
          operation: 'GetAvailability',
          duration_ms: 400,
          error_message: 'Type error',
          error_type: 'TypeError',
          success: false,
          retry: false
        })
      );
    });
  });

  describe('logRateLimit', () => {
    test('should log rate limit allowed with debug level', () => {
      logger.setLogLevel('DEBUG');

      logger.logRateLimit('client-123', true, 9, { limit: 10 });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"DEBUG"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Rate limit check passed for client-123"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"operation":"rate_limit_check"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"client_id":"client-123"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"allowed":true'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"remaining":9'));

      logger.resetLogLevel();
    });

    test('should log rate limit exceeded with warn level', () => {
      logger.logRateLimit('client-456', false, 0, { limit: 10 });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"WARN"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Rate limit exceeded for client-456"')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"operation":"rate_limit_check"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"client_id":"client-456"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"allowed":false'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"remaining":0'));
    });
  });

  describe('log entry structure', () => {
    test('should include timestamp in log entry', () => {
      logger.info('Test message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"timestamp":"2023-01-01T12:00:00.000Z"'));
    });

    test('should include correlation_id from metadata', () => {
      logger.info('Test message', { correlation_id: 'test-correlation-123' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"correlation_id":"test-correlation-123"'));
    });

    test('should include function_name from metadata', () => {
      logger.info('Test message', { function_name: 'TestFunction' });

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"function_name":"TestFunction"'));
    });

    test('should default correlation_id to "unknown" when not provided', () => {
      logger.info('Test message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"correlation_id":"unknown"'));
    });

    test('should default function_name to "unknown" when not provided', () => {
      logger.info('Test message');

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"function_name":"unknown"'));
    });
  });

  describe('log level filtering', () => {
    test('should respect ERROR log level', () => {
      logger.setLogLevel('ERROR');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"ERROR"'));

      logger.resetLogLevel();
    });

    test('should respect WARN log level', () => {
      logger.setLogLevel('WARN');

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(2);
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"WARN"'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"level":"ERROR"'));

      logger.resetLogLevel();
    });

    test('should default to INFO log level when not specified', () => {
      // Don't set LOG_LEVEL environment variable
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warn message');
      logger.error('Error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      expect(mockConsoleLog).not.toHaveBeenCalledWith(expect.stringContaining('"level":"DEBUG"'));
    });
  });
});
