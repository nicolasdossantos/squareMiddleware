const { query } = require('./database');
const { invokePhoneNumberFunction, isPhoneNumberFunctionConfigured } = require('../utils/functionInvoker');
const { logEvent } = require('../utils/logger');

const RETELL_COUNTRY_DEFAULT = process.env.RETELL_PHONE_COUNTRY || 'US';

async function purchasePhoneNumber({ tenantId, retellAgentId, areaCode, voiceProvider, correlationId }) {
  if (!tenantId) {
    throw new Error('tenantId is required to purchase phone number');
  }

  if (!isPhoneNumberFunctionConfigured()) {
    throw new Error('Phone number function not configured');
  }

  const payload = {
    action: 'purchase',
    tenantId,
    retellAgentUuid: retellAgentId || null,
    areaCode: areaCode || null,
    country: RETELL_COUNTRY_DEFAULT,
    voiceProvider: voiceProvider || process.env.RETELL_PHONE_VOICE_PROVIDER || 'retell'
  };

  const response = await invokePhoneNumberFunction(payload, correlationId, {
    timeoutMs: parseInt(process.env.PHONE_NUMBER_FUNCTION_TIMEOUT_MS || '10000', 10)
  });

  if (!response?.data?.success) {
    throw new Error(response?.data?.error || 'Phone number purchase failed');
  }

  logEvent('phone_number_purchased', {
    tenantId,
    retellAgentId,
    retellPhoneNumberId: response.data.retellPhoneNumberId,
    phoneNumber: response.data.phoneNumber,
    correlationId
  });

  return response.data;
}

async function linkAssignmentToAgent({ tenantId, retellAgentId, retellPhoneNumberId, correlationId }) {
  if (!tenantId || !retellAgentId || !retellPhoneNumberId) {
    throw new Error('tenantId, retellAgentId, and retellPhoneNumberId are required');
  }

  await query(
    `
      UPDATE phone_number_assignments
      SET retell_agent_uuid = $1,
          updated_at = NOW()
      WHERE tenant_id = $2
        AND retell_phone_number_id = $3
    `,
    [retellAgentId, tenantId, retellPhoneNumberId]
  );

  await query(
    `
      UPDATE retell_agents
      SET retell_phone_number_id = $1,
          phone_number = (
            SELECT phone_number
            FROM phone_number_assignments
            WHERE tenant_id = $2
              AND retell_phone_number_id = $1
            LIMIT 1
          ),
          phone_number_status = 'active',
          updated_at = NOW()
      WHERE tenant_id = $2
        AND retell_agent_id = $3
    `,
    [retellPhoneNumberId, tenantId, retellAgentId]
  );

  logEvent('phone_number_assignment_linked', {
    tenantId,
    retellAgentId,
    retellPhoneNumberId,
    correlationId
  });
}

async function updateForwarding({ assignmentId, tenantId, forwardingNumber, instructions, correlationId }) {
  if (!assignmentId || !tenantId || !forwardingNumber) {
    throw new Error('assignmentId, tenantId, and forwardingNumber are required');
  }

  if (!isPhoneNumberFunctionConfigured()) {
    throw new Error('Phone number function not configured');
  }

  await invokePhoneNumberFunction(
    {
      action: 'forwarding-update',
      assignmentId,
      tenantId,
      forwardingNumber,
      instructions
    },
    correlationId,
    {
      timeoutMs: parseInt(process.env.PHONE_NUMBER_FUNCTION_TIMEOUT_MS || '10000', 10)
    }
  );

  logEvent('phone_number_forwarding_updated', {
    tenantId,
    assignmentId,
    correlationId
  });
}

async function listPhoneNumbers(tenantId) {
  const { rows } = await query(
    `
      SELECT *
      FROM phone_number_assignments
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `,
    [tenantId]
  );
  return rows;
}

async function getAssignmentByRetellId(tenantId, retellPhoneNumberId) {
  const { rows } = await query(
    `
      SELECT * FROM phone_number_assignments
      WHERE tenant_id = $1 AND retell_phone_number_id = $2
      LIMIT 1
    `,
    [tenantId, retellPhoneNumberId]
  );
  return rows[0] || null;
}

module.exports = {
  purchasePhoneNumber,
  updateForwarding,
  listPhoneNumbers,
  getAssignmentByRetellId,
  linkAssignmentToAgent
};
