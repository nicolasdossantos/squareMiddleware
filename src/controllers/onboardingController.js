const onboardingService = require('../services/onboardingService');
const tenantService = require('../services/tenantService');
const { logger } = require('../utils/logger');

async function submitPreferences(req, res) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const {
      businessName,
      phoneNumber,
      timezone,
      industry,
      voiceKey,
      voiceName,
      voiceProvider,
      language,
      temperature,
      speakingRate,
      ambience
    } = req.body || {};

    if (!voiceKey) {
      return res.status(400).json({
        success: false,
        error: 'missing_voice_key',
        message: 'voiceKey is required to save preferences'
      });
    }

    const profile = await onboardingService.saveVoicePreferences(tenantId, {
      businessName,
      phoneNumber,
      timezone,
      industry,
      voiceKey,
      name: voiceName || voiceKey,
      provider: voiceProvider || 'retell',
      language,
      temperature,
      speakingRate,
      ambience
    });

    const tenant = await tenantService.getTenantById(tenantId);

    return res.status(200).json({
      success: true,
      voiceProfile: profile,
      tenant
    });
  } catch (error) {
    logger.error('onboarding_preferences_failed', { message: error.message, tenantId: req.user?.tenantId });
    return res.status(500).json({
      success: false,
      error: 'preferences_failed',
      message: 'Failed to save onboarding preferences'
    });
  }
}

module.exports = {
  submitPreferences
};
