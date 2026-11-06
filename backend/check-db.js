/**
 * SCRUM PROJECT - DATABASE CHECK SCRIPT
 * Chạy lệnh: node check-db.js (hoặc npm run db:check)
 */
require('dotenv').config();
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

    client.release();
    await pool.end();

    console.log('\n===============================================================');
    console.log('🎉 KIỂM TRA HOÀN TẤT: CƠ SỞ DỮ LIỆU HOẠT ĐỘNG HOÀN TOÀN TỐT!');
    console.log('===============================================================\n');

  } catch (error) {
    console.error('\n❌ LỖI KẾT NỐI DATABASE:', error.message);
    console.error('👉 Hãy kiểm tra lại kết nối mạng hoặc biến DATABASE_URL trong backend/.env\n');
    process.exit(1);
  }
}

checkDatabase();
