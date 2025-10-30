const analyticsService = require('../../../src/services/analyticsService');
const { query } = require('../../../src/services/database');

jest.mock('../../../src/services/database', () => ({
  query: jest.fn()
}));

describe('analyticsService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computePeakCallTimes', () => {
    it('returns counts for each hour', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { hour: 9, call_count: '3' },
          { hour: 15, call_count: '5' }
        ]
      });

      const result = await analyticsService.__test__.computePeakCallTimes('tenant-1');
      expect(result.data).toHaveLength(24);
      expect(result.data[9]).toEqual({ hour: 9, callCount: 3 });
      expect(result.data[15]).toEqual({ hour: 15, callCount: 5 });
    });
  });

  describe('computeConversionTrend', () => {
    it('calculates conversion rate per day', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { day: new Date('2025-01-01'), total_calls: '4', bookings: '1' },
          { day: new Date('2025-01-02'), total_calls: '2', bookings: '2' }
        ]
      });

      const result = await analyticsService.__test__.computeConversionTrend('tenant-1');
      expect(result.data).toEqual([
        {
          date: new Date('2025-01-01').toISOString(),
          totalCalls: 4,
          bookings: 1,
          conversionRate: 0.25
        },
        {
          date: new Date('2025-01-02').toISOString(),
          totalCalls: 2,
          bookings: 2,
          conversionRate: 1
        }
      ]);
    });
  });

  describe('computeLanguageBreakdown', () => {
    it('returns percentages per language', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { language: 'en', call_count: '6' },
          { language: 'es', call_count: '4' }
        ]
      });

      const result = await analyticsService.__test__.computeLanguageBreakdown('tenant-1');
      expect(result.totalCalls).toBe(10);
      expect(result.data).toEqual([
        { language: 'en', callCount: 6, percentage: 60 },
        { language: 'es', callCount: 4, percentage: 40 }
      ]);
    });
  });

  describe('computeOutcomeDistribution', () => {
    it('groups outcomes with percentages', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { outcome: 'successful', call_count: '7' },
          { outcome: 'failed', call_count: '3' }
        ]
      });

      const result = await analyticsService.__test__.computeOutcomeDistribution('tenant-1');
      expect(result.totalCalls).toBe(10);
      expect(result.data).toEqual([
        { outcome: 'successful', callCount: 7, percentage: 70 },
        { outcome: 'failed', callCount: 3, percentage: 30 }
      ]);
    });
  });

  describe('cacheMetric', () => {
    it('upserts into cache table', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await analyticsService.__test__.cacheMetric(
        'tenant-1',
        'peak_call_times',
        { data: [] },
        null,
        null,
        30
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO call_analytics_cache'),
        expect.arrayContaining(['tenant-1', 'peak_call_times', { data: [] }])
      );
    });
  });

  describe('getTenantAnalytics', () => {
    it('computes metrics when cache empty', async () => {
      query
        .mockResolvedValueOnce({ rows: [] }) // peak cache
        .mockResolvedValueOnce({ rows: [{ hour: 0, call_count: '1' }] }) // peak data
        .mockResolvedValueOnce({ rows: [] }) // peak insert
        .mockResolvedValueOnce({ rows: [] }) // conversion cache
        .mockResolvedValueOnce({ rows: [{ day: new Date('2025-01-01'), total_calls: '1', bookings: '1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // language cache
        .mockResolvedValueOnce({ rows: [{ language: 'en', call_count: '1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // outcome cache
        .mockResolvedValueOnce({ rows: [{ outcome: 'successful', call_count: '1' }] })
        .mockResolvedValueOnce({ rows: [] });

      const analytics = await analyticsService.getTenantAnalytics('tenant-1');
      expect(analytics).toHaveProperty('peakCallTimes');
      expect(analytics).toHaveProperty('conversionTrend');
      expect(analytics).toHaveProperty('languageBreakdown');
      expect(analytics).toHaveProperty('outcomeDistribution');
    });
  });
});
