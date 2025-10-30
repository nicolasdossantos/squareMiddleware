const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const customerAuth = require('../middlewares/customerAuth');
const onboardingController = require('../controllers/onboardingController');

const router = express.Router();

router.get('/voices', asyncHandler(onboardingController.getAvailableVoices));
router.get('/voices/:voiceId/preview', asyncHandler(onboardingController.getVoicePreview));
router.post('/preferences', customerAuth, asyncHandler(onboardingController.submitPreferences));
router.post('/square/authorize', customerAuth, asyncHandler(onboardingController.authorizeSquare));
router.get('/status', customerAuth, asyncHandler(onboardingController.getOnboardingStatus));
router.post('/phone-preference', customerAuth, asyncHandler(onboardingController.savePhonePreference));

module.exports = router;
