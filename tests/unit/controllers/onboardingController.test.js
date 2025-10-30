/**
 * onboardingController Unit Tests
 */

jest.mock('../../../src/services/onboardingService', () => ({
  saveVoicePreferences: jest.fn()
}));

jest.mock('../../../src/services/tenantService', () => ({
  getTenantById: jest.fn()
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn()
  }
}));

const onboardingService = require('../../../src/services/onboardingService');
const tenantService = require('../../../src/services/tenantService');
const onboardingController = require('../../../src/controllers/onboardingController');

describe('onboardingController.submitPreferences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildRes() {
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnValue({ json }),
      json
    };
    return { res, json };
  }

  it('returns 401 when tenant context missing', async () => {
    const { res, json } = buildRes();

    await onboardingController.submitPreferences({ user: null }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: 'unauthorized',
      message: 'Authentication required'
    });
  });

  it('returns 400 when voiceKey missing', async () => {
    const { res, json } = buildRes();

    await onboardingController.submitPreferences({ user: { tenantId: 'tenant-1' }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      success: false,
      error: 'missing_voice_key',
      message: 'voiceKey is required to save preferences'
    });
  });

  it('persists preferences and returns tenant context', async () => {
    const { res, json } = buildRes();

    onboardingService.saveVoicePreferences.mockResolvedValue({ id: 'voice-1' });
    tenantService.getTenantById.mockResolvedValue({ id: 'tenant-1', business_name: 'Biz' });

    await onboardingController.submitPreferences(
      {
        user: { tenantId: 'tenant-1' },
        body: {
          voiceKey: 'voice-abc',
          voiceName: 'Voice ABC',
          voiceProvider: 'retell'
        }
      },
      res
    );

    expect(onboardingService.saveVoicePreferences).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        voiceKey: 'voice-abc',
        name: 'Voice ABC',
        provider: 'retell'
      })
    );
    expect(json).toHaveBeenCalledWith({
      success: true,
      voiceProfile: { id: 'voice-1' },
      tenant: { id: 'tenant-1', business_name: 'Biz' }
    });
  });
});
