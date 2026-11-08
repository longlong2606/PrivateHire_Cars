const BookingModel = require('../models/bookingModel');
const ServiceModel = require('../models/serviceModel');
const BookingDraftModel = require('../models/bookingDraftModel');

/**
 * [BOOKING]: Tạo cuốc xe trực tuyến mới
 * Yêu cầu đặc tả: "Protect customer endpoints so visitors cannot submit online bookings"
 * -> Khách vãng lai (chưa đăng nhập) bị chặn hoàn toàn!
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
    } = req.body;

    // Kiểm tra các trường bắt buộc
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

    // Xác định dịch vụ và giá vé cố định theo Table 8
    let resolvedFare = fareAmount;
    let resolvedServiceId = serviceId || null;
    let resolvedServiceName = serviceName || null;
    let resolvedCapacity = vehicleCapacity ? parseInt(vehicleCapacity, 10) : 4;
    let resolvedCurrency = 'GBP';
    let resolvedDuration = 60;

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
          if (resolvedFare === undefined || resolvedFare === null) {
            resolvedFare = quote.fixedFare;
          }
        }
      } catch (_) {
        // Fallback gracefully
      }
    }

    if (resolvedFare === undefined || resolvedFare === null) {
      resolvedFare = 45.00;
    }

    // Tạo mã cuốc xe duy nhất (ví dụ: BK-841920)
    const bookingCode = 'BK-' + Math.floor(100000 + Math.random() * 900000);

    // Lưu cuốc xe gắn liền với ID tài khoản khách hàng
    const booking = await BookingModel.create({
      bookingCode,
      accountId: customer.id,
      pickupAddress: pickupAddress.trim(),
      dropoffAddress: dropoffAddress.trim(),
      pickupTime: pickupTime ? new Date(pickupTime) : new Date(),
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      carType: carType || (resolvedCapacity === 7 ? 'Seven-Passenger Executive MPV' : 'Four-Passenger Executive Saloon'),
      fareAmount: resolvedFare,
      paymentMethod: paymentMethod || 'MOCK_CARD',
      cardRefUsed: customer.mockCardRef || '•••• •••• •••• 4242 (Visa Test Card)',
      notes: notes || null,
      serviceId: resolvedServiceId,
      serviceName: resolvedServiceName,
      vehicleCapacity: resolvedCapacity,
      fareCurrency: resolvedCurrency,
      occupiedDurationMinutes: resolvedDuration,
    });

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
        fareAmount: booking.fare_amount,
        fareCurrency: booking.fare_currency || 'GBP',
        occupiedDurationMinutes: booking.occupied_duration_minutes,
        paymentMethod: booking.payment_method,
        cardRefUsed: booking.card_ref_used,
        status: booking.status,
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
 * [BOOKING]: Lấy danh sách cuốc xe của riêng khách hàng đăng nhập
 * Yêu cầu đặc tả: "customers can access only their own protected information"
 */
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
    res.status(500).json({
      success: false,
      message: 'Server error retrieving bookings',
      error: error.message,
    });
  }
};

/**
 * [BOOKING]: Xem chi tiết 1 cuốc xe
 * Bảo vệ: Nếu cuốc xe thuộc tài khoản khác -> Báo 403 Forbidden
 */
const getBookingById = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Kiểm tra quyền sở hữu dữ liệu (Customer Data Isolation)
    if (booking.account_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_ACCESS',
        message: 'Access denied: Customers can access only their own protected information.',
      });
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error('Error in getBookingById:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving booking',
      error: error.message,
    });
  }
};

/**
 * [FORM STATE PERSISTENCE]: Lưu/cập nhật trạng thái nháp của form đặt xe
 */
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
    res.status(500).json({
      success: false,
      message: 'Server error saving booking form state',
      error: error.message,
    });
  }
};

/**
 * [FORM STATE PERSISTENCE]: Lấy trạng thái nháp của form đặt xe
 */
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
    res.status(500).json({
      success: false,
      message: 'Server error retrieving booking form state',
      error: error.message,
    });
  }
};

/**
 * [FORM STATE PERSISTENCE]: Xóa trạng thái nháp
 */
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
    res.status(500).json({
      success: false,
      message: 'Server error clearing booking draft',
      error: error.message,
    });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
  saveBookingDraft,
  getBookingDraft,
  clearBookingDraft,
};

