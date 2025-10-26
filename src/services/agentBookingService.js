/**
 * Agent Booking Service
 * Persists Square bookings created by middleware agents so we can enforce
 * ownership rules for free-tier sellers and surface upcoming bookings quickly.
 */

const { query } = require('./database');
const { logger } = require('../utils/logger');

/**
 * Extract booking metadata used for persistence.
 * @param {object} booking - Square booking object.
 * @returns {{ id: string|null, startAt: string|null, status: string|null }}
 */
function extractBookingMetadata(booking) {
  if (!booking || typeof booking !== 'object') {
    return { id: null, startAt: null, status: null };
  }

  const id = booking.id || booking.bookingId || null;
  const status = booking.status || null;
  let startAt = booking.startAt || booking.start_at || null;

  if (!startAt && Array.isArray(booking.appointmentSegments)) {
    startAt = booking.appointmentSegments[0]?.startAt || booking.appointmentSegments[0]?.start_at || null;
  }

  return { id, startAt, status };
}

/**
 * Upsert an agent booking record.
 * @param {object} params
 * @param {string} params.agentId - Agent identifier.
 * @param {string} params.tenantId - Tenant identifier (usually same as agent).
 * @param {string} params.locationId - Square location ID.
 * @param {string} params.merchantId - Square merchant ID.
 * @param {object} params.booking - Square booking payload.
 */
async function upsertAgentBooking({ agentId, tenantId, locationId, merchantId, booking }) {
  const { id, startAt, status } = extractBookingMetadata(booking);

  if (!id || !agentId) {
    logger.warn('agent_booking_upsert_skipped', {
      reason: 'missing id or agentId',
      agentId,
      bookingId: id
    });
    return;
  }

  try {
    await query(
      `
        INSERT INTO agent_bookings (booking_id, agent_id, tenant_id, location_id, merchant_id, booking_start, booking_status, booking_payload)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        ON CONFLICT (booking_id)
        DO UPDATE SET
          agent_id = EXCLUDED.agent_id,
          tenant_id = EXCLUDED.tenant_id,
          location_id = EXCLUDED.location_id,
          merchant_id = EXCLUDED.merchant_id,
          booking_start = EXCLUDED.booking_start,
          booking_status = EXCLUDED.booking_status,
          booking_payload = EXCLUDED.booking_payload,
          updated_at = NOW();
      `,
      [
        id,
        agentId,
        tenantId || agentId,
        locationId || null,
        merchantId || null,
        startAt ? new Date(startAt) : null,
        status || null,
        JSON.stringify(booking || {})
      ]
    );

    logger.debug('agent_booking_upsert_success', {
      agentId,
      bookingId: id,
      startAt
    });
  } catch (error) {
    logger.error('agent_booking_upsert_failed', {
      message: error.message,
      agentId,
      bookingId: id
    });
  }
}

/**
 * Remove an agent booking record (e.g., after cancellation).
 * @param {string} bookingId - Square booking ID.
 */
async function removeAgentBooking(bookingId) {
  if (!bookingId) return;

  try {
    await query('DELETE FROM agent_bookings WHERE booking_id = $1', [bookingId]);
    logger.debug('agent_booking_removed', { bookingId });
  } catch (error) {
    logger.error('agent_booking_remove_failed', {
      bookingId,
      message: error.message
    });
  }
}

/**
 * Determine whether a booking belongs to the specified agent.
 * @param {string} agentId - Agent identifier.
 * @param {string} bookingId - Square booking ID.
 * @returns {Promise<boolean>}
 */
async function isAgentBooking(agentId, bookingId) {
  if (!agentId || !bookingId) return false;

  try {
    const result = await query(
      'SELECT 1 FROM agent_bookings WHERE agent_id = $1 AND booking_id = $2 LIMIT 1',
      [agentId, bookingId]
    );
    return result.rowCount > 0;
  } catch (error) {
    logger.error('agent_booking_lookup_failed', {
      agentId,
      bookingId,
      message: error.message
    });
    return false;
  }
}

/**
 * List upcoming bookings for an agent.
 * @param {string} agentId - Agent identifier.
 * @param {number} limit - Number of rows to return.
 * @returns {Promise<object[]>}
 */
async function listUpcomingAgentBookings(agentId, limit = 10) {
  if (!agentId) return [];

  try {
    const result = await query(
      `
        SELECT booking_id, location_id, merchant_id, booking_start, booking_status, booking_payload
        FROM agent_bookings
        WHERE agent_id = $1
          AND booking_start IS NOT NULL
          AND booking_start >= NOW() - INTERVAL '1 hour'
        ORDER BY booking_start ASC
        LIMIT $2
      `,
      [agentId, limit]
    );

    return result.rows.map(row => ({
      bookingId: row.booking_id,
      locationId: row.location_id,
      merchantId: row.merchant_id,
      startAt: row.booking_start ? row.booking_start.toISOString() : null,
      status: row.booking_status,
      booking: row.booking_payload
    }));
  } catch (error) {
    logger.error('agent_booking_list_failed', {
      agentId,
      message: error.message
    });
    return [];
  }
}

module.exports = {
  upsertAgentBooking,
  removeAgentBooking,
  isAgentBooking,
  listUpcomingAgentBookings
};
