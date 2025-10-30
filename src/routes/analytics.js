const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const customerAuth = require('../middlewares/customerAuth');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.use(customerAuth);

router.get('/tenant', asyncHandler(analyticsController.getTenantAnalytics));

module.exports = router;
