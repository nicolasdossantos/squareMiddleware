const { Retell } = require('retell-sdk');
const { Pool } = require('pg');

let pool = null;
let retellClient = null;

function getCorrelationId(req) {
  return (
    req.headers?.['x-correlation-id'] ||
    req.headers?.['x_correlation_id'] ||
    req.headers?.['x-correlationid'] ||
    req.body?.correlationId ||
    null
  );
}

function getPool() {
  if (pool) {
    return pool;
  }

  const connectionString =
    process.env.PG_CONNECTION_STRING || process.env.POSTGRES_CONNECTION_STRING || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('PG_CONNECTION_STRING (or equivalent) is required for phone number manager');
  }

  pool = new Pool({
    connectionString,
    max: parseInt(process.env.PG_POOL_MAX || '5', 10),
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT_MS || '30000', 10)
  });

  return pool;
}

function getRetellClient() {
  if (retellClient) {
    return retellClient;
  }

  if (!process.env.RETELL_API_KEY) {
    throw new Error('RETELL_API_KEY is required to manage phone numbers');
  }

  retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY });
  return retellClient;
}

function normalizePhone(number) {
  if (!number) return null;
  return number.replace(/[^0-9+]/g, '');
}

async function purchaseNumber(client, options) {
  const retell = getRetellClient();

  const payload = {
    country: options.country || 'US',
    area_code: options.areaCode || null,
    capabilities: options.capabilities || ['voice'],
    friendly_name: options.friendlyName || `AI Receptionist ${options.tenantId}`,
    voice_provider: options.voiceProvider || 'retell'
  };

  const result = await retell.phoneNumbers.purchase(payload);

  await client.query(
    `
      INSERT INTO phone_number_assignments (
        tenant_id,
        retell_agent_uuid,
        retell_phone_number_id,
        phone_number,
        status,
        assignment_type,
        metadata
      ) VALUES ($1,$2,$3,$4,'active',$5,$6)
    `,
    [
      options.tenantId,
      options.retellAgentUuid || null,
      result.id,
      normalizePhone(result.phone_number),
      options.assignmentType || 'new',
      JSON.stringify({
        purchase_response: result,
        request: payload
      })
    ]
  );

  return result;
}

async function releaseNumber(client, assignment) {
  const retell = getRetellClient();

  if (!assignment?.retell_phone_number_id) {
    throw new Error('Assignment does not have retell phone number id');
  }

  await retell.phoneNumbers.release(assignment.retell_phone_number_id);

  await client.query(
    `
      UPDATE phone_number_assignments
      SET status = 'released', updated_at = NOW()
      WHERE id = $1
    `,
    [assignment.id]
  );
}

module.exports = async function (context, req) {
  const correlationId = getCorrelationId(req);

  context.log('phone-number-manager function triggered', {
    correlationId
  });

  try {
    const action = req.body?.action;
    const tenantId = req.body?.tenantId;

    if (!action || !tenantId) {
      context.res = {
        status: 400,
        body: {
          success: false,
          error: 'action and tenantId are required'
        }
      };
      return;
    }

    const client = await getPool().connect();

    try {
      switch (action) {
        case 'purchase': {
          const result = await purchaseNumber(client, {
            tenantId,
            retellAgentUuid: req.body?.retellAgentUuid || null,
            country: req.body?.country,
            areaCode: req.body?.areaCode,
            assignmentType: req.body?.assignmentType,
            voiceProvider: req.body?.voiceProvider,
            friendlyName: req.body?.friendlyName
          });

          context.res = {
            status: 200,
            body: {
              success: true,
              phoneNumber: result.phone_number,
              retellPhoneNumberId: result.id,
              correlationId
            }
          };
          break;
        }
        case 'release': {
          const assignmentId = req.body?.assignmentId;
          if (!assignmentId) {
            throw new Error('assignmentId is required for release');
          }

          const { rows } = await client.query(
            `
              SELECT *
              FROM phone_number_assignments
              WHERE id = $1
                AND tenant_id = $2
              LIMIT 1
            `,
            [assignmentId, tenantId]
          );

          if (rows.length === 0) {
            throw new Error('Assignment not found');
          }

          await releaseNumber(client, rows[0]);

          context.res = {
            status: 200,
            body: {
              success: true,
              correlationId
            }
          };
          break;
        }
        case 'forwarding-update': {
          const assignmentId = req.body?.assignmentId;
          const forwardingNumber = normalizePhone(req.body?.forwardingNumber);
          const instructions = req.body?.instructions || null;

          if (!assignmentId || !forwardingNumber) {
            throw new Error('assignmentId and forwardingNumber are required');
          }

          await client.query(
            `
              UPDATE phone_number_assignments
              SET forwarding_number = $1,
                  forwarding_instructions = $2,
                  updated_at = NOW()
              WHERE id = $3
                AND tenant_id = $4
            `,
            [forwardingNumber, instructions, assignmentId, tenantId]
          );

          context.res = {
            status: 200,
            body: {
              success: true,
              forwardingNumber,
              correlationId
            }
          };
          break;
        }
        default:
          context.res = {
            status: 400,
            body: {
              success: false,
              error: `Unsupported action: ${action}`
            }
          };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    context.log.error('phone-number-manager failed', {
      message: error.message,
      stack: error.stack,
      correlationId
    });

    context.res = {
      status: 500,
      body: {
        success: false,
        error: error.message,
        correlationId
      }
    };
  }
};
