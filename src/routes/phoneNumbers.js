const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const customerAuth = require('../middlewares/customerAuth');
const phoneNumberController = require('../controllers/phoneNumberController');

const router = express.Router();

router.use(customerAuth);

router.get('/', asyncHandler(phoneNumberController.list));
router.post('/purchase', asyncHandler(phoneNumberController.purchase));
router.post('/link', asyncHandler(phoneNumberController.linkAssignment));
router.post('/forwarding', asyncHandler(phoneNumberController.updateForwarding));

module.exports = router;
