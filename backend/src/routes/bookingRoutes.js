const express = require('express');
const router = express.Router();
const {
  createBooking,
  checkVehicleAvailability,
  simulatePayment,
  amendBooking,
  cancelBooking,
  getPrintableReceipt,
  validatePromoCode,
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

// [SCRUM-12]: Xem các xe khả dụng phù hợp (Check Vehicle Availability)
router.get('/available-vehicles', checkVehicleAvailability);

// [P09]: Xác thực mã ưu đãi đặc biệt
router.get('/validate-promo', optionalAuth, validatePromoCode);
router.post('/validate-promo', optionalAuth, validatePromoCode);

// [AC]: Protect customer endpoints so visitors cannot submit online bookings
router.post('/', requireAuth, createBooking);

// [P03]: Mô phỏng thanh toán (Simulated Electronic Payment / Cash)
router.post('/:id/simulate-payment', requireAuth, simulatePayment);

// [P05]: Chỉnh sửa và hủy cuốc xe (>= 24h eligibility rule)
router.patch('/:id/amend', requireAuth, amendBooking);
router.post('/:id/cancel', requireAuth, cancelBooking);

// [P03]: Lấy biên lai thanh toán (Printable Receipt)
router.get('/:id/receipt', requireAuth, getPrintableReceipt);

// [AC]: Customers can access only their own protected bookings
router.get('/my-bookings', requireAuth, getMyBookings);
router.get('/:id', requireAuth, getBookingById);

module.exports = router;
