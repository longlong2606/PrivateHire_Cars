const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');
const BookingDraftModel = require('../models/bookingDraftModel');
const VehicleModel = require('../models/vehicleModel');
const DriverModel = require('../models/driverModel');
const SpecialOfferModel = require('../models/specialOfferModel');
const RefundModel = require('../models/refundModel');
const NotificationModel = require('../models/notificationModel');
const { sendBookingConfirmationEmail, sendSpecialOfferEmail } = require('../services/emailService');

/**
 * [BOOKING]: Tạo cuốc xe trực tuyến mới (P02, P03)
 * Hỗ trợ 15% giảm giá Online tự động và mã ưu đãi đặc biệt
 */
const createBooking = async (req, res) => {
  try {
    const customer = req.user;
    if (!customer) {
      return res.status(401).json({
        success: false,
        code: 'VISITOR_BLOCKED',
        message: 'Visitors cannot submit online bookings. Please sign in or register first.',
      });
    }

    const {
      pickupAddress,
      dropoffAddress,
      pickupTime,
      carType,
      fareAmount,
      service,
      serviceId,
      serviceCode,
      serviceName,
      vehicleCapacity,
      notes,
      paymentMethod,
      promoCode,
      status = 'CONFIRMED',
      paymentStatus,
    } = req.body;

    if (!pickupAddress || !pickupAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Pickup address is required to book a car',
      });
    }

    if (!dropoffAddress || !dropoffAddress.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Dropoff destination address is required',
      });
    }

    // 1. Tính giá gốc theo Table 8
    let resolvedServiceId = serviceId || null;
    let resolvedServiceName = serviceName || null;
    let resolvedCapacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : 4;
    let resolvedCurrency = 'GBP';
    let resolvedDuration = 60;
    let baseFare = fareAmount;

    const serviceKey = service || serviceId || serviceCode || serviceName;
    if (serviceKey) {
      try {
        const quote = await ServiceModel.calculateFareAndDuration(serviceKey, resolvedCapacity);
        if (quote) {
          resolvedServiceId = quote.serviceId;
          resolvedServiceName = quote.serviceName;
          resolvedCapacity = quote.vehicleCapacity;
          resolvedDuration = quote.occupiedDurationMinutes;
          resolvedCurrency = quote.currency;
          if (baseFare === undefined || baseFare === null) {
            baseFare = quote.fixedFare;
          }
        }
      } catch (_) {}
    }

    if (baseFare === undefined || baseFare === null) {
      baseFare = 45.00;
    }

    // 2. [P02]: 15% Automatic Online Discount
    const onlineDiscount = Math.round(baseFare * 0.15 * 100) / 100;

    // 3. [P09]: Special Offer Promo Code Deduction (applied after 15% discount)
    let promoDiscount = 0.00;
    let validPromoCode = null;
    if (promoCode) {
      const offer = await SpecialOfferModel.findByCode(promoCode);
      if (offer && offer.account_id === customer.id && !offer.is_used) {
        promoDiscount = parseFloat(offer.discount_amount);
        validPromoCode = offer.code;
      }
    }

    // Total cannot be negative (P02)
    const finalFare = Math.max(0, Math.round((baseFare - onlineDiscount - promoDiscount) * 100) / 100);

    // 4. [P02]: Check vehicle availability
    const pickupDate = pickupTime ? new Date(pickupTime) : new Date();
    const availableVehicles = await VehicleModel.getAvailableVehicles({
      capacity: resolvedCapacity,
      pickupTime: pickupDate,
      durationMinutes: resolvedDuration,
    });

    let assignedVehicleId = null;
    let assignedDriverId = null;
    if (availableVehicles.length > 0) {
      assignedVehicleId = availableVehicles[0].id;
      assignedDriverId = availableVehicles[0].driver_id || null;
    }

    // 5. Booking Code (e.g. BK-841920)
    const bookingCode = 'BK-' + Math.floor(100000 + Math.random() * 900000);

    // Default payment status based on method & request
    const resolvedPaymentMethod = paymentMethod || 'MOCK_CARD';
    const resolvedPaymentStatus = paymentStatus || (resolvedPaymentMethod === 'CASH' ? 'UNPAID' : 'PAID');

    // 6. Lưu cuốc xe
    const booking = await BookingModel.create({
      bookingCode,
      accountId: customer.id,
      pickupAddress: pickupAddress.trim(),
      dropoffAddress: dropoffAddress.trim(),
      pickupTime: pickupDate,
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      carType: carType || (resolvedCapacity === 7 ? 'Seven-Passenger Executive MPV' : 'Four-Passenger Executive Saloon'),
      fareAmount: baseFare,
      paymentMethod: resolvedPaymentMethod,
      cardRefUsed: customer.mockCardRef || '•••• •••• •••• 4242 (Visa Test Card)',
      status: status,
      paymentStatus: resolvedPaymentStatus,
      notes: notes || null,
      serviceId: resolvedServiceId,
      serviceName: resolvedServiceName,
      vehicleCapacity: resolvedCapacity,
      fareCurrency: resolvedCurrency,
      occupiedDurationMinutes: resolvedDuration,
      bookingChannel: 'ONLINE',
      baseFare: baseFare,
      discountAmount: onlineDiscount,
      promoCode: validPromoCode,
      promoDiscount: promoDiscount,
      finalFare: finalFare,
      vehicleId: assignedVehicleId,
      driverId: assignedDriverId,
    });

    // Mark promo offer as used if booking is confirmed
    if (validPromoCode && status === 'CONFIRMED') {
      await SpecialOfferModel.markUsed(validPromoCode).catch(() => {});
    }

    // [P04]: Send real booking confirmation email if status is Confirmed
    if (status === 'CONFIRMED') {
      sendBookingConfirmationEmail({
        toEmail: customer.email,
        name: customer.name,
        bookingCode: booking.booking_code,
        pickupAddress: booking.pickup_address,
        dropoffAddress: booking.dropoff_address,
        pickupTime: booking.pickup_time,
        serviceName: booking.service_name || 'Executive Journey',
        vehicleCapacity: booking.vehicle_capacity || 4,
        fareAmount: booking.final_fare || booking.fare_amount,
        paymentMethod: booking.payment_method,
        paymentStatus: booking.payment_status,
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Booking submitted successfully! Chauffeur is assigned.',
      booking: {
        id: booking.id,
        bookingCode: booking.booking_code,
        accountId: booking.account_id,
        passengerName: booking.passenger_name,
        passengerPhone: booking.passenger_phone,
        pickupAddress: booking.pickup_address,
        dropoffAddress: booking.dropoff_address,
        pickupTime: booking.pickup_time,
        serviceId: booking.service_id,
        serviceName: booking.service_name,
        vehicleCapacity: booking.vehicle_capacity,
        carType: booking.car_type,
        baseFare: booking.base_fare,
        onlineDiscount: booking.discount_amount,
        promoDiscount: booking.promo_discount,
        fareAmount: booking.fare_amount,
        finalFare: booking.final_fare,
        fareCurrency: booking.fare_currency || 'GBP',
        occupiedDurationMinutes: booking.occupied_duration_minutes,
        paymentMethod: booking.payment_method,
        paymentStatus: booking.payment_status,
        cardRefUsed: booking.card_ref_used,
        status: booking.status,
        vehicleId: booking.vehicle_id,
        createdAt: booking.created_at,
      },
    });

    // Form State Persistence: Clear draft state upon confirmed booking
    const draftToken = req.body?.draftToken || req.headers?.['x-draft-token'] || `usr-${customer.id}`;
    await BookingDraftModel.deleteDraft({ accountId: customer.id, draftToken }).catch(() => {});
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting booking',
      error: error.message,
    });
  }
};

