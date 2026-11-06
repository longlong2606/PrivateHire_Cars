const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBookingById,
} = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/authMiddleware');

// [AC]: Protect customer endpoints so visitors cannot submit online bookings
router.post('/', requireAuth, createBooking);

// [AC]: Customers can access only their own protected bookings
router.get('/my-bookings', requireAuth, getMyBookings);
router.get('/:id', requireAuth, getBookingById);

module.exports = router;
