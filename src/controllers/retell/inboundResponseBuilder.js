/**
 * Helpers to build Retell inbound call responses.
 */

const DEFAULT_STAFF_JSON = '[{"id":"default","name":"Our Team","displayName":"Our Team"}]';
const DEFAULT_SERVICES = 'Hair Cut, Beard Trim, Hair Wash, Styling';

/**
 * Convert any value to string, preserving empty string fallback.
 * @param {any} value
 * @param {string} fallback
 * @returns {string}
 */
function toStringOrFallback(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

/**
 * Normalize boolean-like value into a string ('true'/'false').
 * @param {any} value
 * @returns {string}
 */
function toBooleanString(value) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' ? 'true' : 'false';
  }
  return value ? 'true' : 'false';
}

function ensureBusinessNameInMessage(message, businessName) {
  const trimmedBusinessName = (businessName || '').trim();
  if (!trimmedBusinessName) {
    return message;
  }

  const defaultMessage = `Thank you for calling ${trimmedBusinessName}, who am I speaking with today?`;

  if (!message) {
    return defaultMessage;
  }

  const normalizedMessage = message.trim();
  const prefix = 'Thank you for calling';

  if (!normalizedMessage.toLowerCase().startsWith(prefix.toLowerCase())) {
    return defaultMessage;
  }

  if (normalizedMessage.toLowerCase().includes(trimmedBusinessName.toLowerCase())) {
    return normalizedMessage;
  }

  return normalizedMessage.replace(/^Thank you for calling/i, `${prefix} ${trimmedBusinessName}`);
}

/**
 * Build default dynamic variables when customer lookup fails.
 * @param {Object} params
 * @param {string} params.businessName
 * @param {string} params.fromNumber
 * @returns {Object}
 */
function buildDefaultDynamicVariables({ businessName, fromNumber }) {
  const callerId = toStringOrFallback(fromNumber, '').replace(/\D/g, '').slice(-10);
  return {
    customer_first_name: '',
    customer_last_name: '',
    customer_full_name: '',
    customer_email: '',
    customer_phone: toStringOrFallback(fromNumber, ''),
    customer_id: '',
    upcoming_bookings_json: '[]',
    booking_history_json: '[]',
    is_returning_customer: 'false',
    current_datetime_store_timezone: new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(new Date()),
    service_variations_json: '{}',
    staff_with_ids_json: DEFAULT_STAFF_JSON,
    available_services: DEFAULT_SERVICES,
    available_staff: 'Our Team',
    caller_id: callerId,
    initial_message: `Thank you for calling ${businessName}, who am I speaking with today?`
  };
}

/**
 * Build inbound response payload expected by Retell.
 * @param {Object} params
 * @param {Object|null} params.customerResponse
 * @param {string} params.businessName
 * @param {string} params.fromNumber
 * @param {string} params.callId
 * @param {string} params.correlationId
 * @returns {{status:number,body:Object}}
 */
function buildInboundResponse({ customerResponse, businessName, fromNumber, callId, correlationId }) {
  const dynamicVariablesSource = customerResponse?.dynamic_variables;
  let dynamicVariables;

  if (dynamicVariablesSource && typeof dynamicVariablesSource === 'object') {
    dynamicVariables = {
      customer_first_name: toStringOrFallback(dynamicVariablesSource.customer_first_name),
      customer_last_name: toStringOrFallback(dynamicVariablesSource.customer_last_name),
      customer_full_name: toStringOrFallback(dynamicVariablesSource.customer_full_name),
      customer_email: toStringOrFallback(dynamicVariablesSource.customer_email),
      customer_phone: toStringOrFallback(dynamicVariablesSource.customer_phone, fromNumber || ''),
      customer_id: toStringOrFallback(dynamicVariablesSource.customer_id),
      upcoming_bookings_json: toStringOrFallback(dynamicVariablesSource.upcoming_bookings_json, '[]'),
      booking_history_json: toStringOrFallback(dynamicVariablesSource.booking_history_json, '[]'),
      is_returning_customer: toBooleanString(dynamicVariablesSource.is_returning_customer),
      current_datetime_store_timezone: toStringOrFallback(
        dynamicVariablesSource.current_datetime_store_timezone
      ),
      service_variations_json: toStringOrFallback(dynamicVariablesSource.service_variations_json, '{}'),
      staff_with_ids_json: toStringOrFallback(dynamicVariablesSource.staff_with_ids_json, DEFAULT_STAFF_JSON),
      available_services: toStringOrFallback(
        dynamicVariablesSource.available_services,
        DEFAULT_SERVICES
      ),
      available_staff: toStringOrFallback(dynamicVariablesSource.available_staff, 'Our Team'),
      caller_id: toStringOrFallback(dynamicVariablesSource.caller_id, '').replace(/\D/g, '').slice(-10),
      initial_message: toStringOrFallback(
        dynamicVariablesSource.initial_message,
        `Thank you for calling ${businessName}, who am I speaking with today?`
      )
    };
  } else {
    dynamicVariables = buildDefaultDynamicVariables({ businessName, fromNumber });
  }

  dynamicVariables.call_id = callId;
  dynamicVariables.initial_message = ensureBusinessNameInMessage(
    dynamicVariables.initial_message,
    businessName
  );

  const content = dynamicVariables.initial_message ||
    `Thank you for calling ${businessName}, who am I speaking with today?`;

  return {
    status: 200,
    body: {
      call_inbound: {
        response_id: 0,
        content,
        content_complete: true,
        end_call: false,
        dynamic_variables: dynamicVariables,
        metadata: {
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
          customer_lookup_success: Boolean(customerResponse?.success)
        }
      }
    }
  };
}

module.exports = {
  buildInboundResponse,
  buildDefaultDynamicVariables
};
