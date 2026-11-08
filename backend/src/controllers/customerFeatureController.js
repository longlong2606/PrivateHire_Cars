const ReviewModel = require('../models/reviewModel');
const EnquiryModel = require('../models/enquiryModel');
const NotificationModel = require('../models/notificationModel');
const SpecialOfferModel = require('../models/specialOfferModel');
const BookingModel = require('../models/bookingModel');

class CustomerFeatureController {
  /**
   * [P07]: Gửi đánh giá cho chuyến đi đã hoàn thành (Review & Rating)
   * Yêu cầu: Chỉ chủ sở hữu cuốc xe COMPLETED mới được đánh giá. 1 đánh giá / cuốc xe.
   */
  static async submitReview(req, res) {
    try {
      const customer = req.user;
      const { bookingId, journeyRating, vehicleRating, driverRating, reviewText } = req.body;

      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Booking ID is required' });
      }

      const booking = await BookingModel.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      if (booking.account_id !== customer.id) {
        return res.status(403).json({ success: false, message: 'You can only review your own journeys.' });
      }

      if (booking.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Reviews can only be submitted for Completed journeys (P07).',
        });
      }

      const existingReview = await ReviewModel.findByBookingId(bookingId);
      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: 'A review has already been submitted for this journey (1 review limit).',
        });
      }

      const jRating = parseInt(journeyRating, 10);
      const vRating = parseInt(vehicleRating, 10);
      const dRating = parseInt(driverRating, 10);

      if ([jRating, vRating, dRating].some(r => isNaN(r) || r < 1 || r > 5)) {
        return res.status(400).json({
          success: false,
          message: 'All ratings (Journey, Vehicle, Driver) must be between 1 and 5 stars.',
        });
      }

      const review = await ReviewModel.create({
        bookingId,
        accountId: customer.id,
        journeyRating: jRating,
        vehicleRating: vRating,
        driverRating: dRating,
        reviewText: reviewText || '',
      });

      res.status(201).json({
        success: true,
        message: 'Thank you! Your chauffeur review has been recorded.',
        review,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getMyReviews(req, res) {
    try {
      const reviews = await ReviewModel.getForAccount(req.user.id);
      res.json({ success: true, reviews });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [Epic 1]: Gửi thắc mắc / khiếu nại (Customer Enquiry)
   * General (khách vãng lai hoặc đăng nhập) hoặc Trip-specific (chỉ khách đăng nhập)
   */
  static async submitEnquiry(req, res) {
    try {
      const { bookingId, name, email, subject, message } = req.body;
      const accountId = req.user ? req.user.id : null;

      if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
      if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Email is required' });
      if (!subject || !subject.trim()) return res.status(400).json({ success: false, message: 'Subject is required' });
      if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

      if (bookingId && accountId) {
        const booking = await BookingModel.findById(bookingId);
        if (booking && booking.account_id !== accountId) {
          return res.status(403).json({ success: false, message: 'Cannot file enquiry against another customer booking' });
        }
      }

      const enquiry = await EnquiryModel.create({
        accountId,
        bookingId: bookingId || null,
        name,
        email,
        subject,
        message,
      });

      res.status(201).json({
        success: true,
        message: 'Enquiry submitted. Our support team will reply via email shortly.',
        enquiry,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P04]: Lấy thông báo của khách hàng
   */
  static async getNotifications(req, res) {
    try {
      const notifications = await NotificationModel.getForAccount(req.user.id);
      res.json({ success: true, notifications });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markNotificationRead(req, res) {
    try {
      const notifId = req.params.id;
      await NotificationModel.markRead(notifId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P09]: Lấy danh sách ưu đãi khách hàng thân thiết
   */
  static async getMyOffers(req, res) {
    try {
      const offers = await SpecialOfferModel.getOffersForAccount(req.user.id);
      res.json({ success: true, offers });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = CustomerFeatureController;
