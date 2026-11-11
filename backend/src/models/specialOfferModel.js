const db = require('../config/db');

class SpecialOfferModel {
  static async findByCode(code) {
    if (!code) return null;
    const res = await db.query(
      'SELECT * FROM special_offers WHERE UPPER(code) = UPPER($1) LIMIT 1',
      [code.trim()]
    );
    return res.rows[0] || null;
  }

  static async findActiveByCode(code) {
    if (!code) return null;
    const res = await db.query(
      'SELECT * FROM special_offers WHERE UPPER(code) = UPPER($1) AND is_used = FALSE LIMIT 1',
      [code.trim()]
    );
    return res.rows[0] || null;
  }

  static async getOffersForAccount(accountId) {
    const res = await db.query(
      'SELECT * FROM special_offers WHERE account_id = $1 ORDER BY created_at DESC',
      [accountId]
    );
    return res.rows;
  }

  static async createOffer({ code, accountId, discountAmount = 10.00 }) {
    const sql = `
      INSERT INTO special_offers (code, account_id, discount_amount, is_used)
      VALUES ($1, $2, $3, FALSE)
      ON CONFLICT (code) DO NOTHING
      RETURNING *
    `;
    const res = await db.query(sql, [code.trim().toUpperCase(), accountId, discountAmount]);
    return res.rows[0] || null;
  }

  static async markUsed(code) {
    const res = await db.query(
      'UPDATE special_offers SET is_used = TRUE, used_at = CURRENT_TIMESTAMP WHERE UPPER(code) = UPPER($1) RETURNING *',
      [code.trim()]
    );
    return res.rows[0] || null;
  }

  /**
   * Automatically checks completed trip count and awards 1 loyalty voucher for every 3 completed trips
   * (Milestones: 3, 6, 9, 12, 15, ... journeys completed).
   */
  static async awardMilestoneLoyaltyOffers(accountId, customerInfo = null) {
    if (!accountId) return [];
    const BookingModel = require('./bookingModel');
    const NotificationModel = require('./notificationModel');
    const { sendSpecialOfferEmail } = require('../services/emailService');

    const completedCount = await BookingModel.countCompletedByCustomer(accountId);
    const eligibleCount = Math.floor(completedCount / 3);
    const currentOffers = await this.getOffersForAccount(accountId);

    if (eligibleCount <= 0) {
      return currentOffers;
    }

    const existingLoyalty = currentOffers.filter(o => o.code && o.code.toUpperCase().startsWith('LOYALTY10-'));
    const missingCount = eligibleCount - existingLoyalty.length;

    if (missingCount > 0) {
      const AccountModel = require('./accountModel');
      let customer = customerInfo;
      if (!customer) {
        customer = await AccountModel.findById(accountId);
      }

      for (let i = existingLoyalty.length + 1; i <= eligibleCount; i++) {
        let promoCode = '';
        let unique = false;
        let attempts = 0;
        while (!unique && attempts < 10) {
          promoCode = 'LOYALTY10-' + Math.floor(1000 + Math.random() * 9000);
          const existing = await this.findByCode(promoCode);
          if (!existing) unique = true;
          attempts++;
        }

        const created = await this.createOffer({
          code: promoCode,
          accountId,
          discountAmount: 10.00,
        });

        if (created) {
          await NotificationModel.create({
            accountId,
            bookingId: null,
            title: 'Special Loyalty Reward Awarded!',
            message: `Congratulations on completing ${i * 3} journeys! Use promo code ${promoCode} for £10 off your next ride.`,
            type: 'PROMO_AWARDED',
          }).catch(() => {});

          if (customer && customer.email) {
            sendSpecialOfferEmail({
              toEmail: customer.email,
              name: customer.name || 'Valued Customer',
              promoCode,
              discountAmount: 10.00,
            }).catch(() => {});
          }
        }
      }
      return await this.getOffersForAccount(accountId);
    }

    return currentOffers;
  }
}

module.exports = SpecialOfferModel;

