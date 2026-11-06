const db = require('../config/db');

class SessionModel {
  /**
   * Tạo session mới khi người dùng đăng nhập thành công
   */
  static async create({ accountId, sessionToken, expiresAt, ipAddress = null, userAgent = null }) {
    const sql = `
      INSERT INTO sessions (session_token, account_id, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, session_token, account_id, expires_at, created_at
    `;
    const result = await db.query(sql, [sessionToken, accountId, expiresAt, ipAddress, userAgent]);
    return result.rows[0];
  }

  /**
   * Tìm session còn hiệu lực kèm thông tin account
   */
  static async findValidSession(sessionToken) {
    if (!sessionToken) return null;
    const sql = `
      SELECT 
        s.id as session_id,
        s.session_token,
        s.expires_at,
        s.created_at as session_created_at,
        a.id as account_id,
        a.account_code,
        a.name,
        a.email,
        a.address,
        a.telephone,
        a.mock_card_ref,
        a.status
      FROM sessions s
      JOIN accounts a ON s.account_id = a.id
      WHERE s.session_token = $1 AND s.expires_at > NOW()
    `;
    const result = await db.query(sql, [sessionToken.trim()]);
    return result.rows[0] || null;
  }

  /**
   * Xóa session khi người dùng đăng xuất (Sign-out)
   */
  static async deleteByToken(sessionToken) {
    if (!sessionToken) return false;
    const sql = `DELETE FROM sessions WHERE session_token = $1`;
    const result = await db.query(sql, [sessionToken.trim()]);
    return result.rowCount > 0;
  }

  /**
   * Xóa tất cả session của 1 account (ví dụ khi đổi mật khẩu)
   */
  static async deleteAllForAccount(accountId) {
    const sql = `DELETE FROM sessions WHERE account_id = $1`;
    const result = await db.query(sql, [accountId]);
    return result.rowCount;
  }

  /**
   * Dọn dẹp các session đã hết hạn
   */
  static async cleanExpired() {
    const sql = `DELETE FROM sessions WHERE expires_at <= NOW()`;
    const result = await db.query(sql);
    return result.rowCount;
  }
}

module.exports = SessionModel;
