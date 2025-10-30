/**
 * customerAuth Middleware Tests
 */

jest.mock('../../../src/services/authService', () => ({
  verifyAccessToken: jest.fn()
}));

const authService = require('../../../src/services/authService');
const customerAuth = require('../../../src/middlewares/customerAuth');

describe('customerAuth middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes request through when token is valid', async () => {
    authService.verifyAccessToken.mockResolvedValue({
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      email: 'owner@example.com'
    });

    const req = {
      headers: { authorization: 'Bearer valid-token' }
    };
    const res = {};
    const next = jest.fn();

    await customerAuth(req, res, next);

    expect(authService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'owner',
      email: 'owner@example.com'
    });
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when header missing', async () => {
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnValue({ json })
    };

    await customerAuth({ headers: {} }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: 'unauthorized',
      message: 'Authorization header with Bearer token required'
    });
  });

  it('returns 401 when verification fails', async () => {
    authService.verifyAccessToken.mockRejectedValue(new Error('invalid token'));

    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnValue({ json })
    };

    await customerAuth({ headers: { authorization: 'Bearer invalid' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: 'unauthorized',
      message: 'Invalid or expired access token'
    });
  });
});
