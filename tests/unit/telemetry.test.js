// tests/telemetry.test.js

// Mock Application Insights before requiring the module
jest.mock('applicationinsights', () => ({
  setup: jest.fn().mockReturnThis(),
  setAutoDependencyCorrelation: jest.fn().mockReturnThis(),
  setAutoCollectRequests: jest.fn().mockReturnThis(),
  setAutoCollectPerformance: jest.fn().mockReturnThis(),
  setAutoCollectExceptions: jest.fn().mockReturnThis(),
  setAutoCollectDependencies: jest.fn().mockReturnThis(),
  setAutoCollectConsole: jest.fn().mockReturnThis(),
  setUseDiskRetryCaching: jest.fn().mockReturnThis(),
  setSendLiveMetrics: jest.fn().mockReturnThis(),
  setDistributedTracingMode: jest.fn().mockReturnThis(),
  start: jest.fn().mockReturnThis(),
  defaultClient: {
    trackEvent: jest.fn(),
    trackMetric: jest.fn(),
    trackException: jest.fn(),
    trackDependency: jest.fn()
  },
  DistributedTracingModes: {
    AI: 'AI'
  }
}));

const appInsights = require('applicationinsights');

const {
  trackEvent,
  trackMetric,
  trackException,
  trackDependency,
  logPerformance,
  logCacheHit,
  logApiCall,
  client
} = require('../../src/utils/telemetry');

