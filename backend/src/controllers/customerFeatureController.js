const ReviewModel = require('../models/reviewModel');
const EnquiryModel = require('../models/enquiryModel');
const NotificationModel = require('../models/notificationModel');
const SpecialOfferModel = require('../models/specialOfferModel');
const BookingModel = require('../models/bookingModel');
const EmailService = require('../services/emailService');

class CustomerFeatureController {
  /**
   * [P07]: Gửi đánh giá cho chuyến đi đã hoàn thành (Review & Rating)
   * Yêu cầu: Chỉ chủ sở hữu cuốc xe COMPLETED mới được đánh giá. 1 đánh giá / cuốc xe.
   */
  static async submitReview(req, res) {
    try {
      const customer = req.user;
      const { bookingId, bookingCode, journeyRating, vehicleRating, driverRating, reviewText, comments, comment } = req.body;

      let booking = null;
      if (bookingId) {
        if (typeof bookingId === 'string' && bookingId.startsWith('BK-')) {
          booking = await BookingModel.findByCode(bookingId);
        } else {
          booking = await BookingModel.findById(bookingId);
        }
      }
      if (!booking && (bookingCode || req.body.code)) {
        booking = await BookingModel.findByCode(bookingCode || req.body.code);
      }

      if (!booking) {
        return res.status(400).json({ success: false, message: 'Valid Booking ID or Booking Code is required' });
      }

      const resolvedBookingId = booking.id;

      if (booking.account_id !== customer.id) {
        return res.status(403).json({ success: false, message: 'You can only review your own journeys.' });
      }

      if (booking.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Reviews can only be submitted for Completed journeys (P07).',
        });
      }

      const existingReview = await ReviewModel.findByBookingId(resolvedBookingId);
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

      const reviewContent = (reviewText || comments || comment || '').trim();
      if (!reviewContent) {
        return res.status(400).json({
          success: false,
          message: 'Review comments cannot be empty. Please share your feedback.',
        });
      }

      const review = await ReviewModel.create({
        bookingId: resolvedBookingId,
        accountId: customer.id,
        journeyRating: jRating,
        vehicleRating: vRating,
        driverRating: dRating,
        reviewText: reviewContent,
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
   * [SCRUM-9]: Gửi thắc mắc / khiếu nại (Customer Enquiry)
   * AC1: Form offers General and Trip-specific types.
   * AC2: Guest or signed-in customer can submit a general enquiry with message + valid reply email.
   * AC3: Trip-specific requires signed-in customer and one of their own bookings.
   * AC4: Missing message, invalid reply email, or another customer's booking -> error, not saved.
   * AC5: Valid enquiry saved with a reference number so staff can retrieve and answer.
   */
  static async submitEnquiry(req, res) {
    try {
      const { enquiryType = 'GENERAL', bookingId, name, email, subject, message } = req.body;
      const accountId = req.user ? req.user.id : null;

      if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
      if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Valid reply email is required' });
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ success: false, message: 'Invalid reply email format' });
      }

      if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

      let resolvedBookingId = null;
      if (enquiryType === 'TRIP_SPECIFIC' || bookingId) {
        if (!accountId) {
          return res.status(401).json({
            success: false,
            message: 'Trip-specific enquiries require signing in to your registered customer account.',
          });
        }

        if (!bookingId) {
          return res.status(400).json({
            success: false,
            message: 'Please select one of your bookings for a trip-specific enquiry.',
          });
        }

        const booking = await BookingModel.findById(bookingId);
        if (!booking || booking.account_id !== accountId) {
          return res.status(403).json({
            success: false,
            message: 'Cannot file enquiry against a booking not owned by your account.',
          });
        }
        resolvedBookingId = booking.id;
      }

      const enquirySubject = subject && subject.trim() 
        ? subject.trim() 
        : (enquiryType === 'TRIP_SPECIFIC' ? `Trip Enquiry for Booking #${resolvedBookingId}` : 'General Chauffeur Service Enquiry');

      const enquiry = await EnquiryModel.create({
        accountId,
        bookingId: resolvedBookingId,
        name: name.trim(),
        email: email.trim(),
        subject: enquirySubject,
        message: message.trim(),
      });

      const referenceCode = `ENQ-${String(enquiry.id + 100000).substring(1)}`;

      res.status(201).json({
        success: true,
        referenceNumber: referenceCode,
        message: `Enquiry ${referenceCode} submitted successfully. London Dispatch will reply via email.`,
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
   * [SCRUM-28]: Lấy danh sách ưu đãi khách hàng thân thiết (Special-offer recommendation)
   * AC1: Opening Offers page creates recommendation only if customer has >= 3 Completed bookings and has never received one.
   * AC2: Shows customer-linked offer code + configured discount (e.g. £10 GBP); no expiry date.
   * AC3: Offer appears in account and real recommendation email is sent.
   * AC4: Reopening shows existing recommendation; no new one created.
   * AC5: Only linked customer can access/use it; redeemable for one confirmed booking.
   */
  static async getMyOffers(req, res) {
    try {
      const customerId = req.user.id;
      let offers = await SpecialOfferModel.getOffersForAccount(customerId);

      if (offers.length === 0) {
        const completedCount = await BookingModel.countCompletedByCustomer(customerId);
        if (completedCount >= 3) {
          const promoCode = 'LOYALTY10-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          const newOffer = await SpecialOfferModel.createOffer({
            accountId: customerId,
            code: promoCode,
            discountAmount: 10.00,
            description: 'Customer Loyalty Milestone £10 Discount Voucher',
          });
          offers = [newOffer];

          // Real email recommendation (SCRUM-28 AC3)
          if (req.user.email) {
            await EmailService.sendSpecialOfferEmail({
              toEmail: req.user.email,
              name: req.user.name || 'Valued Customer',
              promoCode,
              discountAmount: 10.00,
            }).catch(e => console.warn('Offer email notice:', e.message));
          }
        }
      }

      res.json({ success: true, offers });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = CustomerFeatureController;