/**
 * [P03]: Mô phỏng thanh toán (Simulated Electronic Payment & Cash Confirmation)
 * Hỗ trợ Visa, Mastercard, Amex, PayPal và Cash với 2 nhánh: Success và Fail (Visa check fail)
 */
const simulatePayment = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { paymentMethod = 'CARD', simulationResult = 'SUCCESS' } = req.body;
    const customer = req.user;

    const booking = await BookingModel.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.account_id !== customer.id) {
      return res.status(403).json({ success: false, message: 'Forbidden access' });
    }

    // Branch 1: Simulated Payment Failure (e.g. Visa Check / Card Declined)
    if (simulationResult === 'FAIL') {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_DECLINED',
        message: 'Simulated payment declined by card issuer / bank gateway. Please try another card or payment method.',
      });
    }

    // Branch 2: Simulated Payment Success
    const isCash = paymentMethod === 'CASH';
    const newPaymentStatus = isCash ? 'UNPAID' : 'PAID';
    const newStatus = 'CONFIRMED';

    // Reserve vehicle if not yet assigned
    let vehicleId = booking.vehicle_id;
    if (!vehicleId) {
      const avail = await VehicleModel.getAvailableVehicles({
        capacity: booking.vehicle_capacity || 4,
        pickupTime: booking.pickup_time,
        durationMinutes: booking.occupied_duration_minutes || 60,
      });
      if (avail.length > 0) vehicleId = avail[0].id;
    }

    await BookingModel.updateStatus(bookingId, newStatus);
    await BookingModel.updatePaymentStatus(bookingId, newPaymentStatus);

    if (vehicleId) {
      const db = require('../config/db');
      await db.query('UPDATE bookings SET vehicle_id = $1 WHERE id = $2', [vehicleId, bookingId]);
    }

    // If promo code was used, mark it used
    if (booking.promo_code) {
      await SpecialOfferModel.markUsed(booking.promo_code).catch(() => {});
    }

    // Send real confirmation email
    sendBookingConfirmationEmail({
      toEmail: customer.email,
      name: customer.name,
      bookingCode: booking.booking_code,
      pickupAddress: booking.pickup_address,
      dropoffAddress: booking.dropoff_address,
      pickupTime: booking.pickup_time,
      serviceName: booking.service_name || 'Executive Journey',
      vehicleCapacity: booking.vehicle_capacity || 4,
      fareAmount: booking.final_fare || booking.fare_amount,
      paymentMethod: paymentMethod,
      paymentStatus: newPaymentStatus,
    }).catch(() => {});

    const updated = await BookingModel.findById(bookingId);

    res.json({
      success: true,
      message: isCash 
        ? 'Cash payment chosen. Booking is Confirmed and reserved. Please pay driver upon journey completion.' 
        : 'Payment successfully simulated and accepted! Booking Confirmed.',
      booking: updated,
    });
  } catch (error) {
    console.error('Error in simulatePayment:', error);
    res.status(500).json({ success: false, message: 'Server error simulating payment', error: error.message });
  }
};

