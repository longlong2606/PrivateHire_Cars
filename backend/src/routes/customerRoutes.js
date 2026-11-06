const express = require('express');
const router = express.Router();
const { getCustomerProfile } = require('../controllers/authController');
const { requireAuth, authorizeCustomerAccess } = require('../middleware/authMiddleware');

// [AC]: Protect customer endpoints so customers can access only their own protected information
router.get('/:id', requireAuth, authorizeCustomerAccess('id'), getCustomerProfile);

module.exports = router;

