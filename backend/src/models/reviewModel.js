const db = require('../config/db');

class ReviewModel {
  static async create({ bookingId, accountId, journeyRating, vehicleRating, driverRating, reviewText }) {
    const sql = `
      INSERT INTO reviews (booking_id, account_id, journey_rating, vehicle_rating, driver_rating, review_text)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const res = await db.query(sql, [
      bookingId,
      accountId,
      journeyRating,
      vehicleRating,
      driverRating,
      reviewText ? reviewText.trim() : '',
    ]);
    return res.rows[0];
  }

  static async findByBookingId(bookingId) {
    const res = await db.query('SELECT * FROM reviews WHERE booking_id = $1', [bookingId]);
    return res.rows[0] || null;
  }

  static async getForAccount(accountId) {
    const res = await db.query(
      'SELECT r.*, b.booking_code, b.service_name FROM reviews r JOIN bookings b ON r.booking_id = b.id WHERE r.account_id = $1 ORDER BY r.created_at DESC',
      [accountId]
    );
    return res.rows;
  }

  static async getAll() {
    const res = await db.query(
      'SELECT r.*, b.booking_code, b.service_name, a.name AS customer_name FROM reviews r JOIN bookings b ON r.booking_id = b.id JOIN accounts a ON r.account_id = a.id ORDER BY r.created_at DESC'
    );
    return res.rows;
  }
}

module.exports = ReviewModel;
