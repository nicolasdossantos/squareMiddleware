/**
 * Tests for SMS transport fallback behaviour
 */

describe('smsTransport', () => {
  let smsTransport;
  let config;
  let createMessageMock;
  let mockInvoke;
  let mockIsConfigured;

  beforeEach(() => {
    jest.resetModules();

    createMessageMock = jest.fn().mockResolvedValue({
      sid: 'twilio-123',
      status: 'queued'
    });
    mockInvoke = jest.fn();
    mockIsConfigured = jest.fn();

    jest.doMock('twilio', () =>
      jest.fn(() => ({
        messages: {
          create: createMessageMock
        }
      }))
    );

    jest.doMock('../../../src/utils/functionInvoker', () => ({
      invokeSmsFunction: (...args) => mockInvoke(...args),
      isSmsFunctionConfigured: () => mockIsConfigured(),
      FunctionError: class extends Error {}
    }));

    smsTransport = require('../../../src/services/smsTransport');

    ({ config } = require('../../../src/config'));

    config.twilio.accountSid = 'sid';
    config.twilio.authToken = 'token';
    config.twilio.smsFrom = '+11111111111';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('uses Azure Function when configured', async () => {
    mockIsConfigured.mockReturnValue(true);
    mockInvoke.mockResolvedValue({
      success: true,
      status: 200,
      data: { messageSid: 'function-123', status: 'sent' }
    });

    const result = await smsTransport.sendSms({
      to: '+12223334444',
      body: 'Hi',
      tenant: 'test'
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(createMessageMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      via: 'function',
      messageSid: 'function-123',
      status: 'sent'
    });
  });

  test('falls back to Twilio when function invocation fails', async () => {
    mockIsConfigured.mockReturnValue(true);
    const functionError = new Error('Function failed');
    functionError.status = 500;
    mockInvoke.mockRejectedValue(functionError);

    const result = await smsTransport.sendSms({
      to: '+12223334444',
      body: 'Hi',
      tenant: 'test'
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(createMessageMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      via: 'twilio',
      messageSid: 'twilio-123',
      status: 'queued'
    });
  });
});
