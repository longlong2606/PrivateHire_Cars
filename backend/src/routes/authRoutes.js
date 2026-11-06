const express = require('express');
const router = express.Router();
const { login, logout, getSession } = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// [AC]: Email/Password Sign-in
router.post('/login', login);

// [AC]: Sign-out (Invalidate session)
router.post('/logout', logout);

// [AC]: Session check & current authenticated profile
router.get('/session', requireAuth, getSession);
router.get('/me', requireAuth, getSession);

module.exports = router;
