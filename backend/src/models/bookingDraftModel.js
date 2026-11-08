const db = require('../config/db');

/**
 * Booking Draft Model
 * Implements Form State Persistence for in-progress booking data.
 * Saves, restores, and clears booking drafts across page refreshes,
 * browser restarts, and auth transitions (Visitor -> Login -> Booking).
 */
class BookingDraftModel {
  /**
   * Lưu hoặc cập nhật trạng thái nháp của form đặt xe (Form State Persistence)
   */
  static async saveDraft({
    accountId = null,
    draftToken,
    pickupAddress = '',
    dropoffAddress = '',
    serviceId = null,
    serviceName = null,
    vehicleCapacity = 4,
    fareAmount = null,
    fareCurrency = 'GBP',
    occupiedDurationMinutes = null,
    carType = 'Four-Passenger Executive Saloon',
    notes = null,
    formMetadata = null,
  }) {
    if (!draftToken) {
      throw new Error('draftToken is required to persist booking form state');
    }

    const metadataStr = typeof formMetadata === 'object' && formMetadata !== null 
      ? JSON.stringify(formMetadata) 
      : (formMetadata || null);

    const sql = `
      INSERT INTO booking_drafts (
        account_id,
        draft_token,
        pickup_address,
        dropoff_address,
        service_id,
        service_name,
        vehicle_capacity,
        fare_amount,
        fare_currency,
        occupied_duration_minutes,
        car_type,
        notes,
        form_metadata,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      ON CONFLICT (draft_token) DO UPDATE SET
        account_id = COALESCE(EXCLUDED.account_id, booking_drafts.account_id),
        pickup_address = EXCLUDED.pickup_address,
        dropoff_address = EXCLUDED.dropoff_address,
        service_id = EXCLUDED.service_id,
        service_name = EXCLUDED.service_name,
        vehicle_capacity = EXCLUDED.vehicle_capacity,
        fare_amount = EXCLUDED.fare_amount,
        fare_currency = EXCLUDED.fare_currency,
        occupied_duration_minutes = EXCLUDED.occupied_duration_minutes,
        car_type = EXCLUDED.car_type,
        notes = EXCLUDED.notes,
        form_metadata = EXCLUDED.form_metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      accountId,
      draftToken.trim(),
      pickupAddress ? pickupAddress.trim() : '',
      dropoffAddress ? dropoffAddress.trim() : '',
      serviceId,
      serviceName,
      vehicleCapacity || 4,
      fareAmount,
      fareCurrency || 'GBP',
      occupiedDurationMinutes,
      carType,
      notes,
      metadataStr,
    ];

    const result = await db.query(sql, values);
    return result.rows[0];
  }

  /**
   * Lấy trạng thái nháp theo account_id hoặc draft_token
   */
  static async getDraft({ accountId = null, draftToken = null }) {
    if (accountId) {
      const sql = `
        SELECT * FROM booking_drafts 
        WHERE account_id = $1 
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
      const result = await db.query(sql, [accountId]);
      if (result.rows[0]) return result.rows[0];
    }

    if (draftToken) {
      const sql = `
        SELECT * FROM booking_drafts 
        WHERE draft_token = $1 
        LIMIT 1
      `;
      const result = await db.query(sql, [draftToken.trim()]);
      if (result.rows[0]) return result.rows[0];
    }

    return null;
  }

  /**
   * Xóa trạng thái nháp khi cuốc xe đã được đặt thành công hoặc người dùng bấm xóa nháp
   */
  static async deleteDraft({ accountId = null, draftToken = null }) {
    let deletedCount = 0;
    if (accountId) {
      const sql = `DELETE FROM booking_drafts WHERE account_id = $1`;
      const result = await db.query(sql, [accountId]);
      deletedCount += result.rowCount;
    }
    if (draftToken) {
      const sql = `DELETE FROM booking_drafts WHERE draft_token = $1`;
      const result = await db.query(sql, [draftToken.trim()]);
      deletedCount += result.rowCount;
    }
    return deletedCount > 0;
  }
}

module.exports = BookingDraftModel;
