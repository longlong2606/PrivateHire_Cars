/**
 * SCRUM PROJECT - DATABASE CLEAN SCRIPT
 * Xóa sạch bảng accounts để đăng ký và test lại từ đầu
 */
require('dotenv').config();
const { Pool } = require('pg');

async function cleanDatabase() {
  const connectionString = process.env.DATABASE_URL;
  let pool;
  let targetDesc = '';

  if (connectionString) {
    targetDesc = 'Render Cloud PostgreSQL (DataGrip)';
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
  } else {
    targetDesc = 'Local PostgreSQL (localhost:5432)';
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'scrum_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
  }

  console.log('\n===============================================================');
  console.log('🧹 [XÓA SẠCH DỮ LIỆU TÀI KHOẢN ĐỂ TEST LẠI]');
  console.log('===============================================================');
  console.log(`📌 Database đích: ${targetDesc}`);

  try {
    const client = await pool.connect();
    await client.query('TRUNCATE TABLE accounts RESTART IDENTITY CASCADE');
    console.log('✅ Đã xóa toàn bộ dữ liệu trong bảng "accounts"!');
    console.log('✅ ID tài khoản đã được reset về số 1 (ACC-XXXXXX).');
    console.log('💳 Bảng thẻ test "mock_cards" (AC3) vẫn được bảo toàn nguyên vẹn.');
    client.release();
    await pool.end();

    console.log('🎉 SẴN SÀNG ĐĂNG KÝ VÀ ĐĂNG NHẬP MỚI TỪ ĐẦU!\n');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
    process.exit(1);
  }
}

cleanDatabase();

