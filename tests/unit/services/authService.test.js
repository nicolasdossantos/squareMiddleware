/**
 * authService Unit Tests
 */

const crypto = require('crypto');

jest.mock('../../../src/services/database', () => ({
  query: jest.fn()
}));

jest.mock('../../../src/services/tenantService', () => ({
  createTenantWithOwner: jest.fn(),
  getTenantById: jest.fn()
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn()
}));

jest.mock('../../../src/config', () => ({
  config: {
    auth: {
      accessTokenSecret: 'access-secret',
      refreshTokenSecret: 'refresh-secret',
      accessTokenTtl: '15m',
      refreshTokenTtl: '30d',
      passwordSaltRounds: 12
    }
  }
}));

const db = require('../../../src/services/database');
const tenantService = require('../../../src/services/tenantService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authService = require('../../../src/services/authService');

describe('authService', () => {
  let randomUuidSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    randomUuidSpy = jest.spyOn(crypto, 'randomUUID').mockReturnValue('session-123');
  });

  afterEach(() => {
    randomUuidSpy.mockRestore();
  });

  describe('registerTenant', () => {
    it('creates tenant and returns tokens for new email', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // loadUserByEmail
        .mockResolvedValueOnce({ rows: [] }); // insert session

      bcrypt.hash
        .mockResolvedValueOnce('hashed-password') // password hash
        .mockResolvedValueOnce('hashed-refresh'); // refresh token hash

      tenantService.createTenantWithOwner.mockResolvedValue({
        tenant: { id: 'tenant-1', slug: 'tenant-slug', business_name: 'Biz' },
        user: { id: 'user-1', role: 'owner', email: 'Owner@Example.com' }
      });

      jwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await authService.registerTenant({
        businessName: 'Biz',
        email: 'Owner@Example.com',
        password: 'secret',
        timezone: 'UTC',
        industry: 'spa',
        name: 'Owner Name',
        requestMeta: { userAgent: 'jest', ipAddress: '127.0.0.1' }
      });

      expect(tenantService.createTenantWithOwner).toHaveBeenCalledWith({
        businessName: 'Biz',
        email: 'owner@example.com',
        passwordHash: 'hashed-password',
        timezone: 'UTC',
        industry: 'spa',
        userDisplayName: 'Owner Name'
      });
      expect(db.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO tenant_user_sessions'),
        expect.arrayContaining(['session-123'])
      );
      expect(result.tokens).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: expect.any(Date),
        sessionId: 'session-123'
      });
    });

    it('throws when email already exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

      await expect(
        authService.registerTenant({
          businessName: 'Biz',
          email: 'existing@example.com',
          password: 'secret'
        })
      ).rejects.toThrow('An account with this email already exists');
    });
  });

  describe('authenticate', () => {
    it('returns tokens for valid credentials', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-1',
              tenant_id: 'tenant-1',
              business_name: 'Biz',
              tenant_slug: 'tenant-slug',
              tenant_status: 'active',
              tenant_timezone: 'UTC',
              role: 'owner',
              email: 'owner@example.com',
              password_hash: 'hashed-password',
              is_active: true
            }
          ]
        }) // loadUserByEmail
        .mockResolvedValueOnce({ rows: [] }) // update last_login_at
        .mockResolvedValueOnce({ rows: [] }); // insert new session

      bcrypt.compare.mockResolvedValueOnce(true); // password check
      bcrypt.hash.mockResolvedValueOnce('hashed-refresh');
      jwt.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');

      const result = await authService.authenticate({
        email: 'Owner@example.com',
        password: 'secret',
        requestMeta: {}
      });

      expect(result.tenant).toMatchObject({ id: 'tenant-1', slug: 'tenant-slug' });
      expect(result.tokens.accessToken).toBe('access-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed-password');
    });

    it('throws when password incorrect', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'user-1',
            tenant_id: 'tenant-1',
            business_name: 'Biz',
            tenant_slug: 'tenant-slug',
            tenant_status: 'active',
            tenant_timezone: 'UTC',
            role: 'owner',
            email: 'owner@example.com',
            password_hash: 'hashed-password',
            is_active: true
          }
        ]
      });
      bcrypt.compare.mockResolvedValueOnce(false);

      await expect(
        authService.authenticate({ email: 'owner@example.com', password: 'wrong' })
      ).rejects.toThrow('Invalid email or password');
    });
  });

  describe('refreshSession', () => {
    it('rotates refresh token and revokes old session', async () => {
      jwt.verify.mockReturnValueOnce({
        sid: 'session-old',
        sub: 'user-1',
        tenantId: 'tenant-1'
      });

      db.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'session-old',
              tenant_user_id: 'user-1',
              tenant_id: 'tenant-1',
              refresh_token_hash: 'hashed-old',
              expires_at: new Date(Date.now() + 60000),
              revoked_at: null
            }
          ]
        }) // fetch session
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'user-1',
              tenant_id: 'tenant-1',
              business_name: 'Biz',
              tenant_slug: 'tenant-slug',
              tenant_status: 'active',
              tenant_timezone: 'UTC',
              role: 'owner',
              email: 'owner@example.com',
              is_active: true
            }
          ]
        }) // loadUserById
        .mockResolvedValueOnce({ rows: [] }) // insert new session
        .mockResolvedValueOnce({ rows: [] }); // revoke old session

      bcrypt.compare.mockResolvedValueOnce(true); // refresh token comparison
      bcrypt.hash.mockResolvedValueOnce('hashed-new-refresh');
      jwt.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');

      const result = await authService.refreshSession('old-refresh-token', {
        userAgent: 'jest'
      });

      expect(result.tokens.refreshToken).toBe('new-refresh-token');
      expect(db.query).toHaveBeenNthCalledWith(4, expect.stringContaining('UPDATE tenant_user_sessions'), [
        'session-old'
      ]);
    });
  });
});
