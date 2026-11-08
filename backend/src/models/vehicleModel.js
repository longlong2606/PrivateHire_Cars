const db = require('../config/db');

class VehicleModel {
  static async getAll() {
    const res = await db.query(`
      SELECT v.*, 
             d.name AS driver_name, 
             d.driver_code, 
             d.telephone AS driver_phone, 
             d.reference_number AS driver_ref,
             d.status AS driver_status
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      ORDER BY v.id ASC
    `);
    return res.rows;
  }

  static async findById(id) {
    const res = await db.query(`
      SELECT v.*, 
             d.name AS driver_name, 
             d.driver_code, 
             d.telephone AS driver_phone, 
             d.reference_number AS driver_ref,
             d.status AS driver_status
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      WHERE v.id = $1
    `, [id]);
    return res.rows[0] || null;
  }

  /**
   * P02 Availability Check:
   * Vehicle is unavailable if it has an overlapping Confirmed, Assigned, or EnRoute booking.
   * Pending does not reserve a vehicle.
   */
  static async getAvailableVehicles({ capacity = 4, pickupTime = new Date(), durationMinutes = 60 }) {
    const start = new Date(pickupTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const vehiclesRes = await db.query(`
      SELECT v.*, 
             d.name AS driver_name, 
             d.driver_code, 
             d.telephone AS driver_phone, 
             d.reference_number AS driver_ref,
             d.status AS driver_status
      FROM vehicles v
      LEFT JOIN drivers d ON v.driver_id = d.id
      WHERE v.status = $1 AND v.capacity >= $2 
      ORDER BY v.capacity ASC, v.id ASC
    `, ['ACTIVE', capacity]);

    const activeBookings = await db.query(
      `SELECT vehicle_id, pickup_time, occupied_duration_minutes 
       FROM bookings 
       WHERE vehicle_id IS NOT NULL 
         AND status IN ('CONFIRMED', 'ASSIGNED', 'ENROUTE')`
     );

    const conflictingVehicleIds = new Set();
    for (const b of activeBookings.rows) {
      const bStart = new Date(b.pickup_time);
      const bDuration = (parseInt(b.occupied_duration_minutes, 10) || 60) * 60 * 1000;
      const bEnd = new Date(bStart.getTime() + bDuration);

      if (start < bEnd && end > bStart) {
        conflictingVehicleIds.add(b.vehicle_id);
      }
    }

    return vehiclesRes.rows.filter(v => !conflictingVehicleIds.has(v.id));
  }

  /**
   * Create vehicle and ensure it is linked to at least 1 driver
   */
  static async create({ regNumber, makeModel, colour, capacity = 4, status = 'ACTIVE', driverId }) {
    let resolvedDriverId = driverId;
    if (!resolvedDriverId) {
      // Auto-assign to an active driver to guarantee every vehicle has at least 1 driver
      const freeDriver = await db.query("SELECT id FROM drivers WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1");
      if (freeDriver.rows.length > 0) {
        resolvedDriverId = freeDriver.rows[0].id;
      }
    }

    const sql = `
      INSERT INTO vehicles (reg_number, make_model, colour, capacity, status, driver_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const res = await db.query(sql, [
      regNumber.trim().toUpperCase(),
      makeModel.trim(),
      colour.trim(),
      capacity,
      status,
      resolvedDriverId,
    ]);
    const newVehicle = res.rows[0];

    if (resolvedDriverId) {
      await db.query(
        `INSERT INTO vehicle_drivers (vehicle_id, driver_id, is_primary)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (vehicle_id, driver_id) DO NOTHING`,
        [newVehicle.id, resolvedDriverId]
      );
    }

    return this.findById(newVehicle.id);
  }

  static async assignDriver(vehicleId, driverId) {
    await db.query('UPDATE vehicles SET driver_id = $1 WHERE id = $2', [driverId, vehicleId]);
    await db.query(
      `INSERT INTO vehicle_drivers (vehicle_id, driver_id, is_primary)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (vehicle_id, driver_id) DO NOTHING`,
      [vehicleId, driverId]
    );
    return this.findById(vehicleId);
  }

  static async updateStatus(id, status) {
    const res = await db.query('UPDATE vehicles SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return res.rows[0];
  }
}

module.exports = VehicleModel;
