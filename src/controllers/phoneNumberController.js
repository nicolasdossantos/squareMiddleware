const phoneNumberService = require('../services/phoneNumberService');
const { logger } = require('../utils/logger');

async function purchase(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const result = await phoneNumberService.purchasePhoneNumber({
      tenantId,
      retellAgentId: req.body?.retellAgentId || null,
      areaCode: req.body?.areaCode || null,
      voiceProvider: req.body?.voiceProvider || null,
      correlationId: req.correlationId
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('phone_number_purchase_failed', {
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'purchase_failed',
      message: error.message
    });
  }
}

async function linkAssignment(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized'
      });
    }

    await phoneNumberService.linkAssignmentToAgent({
      tenantId,
      retellAgentId: req.body?.retellAgentId,
      retellPhoneNumberId: req.body?.retellPhoneNumberId,
      correlationId: req.correlationId
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('phone_number_link_failed', {
      message: error.message
    });

    return res.status(500).json({
      success: false,
      error: 'link_failed',
      message: error.message
    });
  }
}

async function updateForwarding(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    await phoneNumberService.updateForwarding({
      assignmentId: req.body?.assignmentId,
      tenantId,
      forwardingNumber: req.body?.forwardingNumber,
      instructions: req.body?.instructions,
      correlationId: req.correlationId
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('phone_number_forwarding_failed', { message: error.message });

    return res.status(500).json({
      success: false,
      error: 'forwarding_failed',
      message: error.message
    });
  }
}

async function list(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const records = await phoneNumberService.listPhoneNumbers(tenantId);
    return res.json({ success: true, numbers: records });
  } catch (error) {
    logger.error('phone_number_list_failed', { message: error.message });

    return res.status(500).json({ success: false, error: 'list_failed', message: error.message });
  }
}

module.exports = {
  purchase,
  linkAssignment,
  updateForwarding,
  list
};
