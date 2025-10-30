const analyticsService = require('../../../src/services/analyticsService');
const analyticsController = require('../../../src/controllers/analyticsController');

jest.mock('../../../src/services/analyticsService');

function createRes() {
  const json = jest.fn();
  return {
    status: jest.fn().mockReturnValue({ json }),
    json
  };
}

describe('analyticsController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when tenant not authenticated', async () => {
    const res = createRes();
    await analyticsController.getTenantAnalytics({ user: null }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.status().json).toHaveBeenCalledWith(expect.objectContaining({ error: 'unauthorized' }));
  });

  it('returns analytics payload', async () => {
    const res = createRes();
    analyticsService.getTenantAnalytics.mockResolvedValue({ peakCallTimes: {} });

    await analyticsController.getTenantAnalytics({ user: { tenantId: 'tenant-1' } }, res);

    expect(analyticsService.getTenantAnalytics).toHaveBeenCalledWith('tenant-1');
    expect(res.json).toHaveBeenCalledWith({ success: true, analytics: { peakCallTimes: {} } });
  });
});
