const customerMemoryService = require('../../../src/services/customerMemoryService');
const { query } = require('../../../src/services/database');

global.Date = class extends Date {
  constructor(...args) {
    if (args.length) {
      super(...args);
    } else {
      super('2025-01-01T00:00:00Z');
    }
  }
};

jest.mock('../../../src/services/database', () => ({
  query: jest.fn()
}));

describe('customerMemoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists profiles with search', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'profile-1' }] });

    const results = await customerMemoryService.listProfiles('tenant-1', { search: 'nick' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('phone_number ILIKE $2'),
      expect.arrayContaining(['%nick%'])
    );
    expect(results).toEqual([{ id: 'profile-1' }]);
  });

  it('returns null when profile not found', async () => {
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValue({ rows: [] });

    const detail = await customerMemoryService.getProfileDetail('tenant-1', 'profile-1');
    expect(detail).toBeNull();
  });

  it('upserts context entry and logs change', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'context-id', context_value: 'VIP' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await customerMemoryService.upsertContextEntry({
      tenantId: 'tenant-1',
      profileId: 'profile-1',
      key: 'favorite_service',
      value: 'Color',
      user: { id: 'user-1', email: 'owner@example.com' }
    });

    expect(result).toEqual({ id: 'context-id', context_value: 'VIP' });
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO context_change_events'),
      expect.arrayContaining(['tenant-1', 'profile-1', 'favorite_service'])
    );
  });

  it('deletes context entry when exists', async () => {
    query.mockResolvedValueOnce({ rows: [{ context_value: 'Old' }] }).mockResolvedValueOnce({ rows: [] });

    const deleted = await customerMemoryService.deleteContextEntry({
      tenantId: 'tenant-1',
      profileId: 'profile-1',
      key: 'favorite_service',
      user: { id: 'user-1', email: 'owner@example.com' }
    });

    expect(deleted).toBe(true);
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO context_change_events'),
      expect.arrayContaining(['tenant-1', 'profile-1', 'favorite_service'])
    );
  });
});
