const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBookingById,
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
} = require('../controllers/bookingController');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');

// [FORM STATE PERSISTENCE]: Lưu, lấy và xóa trạng thái nháp của form đặt xe
router.post('/draft', optionalAuth, saveBookingDraft);
router.get('/draft', optionalAuth, getBookingDraft);
router.delete('/draft', optionalAuth, clearBookingDraft);

// [AC]: Protect customer endpoints so visitors cannot submit online bookings
router.post('/', requireAuth, createBooking);

// [AC]: Customers can access only their own protected bookings
router.get('/my-bookings', requireAuth, getMyBookings);
router.get('/:id', requireAuth, getBookingById);

module.exports = router;
