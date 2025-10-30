/**
 * tenantService Unit Tests
 */

jest.mock('../../../src/services/database', () => ({
  withTransaction: jest.fn(),
  encryptSecret: jest.fn()
}));

const database = require('../../../src/services/database');
const tenantService = require('../../../src/services/tenantService');

describe('tenantService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTenantWithOwner', () => {
    it('creates tenant, owner user, and subscription', async () => {
      const client = {
        query: jest
          .fn()
          // slug availability
          .mockResolvedValueOnce({ rows: [] })
          // insert tenant
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'tenant-1',
                slug: 'biz',
                business_name: 'Biz',
                timezone: 'UTC'
              }
            ]
          })
          // insert tenant user
          .mockResolvedValueOnce({
            rows: [
              {
                id: 'user-1',
                email: 'owner@example.com',
                role: 'owner'
              }
            ]
          })
          // select plan
          .mockResolvedValueOnce({ rows: [{ id: 'plan-basic' }] })
          // insert subscription
          .mockResolvedValueOnce({ rows: [] })
      };

      database.withTransaction.mockImplementation(async handler => handler(client));

      const result = await tenantService.createTenantWithOwner({
        businessName: 'Biz',
        email: 'Owner@Example.com',
        passwordHash: 'hashed-pass',
        timezone: 'UTC',
        industry: 'salon',
        userDisplayName: 'Owner'
      });

      expect(client.query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO tenants'),
        expect.arrayContaining(['biz', 'Biz', 'salon'])
      );

      // tenant_users insert uses lower-cased email
      expect(client.query.mock.calls[2][1][1]).toBe('owner@example.com');
      expect(result).toEqual({
        tenant: expect.objectContaining({ id: 'tenant-1' }),
        user: expect.objectContaining({ id: 'user-1' })
      });
    });
  });

  describe('storeSquareCredentials', () => {
    it('encrypts secrets and upserts credentials', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      database.encryptSecret.mockResolvedValueOnce('enc-access').mockResolvedValueOnce('enc-refresh');

      await tenantService.storeSquareCredentials(
        {
          tenantId: 'tenant-1',
          internalAgentId: 'agent-1',
          squareAccessToken: 'access',
          squareRefreshToken: 'refresh',
          merchantId: 'merchant-1',
          defaultLocationId: 'location-1',
          environment: 'production',
          supportsSellerLevelWrites: true,
          squareScopes: ['scope'],
          expiresAt: new Date('2025-01-01T00:00:00.000Z').toISOString()
        },
        client
      );

      expect(database.encryptSecret).toHaveBeenNthCalledWith(1, 'access', client);
      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO square_credentials'),
        expect.arrayContaining(['enc-access', 'enc-refresh'])
      );
    });
  });

  describe('storeAgentBearerToken', () => {
    it('encrypts bearer token before persisting', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      database.encryptSecret.mockResolvedValue('enc-bearer');

      await tenantService.storeAgentBearerToken('agent-1', 'bearer', client);

      expect(database.encryptSecret).toHaveBeenCalledWith('bearer', client);
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE retell_agents'), [
        'agent-1',
        'enc-bearer'
      ]);
    });
  });
});
