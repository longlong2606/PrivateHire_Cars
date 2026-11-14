const BookingModel = require('../models/bookingModel');
const AccountModel = require('../models/accountModel');
const ServiceModel = require('../models/serviceModel');
const BookingDraftModel = require('../models/bookingDraftModel');
const VehicleModel = require('../models/vehicleModel');
const DriverModel = require('../models/driverModel');
const SpecialOfferModel = require('../models/specialOfferModel');
const RefundModel = require('../models/refundModel');
const NotificationModel = require('../models/notificationModel');
const db = require('../config/db');
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
      passengerCount,
      passengers,
      pax,
      vehicleId,
      notes,
      paymentMethod,
      promoCode,
      offerCode,
      voucherCode,
      channel,
      status = 'PENDING',
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

    // 1. [Point 4]: Kiểm tra tính hợp lệ của số lượng hành khách (từ chối 0, số âm, số lẻ; không tự đổi 0 hoặc 1.5 thành 1)
    const rawPax = passengerCount !== undefined ? passengerCount : (passengers !== undefined ? passengers : (pax !== undefined ? pax : undefined));
    let numPax = 1;
    if (rawPax !== undefined && rawPax !== null && rawPax !== '') {
      numPax = Number(rawPax);
      if (isNaN(numPax) || !Number.isInteger(numPax) || numPax < 1) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PASSENGER_COUNT',
          message: 'Passenger count must be a positive whole integer (at least 1). Decimals, zero, and negative numbers are not permitted.',
        });
      }
      if (numPax > 7) {
        return res.status(400).json({
          success: false,
          code: 'EXCEEDS_MAX_PASSENGERS',
          message: 'Maximum passenger capacity across our entire executive fleet is 7 passengers.',
        });
      }
    }
    const resolvedPassengers = numPax;

    // [Point 3]: Đồng bộ xe được chọn, capacity class và bảng giá
    let selectedVehicle = null;
    let resolvedCapacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : (resolvedPassengers > 4 ? 7 : 4);

    if (vehicleId) {
      const vLookup = await db.query(`
        SELECT v.*, d.name AS driver_name, d.status AS driver_status, d.telephone AS driver_phone, d.reference_number AS driver_ref, d.driver_code
        FROM vehicles v
        LEFT JOIN drivers d ON v.driver_id = d.id
        WHERE v.id = $1
      `, [vehicleId]);
      if (vLookup.rows.length === 0 || vLookup.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          code: 'VEHICLE_NOT_AVAILABLE',
          message: 'Selected vehicle is not available or inactive.',
        });
      }
      selectedVehicle = vLookup.rows[0];
      // Khách chọn xe thực tế: đồng bộ capacity class theo xe thực tế
      resolvedCapacity = selectedVehicle.capacity;
    }

    if (resolvedPassengers > resolvedCapacity) {
      return res.status(400).json({
        success: false,
        code: 'PASSENGERS_EXCEED_CAPACITY',
        message: `Passenger count (${resolvedPassengers}) exceeds the selected vehicle capacity class (${resolvedCapacity} seats). Please select a 7-passenger MPV.`,
      });
    }

    // 2. [Point 2]: Tính giá backend chính thức theo Table 8 (Không nhận giá client)
    let resolvedServiceId = serviceId || null;
    let resolvedServiceName = serviceName || null;
    let resolvedCurrency = 'GBP';
    let resolvedDuration = 60;
    let baseFare = null;

    const serviceKey = service || serviceId || serviceCode || serviceName || 'Airport transfer';
    const quote = await ServiceModel.calculateFareAndDuration(serviceKey, resolvedCapacity);
    if (quote) {
      resolvedServiceId = quote.serviceId;
      resolvedServiceName = quote.serviceName;
      resolvedCapacity = quote.vehicleCapacity;
      resolvedDuration = quote.occupiedDurationMinutes;
      resolvedCurrency = quote.currency;
      baseFare = quote.fixedFare;
    } else {
      baseFare = resolvedCapacity === 7 ? 65.00 : 45.00;
    }

    // Channel check (Point 8): Chỉ kênh ONLINE mới tự động giảm 15%
    const bookingChannel = (channel || 'ONLINE').toUpperCase();
    const onlineDiscount = bookingChannel === 'ONLINE' ? Math.round(baseFare * 0.15 * 100) / 100 : 0.00;

    // 3. [P09]: Special Offer Promo Code Deduction (applied after 15% discount)
    let promoDiscount = 0.00;
    let validPromoCode = null;
    let validVoucherId = null;
    const incomingCode = (promoCode || offerCode || voucherCode || '').trim();
    if (incomingCode) {
      const offer = await SpecialOfferModel.findByCode(incomingCode.toUpperCase());
      if (!offer) {
        return res.status(400).json({
          success: false,
          code: 'VOUCHER_NOT_FOUND',
          message: 'Voucher code does not exist.',
        });
      }
      if (offer.is_used) {
        return res.status(400).json({
          success: false,
          code: 'VOUCHER_ALREADY_USED',
          message: 'You have already used this voucher code.',
        });
      }
      if (offer.account_id) {
        if (!customer) {
          return res.status(403).json({
            success: false,
            code: 'AUTH_REQUIRED_FOR_VOUCHER',
            message: 'This voucher code is assigned to a specific customer account. Please log in to use your voucher.',
          });
        }
        if (parseInt(offer.account_id, 10) !== parseInt(customer.id, 10)) {
          return res.status(403).json({
            success: false,
            code: 'OFFER_DIFFERENT_CUSTOMER',
            message: 'You are not eligible to use this voucher code. This code belongs to another account.',
          });
        }
      }
      promoDiscount = parseFloat(offer.discount_amount);
      validPromoCode = offer.code;
      validVoucherId = offer.id;
    }

    // Total cannot be negative (P02)
    const finalFare = Math.max(0, Math.round((baseFare - onlineDiscount - promoDiscount) * 100) / 100);

    // 4. [P02]: Check vehicle availability
    let pickupDate = new Date();
    if (pickupTime) {
      if (typeof pickupTime === 'string' && pickupTime.length === 16 && !pickupTime.includes('Z') && !pickupTime.includes('+')) {
        pickupDate = new Date(`${pickupTime}:00.000Z`);
      } else {
        pickupDate = new Date(pickupTime);
      }
    } else {
      // Default to 1 hour in future if not provided
      pickupDate = new Date(Date.now() + 60 * 60 * 1000);
    }

    if (pickupDate.getTime() < Date.now() - 60000) {
      return res.status(400).json({
        success: false,
        code: 'PAST_PICKUP_TIME',
        message: 'Pickup time must be in the future.',
      });
    }

    const requestedStatus = status ? status.toUpperCase() : 'PENDING';
    const isDirectConfirmed = requestedStatus === 'CONFIRMED';

    // Verify Vehicle & Driver from DB
    let assignedVehicleId = null;
    let requestedDriverId = null;

    // Check if updating existing pending booking
    const pendingBookingId = req.body.pendingBookingId ? parseInt(req.body.pendingBookingId, 10) : null;
    let existingPending = null;
    if (pendingBookingId) {
      const pRow = await BookingModel.findById(pendingBookingId);
      if (pRow && pRow.account_id === customer.id && pRow.status === 'PENDING') {
        existingPending = pRow;
      }
    }

    const excludeId = existingPending ? existingPending.id : null;

    if (selectedVehicle) {
      const veh = selectedVehicle;
      if (veh.capacity < resolvedPassengers) {
        return res.status(400).json({
          success: false,
          code: 'PASSENGERS_EXCEED_CAPACITY',
          message: `Vehicle capacity (${veh.capacity} seats) is insufficient for ${resolvedPassengers} passengers.`,
        });
      }

      if (veh.driver_status && veh.driver_status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          code: 'DRIVER_NOT_ACTIVE',
          message: 'Chauffeur assigned to this vehicle is currently unavailable.',
        });
      }

      const hasVConflict = await BookingModel.hasVehicleConflict({
        vehicleId: veh.id,
        pickupTime: pickupDate,
        durationMinutes: resolvedDuration,
        excludeBookingId: excludeId,
      });
      if (hasVConflict) {
        return res.status(400).json({
          success: false,
          code: 'VEHICLE_CONFLICT',
          message: 'Selected vehicle has an overlapping booking for this time slot.',
        });
      }

      if (veh.driver_id) {
        const hasDConflict = await BookingModel.hasDriverConflict({
          driverId: veh.driver_id,
          pickupTime: pickupDate,
          durationMinutes: resolvedDuration,
          excludeBookingId: excludeId,
        });
        if (hasDConflict) {
          return res.status(400).json({
            success: false,
            code: 'DRIVER_CONFLICT',
            message: 'Chauffeur for this vehicle has an overlapping booking for this time slot.',
          });
        }
      }

      assignedVehicleId = veh.id;
      requestedDriverId = veh.driver_id || null;
    } else {
      const availableVehicles = await VehicleModel.getAvailableVehicles({
        capacity: resolvedCapacity,
        pickupTime: pickupDate,
        durationMinutes: resolvedDuration,
        excludeBookingId: excludeId,
      });

      if (availableVehicles.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'NO_VEHICLES_AVAILABLE',
          message: 'No available vehicles found for the requested time slot and capacity.',
        });
      }

      assignedVehicleId = availableVehicles[0].id;
      requestedDriverId = availableVehicles[0].driver_id || null;
    }

    const assignedDriverId = isDirectConfirmed ? requestedDriverId : null;
    const finalBookingStatus = isDirectConfirmed ? 'CONFIRMED' : 'PENDING';
    const resolvedPaymentMethod = paymentMethod || 'MOCK_CARD';
    const resolvedPaymentStatus = isDirectConfirmed 
      ? (paymentStatus || (resolvedPaymentMethod === 'CASH' ? 'UNPAID' : 'PAID'))
      : 'UNPAID';

    let booking;

    if (existingPending) {
      // Update existing pending booking without creating duplicate
      booking = await BookingModel.updatePending(existingPending.id, {
        pickupAddress: pickupAddress.trim(),
        dropoffAddress: dropoffAddress.trim(),
        pickupTime: pickupDate,
        serviceId: resolvedServiceId,
        serviceName: resolvedServiceName,
        vehicleCapacity: resolvedCapacity,
        carType: carType || (resolvedCapacity === 7 ? 'Seven-Passenger Executive MPV' : 'Four-Passenger Executive Saloon'),
        fareAmount: baseFare,
        baseFare: baseFare,
        discountAmount: onlineDiscount,
        promoCode: validPromoCode,
        promoDiscount: promoDiscount,
        voucherCode: validPromoCode,
        voucherId: validVoucherId,
        finalFare: finalFare,
        vehicleId: assignedVehicleId,
        requestedDriverId: requestedDriverId,
        passengerCount: resolvedPassengers,
        notes: notes || null,
      });
      // Fetch full row with joined chauffeur data
      booking = await BookingModel.findById(existingPending.id);
    } else {
      // Create new booking
      const bookingCode = 'BK-' + Math.floor(100000 + Math.random() * 900000);
      const codeSuffix = bookingCode.replace(/^BK-/, '');

      let initialPaymentRef = null;
      let initialCardRef = null;
      const normMethod = (resolvedPaymentMethod || 'CARD').toUpperCase();

      if (normMethod === 'CASH') {
        initialPaymentRef = `TXN-CSH-${codeSuffix}`;
        initialCardRef = null;
      } else if (normMethod === 'PAYPAL') {
        initialPaymentRef = `TXN-PP-${codeSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;
        initialCardRef = null;
      } else {
        // CARD
        initialPaymentRef = `TXN-CARD-${codeSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;
        initialCardRef = customer.mockCardRef || '•••• •••• •••• 4242';
      }

      const initialPaidAmount = resolvedPaymentStatus === 'PAID' ? finalFare : 0.00;

      booking = await BookingModel.create({
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
        cardRefUsed: initialCardRef,
        paymentReference: initialPaymentRef,
        paidAmount: initialPaidAmount,
        status: finalBookingStatus,
        paymentStatus: resolvedPaymentStatus,
        notes: notes || null,
        serviceId: resolvedServiceId,
        serviceName: resolvedServiceName,
        vehicleCapacity: resolvedCapacity,
        fareCurrency: resolvedCurrency,
        occupiedDurationMinutes: resolvedDuration,
        bookingChannel: channel || 'ONLINE',
        baseFare: baseFare,
        discountAmount: onlineDiscount,
        promoCode: validPromoCode,
        promoDiscount: promoDiscount,
        voucherCode: validPromoCode,
        voucherId: validVoucherId,
        finalFare: finalFare,
        vehicleId: assignedVehicleId,
        driverId: assignedDriverId,
        requestedDriverId: requestedDriverId,
        passengerCount: resolvedPassengers,
      });
    }

    // Only if status is CONFIRMED: mark promo used, send email, create notification
    if (finalBookingStatus === 'CONFIRMED') {
      if (validPromoCode) {
        await SpecialOfferModel.markUsed(validPromoCode).catch(() => {});
      }

      await NotificationModel.create({
        accountId: customer.id,
        bookingId: booking.id,
        title: 'Booking Confirmed — #' + booking.booking_code,
        message: `Your minicab booking #${booking.booking_code} from ${booking.pickup_address} to ${booking.dropoff_address} has been confirmed. Click to view details of your journey.`,
        type: 'BOOKING_CONFIRMED',
      }).catch(err => console.error('Error creating booking confirmation notification:', err));

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
      }).catch(err => console.warn('⚠️ [Booking Confirmation Email Error]:', err.message));

      const draftToken = req.body?.draftToken || req.headers?.['x-draft-token'] || `usr-${customer.id}`;
      await BookingDraftModel.deleteDraft({ accountId: customer.id, draftToken }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      message: 'Booking submitted successfully! Chauffeur is assigned.',
      booking: {
        id: booking.id,
        bookingCode: booking.booking_code,
        booking_code: booking.booking_code,
        accountId: booking.account_id,
        account_id: booking.account_id,
        passengerName: booking.passenger_name,
        passengerPhone: booking.passenger_phone,
        pickupAddress: booking.pickup_address,
        dropoffAddress: booking.dropoff_address,
        pickupTime: booking.pickup_time,
        serviceId: booking.service_id,
        serviceName: booking.service_name,
        vehicleCapacity: booking.vehicle_capacity,
        passengerCount: booking.passenger_count || resolvedPassengers,
        carType: booking.car_type,
        baseFare: booking.base_fare,
        onlineDiscount: booking.discount_amount,
        promoDiscount: booking.promo_discount,
        fareAmount: booking.fare_amount,
        finalFare: booking.final_fare,
        fareCurrency: booking.fare_currency || 'GBP',
        occupiedDurationMinutes: booking.occupied_duration_minutes,
        paymentMethod: booking.payment_method,
        payment_method: booking.payment_method,
        paymentStatus: booking.payment_status,
        payment_status: booking.payment_status,
        paymentReference: booking.payment_reference,
        payment_reference: booking.payment_reference,
        paidAmount: booking.paid_amount,
        paid_amount: booking.paid_amount,
        cardRefUsed: booking.card_ref_used,
        card_ref_used: booking.card_ref_used,
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
    const { paymentMethod = 'CARD', simulationResult = 'SUCCESS', voucherCode = null } = req.body;
    const customer = req.user;

    const booking = /^\d+$/.test(bookingId)
      ? await BookingModel.findById(bookingId)
      : await BookingModel.findByCode(bookingId);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isStaff = customer.role === 'STAFF' || customer.role === 'ADMIN';
    if (booking.account_id !== customer.id && !isStaff) {
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

    // Idempotency: if already CONFIRMED, ASSIGNED, or COMPLETED
    if (booking.status === 'CONFIRMED' || booking.status === 'ASSIGNED' || booking.status === 'COMPLETED') {
      return res.json({
        success: true,
        message: 'Booking is already confirmed.',
        booking,
      });
    }

    if (booking.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm booking in ${booking.status} status.`,
      });
    }

    // Verify pickup time is still in the future
    const pickupDate = new Date(booking.pickup_time);
    if (pickupDate.getTime() < Date.now() - 60000) {
      return res.status(400).json({
        success: false,
        code: 'PICKUP_EXPIRED',
        message: 'The scheduled pickup time has already passed. Please create a new booking with a future pickup time.',
      });
    }

    // Re-check voucher if booking has voucher
    const codeToCheck = voucherCode || booking.voucher_code || booking.promo_code;
    let validVoucher = null;
    if (codeToCheck) {
      const offer = await SpecialOfferModel.findByCode(codeToCheck.trim().toUpperCase());
      if (!offer || offer.is_used) {
        return res.status(400).json({
          success: false,
          code: 'VOUCHER_INVALID',
          message: 'The applied voucher is no longer valid. Please review your total before continuing.',
        });
      }
      validVoucher = offer;
    }

    // Re-check availability of vehicle and requested chauffeur (excluding this booking)
    const vehicleId = booking.vehicle_id;
    const requestedDriverId = booking.requested_driver_id || booking.driver_id;

    if (vehicleId) {
      const vehicleCheck = await db.query('SELECT * FROM vehicles WHERE id = $1', [vehicleId]);
      if (!vehicleCheck.rows[0] || vehicleCheck.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          code: 'RESOURCE_UNAVAILABLE',
          message: 'The selected vehicle is no longer active or available.',
        });
      }
      const hasVConflict = await BookingModel.hasVehicleConflict({
        vehicleId,
        pickupTime: booking.pickup_time,
        durationMinutes: booking.occupied_duration_minutes || 60,
        excludeBookingId: booking.id,
      });
      if (hasVConflict) {
        return res.status(400).json({
          success: false,
          code: 'RESOURCE_CONFLICT',
          message: 'The selected vehicle is no longer available for this time slot. Please rebook with an available vehicle.',
        });
      }
    }

    if (requestedDriverId) {
      const driverCheck = await db.query('SELECT * FROM drivers WHERE id = $1', [requestedDriverId]);
      if (!driverCheck.rows[0] || driverCheck.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          code: 'RESOURCE_UNAVAILABLE',
          message: 'The selected chauffeur is no longer active or available.',
        });
      }
      const hasDConflict = await BookingModel.hasDriverConflict({
        driverId: requestedDriverId,
        pickupTime: booking.pickup_time,
        durationMinutes: booking.occupied_duration_minutes || 60,
        excludeBookingId: booking.id,
      });
      if (hasDConflict) {
        return res.status(400).json({
          success: false,
          code: 'RESOURCE_CONFLICT',
          message: 'The selected chauffeur is no longer available for this time slot.',
        });
      }
    }

    // Branch 2: Simulated Payment Success
    const isCash = paymentMethod === 'CASH';
    const isPayPal = paymentMethod === 'PAYPAL';
    const newPaymentStatus = isCash ? 'UNPAID' : 'PAID';
    const newStatus = 'CONFIRMED';
    const codeSuffix = (booking.booking_code || '').replace(/^BK-/, '');

    let paymentReference = null;
    let cardRefUsed = null;

    if (isCash) {
      paymentReference = `TXN-CSH-${codeSuffix}`;
      cardRefUsed = null; // Cash must NEVER show Visa Card strings
    } else if (isPayPal) {
      paymentReference = `TXN-PP-${codeSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;
      cardRefUsed = null;
    } else {
      // CARD
      paymentReference = `TXN-CARD-${codeSuffix}-${Math.floor(1000 + Math.random() * 9000)}`;
      cardRefUsed = (req.user && req.user.mockCardRef) || booking.card_ref_used || '•••• •••• •••• 4242';
    }

    // Reserve vehicle and requested chauffeur
    // Note: driver_id remains NULL until staff officially assigns/confirms allocation!
    await db.query(`
      UPDATE bookings 
      SET status = $1, 
          payment_status = $2, 
          payment_method = $3,
          payment_reference = $4,
          card_ref_used = $5,
          requested_driver_id = COALESCE(requested_driver_id, $6),
          paid_amount = CASE WHEN $2 = 'PAID' THEN COALESCE(final_fare, fare_amount, 0.00) ELSE 0.00 END
      WHERE id = $7
    `, [newStatus, newPaymentStatus, paymentMethod, paymentReference, cardRefUsed, requestedDriverId || null, booking.id]);

    // If promo code was used, mark it used
    if (validVoucher) {
      await SpecialOfferModel.markUsed(validVoucher.code).catch(() => {});
    } else if (booking.promo_code) {
      await SpecialOfferModel.markUsed(booking.promo_code).catch(() => {});
    }

    // Send real confirmation email to the actual customer
    let customerAccount = null;
    if (booking.account_id) {
      customerAccount = await AccountModel.findById(booking.account_id);
    }
    const recipientEmail = (customerAccount && customerAccount.email) || booking.customer_email || (customer.role !== 'STAFF' && customer.role !== 'ADMIN' ? customer.email : null);
    const recipientName = (customerAccount && customerAccount.name) || booking.passenger_name || (customer.role !== 'STAFF' && customer.role !== 'ADMIN' ? customer.name : 'Valued Customer');
    if (recipientEmail) {
      sendBookingConfirmationEmail({
        toEmail: recipientEmail,
        name: recipientName,
        bookingCode: booking.booking_code,
        pickupAddress: booking.pickup_address,
        dropoffAddress: booking.dropoff_address,
        pickupTime: booking.pickup_time,
        serviceName: booking.service_name || 'Executive Journey',
        vehicleCapacity: booking.vehicle_capacity || 4,
        fareAmount: booking.final_fare || booking.fare_amount,
        paymentMethod: paymentMethod,
        paymentStatus: newPaymentStatus,
      }).catch(err => console.warn('⚠️ [Booking Confirmation Email Error]:', err.message));
    }

    // Send customer notification for booking confirmation
    await NotificationModel.create({
      accountId: booking.account_id,
      bookingId: booking.id,
      title: 'Booking Confirmed — #' + booking.booking_code,
      message: `Your minicab booking #${booking.booking_code} from ${booking.pickup_address} to ${booking.dropoff_address} has been confirmed. Click to view details of your journey.`,
      type: 'BOOKING_CONFIRMED',
    }).catch(err => console.error('Error creating booking confirmation notification:', err));

    const updated = await BookingModel.findById(booking.id);

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
/**
 * [P05]: Lấy báo giá và kiểm tra trước khi chỉnh sửa cuốc xe (Amend Quote Preview)
 * Hiển thị giá cũ, giá mới, khoản chênh lệch và hành động cần thực hiện (PAYMENT/REFUND/NONE)
 */
const getAmendQuote = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const customer = req.user;
    const { service, vehicleCapacity, pickupTime, passengerCount } = req.query;

    const booking = /^\d+$/.test(bookingId)
      ? await BookingModel.findById(bookingId)
      : await BookingModel.findByCode(bookingId);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.account_id !== customer.id && customer.role !== 'STAFF' && customer.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const now = new Date();
    const currentPickup = new Date(booking.pickup_time);
    const msDiff = currentPickup.getTime() - now.getTime();
    const isNoticeValid = msDiff >= (24 * 3600 * 1000 - 5000);

    const resolvedCapacity = parseInt(vehicleCapacity, 10) || booking.vehicle_capacity || 4;
    const resolvedService = service || booking.service_name || 'Airport transfer';
    const resolvedPax = parseInt(passengerCount, 10) || booking.passenger_count || 1;

    let baseFare = parseFloat(booking.base_fare || booking.fare_amount || 45.00);
    let duration = booking.occupied_duration_minutes || 60;

    const quote = await ServiceModel.calculateFareAndDuration(resolvedService, resolvedCapacity);
    if (quote) {
      baseFare = quote.fixedFare;
      duration = quote.occupiedDurationMinutes;
    }

    const isOnline = (booking.booking_channel || 'ONLINE').toUpperCase() === 'ONLINE';
    const discountAmount = isOnline ? Math.round(baseFare * 0.15 * 100) / 100 : 0.00;
    const promoDiscount = parseFloat(booking.promo_discount || 0.00);
    const newFinalFare = Math.max(0, Math.round((baseFare - discountAmount - promoDiscount) * 100) / 100);

    const isPaid = (booking.payment_status || '').toUpperCase() === 'PAID';
    const paidBaseline = parseFloat(booking.paid_amount || (isPaid ? (booking.final_fare || booking.fare_amount || 0) : 0));
    const oldFare = parseFloat(booking.final_fare || booking.fare_amount || 0);

    const fareDifference = isPaid
      ? Math.round((newFinalFare - paidBaseline) * 100) / 100
      : Math.round((newFinalFare - oldFare) * 100) / 100;

    let actionRequired = 'NONE';
    if (isPaid) {
      if (fareDifference > 0) {
        actionRequired = 'PAYMENT';
      } else if (fareDifference < 0) {
        actionRequired = 'REFUND';
      }
    }

    res.json({
      success: true,
      bookingCode: booking.booking_code,
      paymentStatus: booking.payment_status,
      isNoticeValid,
      oldFare,
      newBaseFare: baseFare,
      newDiscount: discountAmount,
      newFinalFare,
      fareDifference,
      actionRequired,
      durationMinutes: duration,
      vehicleCapacity: resolvedCapacity,
      passengerCount: resolvedPax,
    });
  } catch (error) {
    console.error('Error calculating amend quote:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * [P05]: Chỉnh sửa cuốc xe (Amend Booking)
 * Điều kiện: Trước giờ đón ít nhất 24 giờ (bao gồm đúng 24h).
 * Xử lý điều chỉnh thanh toán:
 * - Paid tăng giá: chỉ lưu sau khi thanh toán bổ sung thành công; thất bại giữ nguyên booking/giá/trạng thái cũ.
 * - Paid giảm giá: tạo hoặc cập nhật Pending refund cho phần giảm.
 * - Unpaid: chỉ cập nhật amount due, không tạo payment hoặc refund.
 * - Giữ lịch sử khoản tiền đã trả; không đặt lại Unpaid.
 * - Cho khách chọn xe cụ thể khả dụng; kiểm tra lại xe và tài xế cho lịch mới.
 * - Giữ booking state và cập nhật reservation nhất quán sau amendment hợp lệ.
 */
const amendBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const customer = req.user;
    const {
      pickupAddress,
      dropoffAddress,
      pickupTime,
      service,
      vehicleCapacity,
      vehicleId,
      passengerCount,
      paymentMethod = 'CARD',
      simulationResult = 'SUCCESS',
    } = req.body;

    const booking = /^\d+$/.test(bookingId)
      ? await BookingModel.findById(bookingId)
      : await BookingModel.findByCode(bookingId);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.account_id !== customer.id && customer.role !== 'STAFF' && customer.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Status check
    const allowedStatuses = ['PENDING', 'CONFIRMED', 'ASSIGNED'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot amend booking with status "${booking.status}". Only Pending, Confirmed, or Assigned bookings can be amended.`,
      });
    }

    // 24-hour notice check on existing pickup time (inclusive of exactly 24 hours)
    const now = new Date();
    const currentPickup = new Date(booking.pickup_time);
    const msDiff = currentPickup.getTime() - now.getTime();

    if (msDiff < (24 * 3600 * 1000 - 5000)) {
      return res.status(400).json({
        success: false,
        code: 'NOTICE_LESS_THAN_24H',
        message: 'Amendments must be made at least 24 hours prior to scheduled pickup time.',
      });
    }

    const newPickupTime = pickupTime ? new Date(pickupTime) : currentPickup;
    if (newPickupTime.getTime() < Date.now() + (24 * 3600 * 1000 - 5000)) {
      return res.status(400).json({
        success: false,
        code: 'AMENDED_PICKUP_TOO_SOON',
        message: 'Amended pickup time must be at least 24 hours in the future.',
      });
    }

    // Passenger count validation if amended
    let resolvedPax = booking.passenger_count || 1;
    if (passengerCount !== undefined && passengerCount !== null) {
      const num = Number(passengerCount);
      if (isNaN(num) || !Number.isInteger(num) || num < 1 || num > 7) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PASSENGER_COUNT',
          message: 'Passenger count must be a positive whole integer between 1 and 7.',
        });
      }
      resolvedPax = num;
    }

    // Vehicle lookup & capacity sync
    let targetVehicleId = vehicleId ? parseInt(vehicleId, 10) : booking.vehicle_id;
    let resolvedCapacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : booking.vehicle_capacity;

    if (vehicleId) {
      const vLookup = await db.query(
        `SELECT v.*, d.status AS driver_status, d.id AS driver_id, d.name AS driver_name 
         FROM vehicles v 
         LEFT JOIN drivers d ON v.driver_id = d.id 
         WHERE v.id = $1`,
        [vehicleId]
      );
      if (vLookup.rows.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'VEHICLE_NOT_FOUND',
          message: 'Selected vehicle not found.',
        });
      }
      const veh = vLookup.rows[0];
      if (veh.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          code: 'VEHICLE_NOT_ACTIVE',
          message: 'Selected vehicle is no longer active.',
        });
      }
      if (veh.driver_status && veh.driver_status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          code: 'DRIVER_NOT_ACTIVE',
          message: 'Chauffeur assigned to this vehicle is currently unavailable.',
        });
      }
      resolvedCapacity = veh.capacity;
      targetVehicleId = veh.id;
    }

    if (resolvedPax > resolvedCapacity) {
      return res.status(400).json({
        success: false,
        code: 'PASSENGERS_EXCEED_CAPACITY',
        message: `Passenger count (${resolvedPax}) exceeds vehicle capacity (${resolvedCapacity} seats). Please select 7-Seat MPV.`,
      });
    }

    // Recalculate Table 8 fare and duration
    let baseFare = parseFloat(booking.base_fare || booking.fare_amount || 45.00);
    let resolvedService = service || booking.service_name;
    let duration = booking.occupied_duration_minutes || 60;
    let serviceId = booking.service_id;

    if (service || vehicleCapacity || vehicleId) {
      const quote = await ServiceModel.calculateFareAndDuration(resolvedService, resolvedCapacity);
      if (quote) {
        baseFare = quote.fixedFare;
        duration = quote.occupiedDurationMinutes;
        serviceId = quote.serviceId;
        resolvedService = quote.serviceName;
      }
    }

    // If targetVehicleId is still empty or capacity changed without specific vehicle, pick available
    if (!targetVehicleId || (resolvedCapacity !== booking.vehicle_capacity && !vehicleId)) {
      const availableVehicles = await VehicleModel.getAvailableVehicles({
        capacity: resolvedCapacity,
        pickupTime: newPickupTime,
        durationMinutes: duration,
        excludeBookingId: booking.id,
      });
      if (availableVehicles.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'NO_VEHICLES_AVAILABLE',
          message: 'No available vehicles found for the requested amended time slot and capacity.',
        });
      }
      targetVehicleId = availableVehicles[0].id;
    }

    // Get chauffeur for target vehicle
    const vCheck = await db.query(
      `SELECT v.*, d.id AS driver_id, d.status AS driver_status 
       FROM vehicles v 
       LEFT JOIN drivers d ON v.driver_id = d.id 
       WHERE v.id = $1`,
      [targetVehicleId]
    );
    const targetVehRow = vCheck.rows[0];
    const targetDriverId = targetVehRow ? targetVehRow.driver_id : null;

    // Check conflict for amended journey (excluding this booking itself)
    const hasVConflict = await BookingModel.hasVehicleConflict({
      vehicleId: targetVehicleId,
      pickupTime: newPickupTime,
      durationMinutes: duration,
      excludeBookingId: booking.id,
    });
    if (hasVConflict) {
      return res.status(400).json({
        success: false,
        code: 'VEHICLE_CONFLICT',
        message: 'The selected vehicle has an overlapping booking for the amended time slot.',
      });
    }

    if (targetDriverId) {
      const hasDConflict = await BookingModel.hasDriverConflict({
        driverId: targetDriverId,
        pickupTime: newPickupTime,
        durationMinutes: duration,
        excludeBookingId: booking.id,
      });
      if (hasDConflict) {
        return res.status(400).json({
          success: false,
          code: 'DRIVER_CONFLICT',
          message: 'The chauffeur for this vehicle has an overlapping booking for the amended time slot.',
        });
      }
    }

    // Recalculate final fare (15% discount for online bookings)
    const isOnline = (booking.booking_channel || 'ONLINE').toUpperCase() === 'ONLINE';
    const discountAmount = isOnline ? Math.round(baseFare * 0.15 * 100) / 100 : 0.00;
    const promoDiscount = parseFloat(booking.promo_discount || 0.00);
    const finalFare = Math.max(0, Math.round((baseFare - discountAmount - promoDiscount) * 100) / 100);

    const isPaid = (booking.payment_status || '').toUpperCase() === 'PAID';
    const paidBaseline = parseFloat(booking.paid_amount || (isPaid ? (booking.final_fare || booking.fare_amount || 0) : 0));
    const oldFare = parseFloat(booking.final_fare || booking.fare_amount || 0);

    const fareDiff = isPaid
      ? Math.round((finalFare - paidBaseline) * 100) / 100
      : Math.round((finalFare - oldFare) * 100) / 100;

    let newPaymentStatus = booking.payment_status;
    let newPaidAmount = paidBaseline;
    let actionResult = 'NONE';

    // 1. Paid booking adjustments
    if (isPaid) {
      if (fareDiff > 0) {
        // Paid tăng giá: chỉ lưu amendment sau khi thanh toán thử khoản tăng thành công
        if (simulationResult === 'FAIL') {
          // Thanh toán thêm thất bại: giữ nguyên booking, giá, trạng thái và reservation cũ
          return res.status(400).json({
            success: false,
            code: 'PAYMENT_DECLINED',
            message: `Additional payment of £${fareDiff.toFixed(2)} GBP was declined. The booking has NOT been amended and original reservation remains unchanged.`,
            oldFare,
            newFare: finalFare,
            fareDifference: fareDiff,
          });
        }
        // Simulated payment succeeded:
        newPaymentStatus = 'PAID';
        newPaidAmount = finalFare;
        actionResult = 'PAYMENT_COMPLETED';
        // Clean up any old pending refund because new fare exceeds previous paid amount
        await db.query(`DELETE FROM refund_requests WHERE booking_id = $1 AND status = 'PENDING'`, [booking.id]);
      } else if (fareDiff < 0) {
        // Paid giảm giá: tạo hoặc cập nhật Pending refund cho phần giảm
        const refundAmount = Math.abs(fareDiff);
        const existingPendingRefund = await db.query(
          `SELECT * FROM refund_requests WHERE booking_id = $1 AND status = 'PENDING' ORDER BY id DESC LIMIT 1`,
          [booking.id]
        );
        if (existingPendingRefund.rows.length > 0) {
          await db.query(
            `UPDATE refund_requests
             SET amount = $1,
                 reason = $2,
                 created_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
              refundAmount,
              `Amendment fare reduction for #${booking.booking_code} (£${paidBaseline.toFixed(2)} -> £${finalFare.toFixed(2)})`,
              existingPendingRefund.rows[0].id,
            ]
          );
        } else {
          await RefundModel.create({
            bookingId: booking.id,
            accountId: booking.account_id,
            amount: refundAmount,
            reason: `Amendment fare reduction for #${booking.booking_code} (£${paidBaseline.toFixed(2)} -> £${finalFare.toFixed(2)})`,
          });
        }
        newPaymentStatus = 'PAID';
        newPaidAmount = paidBaseline;
        actionResult = 'REFUND_QUEUED';
      } else {
        newPaymentStatus = 'PAID';
        newPaidAmount = paidBaseline;
        await db.query(`DELETE FROM refund_requests WHERE booking_id = $1 AND status = 'PENDING'`, [booking.id]);
      }
    } else {
      // Unpaid: chỉ cập nhật amount due, không tạo payment hoặc refund
      newPaymentStatus = 'UNPAID';
      newPaidAmount = 0.00;
    }

    // Giữ booking state và cập nhật reservation nhất quán sau amendment hợp lệ
    const targetStatus = booking.status;
    const targetAssignedDriverId = targetStatus === 'ASSIGNED' ? targetDriverId : booking.driver_id;
    const resolvedCarType = resolvedCapacity === 7 ? 'Seven-Passenger Executive MPV' : 'Four-Passenger Executive Saloon';

    const updated = await BookingModel.amendBooking(booking.id, {
      pickupAddress: pickupAddress ? pickupAddress.trim() : booking.pickup_address,
      dropoffAddress: dropoffAddress ? dropoffAddress.trim() : booking.dropoff_address,
      pickupTime: newPickupTime,
      serviceId,
      serviceName: resolvedService,
      vehicleCapacity: resolvedCapacity,
      carType: resolvedCarType,
      baseFare,
      discountAmount,
      finalFare,
      occupiedDurationMinutes: duration,
      vehicleId: targetVehicleId,
      requestedDriverId: targetDriverId,
      driverId: targetAssignedDriverId,
      passengerCount: resolvedPax,
      paymentStatus: newPaymentStatus,
      paidAmount: newPaidAmount,
    });

    res.json({
      success: true,
      message: 'Booking amended successfully with recalculated Table 8 fare and resource validation.',
      booking: updated,
      oldFare,
      newFare: finalFare,
      fareDifference: fareDiff,
      action: actionResult,
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

    const booking = /^\d+$/.test(bookingId)
      ? await BookingModel.findById(bookingId)
      : await BookingModel.findByCode(bookingId);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.account_id !== customer.id && customer.role !== 'STAFF' && customer.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const allowedStatuses = ['PENDING', 'CONFIRMED', 'ASSIGNED'];
    if (!allowedStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status "${booking.status}". Only Pending, Confirmed, or Assigned bookings can be cancelled.`,
      });
    }

    const now = new Date();
    const currentPickup = new Date(booking.pickup_time);
    const msDiff = currentPickup.getTime() - now.getTime();

    if (msDiff < (24 * 3600 * 1000 - 5000)) {
      return res.status(400).json({
        success: false,
        message: 'Cancellations must be made at least 24 hours prior to scheduled pickup time.',
      });
    }

    // Cancel booking and free vehicle & driver (Point 5: giải phóng xe/tài xế)
    const cancelled = await BookingModel.cancelBooking(booking.id);

    // If customer paid, create a pending refund request for net paid amount (Point 5: tạo đúng refund request)
    let refundCreated = false;
    if (booking.payment_status === 'PAID') {
      const netAmount = parseFloat(booking.paid_amount || booking.final_fare || booking.fare_amount);
      await RefundModel.create({
        bookingId: booking.id,
        accountId: booking.account_id,
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

    const booking = /^\d+$/.test(bookingId)
      ? await BookingModel.findById(bookingId)
      : await BookingModel.findByCode(bookingId);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.account_id !== customer.id && customer.role !== 'STAFF' && customer.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Retrieve refund requests history if any
    let refundHistory = [];
    try {
      const refundRes = await db.query(
        'SELECT id, amount, reason, status, created_at, processed_at, staff_notes FROM refund_requests WHERE booking_id = $1 ORDER BY created_at DESC',
        [booking.id]
      );
      refundHistory = refundRes.rows || [];
    } catch (_) {}

    // Check payment / receipt eligibility:
    // User requirement: "Sau Cancelled/Refunded, owner vẫn xem được lịch sử thanh toán và hoàn tiền sau reload. Không chặn toàn bộ lịch sử vì payment status không còn Paid."
    const isPaidOrRefunded = ['PAID', 'REFUNDED', 'COMPLETED'].includes((booking.payment_status || '').toUpperCase()) 
      || parseFloat(booking.paid_amount || 0) > 0 
      || refundHistory.length > 0;

    if (!isPaidOrRefunded) {
      return res.status(400).json({
        success: false,
        message: 'Receipt is available only after payment has been recorded or on a confirmed/paid journey.',
      });
    }

    const netAmount = parseFloat(booking.final_fare || booking.fare_amount || 0);
    const recordedPaidAmount = parseFloat(booking.paid_amount || (['PAID', 'REFUNDED'].includes(booking.payment_status) ? netAmount : 0));
    const vat = Math.round(recordedPaidAmount * 0.20 * 100) / 100;
    const codeSuffix = (booking.booking_code || '').replace(/^BK-/, '');

    const receiptNumber = `REC-${codeSuffix}`;
    const normMethod = (booking.payment_method || 'CARD').toUpperCase();

    let defaultTxnPrefix = 'TXN-CARD-';
    if (normMethod === 'CASH') defaultTxnPrefix = 'TXN-CSH-';
    else if (normMethod === 'PAYPAL') defaultTxnPrefix = 'TXN-PP-';

    const paymentRef = booking.payment_reference || `${defaultTxnPrefix}${codeSuffix}`;
    const maskedCardRef = (normMethod === 'CASH' || normMethod === 'PAYPAL') ? null : (booking.card_ref_used || '•••• •••• •••• 4242');

    // Build chronological payment history
    const paymentHistory = [];
    if (recordedPaidAmount > 0 || ['PAID', 'REFUNDED'].includes(booking.payment_status)) {
      paymentHistory.push({
        type: 'CHARGE',
        method: booking.payment_method || 'CARD',
        reference: paymentRef,
        amount: recordedPaidAmount > 0 ? recordedPaidAmount : netAmount,
        status: booking.payment_status === 'REFUNDED' ? 'REFUNDED' : 'PAID',
        date: booking.updated_at || booking.created_at,
      });
    }

    res.json({
      success: true,
      receipt: {
        receiptNumber,
        issuedAt: new Date().toISOString(),
        paymentReference: paymentRef,
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
          baseFare: parseFloat(booking.base_fare || booking.fare_amount || 0),
          onlineDiscount: parseFloat(booking.discount_amount || 0.00),
          promoDiscount: parseFloat(booking.promo_discount || 0.00),
          netPaid: recordedPaidAmount,
          actualPaidAmount: recordedPaidAmount,
          paymentReference: paymentRef,
          currency: booking.fare_currency || 'GBP',
          vatIncluded: vat,
          paymentMethod: booking.payment_method || 'CARD',
          cardRefUsed: maskedCardRef,
        },
        paymentHistory,
        refundHistory: refundHistory.map(r => ({
          type: 'REFUND',
          id: r.id,
          reference: `REF-${r.id}`,
          amount: parseFloat(r.amount),
          reason: r.reason,
          status: r.status,
          date: r.created_at,
          processedAt: r.processed_at,
          staffNotes: r.staff_notes,
        })),
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
    const rawCode =
      (req.body && (req.body.code || req.body.offerCode || req.body.promoCode || req.body.voucherCode)) ||
      (req.query && (req.query.code || req.query.offerCode || req.query.promoCode || req.query.voucherCode));
    const customer = req.user;
    const customerId = (customer && customer.id) || (req.body && req.body.customerId) || (req.query && req.query.customerId);

    if (!rawCode || !String(rawCode).trim()) {
      return res.status(400).json({ success: false, valid: false, message: 'Code is required' });
    }

    const code = String(rawCode).trim().toUpperCase();
    const offer = await SpecialOfferModel.findByCode(code);

    if (!offer) {
      return res.status(400).json({
        success: false,
        valid: false,
        code: 'VOUCHER_NOT_FOUND',
        message: 'Voucher code does not exist.',
      });
    }

    if (offer.is_used) {
      return res.status(400).json({
        success: false,
        valid: false,
        code: 'VOUCHER_ALREADY_USED',
        message: 'You have already used this voucher code.',
      });
    }

    if (offer.account_id) {
      if (!customerId) {
        return res.status(403).json({
          success: false,
          valid: false,
          code: 'AUTH_REQUIRED_FOR_VOUCHER',
          message: 'This voucher code is assigned to a specific customer account. Please log in to use your voucher.',
        });
      }
      if (parseInt(offer.account_id, 10) !== parseInt(customerId, 10)) {
        return res.status(403).json({
          success: false,
          valid: false,
          code: 'OFFER_DIFFERENT_CUSTOMER',
          message: 'You are not eligible to use this voucher code. This code belongs to another account.',
        });
      }
    }

    const discountAmount = parseFloat(offer.discount_amount || 10.00);
    return res.json({
      success: true,
      valid: true,
      code: offer.code,
      discountAmount: discountAmount,
      offer: {
        id: offer.id,
        code: offer.code,
        amount: discountAmount,
        discountAmount: discountAmount,
        accountId: offer.account_id,
      },
      message: `Voucher applied! £${discountAmount.toFixed(2)} GBP discount applied to total.`,
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
    const { pickupTime, service, vehicleCapacity, capacity: queryCapacity, durationMinutes: queryDuration, passengerCount, passengers, pax } = req.query;
    const capacity = parseInt(vehicleCapacity || queryCapacity, 10) || 4;
    const pCount = parseInt(passengerCount || passengers || pax || 0, 10);

    if (pCount > capacity) {
      return res.status(400).json({
        success: false,
        code: 'PASSENGERS_EXCEED_CAPACITY',
        message: `Passenger count (${pCount}) exceeds selected vehicle capacity (${capacity} seats). Please select a 7-passenger MPV.`,
        vehicles: [],
      });
    }

    let durationMinutes = parseInt(queryDuration, 10) || 60;
    if (service) {
      try {
        const quote = await ServiceModel.calculateFareAndDuration(service, capacity);
        if (quote) durationMinutes = quote.occupiedDurationMinutes;
      } catch (_) {}
    }

    let pickupDate = new Date();
    if (pickupTime) {
      if (typeof pickupTime === 'string' && pickupTime.length === 16 && !pickupTime.includes('Z') && !pickupTime.includes('+')) {
        pickupDate = new Date(`${pickupTime}:00.000Z`);
      } else {
        pickupDate = new Date(pickupTime);
      }
    }
    let resolvedExcludeId = null;
    if (req.query.excludeBookingId) {
      const exParam = String(req.query.excludeBookingId).trim();
      if (/^\d+$/.test(exParam)) {
        resolvedExcludeId = parseInt(exParam, 10);
      } else {
        const bRow = await BookingModel.findByCode(exParam);
        if (bRow) resolvedExcludeId = bRow.id;
      }
    }

    const available = await VehicleModel.getAvailableVehicles({
      capacity,
      pickupTime: pickupDate,
      durationMinutes,
      excludeBookingId: resolvedExcludeId,
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
  getAmendQuote,
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
