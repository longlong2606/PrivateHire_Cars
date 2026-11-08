const express = require('express');
const router = express.Router();
const StaffController = require('../controllers/staffController');
const { requireAuth, requireStaff } = require('../middleware/authMiddleware');

// All staff endpoints require Staff Authentication
router.use(requireAuth, requireStaff);

// Bookings & Journey Dispatch
router.get('/bookings', StaffController.getAllBookings);
router.post('/bookings', StaffController.createStaffBooking);
router.patch('/bookings/:id/status', StaffController.updateJourneyStatus);
router.post('/bookings/:id/approaching-alert', StaffController.sendApproachingAlert);
router.post('/bookings/:id/collect-cash', StaffController.collectCash);

// Caller lookup
router.get('/customers/search', StaffController.searchCustomer);
router.get('/caller-lookup', StaffController.searchCustomer);

// Refunds queue
router.get('/refunds', StaffController.getRefunds);
router.post('/refunds/:id/process', StaffController.processRefund);

// Fleet & Drivers
router.get('/fleet', StaffController.getFleetAndDrivers);
router.post('/vehicles', StaffController.addVehicle);
router.patch('/vehicles/:id/driver', StaffController.assignVehicleDriver);
router.post('/drivers', StaffController.addDriver);

// [SCRUM-22]: Staff Availability & Prices Search
router.get('/availability', StaffController.checkAvailability);

// Popularity & Loyalty Analytics (P08)
router.get('/reports/popularity-loyalty', StaffController.getPopularityAndLoyaltyReports);

// Customer enquiries
router.get('/enquiries', StaffController.getEnquiries);
router.post('/enquiries/:id/reply', StaffController.replyEnquiry);

module.exports = router;

