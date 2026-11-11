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
          const parsedId = parseInt(bookingId, 10);
          booking = !isNaN(parsedId) ? await BookingModel.findById(parsedId) : await BookingModel.findById(bookingId);
        }
      }
      if (!booking && (bookingCode || req.body.code)) {
        booking = await BookingModel.findByCode(bookingCode || req.body.code);
      }

      if (!booking) {
        return res.status(400).json({ success: false, message: 'Valid Booking ID or Booking Code is required' });
      }

      const resolvedBookingId = booking.id;

      if (parseInt(booking.account_id, 10) !== parseInt(customer.id, 10)) {
        return res.status(403).json({ success: false, message: 'You can only review your own journeys.' });
      }

      const currentStatus = (booking.status || '').trim().toUpperCase();
      if (currentStatus !== 'COMPLETED') {
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
   * Public home stats & verified reviews for Home Page
   * Real database data: total bookings, completed journeys, active fleet, licensed chauffeurs, average rating, reviews
   */
  static async getPublicHomeStats(req, res) {
    try {
      const db = require('../config/db');

      const bookingsQuery = await db.query(
        "SELECT count(*) as total, count(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed FROM bookings"
      );
      const totalBookings = parseInt(bookingsQuery.rows[0]?.total || 0, 10);
      const completedJourneys = parseInt(bookingsQuery.rows[0]?.completed || 0, 10);

      const vQuery = await db.query("SELECT count(*) as count FROM vehicles");
      const dQuery = await db.query("SELECT count(*) as count FROM drivers");
      const vehicleCount = parseInt(vQuery.rows[0]?.count || 150, 10);
      const driverCount = parseInt(dQuery.rows[0]?.count || 150, 10);

      const rStatsQuery = await db.query(
        "SELECT count(*) as count, avg(journey_rating) as avg_j, avg(vehicle_rating) as avg_v, avg(driver_rating) as avg_d FROM reviews"
      );
      const reviewCount = parseInt(rStatsQuery.rows[0]?.count || 0, 10);
      let avgRating = 5.0;
      if (reviewCount > 0) {
        const avgJ = parseFloat(rStatsQuery.rows[0]?.avg_j || 5);
        const avgV = parseFloat(rStatsQuery.rows[0]?.avg_v || 5);
        const avgD = parseFloat(rStatsQuery.rows[0]?.avg_d || 5);
        avgRating = Math.round(((avgJ + avgV + avgD) / 3) * 10) / 10;
      }

      const reviewsListQuery = await db.query(`
        SELECT r.id, r.journey_rating, r.vehicle_rating, r.driver_rating, r.review_text, r.created_at,
               a.name as customer_name,
               b.booking_code, b.service_name, b.pickup_address, b.dropoff_address
        FROM reviews r
        JOIN accounts a ON r.account_id = a.id
        JOIN bookings b ON r.booking_id = b.id
        ORDER BY r.created_at DESC
        LIMIT 6
      `);

      return res.json({
        success: true,
        stats: {
          totalBookings,
          completedJourneys,
          activeFleet: vehicleCount,
          licensedChauffeurs: driverCount,
          averageRating: avgRating,
          totalReviews: reviewCount,
        },
        reviews: reviewsListQuery.rows.map(r => ({
          id: r.id,
          customerName: r.customer_name || 'Verified Customer',
          journeyRating: r.journey_rating || 5,
          vehicleRating: r.vehicle_rating || 5,
          driverRating: r.driver_rating || 5,
          averageRating: Math.round(((r.journey_rating + r.vehicle_rating + r.driver_rating) / 3) * 10) / 10,
          reviewText: r.review_text || 'Excellent service!',
          serviceName: r.service_name || 'Airport Transfer',
          route: (r.pickup_address && r.dropoff_address) ? `${r.pickup_address} → ${r.dropoff_address}` : (r.service_name || 'London Transfer'),
          bookingCode: r.booking_code,
          createdAt: r.created_at,
        })),
      });
    } catch (error) {
      console.error('Error fetching home stats:', error);
      return res.status(500).json({ success: false, message: error.message });
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
      // Award 1 loyalty voucher for every 3 completed trips (SCRUM-28 / P09 milestone rule)
      const offers = await SpecialOfferModel.awardMilestoneLoyaltyOffers(customerId, req.user);
      const completedCount = await BookingModel.countCompletedByCustomer(customerId);

      res.json({
        success: true,
        offers,
        offer: offers.length > 0 ? offers[0] : null,
        completedCount,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = CustomerFeatureController;
