const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initDatabase() {
  console.log(' [Init DB] Đang khởi tạo bảng dữ liệu cho PostgreSQL...');
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Chạy toàn bộ file schema.sql
    await pool.query(sql);
    console.log('[Init DB] Đã tạo thành công các bảng: "accounts" và "simulated_cards"!');

    // Đọc thử bảng accounts để kiểm tra
    const countRes = await pool.query('SELECT COUNT(*) FROM accounts');
    console.log(` [Init DB] Số lượng tài khoản hiện tại: ${countRes.rows[0].count}`);

    // Đọc thử bảng simulated_cards
    const cardRes = await pool.query('SELECT card_code, card_type, is_assigned FROM simulated_cards');
    console.log(` [Init DB] Đã tải ${cardRes.rowCount} mã thẻ giả lập mẫu:`);
    cardRes.rows.forEach(c => console.log(`   - ${c.card_code} (${c.card_type}) - Đã dùng: ${c.is_assigned}`));

    console.log(' [Init DB] Hoàn thành cấu hình cơ sở dữ liệu!');
  } catch (error) {
    console.error(' [Init DB] Lỗi khi khởi tạo database:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;

