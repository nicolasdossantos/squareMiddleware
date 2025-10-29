const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const customerAuth = require('../middlewares/customerAuth');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', asyncHandler(authController.signup));
router.post('/login', asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', customerAuth, asyncHandler(authController.logout));
router.get('/me', customerAuth, asyncHandler(authController.me));
router.get('/tenant', customerAuth, asyncHandler(authController.tenantContext));

module.exports = router;
