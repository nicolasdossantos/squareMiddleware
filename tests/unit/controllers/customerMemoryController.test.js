const customerMemoryController = require('../../../src/controllers/customerMemoryController');
const customerMemoryService = require('../../../src/services/customerMemoryService');

jest.mock('../../../src/services/customerMemoryService');

describe('customerMemoryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRes() {
    const json = jest.fn();
    return {
      status: jest.fn().mockReturnValue({ json }),
      json
    };
  }

  it('requires auth for list', async () => {
    const res = createRes();
    await customerMemoryController.listProfiles({ user: null }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns profiles', async () => {
    const res = createRes();
    customerMemoryService.listProfiles.mockResolvedValue([{ id: 'profile-1' }]);

    await customerMemoryController.listProfiles({ user: { tenantId: 'tenant-1' }, query: {} }, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, profiles: [{ id: 'profile-1' }] });
  });

  it('upserts context entry', async () => {
    const res = createRes();
    customerMemoryService.upsertContextEntry.mockResolvedValue({ id: 'context-id' });

    await customerMemoryController.upsertContext(
      {
        user: { tenantId: 'tenant-1' },
        params: { profileId: 'profile-1' },
        body: { key: 'favorite_staff', value: 'Alex' }
      },
      res
    );

    expect(customerMemoryService.upsertContextEntry).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, context: { id: 'context-id' } });
  });
});