/**
 * [P05]: Chỉnh sửa cuốc xe (Amend Booking)
 * Điều kiện: Trước giờ đón ít nhất 24 giờ. Trạng thái chỉ được là Pending, Confirmed hoặc Assigned.
 */
const amendBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const customer = req.user;
    const { pickupAddress, dropoffAddress, pickupTime, service, vehicleCapacity } = req.body;

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.account_id !== customer.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    // Status check
    const allowedStatuses = ['PENDING', 'CONFIRMED', 'ASSIGNED'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot amend booking with status "${booking.status}". Only Pending, Confirmed, or Assigned bookings can be amended.`,
      });
    }

    // 24-hour notice check
    const now = new Date();
    const currentPickup = new Date(booking.pickup_time);
    const hoursDiff = (currentPickup.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
      return res.status(400).json({
        success: false,
        message: 'Amendments must be made at least 24 hours prior to scheduled pickup time.',
      });
    }

    // Recalculate fare
    const resolvedCapacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : booking.vehicle_capacity;
    let baseFare = booking.base_fare;
    let resolvedService = service || booking.service_name;
    let duration = booking.occupied_duration_minutes;
    let serviceId = booking.service_id;

    if (service || vehicleCapacity) {
      const quote = await ServiceModel.calculateFareAndDuration(resolvedService, resolvedCapacity);
      if (quote) {
        baseFare = quote.fixedFare;
        duration = quote.occupiedDurationMinutes;
        serviceId = quote.serviceId;
        resolvedService = quote.serviceName;
      }
    }

    const discountAmount = Math.round(baseFare * 0.15 * 100) / 100;
    const finalFare = Math.max(0, Math.round((baseFare - discountAmount - (booking.promo_discount || 0)) * 100) / 100);

    // If new fare is lower than old fare and customer has paid, create a refund request for the difference
    if (booking.payment_status === 'PAID' && finalFare < parseFloat(booking.final_fare || booking.fare_amount)) {
      const diff = parseFloat(booking.final_fare || booking.fare_amount) - finalFare;
      await RefundModel.create({
        bookingId: booking.id,
        accountId: customer.id,
        amount: diff,
        reason: `Amendment fare reduction for ${booking.booking_code}`,
      });
    }

    const updated = await BookingModel.amendBooking(bookingId, {
      pickupAddress: pickupAddress || booking.pickup_address,
      dropoffAddress: dropoffAddress || booking.dropoff_address,
      pickupTime: pickupTime ? new Date(pickupTime) : booking.pickup_time,
      serviceId,
      serviceName: resolvedService,
      vehicleCapacity: resolvedCapacity,
      baseFare,
      discountAmount,
      finalFare,
      occupiedDurationMinutes: duration,
    });

    res.json({
      success: true,
      message: 'Booking amended successfully with recalculated Table 8 fare and 15% online discount.',
      booking: updated,
    });
  } catch (error) {
    console.error('Error in amendBooking:', error);
    res.status(500).json({ success: false, message: 'Server error amending booking', error: error.message });
  }
};

/**
 * [P05]: Hủy cuốc xe (Cancel Booking)
 * Điều kiện: Trước giờ đón ít nhất 24 giờ. Trạng thái chỉ được là Pending, Confirmed hoặc Assigned.
 */
const cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const customer = req.user;
    const { reason = 'Customer requested cancellation' } = req.body;

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.account_id !== customer.id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const allowedStatuses = ['PENDING', 'CONFIRMED', 'ASSIGNED'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status "${booking.status}". Only Pending, Confirmed, or Assigned bookings can be cancelled.`,
      });
    }

    const now = new Date();
    const currentPickup = new Date(booking.pickup_time);
    const hoursDiff = (currentPickup.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
      return res.status(400).json({
        success: false,
        message: 'Cancellations must be made at least 24 hours prior to scheduled pickup time.',
      });
    }

    // Cancel booking and free vehicle & driver
    const cancelled = await BookingModel.cancelBooking(bookingId);

    // If customer paid, create a pending refund request for net paid amount
    let refundCreated = false;
    if (booking.payment_status === 'PAID') {
      const netAmount = parseFloat(booking.final_fare || booking.fare_amount);
      await RefundModel.create({
        bookingId: booking.id,
        accountId: customer.id,
        amount: netAmount,
        reason: `Cancellation refund: ${reason}`,
      });
      refundCreated = true;
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully. Resources freed.',
      booking: cancelled,
      refundCreated,
    });
  } catch (error) {
    console.error('Error in cancelBooking:', error);
    res.status(500).json({ success: false, message: 'Server error cancelling booking', error: error.message });
  }
};

