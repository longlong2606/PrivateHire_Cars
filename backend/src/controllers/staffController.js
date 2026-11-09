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
   * Hỗ trợ chọn loại xe (4/7 chỗ), số lượng khách (1-7), phương thức thanh toán và áp mã voucher giảm giá.
   */
  static async createStaffBooking(req, res) {
    try {
      const {
        customerId,
        accountId,
        pickupAddress,
        dropoffAddress,
        pickupTime,
        service,
        serviceName,
        vehicleCapacity,
        passengerCount,
        paymentMethod = 'CASH',
        promoCode,
        voucherCode,
        offerCode,
        notes,
      } = req.body;

      const targetCustomerId = customerId || accountId;
      if (!targetCustomerId) {
        return res.status(400).json({ success: false, message: 'Customer ID or Account ID is required.' });
      }

      const customer = await AccountModel.findById(targetCustomerId);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer account not found' });
      }

      const pCount = passengerCount ? parseInt(passengerCount, 10) : 1;
      let capacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : (pCount > 4 ? 7 : 4);
      if (pCount > 4 && capacity < 7) {
        capacity = 7;
      }

      const requestedService = service || serviceName || 'Airport transfer';
      const quote = await ServiceModel.calculateFareAndDuration(requestedService, capacity);

      const baseFare = quote ? quote.fixedFare : (capacity === 7 ? 65.00 : 45.00);
      const duration = quote ? quote.occupiedDurationMinutes : 60;
      const serviceId = quote ? quote.serviceId : null;
      const resolvedServiceName = quote ? quote.serviceName : requestedService;

      // Staff assisted has NO 15% online discount (P02), but vouchers can be applied!
      let promoDiscount = 0.00;
      let validPromoCode = null;
      const incomingCode = (promoCode || voucherCode || offerCode || '').trim();

      if (incomingCode) {
        const offer = await SpecialOfferModel.findByCode(incomingCode);
        if (offer) {
          if (offer.is_used) {
            return res.status(400).json({ success: false, code: 'VOUCHER_ALREADY_USED', message: 'You have already used this voucher code.' });
          }
          if (offer.account_id && parseInt(offer.account_id, 10) !== parseInt(customer.id, 10)) {
            return res.status(403).json({ success: false, code: 'OFFER_DIFFERENT_CUSTOMER', message: 'This promo code was issued to another customer.' });
          }
          promoDiscount = parseFloat(offer.discount_amount);
          validPromoCode = offer.code;
          await SpecialOfferModel.markUsed(validPromoCode);
        } else if (
          incomingCode.toUpperCase().startsWith('LOYALTY') ||
          incomingCode.toUpperCase() === 'SAVE10' ||
          incomingCode.toUpperCase() === 'VIP10' ||
          incomingCode.toUpperCase() === 'WELCOME10'
        ) {
          promoDiscount = 10.00;
          validPromoCode = incomingCode.toUpperCase();
        } else {
          return res.status(400).json({ success: false, code: 'VOUCHER_NOT_FOUND', message: 'Voucher code does not exist.' });
        }
      }

      const finalFare = Math.max(0, Math.round((baseFare - promoDiscount) * 100) / 100);
      const bookingCode = 'BK-STF-' + Math.floor(100000 + Math.random() * 900000);

      const bookingNotes = notes 
        ? `${notes} | Passengers: ${pCount}` 
        : `Assisted Phone Booking | Passengers: ${pCount}`;

      const cardRef = paymentMethod === 'MOCK_CARD'
        ? (customer.mock_card_ref || customer.mockCardRef || 'CARD-ON-FILE')
        : (paymentMethod === 'INVOICE' ? 'Corporate Invoice Net-30' : 'Cash on Completion');

      const paymentStatus = paymentMethod === 'MOCK_CARD' ? 'PAID' : 'UNPAID';

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
        cardRefUsed: cardRef,
        status: 'CONFIRMED',
        paymentStatus,
        notes: bookingNotes,
        serviceId,
        serviceName: resolvedServiceName,
        vehicleCapacity: capacity,
        fareCurrency: 'GBP',
        occupiedDurationMinutes: duration,
        bookingChannel: 'STAFF_PHONE',
        baseFare: baseFare,
        discountAmount: 0.00, // No 15% online discount for staff/phone bookings
        promoCode: validPromoCode,
        promoDiscount: promoDiscount,
        finalFare: finalFare,
      });

      res.status(201).json({
        success: true,
        message: 'Staff assisted booking confirmed successfully (Standard Table 8 Fare, No Online Discount).',
        booking,
        fareBreakdown: {
          baseFare,
          onlineDiscount: 0.00,
          promoDiscount,
          finalFare,
          promoCode: validPromoCode,
        },
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
        let resolvedVehicle = vehicleId || booking.vehicle_id;
        if (!resolvedVehicle) {
          const avail = await VehicleModel.getAvailableVehicles({ capacity: booking.vehicle_capacity || 4 });
          if (avail.length > 0) {
            resolvedVehicle = avail[0].id;
          }
        }
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
      const staffNotes = (req.body && (req.body.staffNotes || req.body.notes || req.body.staff_notes || req.body.reason)) || '';

      const processed = await RefundModel.processRefund(refundId, staff.id, staffNotes);
      if (!processed) return res.status(404).json({ success: false, message: 'Refund request not found' });

      // Update booking payment status to REFUNDED
      await BookingModel.updatePaymentStatus(processed.booking_id, 'REFUNDED');

      // [Request 16]: Notify customer that refund was processed
      try {
        const booking = await BookingModel.findById(processed.booking_id);
        const bookingCode = booking ? booking.booking_code : `#${processed.booking_id}`;
        const refundAmount = parseFloat(processed.amount).toFixed(2);
        const noteDetail = staffNotes ? ` Staff Note: ${String(staffNotes).trim()}` : '';

        await NotificationModel.create({
          accountId: processed.account_id,
          bookingId: processed.booking_id,
          title: 'Refund Processed Successfully',
          message: `Your refund of £${refundAmount} GBP for journey ${bookingCode} has been approved and issued to your original payment method. Reason: ${processed.reason || 'Booking cancellation or amendment.'}.${noteDetail}`,
          type: 'REFUND_PROCESSED',
        });
      } catch (nErr) {
        console.warn('Could not create customer refund notification:', nErr.message);
      }

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
        popularVehicles: vehiclePopularity,
        customerLoyalty,
        loyalCustomers: customerLoyalty,
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
      const pickupTime = req.query.pickupTime;
      const service = req.query.service || req.query.serviceName || 'Airport transfer';
      const passengerCount = req.query.passengerCount || req.query.passengers || 1;
      const channel = req.query.channel || 'TELEPHONE';
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
        baseFare: parseFloat(baseFare),
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
      const { regNumber, makeModel, colour, capacity = 4, status = 'ACTIVE', driverId } = req.body;
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
        driverId: driverId ? parseInt(driverId, 10) : undefined,
      });

      res.status(201).json({ success: true, message: 'Vehicle added to executive fleet with linked chauffeur.', vehicle });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, message: 'Vehicle registration number already exists.' });
      }
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Phân công tài xế cho xe
   */
  static async assignVehicleDriver(req, res) {
    try {
      const vehicleId = parseInt(req.params.id, 10);
      const { driverId } = req.body;
      if (!driverId) {
        return res.status(400).json({ success: false, message: 'driverId is required' });
      }

      const vehicle = await VehicleModel.assignDriver(vehicleId, parseInt(driverId, 10));
      res.json({ success: true, message: 'Chauffeur successfully assigned to vehicle.', vehicle });
    } catch (error) {
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

  /**
   * Xác thực mã giảm giá cho màn hình Phone Booking Desk
   */
  static async verifyPromoCode(req, res) {
    try {
      const { code, customerId } = req.body;
      if (!code || !code.trim()) {
        return res.status(400).json({ success: false, message: 'Please provide a promo or voucher code.' });
      }
      const incomingCode = code.trim();
      const offer = await SpecialOfferModel.findByCode(incomingCode);

      if (offer) {
        if (offer.is_used) {
          return res.status(400).json({
            success: false,
            valid: false,
            code: 'VOUCHER_ALREADY_USED',
            message: 'You have already used this voucher code.',
          });
        }
        if (offer.account_id && customerId && parseInt(offer.account_id, 10) !== parseInt(customerId, 10)) {
          return res.status(403).json({
            success: false,
            valid: false,
            code: 'OFFER_DIFFERENT_CUSTOMER',
            message: 'This promo code was issued to another customer.',
          });
        }
        return res.json({
          success: true,
          valid: true,
          discountAmount: parseFloat(offer.discount_amount),
          code: offer.code,
          message: `Special voucher applied! £${parseFloat(offer.discount_amount).toFixed(2)} discount.`,
        });
      }

      if (
        incomingCode.toUpperCase().startsWith('LOYALTY') ||
        incomingCode.toUpperCase() === 'SAVE10' ||
        incomingCode.toUpperCase() === 'VIP10' ||
        incomingCode.toUpperCase() === 'WELCOME10'
      ) {
        return res.json({
          success: true,
          valid: true,
          discountAmount: 10.00,
          code: incomingCode.toUpperCase(),
          message: 'Promotional code verified! £10.00 discount applied.',
        });
      }

      return res.status(400).json({
        success: false,
        valid: false,
        code: 'VOUCHER_NOT_FOUND',
        message: 'Voucher code does not exist.',
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  /**
   * Lấy danh sách toàn bộ tài khoản với đầy đủ thông tin các fields trong database
   */
  static async getAllAccounts(req, res) {
    try {
      const accounts = await AccountModel.findAll();
      res.status(200).json({
        success: true,
        count: accounts.length,
        accounts,
        data: accounts,
      });
    } catch (error) {
      console.error('Error in getAllAccounts:', error);
      res.status(500).json({ success: false, message: 'Server error retrieving accounts', error: error.message });
    }
  }

  /**
   * Chỉnh sửa quyền (role) của tài khoản - CHỈ DÀNH CHO ADMIN
   */
  static async updateAccountRole(req, res) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      // 1. Kiểm tra quyền của người gửi request: Phải có role ADMIN hoặc thuộc danh sách Admin Emails
      const requesterRole = (req.user && req.user.role ? req.user.role.toUpperCase() : '');
      const requesterEmail = (req.user && req.user.email ? req.user.email.toLowerCase() : '');
      const adminEmails = ['longhvn2006@gmail.com', 'nguyennhanduc20345@gmail.com'];
      const isAdmin = requesterRole === 'ADMIN' || adminEmails.includes(requesterEmail);

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN_ADMIN_ONLY',
          message: 'Access denied: Only users with the ADMIN role can modify account roles.',
        });
      }

      // 2. Validate role mới
      const validRoles = ['CUSTOMER', 'STAFF', 'ADMIN'];
      const targetRole = (role || '').toUpperCase().trim();
      if (!validRoles.includes(targetRole)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role "${role}". Allowed roles are: ${validRoles.join(', ')}`,
        });
      }

      // 3. Cập nhật role vào PostgreSQL
      const updatedAccount = await AccountModel.updateRole(id, targetRole);
      if (!updatedAccount) {
        return res.status(404).json({ success: false, message: 'Account not found' });
      }

      res.status(200).json({
        success: true,
        message: `Account #${id} role successfully updated to ${targetRole}.`,
        account: updatedAccount,
      });
    } catch (error) {
      console.error('Error updating account role:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = StaffController;

