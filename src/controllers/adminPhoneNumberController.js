const phoneNumberService = require('../services/phoneNumberService');
const { logger } = require('../utils/logger');
const { query } = require('../services/database');

async function listAll(req, res) {
  try {
    const { tenantId } = req.query;
    let sql = `
      SELECT pna.*, t.business_name, ra.retell_agent_id
      FROM phone_number_assignments pna
      INNER JOIN tenants t ON t.id = pna.tenant_id
      LEFT JOIN retell_agents ra ON ra.id = pna.retell_agent_uuid
    `;

    const values = [];
    if (tenantId) {
      sql += ' WHERE pna.tenant_id = $1';
      values.push(tenantId);
    }
    sql += ' ORDER BY pna.created_at DESC LIMIT 200';

    const { rows } = await query(sql, values);

    return res.json({
      success: true,
      assignments: rows
    });
  } catch (error) {
    logger.error('admin_phone_number_list_failed', { message: error.message });
    return res.status(500).json({
      success: false,
      error: 'admin_list_failed',
      message: error.message
    });
  }
}

async function updateAssignment(req, res) {
  try {
    const { assignmentId } = req.params;
    const { status, forwardingNumber, forwardingInstructions, notes } = req.body || {};

    await query(
      `
        UPDATE phone_number_assignments
        SET status = COALESCE($1, status),
            forwarding_number = COALESCE($2, forwarding_number),
            forwarding_instructions = COALESCE($3, forwarding_instructions),
            metadata = metadata || jsonb_build_object('admin_notes', $4),
            updated_at = NOW()
        WHERE id = $5
      `,
      [status || null, forwardingNumber || null, forwardingInstructions || null, notes || null, assignmentId]
    );

    return res.json({ success: true });
  } catch (error) {
    logger.error('admin_phone_number_update_failed', { message: error.message });
    return res.status(500).json({
      success: false,
      error: 'admin_update_failed',
      message: error.message
    });
  }
}

module.exports = {
  listAll,
  updateAssignment
};
