const express = require('express');
const router = express.Router();
const { getCustomerProfile, updateCustomerProfile } = require('../controllers/authController');
const { requireAuth, authorizeCustomerAccess } = require('../middleware/authMiddleware');

// [AC]: Protect customer endpoints so customers can access only their own protected information
router.get('/:id', requireAuth, authorizeCustomerAccess('id'), getCustomerProfile);

// [SCRUM-8]: Maintain customer profile
router.put('/:id', requireAuth, authorizeCustomerAccess('id'), updateCustomerProfile);

module.exports = router;