/**
 * [P03]: Lấy biên lai thanh toán (Printable Receipt)
 * Chỉ hiển thị sau khi đã thanh toán (Electronic Success hoặc Staff Cash Collection)
 */
const getPrintableReceipt = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const customer = req.user;

    const booking = await BookingModel.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.account_id !== customer.id && customer.role !== 'STAFF') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (booking.payment_status !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Receipt is available only after payment has been completed.',
      });
    }

    const netAmount = parseFloat(booking.final_fare || booking.fare_amount);
    const vat = Math.round(netAmount * 0.20 * 100) / 100;
    const totalWithVat = netAmount;

    res.json({
      success: true,
      receipt: {
        receiptNumber: `REC-${booking.booking_code}`,
        issuedAt: new Date().toISOString(),
        customer: {
          name: booking.passenger_name,
          phone: booking.passenger_phone,
        },
        journey: {
          bookingCode: booking.booking_code,
          service: booking.service_name,
          pickupAddress: booking.pickup_address,
          dropoffAddress: booking.dropoff_address,
          pickupTime: booking.pickup_time,
          vehicleCapacity: booking.vehicle_capacity,
          vehicleReg: booking.vehicle_reg || 'PrivateHire Chauffeur Saloon',
          driverName: booking.driver_name || 'Assigned Executive Chauffeur',
        },
        pricing: {
          baseFare: parseFloat(booking.base_fare || booking.fare_amount),
          onlineDiscount: parseFloat(booking.discount_amount || 0.00),
          promoDiscount: parseFloat(booking.promo_discount || 0.00),
          netPaid: netAmount,
          currency: booking.fare_currency || 'GBP',
          vatIncluded: vat,
          paymentMethod: booking.payment_method,
          cardRefUsed: booking.card_ref_used,
        },
      },
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    res.status(500).json({ success: false, message: 'Server error generating receipt', error: error.message });
  }
};

