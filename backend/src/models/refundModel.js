const db = require('../config/db');

class RefundModel {
  static async create({ bookingId, accountId, amount, reason }) {
    const sql = `
      INSERT INTO refund_requests (booking_id, account_id, amount, reason, status)
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
    `;
    const res = await db.query(sql, [bookingId, accountId, amount, reason]);
    return res.rows[0];
  }

  static async getPending() {
    const sql = `
      SELECT 
        rr.*, 
        b.booking_code,
        b.pickup_address,
        b.dropoff_address,
        b.pickup_time,
        b.service_name,
        b.car_type,
        b.vehicle_capacity,
        b.base_fare,
        b.discount_amount,
        b.promo_code,
        b.promo_discount,
        b.final_fare,
        b.fare_amount,
        b.payment_method,
        b.payment_status,
        b.card_ref_used,
        b.status AS booking_status,
        b.notes AS booking_notes,
        b.created_at AS booking_created_at,
        a.name AS customer_name,
        a.email AS customer_email,
        a.telephone AS customer_phone,
        sa.name AS staff_name,
        sa.email AS staff_email
      FROM refund_requests rr
      JOIN bookings b ON rr.booking_id = b.id
      JOIN accounts a ON rr.account_id = a.id
      LEFT JOIN accounts sa ON rr.processed_by_staff_id = sa.id
      ORDER BY rr.created_at DESC
    `;
    const res = await db.query(sql);
    return res.rows;
  }

  static async processRefund(id, staffId, staffNotes = '') {
    const sql = `
      UPDATE refund_requests
      SET status = 'PROCESSED', processed_by_staff_id = $2, processed_at = CURRENT_TIMESTAMP, staff_notes = $3
      WHERE id = $1
      RETURNING *
    `;
    const res = await db.query(sql, [id, staffId, staffNotes ? String(staffNotes).trim() : null]);
    return res.rows[0] || null;
  }
}

module.exports = RefundModel;

