const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const customerAuth = require('../middlewares/customerAuth');
const onboardingController = require('../controllers/onboardingController');

const router = express.Router();

router.post('/preferences', customerAuth, asyncHandler(onboardingController.submitPreferences));

module.exports = router;
