const BookingModel = require('../models/bookingModel');
const AccountModel = require('../models/accountModel');
const VehicleModel = require('../models/vehicleModel');
const DriverModel = require('../models/driverModel');
const RefundModel = require('../models/refundModel');
const EnquiryModel = require('../models/enquiryModel');
const NotificationModel = require('../models/notificationModel');
const SpecialOfferModel = require('../models/specialOfferModel');
const ServiceModel = require('../models/serviceModel');
const { sendSpecialOfferEmail } = require('../services/emailService');

class StaffController {
  /**
   * [P06]: Lấy toàn bộ danh sách đặt xe của hệ thống
   */
  static async getAllBookings(req, res) {
    try {
      const bookings = await BookingModel.getAllForStaff();
      res.json({ success: true, count: bookings.length, bookings });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P06]: Tìm kiếm khách hàng theo Email hoặc Số điện thoại (Caller verification)
   */
  static async searchCustomer(req, res) {
    try {
      const { query } = req.query;
      if (!query || !query.trim()) {
        return res.status(400).json({ success: false, message: 'Search query is required' });
      }

      const q = query.trim().toLowerCase();
      const db = require('../config/db');
      const sql = `
        SELECT id, account_code, name, email, telephone, address, mock_card_ref, status, created_at
        FROM accounts
        WHERE LOWER(email) LIKE $1 OR LOWER(telephone) LIKE $1 OR LOWER(name) LIKE $1
        ORDER BY id ASC
        LIMIT 10
      `;
      const result = await db.query(sql, [`%${q}%`]);
      res.json({ success: true, count: result.rows.length, customers: result.rows, customer: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [Epic 2]: Đặt xe qua nhân viên tổng đài (Staff Assisted Booking)
   * QUY TẮC P02: Không áp dụng giảm giá 15% trực tuyến!
   */
  static async createStaffBooking(req, res) {
    try {
      const {
        customerId,
        pickupAddress,
        dropoffAddress,
        pickupTime,
        service,
        vehicleCapacity,
        paymentMethod = 'CASH',
        notes,
      } = req.body;

      const customer = await AccountModel.findById(customerId);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer account not found' });
      }

      const capacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : 4;
      const quote = await ServiceModel.calculateFareAndDuration(service || 'Airport transfer', capacity);

      const baseFare = quote ? quote.fixedFare : 45.00;
      const duration = quote ? quote.occupiedDurationMinutes : 60;
      const serviceId = quote ? quote.serviceId : null;
      const serviceName = quote ? quote.serviceName : (service || 'Executive Journey');

      // Staff assisted has NO 15% discount (P02)
      const bookingCode = 'BK-STF-' + Math.floor(100000 + Math.random() * 900000);

      const booking = await BookingModel.create({
        bookingCode,
        accountId: customer.id,
        pickupAddress,
        dropoffAddress,
        pickupTime: pickupTime ? new Date(pickupTime) : new Date(),
        passengerName: customer.name,
        passengerPhone: customer.telephone,
        carType: capacity === 7 ? 'Seven-Passenger Executive MPV' : 'Four-Passenger Executive Saloon',
        fareAmount: baseFare,
        paymentMethod,
        cardRefUsed: customer.mockCardRef || 'Cash on Completion',
        status: 'CONFIRMED',
        paymentStatus: paymentMethod === 'CASH' ? 'UNPAID' : 'PAID',
        notes,
        serviceId,
        serviceName,
        vehicleCapacity: capacity,
        fareCurrency: 'GBP',
        occupiedDurationMinutes: duration,
        bookingChannel: 'STAFF_PHONE',
        baseFare: baseFare,
        discountAmount: 0.00,
        finalFare: baseFare,
      });

      res.status(201).json({
        success: true,
        message: 'Staff assisted booking confirmed successfully (Standard Table 8 Fare, No Online Discount).',
        booking,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P03]: Cập nhật trạng thái lộ trình (Journey Simulation)
   * Confirmed -> Assigned (Cần tài xế hoạt động) -> EnRoute -> Completed
   */
  static async updateJourneyStatus(req, res) {
    try {
      const bookingId = req.params.id;
      const { status, driverId, vehicleId } = req.body;

      const booking = await BookingModel.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      if (status === 'ASSIGNED') {
        if (!driverId) {
          return res.status(400).json({ success: false, message: 'Driver must be selected to move booking to ASSIGNED' });
        }
        const resolvedVehicle = vehicleId || booking.vehicle_id;
        await BookingModel.assignDriverAndVehicle(bookingId, driverId, resolvedVehicle);
      } else {
        await BookingModel.updateStatus(bookingId, status);
      }

      // [P09]: If booking becomes COMPLETED, check customer loyalty metrics!
      if (status === 'COMPLETED') {
        const completedCount = await BookingModel.countCompletedByCustomer(booking.account_id);
        if (completedCount >= 3) {
          // Check if customer already has a loyalty offer
          const existingOffers = await SpecialOfferModel.getOffersForAccount(booking.account_id);
          if (existingOffers.length === 0) {
            const promoCode = 'LOYALTY10-' + Math.floor(1000 + Math.random() * 9000);
            await SpecialOfferModel.createOffer({
              code: promoCode,
              accountId: booking.account_id,
              discountAmount: 10.00,
            });

            await NotificationModel.create({
              accountId: booking.account_id,
              bookingId: booking.id,
              title: 'Special Loyalty Reward Awarded!',
              message: `Congratulations on completing 3 journeys! Use promo code ${promoCode} for £10 off your next ride.`,
              type: 'PROMO_AWARDED',
            });

            const customer = await AccountModel.findById(booking.account_id);
            if (customer) {
              sendSpecialOfferEmail({
                toEmail: customer.email,
                name: customer.name,
                promoCode,
                discountAmount: 10.00,
              }).catch(() => {});
            }
          }
        }
      }

      const updated = await BookingModel.findById(bookingId);
      res.json({ success: true, message: `Booking status updated to ${status}`, booking: updated });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P04]: Kích hoạt thông báo xe đang đến (Approaching Vehicle Alert)
   * Chỉ được kích hoạt khi booking ở trạng thái ENROUTE. Không tạo trùng lặp.
   */
  static async sendApproachingAlert(req, res) {
    try {
      const bookingId = req.params.id;
      const booking = await BookingModel.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      if (booking.status !== 'ENROUTE') {
        return res.status(400).json({
          success: false,
          message: 'Approaching vehicle alert can only be triggered when journey is EnRoute.',
        });
      }

      if (booking.approaching_alert) {
        return res.status(400).json({
          success: false,
          message: 'Approaching vehicle alert has already been sent for this booking. Duplicate notifications prevented (P04).',
        });
      }

      await BookingModel.setApproachingAlert(bookingId);

      // Create persistent web notification in customer account
      const notif = await NotificationModel.create({
        accountId: booking.account_id,
        bookingId: booking.id,
        title: 'Chauffeur Approaching Pickup Location',
        message: `Your chauffeur ${booking.driver_name || 'Marcus'} (${booking.vehicle_reg || 'Executive Saloon'}) is approaching ${booking.pickup_address}. Please be ready.`,
        type: 'APPROACHING_VEHICLE',
      });

      res.json({
        success: true,
        message: 'Approaching vehicle alert dispatched successfully to customer dashboard.',
        notification: notif,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P03]: Nhân viên xác nhận thu tiền mặt (Confirm Cash Received)
   * Dành cho cuốc xe COMPLETED + CASH + UNPAID -> Chuyển thành PAID
   */
  static async collectCash(req, res) {
    try {
      const bookingId = req.params.id;
      const booking = await BookingModel.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      if (booking.status !== 'COMPLETED') {
        return res.status(400).json({ success: false, message: 'Cash can only be recorded for Completed bookings.' });
      }

      await BookingModel.updatePaymentStatus(bookingId, 'PAID');
      const updated = await BookingModel.findById(bookingId);

      res.json({
        success: true,
        message: 'Cash payment confirmed and recorded by staff. Receipt is now generated.',
        booking: updated,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P05]: Quản lý danh sách hoàn tiền (Refunds Queue)
   */
  static async getRefunds(req, res) {
    try {
      const refunds = await RefundModel.getPending();
      res.json({ success: true, count: refunds.length, refunds });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P05]: Xử lý hoàn tiền
   */
  static async processRefund(req, res) {
    try {
      const refundId = req.params.id;
      const staff = req.user;

      const processed = await RefundModel.processRefund(refundId, staff.id);
      if (!processed) return res.status(404).json({ success: false, message: 'Refund request not found' });

      // Update booking payment status to REFUNDED
      await BookingModel.updatePaymentStatus(processed.booking_id, 'REFUNDED');

      res.json({
        success: true,
        message: `Refund of £${processed.amount} successfully processed by Staff ${staff.name}.`,
        refund: processed,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P06]: Danh sách đội xe và tài xế
   */
  static async getFleetAndDrivers(req, res) {
    try {
      const vehicles = await VehicleModel.getAll();
      const drivers = await DriverModel.getAll();
      res.json({ success: true, vehicles, drivers });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [P08]: Báo cáo độ phổ biến của xe và mức độ trung thành của khách hàng
   */
  static async getPopularityAndLoyaltyReports(req, res) {
    try {
      const vehiclePopularity = await BookingModel.getVehiclePopularity();
      const customerLoyalty = await BookingModel.getCustomerLoyalty();

      res.json({
        success: true,
        vehiclePopularity,
        customerLoyalty,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [Epic 1]: Xem danh sách thắc mắc của khách hàng
   */
  static async getEnquiries(req, res) {
    try {
      const enquiries = await EnquiryModel.getAll();
      res.json({ success: true, count: enquiries.length, enquiries });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [Epic 1]: Nhân viên trả lời thắc mắc (Gửi email thật đến khách hàng)
   */
  static async replyEnquiry(req, res) {
    try {
      const enquiryId = req.params.id;
      const { replyText } = req.body;
      const staff = req.user;

      if (!replyText || !replyText.trim()) {
        return res.status(400).json({ success: false, message: 'Reply text is required' });
      }

      const enquiry = await EnquiryModel.reply(enquiryId, staff.id, replyText);
      if (!enquiry) return res.status(404).json({ success: false, message: 'Enquiry not found' });

      res.json({
        success: true,
        message: `Reply recorded and dispatched to ${enquiry.email}.`,
        enquiry,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [SCRUM-22]: Tra cứu tính khả dụng của xe và tài xế (Staff Availability & Quote Search)
   */
  static async checkAvailability(req, res) {
    try {
      const { pickupTime, service = 'Airport transfer', passengerCount = 1, channel = 'TELEPHONE' } = req.query;
      const count = parseInt(passengerCount, 10) || 1;
      const capacity = count > 4 ? 7 : 4;
      const pickupDate = pickupTime ? new Date(pickupTime) : new Date();

      let baseFare = 45.00;
      let durationMinutes = 90;
      let serviceName = service;

      try {
        const quote = await ServiceModel.calculateFareAndDuration(service, capacity);
        if (quote) {
          baseFare = quote.fixedFare;
          durationMinutes = quote.occupiedDurationMinutes;
          serviceName = quote.serviceName;
        }
      } catch (_) {}

      const availableVehicles = await VehicleModel.getAvailableVehicles({
        capacity,
        pickupTime: pickupDate,
        durationMinutes,
      });

      const start = pickupDate;
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

      const db = require('../config/db');
      const busyDriversRes = await db.query(
        `SELECT driver_id, pickup_time, occupied_duration_minutes
         FROM bookings
         WHERE driver_id IS NOT NULL AND status IN ('ASSIGNED', 'ENROUTE')`
      );

      const busyDriverIds = new Set();
      for (const b of busyDriversRes.rows) {
        const bStart = new Date(b.pickup_time);
        const bDuration = (parseInt(b.occupied_duration_minutes, 10) || 60) * 60 * 1000;
        const bEnd = new Date(bStart.getTime() + bDuration);

        if (start < bEnd && end > bStart) {
          busyDriverIds.add(b.driver_id);
        }
      }

      const allActiveDrivers = await DriverModel.getActiveDrivers();
      const availableDrivers = allActiveDrivers.filter(d => !busyDriverIds.has(d.id));

      res.json({
        success: true,
        quote: {
          serviceName,
          passengerCount: count,
          vehicleCapacity: capacity,
          occupiedDurationMinutes: durationMinutes,
          baseFare: parseFloat(baseFare),
          channel,
          currency: 'GBP',
          automaticOnlineDiscount: 0.00,
          finalFare: parseFloat(baseFare),
        },
        availableVehicles,
        availableDrivers,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [SCRUM-25]: Quản trị xe minicab (Add Vehicle)
   */
  static async addVehicle(req, res) {
    try {
      const { regNumber, makeModel, colour, capacity = 4, status = 'ACTIVE' } = req.body;
      if (!regNumber || !makeModel || !colour) {
        return res.status(400).json({ success: false, message: 'Registration number, make/model and colour are required' });
      }

      const cap = parseInt(capacity, 10);
      if (cap !== 4 && cap !== 7) {
        return res.status(400).json({ success: false, message: 'Vehicle capacity must be strictly 4 or 7' });
      }

      const vehicle = await VehicleModel.create({
        regNumber,
        makeModel,
        colour,
        capacity: cap,
        status: status || 'ACTIVE',
      });

      res.status(201).json({ success: true, message: 'Vehicle added to executive fleet.', vehicle });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, message: 'Vehicle registration number already exists.' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * [SCRUM-26]: Quản trị tài xế (Add Driver)
   */
  static async addDriver(req, res) {
    try {
      const { name, telephone, referenceNumber, status = 'ACTIVE' } = req.body;
      if (!name || !telephone || !referenceNumber) {
        return res.status(400).json({ success: false, message: 'Name, telephone and reference number are required' });
      }

      const driverCode = 'DRV-' + Math.floor(100 + Math.random() * 900);
      const driver = await DriverModel.create({
        driverCode,
        name,
        telephone,
        referenceNumber,
        status: status || 'ACTIVE',
      });

      res.status(201).json({ success: true, message: 'Licensed chauffeur added to system.', driver });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, message: 'Driver reference number already exists.' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = StaffController;

