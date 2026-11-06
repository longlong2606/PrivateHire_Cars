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
    // Tạo bảng nếu chưa có trước khi truncate
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        ip_address VARCHAR(100),
        user_agent VARCHAR(255),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        booking_code VARCHAR(50) UNIQUE NOT NULL,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        pickup_address VARCHAR(255) NOT NULL,
        dropoff_address VARCHAR(255) NOT NULL,
        pickup_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        passenger_name VARCHAR(100) NOT NULL,
        passenger_phone VARCHAR(50) NOT NULL,
        car_type VARCHAR(50) DEFAULT 'Executive Saloon',
        fare_amount NUMERIC(10, 2) NOT NULL DEFAULT 45.00,
        payment_method VARCHAR(50) DEFAULT 'MOCK_CARD',
        card_ref_used VARCHAR(100),
        status VARCHAR(50) DEFAULT 'CONFIRMED',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query('TRUNCATE TABLE accounts, sessions, bookings RESTART IDENTITY CASCADE');
    console.log('✅ Đã xóa toàn bộ dữ liệu trong bảng "accounts", "sessions", "bookings"!');
    console.log('✅ ID tài khoản và cuốc xe đã được reset về số 1.');
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

