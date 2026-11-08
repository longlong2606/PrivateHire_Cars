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
    const res = await db.query('UPDATE drivers SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    return res.rows[0];
  }
}

module.exports = DriverModel;
