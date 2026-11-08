const db = require('../config/db');

class BookingModel {
  /**
   * Tạo cuốc xe mới
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
    status = 'PENDING',
    paymentStatus = 'UNPAID',
    notes = null,
    serviceId = null,
    serviceName = null,
    vehicleCapacity = 4,
    fareCurrency = 'GBP',
    occupiedDurationMinutes = 60,
    bookingChannel = 'ONLINE',
    baseFare = 45.00,
    discountAmount = 0.00,
    promoCode = null,
    promoDiscount = 0.00,
    finalFare = 45.00,
    vehicleId = null,
    driverId = null,
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
        payment_status,
        notes,
        service_id,
        service_name,
        vehicle_capacity,
        fare_currency,
        occupied_duration_minutes,
        booking_channel,
        base_fare,
        discount_amount,
        promo_code,
        promo_discount,
        final_fare,
        vehicle_id,
        driver_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27
      )
      RETURNING *
    `;
    const values = [
      bookingCode,
      accountId,
      pickupAddress ? pickupAddress.trim() : '',
      dropoffAddress ? dropoffAddress.trim() : '',
      pickupTime,
      passengerName ? passengerName.trim() : '',
      passengerPhone ? passengerPhone.trim() : '',
      carType,
      fareAmount,
      paymentMethod,
      cardRefUsed,
      status,
      paymentStatus,
      notes,
      serviceId,
      serviceName,
      vehicleCapacity,
      fareCurrency,
      occupiedDurationMinutes,
      bookingChannel,
      baseFare,
      discountAmount,
      promoCode,
      promoDiscount,
      finalFare,
      vehicleId,
      driverId,
    ];
    const result = await db.query(sql, values);
    return result.rows[0];
  }

  static async findByAccountId(accountId) {
    const sql = `
      SELECT b.*, 
             v.reg_number AS vehicle_reg, 
             v.make_model AS vehicle_model,
             v.colour AS vehicle_colour,
             v.capacity AS vehicle_capacity_seats,
             v.status AS vehicle_status,
             COALESCE(d.name, vd.name) AS driver_name, 
             COALESCE(d.telephone, vd.telephone) AS driver_phone,
             COALESCE(d.driver_code, vd.driver_code) AS driver_code,
             COALESCE(d.reference_number, vd.reference_number) AS driver_ref,
             COALESCE(d.status, vd.status) AS driver_status,
             r.id AS review_id, r.journey_rating, r.vehicle_rating, r.driver_rating, 
             r.review_text, r.created_at AS review_created_at
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN drivers vd ON v.driver_id = vd.id
      LEFT JOIN reviews r ON b.id = r.booking_id
      WHERE b.account_id = $1 
      ORDER BY b.created_at DESC
    `;
    const result = await db.query(sql, [accountId]);
    return result.rows;
  }

  static async findById(id) {
    const sql = `
      SELECT b.*, 
             v.reg_number AS vehicle_reg, 
             v.make_model AS vehicle_model,
             v.colour AS vehicle_colour,
             v.capacity AS vehicle_capacity_seats,
             v.status AS vehicle_status,
             COALESCE(d.name, vd.name) AS driver_name, 
             COALESCE(d.telephone, vd.telephone) AS driver_phone,
             COALESCE(d.driver_code, vd.driver_code) AS driver_code,
             COALESCE(d.reference_number, vd.reference_number) AS driver_ref,
             COALESCE(d.status, vd.status) AS driver_status,
             r.id AS review_id, r.journey_rating, r.vehicle_rating, r.driver_rating, 
             r.review_text, r.created_at AS review_created_at
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN drivers vd ON v.driver_id = vd.id
      LEFT JOIN reviews r ON b.id = r.booking_id
      WHERE b.id = $1
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  }

  static async findByCode(bookingCode) {
    const sql = `
      SELECT b.*, 
             v.reg_number AS vehicle_reg, 
             v.make_model AS vehicle_model,
             v.colour AS vehicle_colour,
             v.capacity AS vehicle_capacity_seats,
             v.status AS vehicle_status,
             COALESCE(d.name, vd.name) AS driver_name, 
             COALESCE(d.telephone, vd.telephone) AS driver_phone,
             COALESCE(d.driver_code, vd.driver_code) AS driver_code,
             COALESCE(d.reference_number, vd.reference_number) AS driver_ref,
             COALESCE(d.status, vd.status) AS driver_status,
             r.id AS review_id, r.journey_rating, r.vehicle_rating, r.driver_rating, 
             r.review_text, r.created_at AS review_created_at
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN drivers vd ON v.driver_id = vd.id
      LEFT JOIN reviews r ON b.id = r.booking_id
      WHERE b.booking_code = $1
    `;
    const result = await db.query(sql, [bookingCode.trim()]);
    return result.rows[0] || null;
  }

  static async updateStatus(id, status) {
    const res = await db.query('UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return res.rows[0];
  }

  static async updatePaymentStatus(id, paymentStatus) {
    const res = await db.query('UPDATE bookings SET payment_status = $1 WHERE id = $2 RETURNING *', [paymentStatus, id]);
    return res.rows[0];
  }

  static async assignDriverAndVehicle(id, driverId, vehicleId) {
    const res = await db.query(
      `UPDATE bookings 
       SET driver_id = $1, vehicle_id = $2, status = 'ASSIGNED' 
       WHERE id = $3 
       RETURNING *`,
      [driverId, vehicleId, id]
    );
    return res.rows[0];
  }

  static async setApproachingAlert(id) {
    const res = await db.query(
      'UPDATE bookings SET approaching_alert = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    return res.rows[0];
  }

  static async amendBooking(id, { pickupAddress, dropoffAddress, pickupTime, serviceId, serviceName, vehicleCapacity, baseFare, discountAmount, finalFare, occupiedDurationMinutes }) {
    const sql = `
      UPDATE bookings
      SET pickup_address = COALESCE($1, pickup_address),
          dropoff_address = COALESCE($2, dropoff_address),
          pickup_time = COALESCE($3, pickup_time),
          service_id = COALESCE($4, service_id),
          service_name = COALESCE($5, service_name),
          vehicle_capacity = COALESCE($6, vehicle_capacity),
          base_fare = COALESCE($7, base_fare),
          discount_amount = COALESCE($8, discount_amount),
          final_fare = COALESCE($9, final_fare),
          fare_amount = COALESCE($9, fare_amount),
          occupied_duration_minutes = COALESCE($10, occupied_duration_minutes)
      WHERE id = $11
      RETURNING *
    `;
    const res = await db.query(sql, [
      pickupAddress,
      dropoffAddress,
      pickupTime,
      serviceId,
      serviceName,
      vehicleCapacity,
      baseFare,
      discountAmount,
      finalFare,
      occupiedDurationMinutes,
      id,
    ]);
    return res.rows[0];
  }

  static async cancelBooking(id) {
    const res = await db.query(
      `UPDATE bookings 
       SET status = 'CANCELLED', vehicle_id = NULL, driver_id = NULL 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return res.rows[0];
  }

  static async getAllForStaff() {
    const sql = `
      SELECT b.*, a.name AS customer_name, a.email AS customer_email, a.telephone AS customer_phone,
             v.reg_number AS vehicle_reg, v.make_model AS vehicle_model,
             v.colour AS vehicle_colour, v.capacity AS vehicle_capacity_seats, v.status AS vehicle_status,
             COALESCE(d.name, vd.name) AS driver_name, 
             COALESCE(d.telephone, vd.telephone) AS driver_phone,
             COALESCE(d.driver_code, vd.driver_code) AS driver_code
      FROM bookings b
      JOIN accounts a ON b.account_id = a.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN drivers vd ON v.driver_id = vd.id
      ORDER BY b.created_at DESC
    `;
    const res = await db.query(sql);
    return res.rows;
  }

  static async countCompletedByCustomer(accountId) {
    const sql = `SELECT COUNT(*) AS total FROM bookings WHERE account_id = $1 AND status = 'COMPLETED'`;
    const res = await db.query(sql, [accountId]);
    return parseInt(res.rows[0]?.total ?? res.rows[0]?.count ?? 0, 10);
  }

  /**
   * P08: Vehicle Popularity (Count of Completed bookings per vehicle, ordered descending)
   */
  static async getVehiclePopularity() {
    const sql = `
      SELECT v.id, v.reg_number, v.make_model, v.capacity, COUNT(b.id) AS completed_trips_count
      FROM vehicles v
      LEFT JOIN bookings b ON v.id = b.vehicle_id AND b.status = 'COMPLETED'
      GROUP BY v.id, v.reg_number, v.make_model, v.capacity
      ORDER BY completed_trips_count DESC, v.id ASC
    `;
    const res = await db.query(sql);
    return res.rows;
  }

  /**
   * P08: Customer Loyalty (Count of Completed bookings per customer, ordered descending)
   */
  static async getCustomerLoyalty() {
    const sql = `
      SELECT a.id, a.account_code, a.name, a.email, a.telephone, COUNT(b.id) AS completed_trips_count
      FROM accounts a
      LEFT JOIN bookings b ON a.id = b.account_id AND b.status = 'COMPLETED'
      WHERE a.role != 'STAFF'
      GROUP BY a.id, a.account_code, a.name, a.email, a.telephone
      ORDER BY completed_trips_count DESC, a.id ASC
    `;
    const res = await db.query(sql);
    return res.rows;
  }
}

module.exports = BookingModel;
