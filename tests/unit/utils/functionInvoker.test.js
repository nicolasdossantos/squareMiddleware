/**
 * Tests for Azure Function invoker utility
 */

jest.mock('axios', () => ({
  post: jest.fn()
}));

const axios = require('axios');
const { config } = require('../../../src/config');
const { invokeEmailFunction, FunctionError } = require('../../../src/utils/functionInvoker');

describe('functionInvoker', () => {
  const originalEmailConfig = { ...config.azureFunctions.email };

  beforeEach(() => {
    jest.clearAllMocks();
    config.azureFunctions.email = {
      url: 'https://example.com/email',
      key: 'test-key',
      timeout: 1000
    };
  });

  afterAll(() => {
    config.azureFunctions.email = originalEmailConfig;
  });

  test('should send payload with correlation ID and return structured response', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: { messageId: 'abc-123', ok: true },
      headers: { 'x-request-id': 'req-1' }
    });

    const payload = { to: 'user@example.com', subject: 'Hi' };
    const result = await invokeEmailFunction(payload, 'corr-123');

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/email?code=test-key'),
      payload,
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-functions-key': 'test-key',
          'x-correlation-id': 'corr-123'
        }),
        timeout: 1000
      })
    );

    expect(result).toEqual({
      success: true,
      status: 200,
      data: { messageId: 'abc-123', ok: true },
      headers: { 'x-request-id': 'req-1' },
      functionName: 'email-sender',
      correlationId: 'corr-123'
    });
  });

  test('should retry on retryable error and succeed', async () => {
    const error = new Error('Server error');
    error.response = {
      status: 500,
      data: { error: 'Server error' }
    };

    axios.post.mockRejectedValueOnce(error).mockResolvedValueOnce({
      status: 200,
      data: { messageId: 'retry-1' },
      headers: {}
    });

    const result = await invokeEmailFunction({ to: 'user@example.com', subject: 'Retry' }, 'corr-retry', {
      retries: 1,
      retryDelayMs: 0
    });

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ messageId: 'retry-1' });
  });

  test('should throw FunctionError after retries exhausted', async () => {
    const error = new Error('Service unavailable');
    error.response = {
      status: 503,
      data: { error: 'unavailable' }
    };

    axios.post.mockRejectedValue(error);

    await expect(
      invokeEmailFunction({ to: 'user@example.com', subject: 'Fail' }, 'corr-fail', {
        retries: 1,
        retryDelayMs: 0
      })
    ).rejects.toBeInstanceOf(FunctionError);

    expect(axios.post).toHaveBeenCalledTimes(2);
  });

  test('should throw configuration error when function missing', async () => {
    config.azureFunctions.email = null;

    await expect(
      invokeEmailFunction({ to: 'user@example.com', subject: 'Missing config' }, 'corr-config')
    ).rejects.toMatchObject({
      code: 'FUNCTION_NOT_CONFIGURED',
      isFunctionNotConfigured: true
    });
  });
});
