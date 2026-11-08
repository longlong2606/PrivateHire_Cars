/**
 * Link every vehicle in the fleet to at least 1 licensed chauffeur.
 * Guarantees that 100% of vehicles in the database have a designated driver.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../config/db');

async function linkAllVehiclesToDrivers() {
  console.log('--- Bắt đầu liên kết mỗi chiếc xe với ít nhất 1 tài xế ---');

  // Chờ pool sẵn sàng
  await new Promise(r => setTimeout(r, 2000));

  // 1. Đảm bảo cấu trúc cột và bảng liên kết
  await db.query(`
    ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS vehicle_drivers (
      id SERIAL PRIMARY KEY,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      is_primary BOOLEAN DEFAULT TRUE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_vehicle_driver UNIQUE (vehicle_id, driver_id)
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_drivers_vehicle ON vehicle_drivers(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_drivers_driver ON vehicle_drivers(driver_id);
  `);

  console.log('✅ Bảng và cột liên kết xe - tài xế đã sẵn sàng.');

  // 2. Lấy toàn bộ xe và tài xế
  const vRes = await db.query('SELECT id, reg_number, make_model, driver_id FROM vehicles ORDER BY id ASC');
  const dRes = await db.query('SELECT id, driver_code, name, telephone FROM drivers ORDER BY id ASC');

  const vehicles = vRes.rows;
  const drivers = dRes.rows;

  console.log(`📊 Tìm thấy: ${vehicles.length} xe và ${drivers.length} tài xế.`);

  if (drivers.length === 0) {
    console.error('❌ Không tìm thấy tài xế nào trong cơ sở dữ liệu!');
    process.exit(1);
  }

  // 3. Tiến hành gán tài xế cho từng chiếc xe (Đảm bảo 100% xe đều có ít nhất 1 tài xế)
  let updatedCount = 0;
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    // Chọn tài xế tương ứng (vòng lặp modulo nếu số lượng lệch)
    const assignedDriver = drivers[i % drivers.length];

    // Cập nhật driver_id trên vehicles
    await db.query(
      'UPDATE vehicles SET driver_id = $1 WHERE id = $2',
      [assignedDriver.id, v.id]
    );

    // Ghi nhận vào bảng liên kết vehicle_drivers
    await db.query(
      `INSERT INTO vehicle_drivers (vehicle_id, driver_id, is_primary)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (vehicle_id, driver_id) DO NOTHING`,
      [v.id, assignedDriver.id]
    );

    updatedCount++;
  }

  // 4. Kiểm tra lại tính toàn vẹn (Số xe chưa có tài xế phải = 0)
  const unlinkedRes = await db.query('SELECT COUNT(*) FROM vehicles WHERE driver_id IS NULL');
  const unlinkedCount = parseInt(unlinkedRes.rows[0].count, 10);

  const sampleRes = await db.query(`
    SELECT v.id, v.reg_number, v.make_model, d.name AS driver_name, d.driver_code, d.telephone AS driver_phone
    FROM vehicles v
    JOIN drivers d ON v.driver_id = d.id
    ORDER BY v.id ASC
    LIMIT 5
  `);

  console.log('---------------------------------------------------------');
  console.log(`🎉 KẾT QUẢ LIÊN KẾT XE - TÀI XẾ:`);
  console.log(`🚗 Tổng số xe đã liên kết: ${updatedCount} / ${vehicles.length}`);
  console.log(`⚠️ Số xe chưa có tài xế: ${unlinkedCount} (Yêu cầu: = 0)`);
  console.log('🔍 Mẫu 5 xe liên kết đầu tiên:');
  console.table(sampleRes.rows);
  console.log('---------------------------------------------------------');

  process.exit(0);
}

linkAllVehiclesToDrivers().catch(err => {
  console.error('Lỗi khi liên kết xe và tài xế:', err);
  process.exit(1);
});