/**
 * [P09]: Kiểm tra mã giảm giá (Validate Promo Code)
 */
const validatePromoCode = async (req, res) => {
  try {
    const { code } = req.query;
    const customer = req.user;

    if (!code) return res.status(400).json({ success: false, message: 'Code is required' });

    const offer = await SpecialOfferModel.findByCode(code);
    if (!offer) {
      return res.status(404).json({ success: false, valid: false, message: 'Promo code does not exist or has expired.' });
    }

    if (offer.account_id !== customer.id) {
      return res.status(403).json({ success: false, valid: false, message: 'This promo code was issued to another customer.' });
    }

    if (offer.is_used) {
      return res.status(400).json({ success: false, valid: false, message: 'Promo code has already been used.' });
    }

    res.json({
      success: true,
      valid: true,
      code: offer.code,
      discountAmount: parseFloat(offer.discount_amount),
      message: `Code applied! £${parseFloat(offer.discount_amount).toFixed(2)} discount will be deducted from your total.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMyBookings = async (req, res) => {
  try {
    const customer = req.user;
    const bookings = await BookingModel.findByAccountId(customer.id);
    res.json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error('Error in getMyBookings:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving bookings', error: error.message });
  }
};

const getBookingById = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await BookingModel.findById(bookingId);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.account_id !== req.user.id && req.user.role !== 'STAFF') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_ACCESS',
        message: 'Access denied: Customers can access only their own protected information.',
      });
    }

    res.json({ success: true, booking });
  } catch (error) {
    console.error('Error in getBookingById:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving booking', error: error.message });
  }
};

const saveBookingDraft = async (req, res) => {
  try {
    const customer = req.user || null;
    const {
      draftToken,
      pickupAddress,
      dropoffAddress,
      service,
      serviceId,
      serviceName,
      vehicleCapacity,
      carType,
      notes,
      fareAmount,
      formMetadata,
    } = req.body;

    const token = draftToken || req.headers?.['x-draft-token'] || (customer ? `usr-${customer.id}` : `vst-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);

    let resolvedFare = fareAmount;
    let resolvedServiceId = serviceId || null;
    let resolvedServiceName = serviceName || null;
    let resolvedCapacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : 4;
    let resolvedDuration = 60;
    let resolvedCurrency = 'GBP';

    const serviceKey = service || serviceId || serviceName;
    if (serviceKey) {
      try {
        const quote = await ServiceModel.calculateFareAndDuration(serviceKey, resolvedCapacity);
        if (quote) {
          resolvedServiceId = quote.serviceId;
          resolvedServiceName = quote.serviceName;
          resolvedCapacity = quote.vehicleCapacity;
          resolvedDuration = quote.occupiedDurationMinutes;
          resolvedCurrency = quote.currency;
          if (resolvedFare === undefined || resolvedFare === null) {
            resolvedFare = quote.fixedFare;
          }
        }
      } catch (_) {}
    }

    const draft = await BookingDraftModel.saveDraft({
      accountId: customer ? customer.id : null,
      draftToken: token,
      pickupAddress,
      dropoffAddress,
      serviceId: resolvedServiceId,
      serviceName: resolvedServiceName,
      vehicleCapacity: resolvedCapacity,
      fareAmount: resolvedFare,
      fareCurrency: resolvedCurrency,
      occupiedDurationMinutes: resolvedDuration,
      carType: carType || (resolvedCapacity === 7 ? 'Seven-Passenger Executive MPV' : 'Four-Passenger Executive Saloon'),
      notes,
      formMetadata,
    });

    res.status(200).json({
      success: true,
      message: 'Booking form state persisted successfully',
      draftToken: token,
      draft: {
        id: draft.id,
        draftToken: draft.draft_token,
        accountId: draft.account_id,
        pickupAddress: draft.pickup_address,
        dropoffAddress: draft.dropoff_address,
        serviceName: draft.service_name,
        vehicleCapacity: draft.vehicle_capacity,
        fareAmount: draft.fare_amount,
        fareCurrency: draft.fare_currency,
        occupiedDurationMinutes: draft.occupied_duration_minutes,
        carType: draft.car_type,
        notes: draft.notes,
        updatedAt: draft.updated_at,
      },
    });
  } catch (error) {
    console.error('Error in saveBookingDraft:', error);
    res.status(500).json({ success: false, message: 'Server error saving booking form state', error: error.message });
  }
};

const getBookingDraft = async (req, res) => {
  try {
    const customer = req.user || null;
    const draftToken = req.query?.draftToken || req.headers?.['x-draft-token'] || (customer ? `usr-${customer.id}` : null);

    const draft = await BookingDraftModel.getDraft({
      accountId: customer ? customer.id : null,
      draftToken,
    });

    res.status(200).json({
      success: true,
      hasDraft: !!draft,
      draft: draft ? {
        id: draft.id,
        draftToken: draft.draft_token,
        accountId: draft.account_id,
        pickupAddress: draft.pickup_address,
        dropoffAddress: draft.dropoff_address,
        serviceName: draft.service_name,
        vehicleCapacity: draft.vehicle_capacity,
        fareAmount: draft.fare_amount,
        fareCurrency: draft.fare_currency,
        occupiedDurationMinutes: draft.occupied_duration_minutes,
        carType: draft.car_type,
        notes: draft.notes,
        updatedAt: draft.updated_at,
      } : null,
    });
  } catch (error) {
    console.error('Error in getBookingDraft:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving booking form state', error: error.message });
  }
};

