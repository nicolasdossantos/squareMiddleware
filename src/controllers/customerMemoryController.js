const customerMemoryService = require('../services/customerMemoryService');
const { logger } = require('../utils/logger');

async function listProfiles(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const profiles = await customerMemoryService.listProfiles(tenantId, {
      search: req.query.search || null,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined
    });

    return res.json({ success: true, profiles });
  } catch (error) {
    logger.error('customer_memory_list_failed', { message: error.message });
    return res.status(500).json({ success: false, error: 'list_failed', message: error.message });
  }
}

async function getProfile(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const profileId = req.params.profileId;
    const detail = await customerMemoryService.getProfileDetail(tenantId, profileId);

    if (!detail) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    return res.json({ success: true, detail });
  } catch (error) {
    logger.error('customer_memory_get_failed', { message: error.message });
    return res.status(500).json({ success: false, error: 'fetch_failed', message: error.message });
  }
}

async function upsertContext(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const { key, value, valueType, confidence, source } = req.body || {};
    if (!key || typeof value === 'undefined') {
      return res.status(400).json({ success: false, error: 'missing_context_data' });
    }

    const profileId = req.params.profileId;
    const result = await customerMemoryService.upsertContextEntry({
      tenantId,
      profileId,
      key,
      value,
      valueType,
      confidence,
      source,
      user: req.user
    });

    return res.json({ success: true, context: result });
  } catch (error) {
    logger.error('customer_memory_upsert_failed', { message: error.message });
    return res.status(500).json({ success: false, error: 'upsert_failed', message: error.message });
  }
}

async function deleteContext(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const profileId = req.params.profileId;
    const key = req.params.contextKey;

    if (!key) {
      return res.status(400).json({ success: false, error: 'missing_context_key' });
    }

    const deleted = await customerMemoryService.deleteContextEntry({
      tenantId,
      profileId,
      key,
      user: req.user
    });

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'not_found' });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('customer_memory_delete_failed', { message: error.message });
    return res.status(500).json({ success: false, error: 'delete_failed', message: error.message });
  }
}

module.exports = {
  listProfiles,
  getProfile,
  upsertContext,
  deleteContext
};
