// tests/GetServiceAvailability.helpers.test.js

// Mock environment variables for testing
process.env.SQUARE_ACCESS_TOKEN = 'test_token';
process.env.SQUARE_LOCATION_ID = 'test_location';
process.env.TZ = 'America/New_York';

// Mock the square client and utilities
jest.mock('../../src/utils/squareUtils', () => ({
  square: {
    bookingsApi: {
      searchAvailability: jest.fn()
    }
  },
  createSquareClient: jest.fn(() => ({
    bookingsApi: {
      searchAvailability: jest.fn()
    }
  })),
  LOCATION_ID: 'test_location',
  logApiCall: jest.fn(),
  trackException: jest.fn(),
  fmtLocal: jest.fn(iso => `Formatted: ${iso}`)
}));

const { loadAvailability } = require('../../src/utils/helpers/availabilityHelpers');
const {
  square,
  createSquareClient,
  logApiCall,
  trackException,
  fmtLocal
} = require('../../src/utils/squareUtils');

describe('GetServiceAvailability helpers', () => {
  let mockContext;
  let mockTenant;
  let mockSquareClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock square client that will be returned by createSquareClient
    // Square SDK v42+ response structure: { result: { availabilities: [...] } }
    mockSquareClient = {
      bookingsApi: {
        searchAvailability: jest.fn().mockResolvedValue({
          result: {
            availabilities: [
              {
                startAt: '2025-01-20T10:00:00Z',
                appointmentSegments: [{ serviceVariationId: 'SERVICE_1', durationMinutes: 20 }]
              },
              {
                startAt: '2025-01-20T11:00:00Z',
                appointmentSegments: [{ serviceVariationId: 'SERVICE_1', durationMinutes: 20 }]
              }
            ]
          }
        })
      }
    };

    // Mock createSquareClient to return our mock client
    createSquareClient.mockReturnValue(mockSquareClient);

    mockContext = {
      log: jest.fn()
    };

    mockTenant = {
      id: 'test-tenant',
      accessToken: 'test_token',
      locationId: 'test_location',
      mode: 'sandbox',
      timezone: 'America/New_York'
    };
  });

  describe('loadAvailability', () => {
    const startIso = '2025-01-20T08:00:00Z';
    const endIso = '2025-01-20T18:00:00Z';

    test('should load availability for single service', async () => {
      // Mock successful Square API response (Square SDK v42+ format)
      mockSquareClient.bookingsApi.searchAvailability.mockResolvedValue({
        result: {
          availabilities: [
            {
              startAt: '2025-01-20T10:00:00Z',
              appointmentSegments: [{ serviceVariationId: 'SERVICE_1', durationMinutes: 20 }]
            },
            {
              startAt: '2025-01-20T11:00:00Z',
              appointmentSegments: [{ serviceVariationId: 'SERVICE_1', durationMinutes: 20 }]
            }
          ]
        }
      });

      const result = await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);

      expect(mockSquareClient.bookingsApi.searchAvailability).toHaveBeenCalledWith({
        query: {
          filter: {
            startAtRange: {
              startAt: startIso,
              endAt: endIso
            },
            locationId: 'test_location',
            segmentFilters: [{ serviceVariationId: 'SERVICE_1' }]
          }
        }
      });

      expect(result).toEqual({
        id: 'SERVICE_1',
        serviceVariationIds: ['SERVICE_1'],
        staffMemberId: null,
        slots: [
          {
            startAt: '2025-01-20T10:00:00Z',
            readable_time: 'Formatted: 2025-01-20T10:00:00Z',
            appointmentSegments: [{ serviceVariationId: 'SERVICE_1', durationMinutes: 20 }]
          },
          {
            startAt: '2025-01-20T11:00:00Z',
            readable_time: 'Formatted: 2025-01-20T11:00:00Z',
            appointmentSegments: [{ serviceVariationId: 'SERVICE_1', durationMinutes: 20 }]
          }
        ]
      });

      expect(logApiCall).toHaveBeenCalledWith(
        mockContext,
        'search_availability',
        true,
        expect.any(Number),
        expect.objectContaining({
          service_variation_ids: 'SERVICE_1',
          service_count: 1,
          staff_member_id: 'all',
          availability_count: 2
        })
      );
    });

    test('should load availability for multiple services', async () => {
      const serviceIds = ['SERVICE_1', 'SERVICE_2'];

      mockSquareClient.bookingsApi.searchAvailability.mockResolvedValue({
        result: {
          availabilities: [
            {
              startAt: '2025-01-20T10:00:00Z',
              appointmentSegments: [
                { serviceVariationId: 'SERVICE_1', durationMinutes: 20 },
                { serviceVariationId: 'SERVICE_2', durationMinutes: 15 }
              ]
            }
          ]
        }
      });

      const result = await loadAvailability(mockTenant, serviceIds, null, startIso, endIso, mockContext);

      expect(mockSquareClient.bookingsApi.searchAvailability).toHaveBeenCalledWith({
        query: {
          filter: {
            startAtRange: {
              startAt: startIso,
              endAt: endIso
            },
            locationId: 'test_location',
            segmentFilters: [{ serviceVariationId: 'SERVICE_1' }, { serviceVariationId: 'SERVICE_2' }]
          }
        }
      });

      expect(result.id).toBe('SERVICE_1,SERVICE_2');
      expect(result.serviceVariationIds).toEqual(['SERVICE_1', 'SERVICE_2']);
      expect(result.slots).toHaveLength(1);
    });

    test('should include barber filter when staffMemberId provided', async () => {
      const staffMemberId = 'BARBER_1';

      await loadAvailability(mockTenant, ['SERVICE_1'], staffMemberId, startIso, endIso, mockContext);

      expect(mockSquareClient.bookingsApi.searchAvailability).toHaveBeenCalledWith({
        query: {
          filter: {
            startAtRange: {
              startAt: startIso,
              endAt: endIso
            },
            locationId: 'test_location',
            segmentFilters: [
              {
                serviceVariationId: 'SERVICE_1',
                teamMemberIdFilter: {
                  any: ['BARBER_1']
                }
              }
            ]
          }
        }
      });

      expect(logApiCall).toHaveBeenCalledWith(
        mockContext,
        'search_availability',
        true,
        expect.any(Number),
        expect.objectContaining({
          staff_member_id: 'BARBER_1'
        })
      );
    });

    test('should include barber filter for multiple services', async () => {
      const serviceIds = ['SERVICE_1', 'SERVICE_2'];
      const staffMemberId = 'BARBER_1';

      await loadAvailability(mockTenant, serviceIds, staffMemberId, startIso, endIso, mockContext);

      expect(mockSquareClient.bookingsApi.searchAvailability).toHaveBeenCalledWith({
        query: {
          filter: {
            startAtRange: {
              startAt: startIso,
              endAt: endIso
            },
            locationId: 'test_location',
            segmentFilters: [
              {
                serviceVariationId: 'SERVICE_1',
                teamMemberIdFilter: {
                  any: ['BARBER_1']
                }
              },
              {
                serviceVariationId: 'SERVICE_2',
                teamMemberIdFilter: {
                  any: ['BARBER_1']
                }
              }
            ]
          }
        }
      });
    });

    test('should handle single string service ID (backward compatibility)', async () => {
      // Mock successful Square API response (Square SDK v42+ format)
      mockSquareClient.bookingsApi.searchAvailability.mockResolvedValue({
        result: {
          availabilities: [
            {
              startAt: '2025-01-20T10:00:00Z',
              appointmentSegments: [{ serviceVariationId: 'SERVICE_1', durationMinutes: 20 }]
            }
          ]
        }
      });

      const result = await loadAvailability(mockTenant, 'SERVICE_1', null, startIso, endIso, mockContext);

      expect(result.id).toBe('SERVICE_1');
      expect(result.serviceVariationIds).toEqual(['SERVICE_1']);
    });

    test('should handle empty availability response', async () => {
      // Override mock for this specific test (Square SDK v42+ format)
      mockSquareClient.bookingsApi.searchAvailability.mockResolvedValue({
        result: {
          availabilities: []
        }
      });

      const result = await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);

      expect(result.slots).toEqual([]);
      expect(logApiCall).toHaveBeenCalledWith(
        mockContext,
        'search_availability',
        true,
        expect.any(Number),
        expect.objectContaining({
          availability_count: 0
        })
      );
    });

    test('should handle missing availabilities property', async () => {
      // Override mock for this specific test (Square SDK v42+ format with missing availabilities)
      mockSquareClient.bookingsApi.searchAvailability.mockResolvedValue({
        result: {}
      });

      const result = await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);

      expect(result.slots).toEqual([]);
    });

    test('should handle missing appointmentSegments', async () => {
      // Override mock for this specific test (Square SDK v42+ format)
      mockSquareClient.bookingsApi.searchAvailability.mockResolvedValue({
        result: {
          availabilities: [
            {
              startAt: '2025-01-20T10:00:00Z'
              // appointmentSegments missing
            }
          ]
        }
      });

      const result = await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);

      expect(result.slots[0].appointmentSegments).toEqual([]);
    });

    test('should format readable time for each slot', async () => {
      const result = await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);

      expect(fmtLocal).toHaveBeenCalledWith('2025-01-20T10:00:00Z', 'America/New_York');
      expect(fmtLocal).toHaveBeenCalledWith('2025-01-20T11:00:00Z', 'America/New_York');
      expect(result.slots[0].readable_time).toBe('Formatted: 2025-01-20T10:00:00Z');
    });

    test('should handle Square API error', async () => {
      // Override mock for this specific test
      const apiError = new Error('Square API rate limit exceeded');
      mockSquareClient.bookingsApi.searchAvailability.mockRejectedValue(apiError);

      try {
        await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);
        fail('Should have thrown an error');
      } catch (thrownError) {
        expect(thrownError.message).toContain('Square API rate limit exceeded');
        expect(thrownError.code).toBe('AVAILABILITY_ERROR');
      }

      expect(trackException).toHaveBeenCalledWith(apiError, expect.any(Object));
    });

    test('should call API for each request (no caching)', async () => {
      // Multiple calls should each trigger an API call since we removed caching
      await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);
      await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);
      await loadAvailability(mockTenant, ['SERVICE_1'], 'BARBER_1', startIso, endIso, mockContext);
      await loadAvailability(mockTenant, ['SERVICE_1', 'SERVICE_2'], null, startIso, endIso, mockContext);

      // Should have made 4 separate API calls (no caching)
      expect(mockSquareClient.bookingsApi.searchAvailability).toHaveBeenCalledTimes(4);
    });

    test('should measure and log API call duration', async () => {
      await loadAvailability(mockTenant, ['SERVICE_1'], null, startIso, endIso, mockContext);

      expect(logApiCall).toHaveBeenCalledWith(
        mockContext,
        'search_availability',
        true,
        expect.any(Number),
        expect.any(Object)
      );

      // Verify duration is reasonable (should be small for mock)
      const duration = logApiCall.mock.calls[0][3];
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(1000); // Should be very fast for mock
    });
  });
});
