const axios = require('axios');
const { config } = require('../config');
const { logger } = require('./logger');
const { FunctionError } = require('./functionError');

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 300;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function createNotConfiguredError(name) {
  const error = new Error(`${name} function not configured`);
  error.code = 'FUNCTION_NOT_CONFIGURED';
  error.isFunctionNotConfigured = true;
  return error;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildUrlWithKey(url, key) {
  if (!url || !key) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('code')) {
      parsed.searchParams.append('code', key);
    }
    return parsed.toString();
  } catch (error) {
    logger.warn('Unable to append Azure Function key to URL', {
      error: error.message
    });
    return url;
  }
}

function shouldRetry(error) {
  if (!error) {
    return false;
  }

  if (!error.response) {
    // Network/timeout errors
    return true;
  }

  return RETRYABLE_STATUSES.has(error.response.status);
}

function getRetryDelayMs(baseDelay, attempt) {
  const backoff = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * baseDelay);
  return backoff + jitter;
}

async function wait(delayMs) {
  if (!delayMs) return;
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

async function callFunction(name, functionConfig, payload, correlationId, options = {}) {
  if (!functionConfig || !functionConfig.url || !functionConfig.key) {
    throw createNotConfiguredError(name);
  }

  const timeoutMs =
    toNumber(options.timeoutMs, null) || toNumber(functionConfig.timeout, null) || DEFAULT_TIMEOUT_MS;

  const totalRetries =
    toNumber(options.retries, null) || toNumber(functionConfig.retries, null) || DEFAULT_RETRIES;
  const retryDelay =
    toNumber(options.retryDelayMs, null) ||
    toNumber(functionConfig.retryDelayMs, null) ||
    DEFAULT_RETRY_DELAY_MS;

  const url = buildUrlWithKey(functionConfig.url, functionConfig.key);

  const headers = {
    'Content-Type': 'application/json',
    'x-functions-key': functionConfig.key
  };

  if (correlationId) {
    headers['x-correlation-id'] = correlationId;
  }

  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders);
  }

  const requestPayload = {
    ...payload
  };

  let attempt = 0;
  let lastError = null;

  while (attempt <= totalRetries) {
    attempt += 1;

    try {
      const response = await axios.post(url, requestPayload, {
        timeout: timeoutMs,
        headers
      });

      return {
        success: true,
        status: response.status,
        data: response.data,
        headers: response.headers,
        functionName: name,
        correlationId
      };
    } catch (error) {
      lastError = error;

      const status = error.response?.status;
      const responseData = error.response?.data;

      logger.warn('Azure Function invocation failed', {
        function: name,
        status,
        correlationId,
        attempt,
        retriesRemaining: Math.max(totalRetries - attempt + 1, 0),
        response: responseData,
        message: error.message
      });

      if (attempt > totalRetries || !shouldRetry(error)) {
        break;
      }

      const delayMs = getRetryDelayMs(retryDelay, attempt);
      await wait(delayMs);
    }
  }

  const status = lastError?.response?.status;
  const responseData = lastError?.response?.data;

  throw new FunctionError(
    (responseData && responseData.error) || lastError?.message || 'Azure Function invocation failed',
    {
      functionName: name,
      status,
      response: responseData,
      originalError: lastError,
      correlationId
    }
  );
}

function invokeEmailFunction(payload, correlationId, options = {}) {
  return callFunction('email-sender', config.azureFunctions?.email, payload, correlationId, options);
}

function invokeSmsFunction(payload, correlationId, options = {}) {
  return callFunction('sms-sender', config.azureFunctions?.sms, payload, correlationId, options);
}

function isEmailFunctionConfigured() {
  const cfg = config.azureFunctions?.email;
  return Boolean(cfg && cfg.url && cfg.key);
}

function isSmsFunctionConfigured() {
  const cfg = config.azureFunctions?.sms;
  return Boolean(cfg && cfg.url && cfg.key);
}

module.exports = {
  invokeEmailFunction,
  invokeSmsFunction,
  isEmailFunctionConfigured,
  isSmsFunctionConfigured,
  FunctionError
};
