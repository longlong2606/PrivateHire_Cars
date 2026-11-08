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
    const res = await db.query(
      'SELECT * FROM notifications WHERE account_id = $1 ORDER BY created_at DESC LIMIT 20',
      [accountId]
    );
    return res.rows;
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

