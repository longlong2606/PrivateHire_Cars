const db = require('../config/db');

class DriverModel {
  static async getAll() {
    const res = await db.query(`
      SELECT d.*, 
             v.id AS vehicle_id, 
             v.reg_number AS vehicle_reg, 
             v.make_model AS vehicle_make,
             v.colour AS vehicle_colour,
             v.capacity AS vehicle_capacity
      FROM drivers d
      LEFT JOIN vehicles v ON d.id = v.driver_id
      ORDER BY d.id ASC
    `);
    return res.rows;
  }

  static async findById(id) {
    const res = await db.query(`
      SELECT d.*, 
             v.id AS vehicle_id, 
             v.reg_number AS vehicle_reg, 
             v.make_model AS vehicle_make
      FROM drivers d
      LEFT JOIN vehicles v ON d.id = v.driver_id
      WHERE d.id = $1
    `, [id]);
    return res.rows[0] || null;
  }

  static async getActiveDrivers() {
    const res = await db.query(`
      SELECT d.*, 
             v.id AS vehicle_id, 
             v.reg_number AS vehicle_reg, 
             v.make_model AS vehicle_make
      FROM drivers d
      LEFT JOIN vehicles v ON d.id = v.driver_id
      WHERE d.status = 'ACTIVE' 
      ORDER BY d.name ASC
    `);
    return res.rows;
  }

  static async create({ driverCode, name, telephone, referenceNumber, status = 'ACTIVE' }) {
    const sql = `
      INSERT INTO drivers (driver_code, name, telephone, reference_number, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const res = await db.query(sql, [
      driverCode.trim().toUpperCase(),
      name.trim(),
      telephone.trim(),
      referenceNumber.trim(),
      status,
    ]);
    return res.rows[0];
  }

  static async updateStatus(id, status) {
    if (status === 'UNAVAILABLE') {
      const activeRes = await db.query(`
        SELECT id, booking_code, status, pickup_time, occupied_duration_minutes 
        FROM bookings 
        WHERE (driver_id = $1 OR requested_driver_id = $1)
          AND status IN ('CONFIRMED', 'ASSIGNED', 'ENROUTE')
      `, [id]);
      const now = Date.now();
      const isHeld = activeRes.rows.some(b => {
        const start = new Date(b.pickup_time).getTime();
        const duration = (parseInt(b.occupied_duration_minutes, 10) || 60) * 60 * 1000;
        return (start + duration) >= now;
      });
      if (isHeld) {
        const err = new Error('Cannot set chauffeur to UNAVAILABLE while reserved or assigned to active or upcoming journeys.');
        err.code = 'DRIVER_CURRENTLY_HELD';
        throw err;
      }
    }
    const res = await db.query('UPDATE drivers SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return res.rows[0];
  }
}

module.exports = DriverModel;
