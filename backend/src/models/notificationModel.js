const db = require('../config/db');

class NotificationModel {
  static async create({ accountId, bookingId = null, title, message, type = 'GENERAL' }) {
    const sql = `
      INSERT INTO notifications (account_id, booking_id, title, message, type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await db.query(sql, [accountId, bookingId, title.trim(), message.trim(), type]);
    return res.rows[0];
  }

  static async getForAccount(accountId) {
    const sql = `
      SELECT 
        n.*,
        b.booking_code,
        rr.amount AS refund_amount,
        rr.reason AS refund_trigger_reason,
        rr.staff_notes,
        rr.processed_at AS refund_processed_at,
        sa.name AS processed_by_staff_name,
        sa.email AS processed_by_staff_email
      FROM notifications n
      LEFT JOIN bookings b ON n.booking_id = b.id
      LEFT JOIN refund_requests rr ON (n.type = 'REFUND_PROCESSED' AND n.booking_id = rr.booking_id)
      LEFT JOIN accounts sa ON rr.processed_by_staff_id = sa.id
      WHERE n.account_id = $1
      ORDER BY n.created_at DESC
      LIMIT 20
    `;
    const res = await db.query(sql, [accountId]);
    return res.rows;
  }

  static async getByAccountId(accountId) {
    return this.getForAccount(accountId);
  }

  static async markRead(id, accountId) {
    const res = await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND account_id = $2 RETURNING *',
      [id, accountId]
    );
    return res.rows[0] || null;
  }
}

module.exports = NotificationModel;

