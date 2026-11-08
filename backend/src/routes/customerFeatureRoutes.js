const express = require('express');
const router = express.Router();
const CustomerFeatureController = require('../controllers/customerFeatureController');
const { requireAuth, optionalAuth } = require('../middleware/authMiddleware');

// [P07]: Reviews
router.post('/reviews', requireAuth, CustomerFeatureController.submitReview);
router.get('/reviews/my', requireAuth, CustomerFeatureController.getMyReviews);

// [Epic 1]: Enquiries (hỗ trợ cả khách vãng lai và đăng nhập)
router.post('/enquiries', optionalAuth, CustomerFeatureController.submitEnquiry);

// [P04]: Web Notifications (e.g. Approaching vehicle alert)
router.get('/notifications', requireAuth, CustomerFeatureController.getNotifications);
router.patch('/notifications/:id/read', requireAuth, CustomerFeatureController.markNotificationRead);

// [P09]: Loyalty Offers
router.get('/offers/my', requireAuth, CustomerFeatureController.getMyOffers);

module.exports = router;
