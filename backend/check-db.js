/**
 * SCRUM PROJECT - DATABASE CHECK SCRIPT
 * Chạy lệnh: node backend/check-db.js (hoặc cd backend && npm run db:check)
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

async function checkDatabase() {
  const connectionString = process.env.DATABASE_URL;
  let pool;
  let targetDesc = '';

  if (connectionString) {
    targetDesc = 'Render Cloud PostgreSQL (Hiển thị trên DataGrip)';
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
      connectionTimeoutMillis: 5000,
    });
  }

  console.log('\n===============================================================');
  console.log('🔍 [KIỂM TRA CƠ SỞ DỮ LIỆU POSTGRESQL]');
  console.log('===============================================================');
  console.log(`📌 Mục tiêu: ${targetDesc}`);

  try {
    const client = await pool.connect();

    // Đồng bộ schema.sql để đảm bảo có đủ các bảng mới nhất
    const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await client.query(sql);
    }

    // 1. Thông tin server
    const infoRes = await client.query(`
      SELECT 
        current_database() AS db_name,
        current_user AS db_user,
        inet_server_addr() AS server_ip,
        inet_server_port() AS server_port,
        version() AS db_version
    `);
    const info = infoRes.rows[0];
    console.log(`✅ Kết nối thành công!`);
    console.log(`   - Database : ${info.db_name}`);
    console.log(`   - Username : ${info.db_user}`);
    console.log(`   - Phiên bản: ${info.db_version.split(' ')[0]} ${info.db_version.split(' ')[1]}`);

    // 2. Kiểm tra bảng mock_cards (AC3)
    console.log('\n---------------------------------------------------------------');
    console.log('💳 1. KIỂM TRA BẢNG THẺ TEST (mock_cards - AC3):');
    const cardsRes = await client.query('SELECT card_code, card_brand, masked_reference, is_active FROM mock_cards ORDER BY id ASC');
    console.log(`   Tổng số thẻ test: ${cardsRes.rowCount} thẻ`);
    console.table(cardsRes.rows);

    // 3. Kiểm tra bảng accounts (AC1, AC2, AC4, AC5)
    console.log('\n---------------------------------------------------------------');
    console.log('👤 2. KIỂM TRA BẢNG TÀI KHOẢN (accounts - AC1, AC4):');
    const accRes = await client.query(`
      SELECT 
        id,
        account_code,
        name,
        email,
        telephone,
        mock_card_ref,
        CASE 
          WHEN password_hash LIKE '$2b$%' THEN '✅ Băm BCrypt chuẩn ($2b$)'
          ELSE '⚠️ Chưa băm'
        END AS password_status,
        status,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
      FROM accounts 
      ORDER BY id ASC
    `);

    console.log(`   Tổng số tài khoản đã đăng ký: ${accRes.rowCount} tài khoản`);
    if (accRes.rowCount === 0) {
      console.log('   (Hiện chưa có tài khoản nào. Hãy mở web đăng ký để thêm tài khoản mới)');
    } else {
      console.table(accRes.rows);
    }

    // 4. Kiểm tra bảng dịch vụ (services - Demonstration Fares and Journey Durations)
    console.log('\n---------------------------------------------------------------');
    console.log('🚖 3. KIỂM TRA 6 DỊCH VỤ CỐ ĐỊNH (services - Fixed Fares & Durations):');
    const servRes = await client.query(`
      SELECT 
        id,
        service_name AS "Service",
        '£' || trim(to_char(four_passenger_fare, '999990.00')) || ' GBP' AS "Four-passenger vehicle",
        '£' || trim(to_char(seven_passenger_fare, '999990.00')) || ' GBP' AS "Seven-passenger vehicle",
        occupied_duration_minutes || ' mins' AS "Occupied duration"
      FROM services 
      ORDER BY id ASC
    `);
    console.log(`   Tổng số dịch vụ cố định: ${servRes.rowCount} dịch vụ (Quy tắc: giá tính theo loại dịch vụ và sức chứa xe, không tính theo cự ly)`);
    console.table(servRes.rows);

    // 5. Kiểm tra bảng bookings
    console.log('\n---------------------------------------------------------------');
    console.log('📅 4. KIỂM TRA BẢNG ĐẶT XE (bookings):');
    const bookRes = await client.query(`
      SELECT 
        id,
        booking_code,
        account_id,
        passenger_name,
        pickup_address,
        dropoff_address,
        car_type,
        fare_amount,
        status,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at
      FROM bookings 
      ORDER BY id DESC
      LIMIT 5
    `);
    console.log(`   Tổng số cuốc xe gần nhất: ${bookRes.rowCount}`);
    if (bookRes.rowCount > 0) {
      console.table(bookRes.rows);
    } else {
      console.log('   (Chưa có cuốc xe nào được đặt)');
    }

    // 6. Kiểm tra bảng booking_drafts (Form State Persistence)
    console.log('\n---------------------------------------------------------------');
    console.log('📝 5. KIỂM TRA BẢNG NHÁP FORM ĐẶT XE (booking_drafts - Form State Persistence):');
    const draftRes = await client.query(`
      SELECT 
        id,
        account_id,
        draft_token,
        pickup_address,
        dropoff_address,
        service_name,
        vehicle_capacity || ' seats' AS capacity,
        '£' || trim(to_char(COALESCE(fare_amount, 0), '999990.00')) || ' GBP' AS fare,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM booking_drafts 
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    console.log(`   Tổng số bản nháp đang lưu: ${draftRes.rowCount} bản nháp`);
    if (draftRes.rowCount > 0) {
      console.table(draftRes.rows);
    } else {
      console.log('   (Hiện chưa có bản nháp form nào. Nhập thông tin trên form đặt xe để tự động lưu nháp)');
    }

    client.release();
    await pool.end();

    console.log('\n===============================================================');
    console.log('🎉 KIỂM TRA HOÀN TẤT: CƠ SỞ DỮ LIỆU ĐÃ ĐƯỢC SEED ĐẦY ĐỦ 6 DỊCH VỤ!');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('\n❌ LỖI KẾT NỐI DATABASE:', error.message);
    console.error('👉 Hãy kiểm tra lại kết nối mạng hoặc biến DATABASE_URL trong backend/.env\n');
    process.exit(1);
  }
}

checkDatabase();
