const db = require('../config/db');

class DriverModel {
  static async getAll() {
    const res = await db.query('SELECT * FROM drivers ORDER BY id ASC');
    return res.rows;
  }

  static async findById(id) {
    const res = await db.query('SELECT * FROM drivers WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  static async getActiveDrivers() {
    const res = await db.query("SELECT * FROM drivers WHERE status = 'ACTIVE' ORDER BY name ASC");
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
