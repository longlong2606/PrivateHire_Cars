const db = require('../config/db');

class BookingModel {
  /**
   * Tạo cuốc xe mới - Chỉ thực hiện được bởi khách hàng đã đăng nhập
   */
  static async create({
    bookingCode,
    accountId,
    pickupAddress,
    dropoffAddress,
    pickupTime = new Date(),
    passengerName,
    passengerPhone,
    carType = 'Executive Saloon',
    fareAmount = 45.00,
    paymentMethod = 'MOCK_CARD',
    cardRefUsed = null,
    notes = null,
  }) {
    const sql = `
      INSERT INTO bookings (
        booking_code,
        account_id,
        pickup_address,
        dropoff_address,
        pickup_time,
        passenger_name,
        passenger_phone,
        car_type,
        fare_amount,
        payment_method,
        card_ref_used,
        status,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'CONFIRMED', $12)
      RETURNING *
    `;
    const values = [
      bookingCode,
      accountId,
      pickupAddress.trim(),
      dropoffAddress.trim(),
      pickupTime,
      passengerName.trim(),
      passengerPhone.trim(),
      carType,
      fareAmount,
      paymentMethod,
      cardRefUsed,
      notes,
    ];
    const result = await db.query(sql, values);
    return result.rows[0];
  }

  /**
   * Lấy danh sách cuốc xe của riêng tài khoản khách hàng (Customer Isolation)
   */
  static async findByAccountId(accountId) {
    const sql = `
      SELECT * FROM bookings 
      WHERE account_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await db.query(sql, [accountId]);
    return result.rows;
  }

  /**
   * Tìm cuốc xe theo ID
   */
  static async findById(id) {
    const sql = `SELECT * FROM bookings WHERE id = $1`;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Tìm cuốc xe theo mã booking_code
   */
  static async findByCode(bookingCode) {
    const sql = `SELECT * FROM bookings WHERE booking_code = $1`;
    const result = await db.query(sql, [bookingCode.trim()]);
    return result.rows[0] || null;
  }

  /**
   * Đếm tổng số cuốc xe của tài khoản
   */
  static async countByAccountId(accountId) {
    const sql = `SELECT COUNT(*) FROM bookings WHERE account_id = $1`;
    const result = await db.query(sql, [accountId]);
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = BookingModel;

