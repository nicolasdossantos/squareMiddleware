const request = require('supertest');
const path = require('path');

jest.mock('../../src/middlewares/retellAuth', () => jest.fn((req, _res, next) => next()));

jest.mock('../../src/services/customerInfoResponseService', () => ({
  buildConversationInitiationData: jest.fn().mockResolvedValue({
    success: true,
    type: 'conversation_initiation_client_data',
    dynamic_variables: {
      initial_message: 'Hi there!',
      customer_first_name: 'John',
      customer_last_name: 'Doe'
    }
  })
}));

jest.mock('../../src/services/bookingService', () => ({
  createBooking: jest.fn(async (_tenant, bookingData) => ({
    success: true,
    data: {
      booking: {
        id: 'booking-created',
        startAt: bookingData.startAt
      }
    }
  })),
  updateBooking: jest.fn(async (_tenant, bookingId) => ({
    success: true,
    data: {
      id: bookingId,
      updatedAt: new Date().toISOString()
    }
  })),
  cancelBooking: jest.fn(),
  getBooking: jest.fn(),
  getBookingsByCustomer: jest.fn(),
  getCustomerBookings: jest.fn(),
  getActiveBookingsByCustomer: jest.fn(),
  listBookings: jest.fn(),
  confirmBooking: jest.fn()
}));

jest.mock('../../src/utils/helpers/bookingHelpers', () => ({
  validateBookingData: jest.fn(() => ({ isValid: true, errors: null })),
  cancelBooking: jest.fn(async (_ctx, tenant, bookingId) => ({
    booking: {
      id: bookingId,
      tenantId: tenant.id
    }
  })),
  getBooking: jest.fn()
}));

jest.mock('../../src/utils/squareUtils', () => {
  const actual = jest.requireActual('../../src/utils/squareUtils');
  return {
    ...actual,
    createSquareClient: jest.fn(() => ({
      bookingsApi: {
        searchAvailability: jest.fn().mockImplementation(({ query }) => {
          const startRange = query?.filter?.startAtRange;
          const requestedStart = startRange
            ? new Date(new Date(startRange.startAt).getTime() + 30 * 60 * 1000).toISOString()
            : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

          return Promise.resolve({
            result: {
              availabilities: [
                {
                  startAt: requestedStart,
                  appointmentSegments: [
                    {
                      serviceVariationId: 'sv1',
                      teamMemberId: 'tm1',
                      durationMinutes: 30
                    }
                  ]
                }
              ]
            }
          });
        }),
        listBookings: jest.fn().mockResolvedValue({
          result: {
            bookings: []
          }
        })
      }
    }))
  };
});

const bookingService = require('../../src/services/bookingService');
const bookingHelpers = require('../../src/utils/helpers/bookingHelpers');
const squareUtils = require('../../src/utils/squareUtils');
const agentConfigService = require('../../src/services/agentConfigService');

let createApp;

describe('Retell booking tool integration', () => {
  const AGENT_CONFIGS = [
    {
      agentId: 'agent-alpha',
      bearerToken: 'alpha-bearer',
      squareAccessToken: 'sq0at-alpha-0123456789abcdef',
      squareLocationId: 'L_ALPHA',
      squareApplicationId: 'APP_ALPHA',
      squareEnvironment: 'sandbox',
      timezone: 'America/New_York'
    },
    {
      agentId: 'agent-beta',
      bearerToken: 'beta-bearer',
      squareAccessToken: 'sq0at-beta-0123456789abcdef',
      squareLocationId: 'L_BETA',
      squareApplicationId: 'APP_BETA',
      squareEnvironment: 'sandbox',
      timezone: 'America/Los_Angeles'
    }
  ];

  beforeAll(() => {
    process.env.SQUARE_ACCESS_TOKEN = 'sq0at-default-1234567890abcdef';
    process.env.SQUARE_LOCATION_ID = 'DEFAULT_LOCATION';
    process.env.SQUARE_APPLICATION_ID = 'DEFAULT_APP';
    process.env.NODE_ENV = 'test';
    process.env.RETELL_API_KEY = 'test-retell-api-key';
    process.env.TZ = 'America/New_York';
    process.env.AGENT_CONFIGS = JSON.stringify(AGENT_CONFIGS);

    agentConfigService.reload();
    createApp = require('../../src/express-app');
  });

  beforeEach(() => {
    process.env.AGENT_CONFIGS = JSON.stringify(AGENT_CONFIGS);
    agentConfigService.reload();
    jest.clearAllMocks();
  });

  it('returns 401 when agent configuration is missing', async () => {
    process.env.AGENT_CONFIGS = JSON.stringify([]);
    agentConfigService.reload();
    const app = createApp();
    const payload = {
      event: 'call_inbound',
      call_inbound: {
        agent_id: 'unknown-agent',
        from_number: '+12671234567',
        to_number: '+15551230000'
      }
    };

    const response = await request(app).post('/api/webhooks/retell').send(payload).expect(401);

    expect(response.body).toMatchObject({
      success: false,
      error: 'Agent configuration not found'
    });
  });

  it('processes booking create/update/cancel using tenant-scoped credentials', async () => {
    const app = createApp();

    const inboundPayload = {
      event: 'call_inbound',
      call_inbound: {
        agent_id: 'agent-alpha',
        from_number: '+12671234567',
        to_number: '+15551230000'
      }
    };

    const inboundResponse = await request(app).post('/api/webhooks/retell').send(inboundPayload).expect(200);

    const callId = inboundResponse.body?.call_inbound?.dynamic_variables?.call_id;
    expect(callId).toBeTruthy();

    const bookingPayload = {
      customerId: 'customer-1',
      startAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      appointmentSegments: [
        {
          serviceVariationId: 'sv1',
          teamMemberId: 'tm1',
          serviceVariationVersion: '1',
          durationMinutes: 30
        }
      ]
    };

    await request(app)
      .post('/api/booking/create')
      .set('x-retell-call-id', callId)
      .send(bookingPayload)
      .expect(201);

    expect(bookingService.createBooking).toHaveBeenCalled();
    const createTenantArg = bookingService.createBooking.mock.calls[0][0];
    expect(createTenantArg.squareAccessToken).toBe('sq0at-alpha-0123456789abcdef');

    await request(app)
      .post('/api/booking/update?bookingId=booking-created')
      .set('x-retell-call-id', callId)
      .send({
        startAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        appointmentSegments: [
          {
            serviceVariationId: 'sv1',
            teamMemberId: 'tm1',
            serviceVariationVersion: '1',
            durationMinutes: 30
          }
        ]
      })
      .expect(200);

    expect(bookingService.updateBooking).toHaveBeenCalled();
    const updateTenantArg = bookingService.updateBooking.mock.calls[0][0];
    expect(updateTenantArg.squareAccessToken).toBe('sq0at-alpha-0123456789abcdef');

    await request(app)
      .post('/api/booking/cancel?bookingId=booking-created')
      .set('x-retell-call-id', callId)
      .send({})
      .expect(200);

    expect(bookingHelpers.cancelBooking).toHaveBeenCalled();
    const cancelTenantArg = bookingHelpers.cancelBooking.mock.calls[0][1];
    expect(cancelTenantArg.squareAccessToken).toBe('sq0at-alpha-0123456789abcdef');

    // Ensure Square client cache uses tenant-specific key
    expect(squareUtils.createSquareClient).toHaveBeenCalledWith(
      'sq0at-alpha-0123456789abcdef',
      expect.any(String)
    );
  });
});
