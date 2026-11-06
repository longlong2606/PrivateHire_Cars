const BookingModel = require('../models/bookingModel');

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
      carType: carType || 'Executive Saloon',
      fareAmount: fareAmount || 45.00,
      paymentMethod: paymentMethod || 'MOCK_CARD',
      cardRefUsed: customer.mockCardRef || '•••• •••• •••• 4242 (Visa Test Card)',
      notes: notes || null,
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
        carType: booking.car_type,
        fareAmount: booking.fare_amount,
        paymentMethod: booking.payment_method,
        cardRefUsed: booking.card_ref_used,
        status: booking.status,
        createdAt: booking.created_at,
      },
    });
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

module.exports = {
  createBooking,
  getMyBookings,
  getBookingById,
};
