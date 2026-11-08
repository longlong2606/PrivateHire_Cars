const db = require('../config/db');

class VehicleModel {
  static async getAll() {
    const res = await db.query('SELECT * FROM vehicles ORDER BY id ASC');
    return res.rows;
  }

  static async findById(id) {
    const res = await db.query('SELECT * FROM vehicles WHERE id = $1', [id]);
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

    const vehiclesRes = await db.query(
      'SELECT * FROM vehicles WHERE status = $1 AND capacity >= $2 ORDER BY capacity ASC, id ASC',
      ['ACTIVE', capacity]
    );

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

  static async create({ regNumber, makeModel, colour, capacity = 4, status = 'ACTIVE' }) {
    const sql = `
      INSERT INTO vehicles (reg_number, make_model, colour, capacity, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await db.query(sql, [regNumber.trim().toUpperCase(), makeModel.trim(), colour.trim(), capacity, status]);
    return res.rows[0];
  }

  static async updateStatus(id, status) {
    const res = await db.query('UPDATE vehicles SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return res.rows[0];
  }
}

module.exports = VehicleModel;
