const db = require('../config/db');

class AccountModel {
  /**
   * Lấy danh sách tất cả tài khoản
   */
  static async findAll() {
    const sql = `
      SELECT id, account_code, name, email, address, telephone, mock_card_ref, status, created_at 
      FROM accounts 
      ORDER BY id DESC
    `;
    const result = await db.query(sql);
    return result.rows;
  }

  /**
   * Tìm tài khoản theo ID
   */
  static async findById(id) {
    const sql = `
      SELECT id, account_code, name, email, address, telephone, mock_card_ref, status, created_at 
      FROM accounts 
      WHERE id = $1
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Tìm tài khoản theo Email (dùng để check trùng lặp theo AC2)
   */
  static async findByEmail(email) {
    const sql = `
      SELECT * FROM accounts WHERE LOWER(email) = LOWER($1)
    `;
    const result = await db.query(sql, [email.trim()]);
    return result.rows[0] || null;
  }


  static async create({ accountCode, name, email, address, telephone, passwordHash, mockCardRef }) {
    const sql = `
      INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
      RETURNING id, account_code, name, email, address, telephone, mock_card_ref, status, created_at
    `;
    const values = [
      accountCode,
      name.trim(),
      email.trim().toLowerCase(),
      address.trim(),
      telephone.trim(),
      passwordHash,
      mockCardRef.trim(),
    ];
    const result = await db.query(sql, values);
    return result.rows[0];
  }


  static async getMockCards() {
    try {
      const sql = `
        SELECT id, card_code, card_brand, masked_reference, expiry_mock, is_active
        FROM mock_cards
        WHERE is_active = TRUE
        ORDER BY id ASC
      `;
      const result = await db.query(sql);
      if (result.rows && result.rows.length > 0) {
        return result.rows;
      }
    } catch (err) {
      console.warn('⚠️ Lỗi truy vấn mock_cards, sử dụng fallback mẫu:', err.message);
    }

    return [
      { id: 1, card_code: 'MOCK_VISA_4242', card_brand: 'Visa Mock', masked_reference: '•••• •••• •••• 4242 (Visa Test Card)', expiry_mock: '12/28', is_active: true },
      { id: 2, card_code: 'MOCK_MC_5555', card_brand: 'Mastercard Mock', masked_reference: '•••• •••• •••• 5555 (Mastercard Test Card)', expiry_mock: '08/29', is_active: true },
      { id: 3, card_code: 'MOCK_JCB_3528', card_brand: 'JCB Mock', masked_reference: '•••• •••• •••• 3528 (JCB Test Card)', expiry_mock: '10/27', is_active: true },
      { id: 4, card_code: 'MOCK_AMEX_3782', card_brand: 'Amex Mock', masked_reference: '•••• •••••• •3782 (Amex Test Card)', expiry_mock: '05/30', is_active: true },
    ];
  }

  /**
   * Hàm kiểm thử Đọc / Ghi cơ sở dữ liệu (Đáp ứng cụ thể Bước 2)
   */
  static async testReadWrite() {
    // 1. Kiểm tra ghi dữ liệu tạm
    const testCode = 'TEST-ACC-' + Date.now().toString().slice(-4);
    const insertSql = `
      INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'TEST')
      RETURNING *
    `;
    const testValues = [
      testCode,
      'Test User',
      `test_${Date.now()}@example.com`,
      '123 Test Street, Hanoi',
      '0987654321',
      '$2a$10$dummyHashValueForTestingDBReadWrite...',
      '•••• •••• •••• 4242 (Visa Test Card)',
    ];

    const writeResult = await db.query(insertSql, testValues);
    const createdId = writeResult.rows[0].id;

    // 2. Kiểm tra đọc dữ liệu vừa ghi
    const readSql = `SELECT * FROM accounts WHERE id = $1`;
    const readResult = await db.query(readSql, [createdId]);

    // 3. Dọn dẹp dữ liệu test
    await db.query(`DELETE FROM accounts WHERE id = $1`, [createdId]);

    return {
      writeSuccess: writeResult.rowCount > 0,
      readSuccess: readResult.rowCount > 0,
      writtenRecord: writeResult.rows[0],
      readRecord: readResult.rows[0],
    };
  }
}

module.exports = AccountModel;

