// GetServiceAvailability/helpers.js
const { createSquareClient, logApiCall, trackException, fmtLocal } = require('../squareUtils');

/**
 * Load availability for one or more service variations and staff member within a date range
 * This function is specific to the GetServiceAvailability endpoint
 * When multiple services are provided, it searches for contiguous availability across all services
 * @param {Object} tenant - Tenant context with credentials
 * @param {string|Array} serviceVariationIds - Service variation ID(s)
 * @param {string} staffMemberId - Staff member ID (optional)
 * @param {string} startIso - Start time in ISO format
 * @param {string} endIso - End time in ISO format
 * @param {Object} context - Request context with logging
 * @returns {Array} Available time slots
 */
async function loadAvailability(tenant, serviceVariationIds, staffMemberId, startIso, endIso, context) {
  const startTime = Date.now();

  // Handle both single ID and array of IDs
  const idsArray = Array.isArray(serviceVariationIds) ? serviceVariationIds : [serviceVariationIds];

  // Debug logging for Square API call
  context.log('🔍 [SQUARE DEBUG] Input serviceVariationIds:', serviceVariationIds);
  context.log('🔍 [SQUARE DEBUG] Input type:', typeof serviceVariationIds);
  context.log('🔍 [SQUARE DEBUG] Processed idsArray:', idsArray);
  context.log(
    '🔍 [SQUARE DEBUG] ID lengths:',
    idsArray.map(id => ({ id, length: id.length }))
  );

  try {
    // For multiple services, we need to handle the case where the same service
    // is requested multiple times (e.g., 3 haircuts back-to-back)
    let segmentFilters;

    if (idsArray.length === 1) {
      // Single service - use the original approach
      segmentFilters = [
        {
          serviceVariationId: idsArray[0],
          ...(staffMemberId && {
            teamMemberIdFilter: {
              any: [staffMemberId]
            }
          })
        }
      ];
    } else {
      // Multiple services - create segment filter for each appointment segment
      // This correctly represents consecutive bookings (even if same service repeated)
      segmentFilters = idsArray.map(serviceVariationId => ({
        serviceVariationId,
        ...(staffMemberId && {
          teamMemberIdFilter: {
            any: [staffMemberId]
          }
        })
      }));

      // Count duplicates for logging
      const serviceCounts = {};
      idsArray.forEach(id => {
        serviceCounts[id] = (serviceCounts[id] || 0) + 1;
      });

      context.log(`🔍 Searching for ${idsArray.length} consecutive appointment segments:`, {
        total_segments: idsArray.length,
        service_breakdown: serviceCounts,
        staff_member: staffMemberId || 'any',
        note: 'Each segment will be checked for consecutive availability'
      });
    }

    const searchParams = {
      query: {
        filter: {
          startAtRange: {
            startAt: startIso,
            endAt: endIso
          },
          locationId: tenant.locationId,
          segmentFilters
        }
      }
    };

    // Debug log the exact parameters being sent to Square
    context.log(
      '🔍 [SQUARE DEBUG] searchParams being sent to Square API:',
      JSON.stringify(searchParams, null, 2)
    );
    context.log('🔍 [SQUARE DEBUG] segmentFilters:', JSON.stringify(segmentFilters, null, 2));

    // Create tenant-specific Square client
    const square = createSquareClient(tenant.accessToken);

    const apiStartTime = Date.now();
    const resp = await square.bookingsApi.searchAvailability(searchParams);
    const apiDuration = Date.now() - apiStartTime;

    logApiCall(context, 'search_availability', true, apiDuration, {
      service_variation_ids: idsArray.join(','),
      service_count: idsArray.length,
      staff_member_id: staffMemberId || 'all',
      availability_count: resp.availabilities?.length || 0,
      tenant_id: tenant.id
    });

    // Process availability slots with double booking protection
    const slots = (resp.availabilities || [])
      .map(availability => ({
        startAt: availability.startAt,
        readable_time: fmtLocal(availability.startAt, tenant.timezone),
        appointmentSegments: availability.appointmentSegments || []
      }))
      .filter(slot => {
        // For multi-segment bookings, ensure ALL segments have the same staff member
        if (idsArray.length > 1 && slot.appointmentSegments.length > 1) {
          const uniqueStaffMembers = [...new Set(slot.appointmentSegments.map(seg => seg.teamMemberId))];

          if (uniqueStaffMembers.length > 1) {
            context.log('⚠️  Filtering out slot with multiple staff members:', {
              startAt: slot.startAt,
              readableTime: slot.readable_time,
              uniqueStaffMembers,
              segments: slot.appointmentSegments.map(seg => ({
                serviceVariationId: seg.serviceVariationId,
                teamMemberId: seg.teamMemberId,
                durationMinutes: seg.durationMinutes
              })),
              reason: 'Multi-segment booking must have all segments with the same staff member'
            });
            return false; // Filter out this slot
          }

          // If a specific staff member was requested, verify all segments are with that staff member
          if (staffMemberId && slot.appointmentSegments.some(seg => seg.teamMemberId !== staffMemberId)) {
            context.log('⚠️  Filtering out slot with wrong staff member:', {
              startAt: slot.startAt,
              readableTime: slot.readable_time,
              requestedStaffMember: staffMemberId,
              actualStaffMembers: uniqueBarbers,
              reason: 'Segment staff member does not match requested staff member'
            });
            return false; // Filter out this slot
          }
        }

        return true; // Keep this slot
      });

    // Additional debugging for multi-service bookings
    if (idsArray.length > 1) {
      const rawSlots = resp.availabilities || [];

      context.log('🔍 Multi-service availability search result:', {
        services_requested: idsArray.length,
        raw_slots_found: rawSlots.length,
        filtered_slots_found: slots.length,
        slots_filtered_out: rawSlots.length - slots.length,
        search_params: searchParams,
        first_few_raw_slots: rawSlots.slice(0, 3).map(avail => ({
          startAt: avail.startAt,
          segments_count: avail.appointmentSegments?.length || 0,
          segments: avail.appointmentSegments?.map(seg => ({
            serviceVariationId: seg.serviceVariationId,
            teamMemberId: seg.teamMemberId,
            durationMinutes: seg.durationMinutes
          }))
        })),
        first_few_filtered_slots: slots.slice(0, 3).map(slot => ({
          startAt: slot.startAt,
          readableTime: slot.readable_time,
          segments_count: slot.appointmentSegments?.length || 0,
          segments: slot.appointmentSegments?.map(seg => ({
            serviceVariationId: seg.serviceVariationId,
            teamMemberId: seg.teamMemberId,
            durationMinutes: seg.durationMinutes
          }))
        }))
      });
    }

    const record = {
      id: idsArray.join(','), // Use comma-separated IDs for multi-service
      serviceVariationIds: idsArray,
      staffMemberId: staffMemberId || null,
      slots
    };

    return record;
  } catch (error) {
    const apiDuration = Date.now() - startTime;
    logApiCall(context, 'search_availability', false, apiDuration, {
      service_variation_ids: idsArray.join(','),
      service_count: idsArray.length,
      staff_member_id: staffMemberId || 'all'
    });
    trackException(error, {
      function: 'loadAvailability',
      service_variation_ids: idsArray.join(','),
      service_count: idsArray.length,
      staff_member_id: staffMemberId
    });
    context.log('❌ Error loading availability:', error);
    throw error;
  }
}

module.exports = {
  loadAvailability
};
