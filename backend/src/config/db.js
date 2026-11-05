const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let activePool = null;
let dbStatus = {
  connected: false,
  mode: 'DISCONNECTED', // 'POSTGRESQL' or 'PG_MEM_FALLBACK'
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'scrum_db',
  user: process.env.DB_USER || 'postgres',
  error: null,
};

// Cấu hình pool kết nối PostgreSQL thực tế
const realPool = new Pool({
  host: dbStatus.host,
  port: dbStatus.port,
  user: dbStatus.user,
  password: process.env.DB_PASSWORD || 'postgres',
  database: dbStatus.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000, // Timeout sau 3 giây nếu không kết nối được
});

// Hàm khởi tạo bảng từ schema.sql
const executeSchema = async (targetPool) => {
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await targetPool.query(sql);
  }
};

// Khởi tạo kết nối
const initConnection = async () => {
  try {
    const client = await realPool.connect();
    const result = await client.query('SELECT NOW() as server_time, current_database() as db_name');
    client.release();

    activePool = realPool;
    dbStatus.connected = true;
    dbStatus.mode = 'POSTGRESQL';
    dbStatus.database = result.rows[0].db_name;
    dbStatus.error = null;

    console.log('---------------------------------------------------------');
    console.log(`✅ [Database] Đã kết nối PostgreSQL thành công!`);
    console.log(`📡 [Database] Host: ${dbStatus.host}:${dbStatus.port} | DB: ${dbStatus.database}`);
    console.log('---------------------------------------------------------');

    // Tự động tạo bảng nếu chưa có
    await executeSchema(activePool);
    console.log('✅ [Database] Đã đồng bộ bảng "accounts" và "mock_cards" vào PostgreSQL!');

    return true;
  } catch (error) {
    dbStatus.error = error.message;
    console.warn('---------------------------------------------------------');
    console.warn(`⚠️ [Database] Không thể kết nối tới PostgreSQL (${dbStatus.host}:${dbStatus.port})`);
    console.warn(`   Nguyên nhân: ${error.message}`);
    console.warn(`🔄 [Database] Tự động kích hoạt cơ chế pg-mem (PostgreSQL in-memory) để ứng dụng có thể chạy ngay trên máy nhóm mà không bị dừng.`);
    console.warn(`💡 [Database Tip] Để kết nối PostgreSQL thật: cài PostgreSQL hoặc chạy "docker compose up -d"`);
    console.warn('---------------------------------------------------------');

    try {
      const { newDb } = require('pg-mem');
      const memDb = newDb();
      const { Pool: MemPool } = memDb.adapters.createPg();
      activePool = new MemPool();

      await executeSchema(activePool);

      dbStatus.connected = true;
      dbStatus.mode = 'PG_MEM_FALLBACK';
      console.log('✅ [Database Fallback] pg-mem đã sẵn sàng với bảng "accounts" và "mock_cards" mẫu!');
      return true;
    } catch (memError) {
      console.error('❌ [Database Fallback] Lỗi pg-mem:', memError.message);
      dbStatus.connected = false;
      return false;
    }
  }
};

// Hàm query đa năng
const query = async (text, params) => {
  if (!activePool) {
    await initConnection();
  }
  return activePool.query(text, params);
};

module.exports = {
  query,
  initConnection,
  getDbStatus: () => ({ ...dbStatus }),
  getPool: () => activePool,
};