const clearBookingDraft = async (req, res) => {
  try {
    const customer = req.user || null;
    const draftToken = req.query?.draftToken || req.body?.draftToken || req.headers?.['x-draft-token'] || (customer ? `usr-${customer.id}` : null);

    await BookingDraftModel.deleteDraft({
      accountId: customer ? customer.id : null,
      draftToken,
    });

    res.status(200).json({
      success: true,
      message: 'Booking draft cleared successfully',
    });
  } catch (error) {
    console.error('Error in clearBookingDraft:', error);
    res.status(500).json({ success: false, message: 'Server error clearing booking draft', error: error.message });
  }
};

/**
 * [SCRUM-12]: Kiểm tra xe khả dụng theo thời gian và sức chứa (Check Vehicle Availability)
 */
const checkVehicleAvailability = async (req, res) => {
  try {
    const { pickupTime, service, vehicleCapacity = 4 } = req.query;
    const capacity = parseInt(vehicleCapacity, 10) || 4;

    let durationMinutes = 60;
    if (service) {
      try {
        const quote = await ServiceModel.calculateFareAndDuration(service, capacity);
        if (quote) durationMinutes = quote.occupiedDurationMinutes;
      } catch (_) {}
    }

    const pickupDate = pickupTime ? new Date(pickupTime) : new Date();
    const available = await VehicleModel.getAvailableVehicles({
      capacity,
      pickupTime: pickupDate,
      durationMinutes,
    });

    res.json({
      success: true,
      count: available.length,
      durationMinutes,
      pickupTime: pickupDate.toISOString(),
      vehicles: available,
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
