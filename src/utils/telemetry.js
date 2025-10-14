// shared/telemetry.js
const appInsights = require('applicationinsights');

// Initialize Application Insights if connection string is provided
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  appInsights
    .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(false)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI)
    .start();
}

const client = appInsights.defaultClient;

/**
 * Track custom events with Application Insights
 */
function trackEvent(name, properties = {}, measurements = {}) {
  if (client) {
    client.trackEvent({
      name,
      properties: {
        ...properties,
        timestamp: new Date().toISOString()
      },
      measurements
    });
  }
}

/**
 * Track custom metrics with Application Insights
 */
function trackMetric(name, value, properties = {}) {
  if (client) {
    client.trackMetric({
      name,
      value,
      properties: {
        ...properties,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Track exceptions with Application Insights
 */
function trackException(error, properties = {}) {
  if (client) {
    client.trackException({
      exception: error,
      properties: {
        ...properties,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Track API dependency calls
 */
function trackDependency(name, commandName, duration, success, properties = {}) {
  if (client) {
    client.trackDependency({
      target: name,
      name: commandName,
      data: commandName,
      duration,
      resultCode: success ? 200 : 500,
      success,
      dependencyTypeName: 'HTTP',
      properties: {
        ...properties,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Enhanced monitoring that integrates with Application Insights
 */
function logPerformance(context, functionName, startTime, additionalData = {}) {
  const duration = Date.now() - startTime;
  const logData = {
    function: functionName,
    duration_ms: duration,
    timestamp: new Date().toISOString(),
    ...additionalData
  };

  // Log to Azure Functions logging (only if metric function is available)
  if (context.log.metric && typeof context.log.metric === 'function') {
    context.log.metric(`${functionName}_duration`, duration, logData);
  } else {
    // Fallback for local development
    context.log(`Performance metric: ${functionName}_duration = ${duration}ms`, logData);
  }

  // Track with Application Insights
  trackMetric(`${functionName}_duration_ms`, duration, logData);

  if (duration > 5000) {
    context.log.warn(`Slow execution detected for ${functionName}: ${duration}ms`, logData);
    trackEvent('slow_execution', logData);
  }
}

function logCacheHit(context, cacheType, hit = true) {
  const logData = {
    cache_type: cacheType,
    cache_hit: hit,
    timestamp: new Date().toISOString()
  };

  if (context.log.metric && typeof context.log.metric === 'function') {
    context.log.metric(`cache_${cacheType}_${hit ? 'hit' : 'miss'}`, 1, logData);
  } else {
    context.log(`Cache metric: cache_${cacheType}_${hit ? 'hit' : 'miss'} = 1`, logData);
  }
  trackMetric(`cache_${cacheType}_${hit ? 'hit' : 'miss'}`, 1, logData);
}

function logApiCall(context, apiName, success = true, responseTime = null, additionalData = {}) {
  const logData = {
    api: apiName,
    success,
    timestamp: new Date().toISOString(),
    ...additionalData
  };

  if (responseTime) {
    logData.response_time_ms = responseTime;
    trackDependency('square_api', apiName, responseTime, success, logData);
  }

  if (context.log.metric && typeof context.log.metric === 'function') {
    context.log.metric(`api_call_${apiName}`, 1, logData);
  } else {
    context.log(`API call metric: api_call_${apiName} = 1`, logData);
  }

  // Track metrics for monitoring
  trackMetric(`api_call_${apiName}`, 1, logData);
  trackEvent(`api_call_${apiName}`, logData);
}

module.exports = {
  trackEvent,
  trackMetric,
  trackException,
  trackDependency,
  logPerformance,
  logCacheHit,
  logApiCall,
  client
};
