const db = require('../config/db');

class SpecialOfferModel {
  static async findByCode(code) {
    if (!code) return null;
    const res = await db.query(
      'SELECT * FROM special_offers WHERE UPPER(code) = UPPER($1) AND is_used = FALSE LIMIT 1',
      [code.trim()]
    );
    return res.rows[0] || null;
  }

  static async getOffersForAccount(accountId) {
    const res = await db.query(
      'SELECT * FROM special_offers WHERE account_id = $1 ORDER BY created_at DESC',
      [accountId]
    );
    return res.rows;
  }

  static async createOffer({ code, accountId, discountAmount = 10.00 }) {
    const sql = `
      INSERT INTO special_offers (code, account_id, discount_amount, is_used)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (code) DO NOTHING
      RETURNING *
    `;
    const res = await db.query(sql, [code.trim().toUpperCase(), accountId, discountAmount]);
    return res.rows[0] || null;
  }

  static async markUsed(code) {
    const res = await db.query(
      'UPDATE special_offers SET is_used = TRUE, used_at = CURRENT_TIMESTAMP WHERE UPPER(code) = UPPER($1) RETURNING *',
      [code.trim()]
    );
    return res.rows[0] || null;
  }
}

module.exports = SpecialOfferModel;

