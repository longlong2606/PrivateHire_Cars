const db = require('../config/db');

class EnquiryModel {
  static async create({ accountId = null, bookingId = null, name, email, subject, message }) {
    const sql = `
      INSERT INTO enquiries (account_id, booking_id, name, email, subject, message, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
      RETURNING *
    `;
    const res = await db.query(sql, [
      accountId,
      bookingId,
      name.trim(),
      email.trim(),
      subject.trim(),
      message.trim(),
    ]);
    return res.rows[0];
  }

  static async getAll() {
    const sql = `
      SELECT e.*, 
             b.booking_code,
             'ENQ-' || LPAD(e.id::text, 5, '0') AS reference_code,
             'ENQ-' || LPAD(e.id::text, 5, '0') AS enquiry_code,
             e.name AS customer_name,
             e.email AS reply_email,
             sa.name AS staff_name
      FROM enquiries e
      LEFT JOIN bookings b ON e.booking_id = b.id
      LEFT JOIN accounts sa ON e.replied_by_staff_id = sa.id
      ORDER BY e.created_at DESC
    `;
    const res = await db.query(sql);
    return res.rows;
  }

  static async reply(id, staffId, replyText) {
    const sql = `
      UPDATE enquiries
      SET staff_reply = $2, replied_by_staff_id = $3, status = 'RESOLVED', replied_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const res = await db.query(sql, [id, replyText.trim(), staffId]);
    return res.rows[0] || null;
  }
}

module.exports = EnquiryModel;

