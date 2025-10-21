/**
 * Tests for email transport fallback behaviour
 */

describe('emailTransport', () => {
  let sendMailMock;
  let emailTransport;
  let config;
  let mockInvoke;
  let mockIsConfigured;

  beforeEach(() => {
    jest.resetModules();

    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'smtp-123' });
    mockInvoke = jest.fn();
    mockIsConfigured = jest.fn();

    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn(() => ({
        sendMail: sendMailMock,
        verify: jest.fn().mockResolvedValue(true)
      }))
    }));

    jest.doMock('../../../src/utils/functionInvoker', () => ({
      invokeEmailFunction: (...args) => mockInvoke(...args),
      isEmailFunctionConfigured: () => mockIsConfigured(),
      FunctionError: class extends Error {}
    }));

    emailTransport = require('../../../src/services/emailTransport');

    ({ config } = require('../../../src/config'));

    config.email.host = 'smtp.example.com';
    config.email.user = 'user';
    config.email.password = 'pass';
    config.email.port = 587;
    config.email.secure = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('uses Azure Function when configured', async () => {
    mockIsConfigured.mockReturnValue(true);
    mockInvoke.mockResolvedValue({
      success: true,
      status: 200,
      data: { messageId: 'fn-1' },
      headers: {}
    });

    const result = await emailTransport.sendEmail(
      { to: 'user@example.com', subject: 'Hello', html: '<p>Hello</p>' },
      { correlationId: 'corr-1', context: 'test' }
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      via: 'function',
      messageId: 'fn-1'
    });
  });

  test('falls back to SMTP when function invocation fails', async () => {
    mockIsConfigured.mockReturnValue(true);
    const functionError = new Error('Function failed');
    functionError.status = 500;
    mockInvoke.mockRejectedValue(functionError);

    const result = await emailTransport.sendEmail(
      { to: 'user@example.com', subject: 'Hello', html: '<p>Hello</p>' },
      { correlationId: 'corr-2', context: 'test' }
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      via: 'smtp',
      messageId: 'smtp-123'
    });
  });
});