describe('Telemetry Module', () => {
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContext = {
      log: {
        metric: jest.fn(),
        warn: jest.fn()
      }
    };

    // Setup context.log as a function with properties
    Object.assign(mockContext.log, {
      metric: jest.fn(),
      warn: jest.fn()
    });
  });

  describe('Application Insights Integration', () => {
    test('should export Application Insights client', () => {
      expect(client).toBe(appInsights.defaultClient);
    });
  });

  describe('trackEvent', () => {
    test('should track event with Application Insights when client available', () => {
      const eventName = 'test_event';
      const properties = { user_id: '123', action: 'click' };
      const measurements = { duration: 100 };

      trackEvent(eventName, properties, measurements);

      expect(client.trackEvent).toHaveBeenCalledWith({
        name: eventName,
        properties: {
          ...properties,
          timestamp: expect.any(String)
        },
        measurements
      });
    });

    test('should handle event without properties and measurements', () => {
      const eventName = 'simple_event';

      trackEvent(eventName);

      expect(client.trackEvent).toHaveBeenCalledWith({
        name: eventName,
        properties: {
          timestamp: expect.any(String)
        },
        measurements: {}
      });
    });

    test('should include ISO timestamp in properties', () => {
      const eventName = 'timestamp_test';

      trackEvent(eventName);

      const call = client.trackEvent.mock.calls[0][0];
      expect(call.properties.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('should not crash when client is null', () => {
      // Temporarily remove client
      const originalClient = require('../../src/utils/telemetry').client;
      require('../../src/utils/telemetry').client = null;

      expect(() => trackEvent('test_event')).not.toThrow();

      // Restore client
      require('../../src/utils/telemetry').client = originalClient;
    });
  });

  describe('trackMetric', () => {
    test('should track metric with Application Insights when client available', () => {
      const metricName = 'response_time';
      const value = 150;
      const properties = { endpoint: '/api/availability' };

      trackMetric(metricName, value, properties);

      expect(client.trackMetric).toHaveBeenCalledWith({
        name: metricName,
        value,
        properties: {
          ...properties,
          timestamp: expect.any(String)
        }
      });
    });

    test('should handle metric without properties', () => {
      const metricName = 'simple_metric';
      const value = 42;

      trackMetric(metricName, value);

      expect(client.trackMetric).toHaveBeenCalledWith({
        name: metricName,
        value,
        properties: {
          timestamp: expect.any(String)
        }
      });
    });

    test('should handle zero and negative values', () => {
      trackMetric('zero_metric', 0);
      trackMetric('negative_metric', -5);

      expect(client.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'zero_metric',
          value: 0
        })
      );
      expect(client.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'negative_metric',
          value: -5
        })
      );
    });
  });

  describe('trackException', () => {
    test('should track exception with Application Insights when client available', () => {
      const error = new Error('Test error');
      const properties = { function: 'GetServiceAvailability', user_id: '123' };

      trackException(error, properties);

      expect(client.trackException).toHaveBeenCalledWith({
        exception: error,
        properties: {
          ...properties,
          timestamp: expect.any(String)
        }
      });
    });

    test('should handle exception without properties', () => {
      const error = new Error('Simple error');

      trackException(error);

      expect(client.trackException).toHaveBeenCalledWith({
        exception: error,
        properties: {
          timestamp: expect.any(String)
        }
      });
    });

    test('should handle different error types', () => {
      const syntaxError = new SyntaxError('Invalid syntax');
      const typeError = new TypeError('Wrong type');
      const customError = { message: 'Custom error object' };

      trackException(syntaxError);
      trackException(typeError);
      trackException(customError);

      expect(client.trackException).toHaveBeenCalledTimes(3);
      expect(client.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: syntaxError
        })
      );
      expect(client.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: typeError
        })
      );
      expect(client.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: customError
        })
      );
    });
  });

  describe('trackDependency', () => {
    test('should track dependency with Application Insights when client available', () => {
      const name = 'square_api';
      const commandName = 'searchAvailability';
      const duration = 250;
      const success = true;
      const properties = { service_id: 'SERVICE_1' };

      trackDependency(name, commandName, duration, success, properties);

      expect(client.trackDependency).toHaveBeenCalledWith({
        target: name,
        name: commandName,
        data: commandName,
        duration,
        resultCode: 200,
        success: true,
        dependencyTypeName: 'HTTP',
        properties: {
          ...properties,
          timestamp: expect.any(String)
        }
      });
    });

    test('should track failed dependency with 500 result code', () => {
      const name = 'square_api';
      const commandName = 'searchAvailability';
      const duration = 500;
      const success = false;

      trackDependency(name, commandName, duration, success);

      expect(client.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({
          resultCode: 500,
          success: false
        })
      );
    });

    test('should handle dependency without properties', () => {
      trackDependency('api', 'command', 100, true);

      expect(client.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'api',
          name: 'command',
          data: 'command',
          duration: 100,
          properties: {
            timestamp: expect.any(String)
          }
        })
      );
    });
  });

  describe('logPerformance', () => {
    test('should log performance with Azure Functions metric when available', () => {
      const functionName = 'GetServiceAvailability';
      const startTime = Date.now() - 1000;
      const additionalData = { service_count: 2 };

      logPerformance(mockContext, functionName, startTime, additionalData);

      const expectedDuration = expect.any(Number);
      expect(mockContext.log.metric).toHaveBeenCalledWith(
        `${functionName}_duration`,
        expectedDuration,
        expect.objectContaining({
          function: functionName,
          duration_ms: expectedDuration,
          service_count: 2,
          timestamp: expect.any(String)
        })
      );

      expect(client.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `${functionName}_duration_ms`,
          value: expectedDuration
        })
      );
    });

    test('should use fallback logging when metric function not available', () => {
      const contextWithoutMetric = {
        log: jest.fn()
      };

      const functionName = 'TestFunction';
      const startTime = Date.now() - 500;

      logPerformance(contextWithoutMetric, functionName, startTime);

      expect(contextWithoutMetric.log).toHaveBeenCalledWith(
        expect.stringContaining(`Performance metric: ${functionName}_duration`),
        expect.any(Object)
      );
    });

    test('should warn about slow execution and track event', () => {
      const functionName = 'SlowFunction';
      const startTime = Date.now() - 6000; // 6 seconds ago

      logPerformance(mockContext, functionName, startTime);

      expect(mockContext.log.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Slow execution detected for ${functionName}`),
        expect.any(Object)
      );

      expect(client.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'slow_execution'
        })
      );
    });

    test('should not warn for fast execution', () => {
      const functionName = 'FastFunction';
      const startTime = Date.now() - 100; // 100ms ago

      logPerformance(mockContext, functionName, startTime);

      expect(mockContext.log.warn).not.toHaveBeenCalled();
      expect(client.trackEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'slow_execution'
        })
      );
    });

    test('should include additional data in performance log', () => {
      const functionName = 'TestFunction';
      const startTime = Date.now() - 200;
      const additionalData = {
        user_id: '123',
        service_count: 3,
        barber_id: 'BARBER_1'
      };

      logPerformance(mockContext, functionName, startTime, additionalData);

      expect(client.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining(additionalData)
        })
      );
    });
  });

  describe('logCacheHit', () => {
    test('should log cache hit with Azure Functions metric when available', () => {
      const cacheType = 'availability';
      const hit = true;

      logCacheHit(mockContext, cacheType, hit);

      expect(mockContext.log.metric).toHaveBeenCalledWith(
        'cache_availability_hit',
        1,
        expect.objectContaining({
          cache_type: cacheType,
          cache_hit: hit,
          timestamp: expect.any(String)
        })
      );

      expect(client.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cache_availability_hit',
          value: 1
        })
      );
    });

    test('should log cache miss', () => {
      const cacheType = 'services';
      const hit = false;

      logCacheHit(mockContext, cacheType, hit);

      expect(mockContext.log.metric).toHaveBeenCalledWith('cache_services_miss', 1, expect.any(Object));

      expect(client.trackMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'cache_services_miss',
          value: 1
        })
      );
    });

    test('should default to cache hit when hit parameter not provided', () => {
      const cacheType = 'default';

      logCacheHit(mockContext, cacheType);

      expect(mockContext.log.metric).toHaveBeenCalledWith('cache_default_hit', 1, expect.any(Object));
    });

    test('should use fallback logging when metric function not available', () => {
      const contextWithoutMetric = {
        log: jest.fn()
      };

      logCacheHit(contextWithoutMetric, 'test', true);

      expect(contextWithoutMetric.log).toHaveBeenCalledWith(
        expect.stringContaining('Cache metric: cache_test_hit = 1'),
        expect.any(Object)
      );
    });
  });

  describe('logApiCall', () => {
    test('should log successful API call with response time', () => {
      const apiName = 'searchAvailability';
      const success = true;
      const responseTime = 150;
      const additionalData = { service_id: 'SERVICE_1' };

      logApiCall(mockContext, apiName, success, responseTime, additionalData);

      expect(mockContext.log.metric).toHaveBeenCalledWith(
        `api_call_${apiName}`,
        1,
        expect.objectContaining({
          api: apiName,
          success: true,
          response_time_ms: responseTime,
          service_id: 'SERVICE_1',
          timestamp: expect.any(String)
        })
      );

      expect(client.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({
          target: 'square_api',
          name: apiName,
          duration: responseTime,
          success: true
        })
      );

      expect(client.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `api_call_${apiName}`
        })
      );
    });

    test('should log failed API call', () => {
      const apiName = 'createBooking';
      const success = false;
      const responseTime = 500;

      logApiCall(mockContext, apiName, success, responseTime);

      expect(client.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          resultCode: 500
        })
      );
    });

    test('should handle API call without response time', () => {
      const apiName = 'validateService';

      logApiCall(mockContext, apiName);

      expect(client.trackDependency).not.toHaveBeenCalled();
      expect(client.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `api_call_${apiName}`
        })
      );
    });

    test('should default to success when not specified', () => {
      const apiName = 'defaultTest';

      logApiCall(mockContext, apiName);

      expect(mockContext.log.metric).toHaveBeenCalledWith(
        `api_call_${apiName}`,
        1,
        expect.objectContaining({
          success: true
        })
      );
    });

    test('should use fallback logging when metric function not available', () => {
      const contextWithoutMetric = {
        log: jest.fn()
      };

      logApiCall(contextWithoutMetric, 'test_api');

      expect(contextWithoutMetric.log).toHaveBeenCalledWith(
        expect.stringContaining('API call metric: api_call_test_api = 1'),
        expect.any(Object)
      );
    });

    test('should include additional data in API call log', () => {
      const apiName = 'testApi';
      const additionalData = {
        service_variation_ids: 'SERVICE_1,SERVICE_2',
        service_count: 2,
        barber_id: 'BARBER_1'
      };

      logApiCall(mockContext, apiName, true, 200, additionalData);

      expect(client.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining(additionalData)
        })
      );
    });
  });

  describe('Environment Configuration', () => {
    test('should handle missing Application Insights connection string', () => {
      // This test verifies the module doesn't crash when APPLICATIONINSIGHTS_CONNECTION_STRING is not set
      // The initialization happens when the module is first required, so we can't easily test this
      // But we can verify the module exports work correctly
      expect(trackEvent).toBeDefined();
      expect(trackMetric).toBeDefined();
      expect(trackException).toBeDefined();
      expect(trackDependency).toBeDefined();
      expect(logPerformance).toBeDefined();
      expect(logCacheHit).toBeDefined();
      expect(logApiCall).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete telemetry flow for API request', () => {
      const functionName = 'GetServiceAvailability';
      const startTime = Date.now() - 300;
      const apiDuration = 150;

      // Track function invocation
      trackEvent('function_invoked', {
        function_name: functionName,
        correlation_id: 'test-123'
      });

      // Track API call
      logApiCall(mockContext, 'searchAvailability', true, apiDuration, {
        service_count: 2
      });

      // Track cache operation
      logCacheHit(mockContext, 'availability', false);

      // Track performance
      logPerformance(mockContext, functionName, startTime, {
        correlation_id: 'test-123',
        service_count: 2
      });

      // Verify all telemetry calls were made
      expect(client.trackEvent).toHaveBeenCalledTimes(2); // function_invoked + api_call
      expect(client.trackDependency).toHaveBeenCalledTimes(1);
      expect(client.trackMetric).toHaveBeenCalledTimes(3); // api_call + cache + performance
    });

    test('should handle error scenario with exception tracking', () => {
      const error = new Error('Square API timeout');
      const functionName = 'GetServiceAvailability';
      const startTime = Date.now() - 6000; // Slow execution

      // Track the error
      trackException(error, {
        function: functionName,
        correlation_id: 'error-123'
      });

      // Track failed API call
      logApiCall(mockContext, 'searchAvailability', false, 5000);

      // Track performance (should trigger slow execution warning)
      logPerformance(mockContext, functionName, startTime);

      expect(client.trackException).toHaveBeenCalledWith(
        expect.objectContaining({
          exception: error
        })
      );

      expect(client.trackDependency).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );

      expect(client.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'slow_execution'
        })
      );
    });
  });
});
