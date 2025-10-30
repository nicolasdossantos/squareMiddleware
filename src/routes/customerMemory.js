const express = require('express');
const { asyncHandler } = require('../middlewares/errorHandler');
const customerAuth = require('../middlewares/customerAuth');
const controller = require('../controllers/customerMemoryController');

const router = express.Router();

router.use(customerAuth);

router.get('/profiles', asyncHandler(controller.listProfiles));
router.get('/profiles/:profileId', asyncHandler(controller.getProfile));
router.post('/profiles/:profileId/context', asyncHandler(controller.upsertContext));
router.delete('/profiles/:profileId/context/:contextKey', asyncHandler(controller.deleteContext));

module.exports = router;
