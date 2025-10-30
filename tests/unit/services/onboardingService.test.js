/**
 * onboardingService Unit Tests
 */

const crypto = require('crypto');

jest.mock('../../../src/services/database', () => ({
  withTransaction: jest.fn(),
  encryptSecret: jest.fn()
}));

jest.mock('../../../src/services/tenantService', () => ({
  storeAgentBearerToken: jest.fn(),
  storeSquareCredentials: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

const database = require('../../../src/services/database');
const tenantService = require('../../../src/services/tenantService');
const onboardingService = require('../../../src/services/onboardingService');

describe('onboardingService', () => {
  let randomBytesSpy;
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    randomBytesSpy = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('aa'.repeat(32), 'hex'));

    client = {
      query: jest
        .fn()
        // upsert voice profile insert
        .mockResolvedValueOnce({ rows: [{ id: 'voice-1' }] })
        // upsert voice profile update
        .mockResolvedValueOnce({ rows: [] })
        // retell_agents insert
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'agent-internal',
              tenant_id: 'tenant-1',
              retell_agent_id: 'retell-agent-1',
              status: 'pending_qa'
            }
          ]
        })
        // tenants update
        .mockResolvedValueOnce({ rows: [] })
        // pending_qa insert
        .mockResolvedValueOnce({
          rows: [{ id: 'qa-1', qa_status: 'pending' }]
        })
    };

    database.withTransaction.mockImplementation(async handler => handler(client));
  });

  afterEach(() => {
    randomBytesSpy.mockRestore();
  });

  describe('confirmSquareAuthorization', () => {
    it('persists onboarding artifacts and returns queue payload', async () => {
      tenantService.storeAgentBearerToken.mockResolvedValue();
      tenantService.storeSquareCredentials.mockResolvedValue();

      const result = await onboardingService.confirmSquareAuthorization({
        tenantId: 'tenant-1',
        retellAgentId: 'retell-agent-1',
        tokens: {
          accessToken: 'square-access',
          refreshToken: 'square-refresh',
          scope: ['APPOINTMENTS_READ'],
          expiresAt: '2025-01-01T00:00:00Z',
          merchantId: 'merchant-1',
          environment: 'production'
        },
        metadata: {
          merchantId: 'merchant-1',
          defaultLocationId: 'location-1',
          displayName: 'Biz Name',
          supportsSellerLevelWrites: true,
          timezone: 'America/New_York'
        },
        voicePreferences: {
          voiceKey: 'voice-abc',
          name: 'Voice ABC',
          provider: 'retell',
          language: 'en'
        },
        submittedBy: 'user-1',
        configuration: { note: 'test' }
      });

      expect(client.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO retell_agents'),
        expect.arrayContaining(['tenant-1', expect.any(String), 'retell-agent-1'])
      );

      expect(tenantService.storeAgentBearerToken).toHaveBeenCalledWith(
        'agent-internal',
        'aa'.repeat(32),
        client
      );

      expect(tenantService.storeSquareCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          internalAgentId: 'agent-internal',
          squareAccessToken: 'square-access',
          squareRefreshToken: 'square-refresh',
          merchantId: 'merchant-1',
          defaultLocationId: 'location-1',
          environment: 'production'
        }),
        client
      );

      expect(result).toEqual({
        agent: expect.objectContaining({ id: 'agent-internal' }),
        voiceProfile: expect.objectContaining({ id: 'voice-1' }),
        pendingQa: expect.objectContaining({ id: 'qa-1' }),
        bearerToken: 'aa'.repeat(32)
      });
    });
  });

  describe('saveVoicePreferences', () => {
    it('stores preferences and updates tenant profile', async () => {
      client.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 'voice-1', is_default: true }] }) // insert
        .mockResolvedValueOnce({ rows: [] }) // update defaults
        .mockResolvedValueOnce({ rows: [] }); // tenant update

      database.withTransaction.mockImplementation(async handler => handler(client));

      const profile = await onboardingService.saveVoicePreferences('tenant-1', {
        voiceKey: 'voice-xyz',
        name: 'Voice XYZ',
        provider: 'retell',
        language: 'en',
        temperature: 1.1,
        speakingRate: 1.05,
        ambience: 'office',
        businessName: 'Biz',
        phoneNumber: '+15551234567',
        timezone: 'America/Los_Angeles',
        industry: 'salon'
      });

      expect(client.query).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('UPDATE tenants'),
        expect.arrayContaining(['Biz', '+15551234567', 'America/Los_Angeles', 'salon'])
      );

      expect(profile).toEqual({ id: 'voice-1', is_default: true });
    });
  });
});
