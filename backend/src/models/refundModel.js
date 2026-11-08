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
      SELECT rr.*, b.booking_code, a.name AS customer_name, a.email AS customer_email
      FROM refund_requests rr
      JOIN bookings b ON rr.booking_id = b.id
      JOIN accounts a ON rr.account_id = a.id
      WHERE rr.status = 'PENDING'
      ORDER BY rr.created_at ASC
    `;
    const res = await db.query(sql);
    return res.rows;
  }

  static async processRefund(id, staffId) {
    const sql = `
      UPDATE refund_requests
      SET status = 'PROCESSED', processed_by_staff_id = $2, processed_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const res = await db.query(sql, [id, staffId]);
    return res.rows[0] || null;
  }
}

module.exports = RefundModel;

