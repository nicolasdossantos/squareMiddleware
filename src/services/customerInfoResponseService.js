/**
 * Customer Info Response Service
 * Builds ElevenLabs-compatible conversation initiation payloads.
 */
const logger = require('../utils/logger');
const { logPerformance, logEvent } = logger;
const customerService = require('./customerService');
const { createSquareClient, loadServiceVariations, loadStaffMembers, formatPhoneNumber } = require('../utils/squareUtils');
const { cleanBigIntFromObject } = require('../utils/helpers/bigIntUtils');
const { getRelativeTimeframe } = require('../utils/helpers/dateHelpers');

/**
 * Normalize phone number for display
 * @param {string} phone
 * @returns {string}
 */
function formatPhoneForDisplay(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
}

/**
 * Build ElevenLabs conversation initiation payload for a phone number.
 * Extracted from customerController to make it reusable for webhook flows.
 *
 * @param {Object} params
 * @param {Object} params.tenant
 * @param {string} params.phoneNumber
 * @param {string} params.correlationId
 * @returns {Promise<Object>}
 */
async function buildConversationInitiationData({ tenant, phoneNumber, correlationId }) {
  const startTime = Date.now();

  try {
    logEvent('get_customer_info_by_phone_request', {
      phoneNumber,
      correlationId,
      tenantId: tenant?.id
    });

    // Call the customer service to get info by phone
    const customerServiceResult = await customerService.getCustomerInfo(tenant, phoneNumber);

    // Extract the actual customer from the service result
    const foundCustomer = customerServiceResult?.customer;
    let customerInfo;

    if (!foundCustomer) {
      logger.info('Customer not found, attempting fallback search with additional phone formats', {
        originalPhone: phoneNumber,
        correlationId
      });

      // Try additional fallback searches with different phone formats
      let fallbackCustomer = null;
      const fallbackFormats = [];

      if (phoneNumber) {
        const cleanPhone = phoneNumber.replace(/\D/g, '');

        // Try different phone number formats
        if (cleanPhone.length >= 10) {
          // Try with +1 prefix
          if (cleanPhone.length === 10) {
            fallbackFormats.push(`+1${cleanPhone}`, `1${cleanPhone}`);
          }
          // Try without country code
          if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
            fallbackFormats.push(cleanPhone.slice(1));
          }
          // Try formatted versions
          if (cleanPhone.length === 10) {
            fallbackFormats.push(
              `(${cleanPhone.slice(0, 3)}) ${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
            );
            fallbackFormats.push(
              `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
            );
          }
        }
      }

      // Try each fallback format
      for (const format of fallbackFormats) {
        if (format !== phoneNumber) {
          logger.info('Trying fallback phone format', {
            format,
            correlationId
          });
          try {
            const fallbackResult = await customerService.getCustomerInfo(tenant, format);
            if (fallbackResult?.customer) {
              fallbackCustomer = fallbackResult.customer;
              logger.info('Found customer with fallback format', {
                format,
                customerId: fallbackCustomer.id,
                correlationId
              });
              break;
            }
          } catch (fallbackError) {
            logger.warn('Fallback search failed for format', {
              format,
              error: fallbackError.message
            });
          }
        }
      }

      if (!fallbackCustomer) {
        logger.info('No customer found even with fallback searches', {
          originalPhone: phoneNumber,
          attemptedFormats: fallbackFormats,
          correlationId
        });

        // For ElevenLabs, return a response even for non-customers
        customerInfo = {
          ...customerServiceResult,
          customer: null
        };
      } else {
        // Use the fallback customer data
        customerInfo = { ...customerServiceResult, customer: fallbackCustomer };
      }
    } else {
      customerInfo = customerServiceResult;
    }

    // Get current bookings for the customer using tenant-specific Square client
    const square = createSquareClient(
      tenant.accessToken || tenant.squareAccessToken,
      tenant.squareEnvironment || tenant.environment || 'production'
    );

    const context = {
      log: (...args) => logger.info(...args),
      error: (...args) => logger.error(...args)
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago (matches Azure Functions)
    const customerData = customerInfo.customer;

    // Get bookings using separate API calls like Azure Functions (only if customer exists)
    let futureBookings = [];
    let pastBookings = [];

    if (customerData) {
      try {
        // Get future bookings (from now onwards)
        const futureBookingsPromise = square.bookingsApi.listBookings(
          10, // limit
          undefined, // cursor
          customerData.id, // customerId
          undefined, // teamMemberId
          undefined, // locationId
          now.toISOString() // startAtMin
        );

        // Get past bookings (last 30 days only)
        const pastBookingsPromise = square.bookingsApi.listBookings(
          50, // limit
          undefined, // cursor
          customerData.id, // customerId
          undefined, // teamMemberId
          undefined, // locationId
          thirtyDaysAgo.toISOString(), // startAtMin
          now.toISOString() // startAtMax
        );

        // Execute both API calls in parallel
        const [futureResponse, pastResponse] = await Promise.all([
          futureBookingsPromise,
          pastBookingsPromise
        ]);

        // Extract bookings from responses (Square SDK v42+ uses result.bookings)
        futureBookings = futureResponse.result?.bookings || [];
        pastBookings = pastResponse.result?.bookings || [];

        logger.info('📊 Square API bookings retrieved', {
          futureBookings: futureBookings.length,
          pastBookings: pastBookings.length,
          correlationId
        });
      } catch (bookingError) {
        logger.error('Error fetching bookings from Square API:', bookingError);
        // Continue with empty arrays if API fails
      }
    }

    // Clean BigInt values before processing
    const cleanedFutureBookings = cleanBigIntFromObject(futureBookings);
    const cleanedPastBookings = cleanBigIntFromObject(pastBookings);

    logger.info('🔍 Debug: Bookings structure from Square API', {
      futureBookingsCount: cleanedFutureBookings.length,
      pastBookingsCount: cleanedPastBookings.length,
      futureBookingStatuses: cleanedFutureBookings.map(b => ({
        id: b.id,
        status: b.status,
        startAt: b.startAt
      })),
      pastBookingStatuses: cleanedPastBookings.map(b => ({
        id: b.id,
        status: b.status,
        startAt: b.startAt
      })),
      correlationId
    });

    // Filter for future bookings - ACCEPTED and PENDING (matches Azure Functions)
    const nextBookings = cleanedFutureBookings
      .filter(booking => booking.status === 'ACCEPTED' || booking.status === 'PENDING')
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt)) // ASC order
      .slice(0, 10);

    // Filter for past bookings - only ACCEPTED status (matches Azure Functions)
    const filteredPastBookings = cleanedPastBookings
      .filter(booking => booking.status === 'ACCEPTED')
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)) // DESC order
      .slice(0, 10);

    // Format bookings for ElevenLabs response
    const formatBooking = booking => {
      const startDate = new Date(booking.startAt);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const daysAway = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));

      return {
        booking_id: booking.id,
        status: booking.status,
        start_at: booking.startAt,
        end_at: '',
        date: formatter.format(startDate),
        time: timeFormatter.format(startDate),
        days_away: daysAway,
        relative_time: getRelativeTimeframe(booking.startAt, 'America/New_York'),
        service_variation_id: booking.appointmentSegments?.[0]?.serviceVariationId || '',
        team_member_id: booking.appointmentSegments?.[0]?.teamMemberId || '',
        location_id: booking.locationId,
        customer_note: booking.customerNote || '',
        seller_note: booking.sellerNote || '',
        version: booking.version || 0,
        created_at: booking.createdAt,
        updated_at: booking.updatedAt,
        appointment_segments: booking.appointmentSegments || []
      };
    };

    const [servicesData, staffData] = await Promise.all([
      loadServiceVariations(context, tenant).catch(() => ({ services: [] })),
      loadStaffMembers(context, tenant).catch(() => ({ staffMembers: [] }))
    ]);

    // Build service variations lookup
    const serviceVariations = {};
    servicesData.services?.forEach(service => {
      service.variations?.forEach(variation => {
        serviceVariations[variation.id] = {
          serviceName: service.name,
          variationName: variation.name,
          priceFormatted: `$${(parseInt(variation.price || '0', 10) / 100).toFixed(2)}`,
          durationMinutes: Math.round(parseInt(variation.duration || '0', 10) / 60000),
          teamMemberIds: variation.teamMemberIds || []
        };
      });
    });

    // Build staff members data
    const staffWithIds =
      staffData.staffMembers?.map(staffMember => ({
        id: staffMember.id,
        name: staffMember.fullName || `${staffMember.firstName} ${staffMember.lastName}`.trim(),
        displayName: staffMember.firstName === 'wariton' ? 'Junior' : staffMember.firstName || 'Staff Member'
      })) || [];

    // Get current date/time in store timezone
    const currentDateTime = new Intl.DateTimeFormat('en-US', {
      timeZone: tenant.timezone || 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(now);

    // Generate initial message based on customer status
    let initialMessage = 'Thank you for calling. Who am I speaking with today?';

    if (customerData) {
      const firstName = customerData?.givenName || customerData?.firstName || '';
      const fullName = customerData
        ? `${customerData.givenName || customerData.firstName || ''} ${
            customerData.familyName || customerData.lastName || ''
          }`.trim()
        : '';
      const lastName = customerData?.familyName || customerData?.lastName || '';

      let nameToUse = '';
      if (firstName) {
        nameToUse = firstName;
      } else if (fullName) {
        nameToUse = fullName;
      } else if (lastName) {
        nameToUse = lastName;
      }

      if (nameToUse) {
        initialMessage = `Thank you for calling. Am I speaking to ${nameToUse}?`;
      }
    }

    const normalizedPhoneResult = phoneNumber ? formatPhoneNumber(phoneNumber) : { isValid: false };
    const customerPhoneE164 = normalizedPhoneResult?.isValid ? normalizedPhoneResult.formatted : '';

    const elevenLabsResponse = {
      success: true,
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        customer_first_name: customerData?.givenName || customerData?.firstName || '',
        customer_last_name: customerData?.familyName || customerData?.lastName || '',
        customer_full_name: customerData
          ? `${customerData.givenName || customerData.firstName || ''} ${
              customerData.familyName || customerData.lastName || ''
            }`.trim()
          : '',
        customer_email: customerData?.emailAddress || customerData?.email || '',
        customer_phone: formatPhoneForDisplay(phoneNumber),
        customer_phone_e164: customerPhoneE164,
        customer_id: customerData?.id || '',
        upcoming_bookings_json: JSON.stringify(nextBookings.map(formatBooking)),
        booking_history_json: JSON.stringify(filteredPastBookings.map(formatBooking)),
        is_returning_customer: !!customerData,
        current_datetime_store_timezone: currentDateTime,
        service_variations_json: JSON.stringify(serviceVariations),
        staff_with_ids_json: JSON.stringify(staffWithIds),
        available_staff: staffWithIds.map(s => s.displayName).join(', '),
        available_services: servicesData.services?.map(s => s.name).join(', ') || '',
        caller_id: (phoneNumber || '').replace(/\D/g, '').slice(-10),
        initial_message: initialMessage,
        mensagem_inicial: 'Em que posso ajudar?'
      },
      correlation_id: correlationId
    };

    logPerformance(correlationId, 'get_customer_info_by_phone', startTime, {
      success: true
    });

    return elevenLabsResponse;
  } catch (error) {
    logger.error('Error generating customer info by phone:', error);

    logPerformance(correlationId, 'get_customer_info_by_phone', startTime, {
      success: false,
      error: error.message
    });

    throw error;
  }
}

module.exports = {
  buildConversationInitiationData
};
