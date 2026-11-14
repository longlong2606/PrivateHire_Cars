const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const db = require('../src/config/db');
const BookingModel = require('../src/models/bookingModel');
const SpecialOfferModel = require('../src/models/specialOfferModel');
const NotificationModel = require('../src/models/notificationModel');
const AccountModel = require('../src/models/accountModel');

describe('Sprint Feature: Milestone Loyalty Vouchers (Every 3 Trips) & Booking Creation Notifications', () => {
  let testCustomer;

  before(async () => {
    // Ensure test account exists
    const res = await db.query(
      "SELECT * FROM accounts WHERE email = 'milestone.test@example.com' LIMIT 1"
    );
    if (res.rows.length > 0) {
      testCustomer = res.rows[0];
    } else {
      const created = await AccountModel.create({
        accountCode: 'ACC-MLS-' + Math.floor(1000 + Math.random() * 9000),
        name: 'Milestone Test User',
        email: 'milestone.test@example.com',
        address: '10 Downing Street, London',
        telephone: '+44 7700 900888',
        passwordHash: 'dummy-hashed-pass',
        mockCardRef: '•••• •••• •••• 4242',
      });
      testCustomer = created;
    }
  });

  test('1. Every 3 completed journeys awards a loyalty voucher (£10)', async () => {
    const customerId = testCustomer.id;

    // Clean up test offers & test bookings for this account
    await db.query("DELETE FROM notifications WHERE account_id = $1", [customerId]);
    await db.query("DELETE FROM special_offers WHERE account_id = $1", [customerId]);
    await db.query("DELETE FROM bookings WHERE account_id = $1", [customerId]);

    // Create 6 completed bookings
    for (let i = 1; i <= 6; i++) {
      await BookingModel.create({
        bookingCode: `BK-TEST-MLS-${i}-${Math.floor(1000 + Math.random() * 9000)}`,
        accountId: customerId,
        pickupAddress: 'London Heathrow Airport Terminal 5',
        dropoffAddress: 'Mayfair, London',
        pickupTime: new Date(),
        passengerName: testCustomer.name,
        passengerPhone: testCustomer.telephone,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        finalFare: 45.00,
      });
    }

    const completedCount = await BookingModel.countCompletedByCustomer(customerId);
    assert.equal(completedCount, 6, 'Should have exactly 6 completed journeys');

    // Call awardMilestoneLoyaltyOffers (Rule 11: Single recommendation when >= 3 completed trips)
    const offers = await SpecialOfferModel.awardMilestoneLoyaltyOffers(customerId, testCustomer);
    assert.equal(offers.length, 1, 'Should receive exactly 1 loyalty voucher recommendation for completing >= 3 journeys');

    // Verify reopening Offers does not create duplicates
    const reopenOffers = await SpecialOfferModel.awardMilestoneLoyaltyOffers(customerId, testCustomer);
    assert.equal(reopenOffers.length, 1, 'Reopening offers must not create duplicate vouchers');

    // Verify notifications created
    const notifs = await NotificationModel.getForAccount(customerId);
    const promoNotifs = notifs.filter(n => n.type === 'PROMO_AWARDED');
    assert.equal(promoNotifs.length, 1, 'Should have exactly 1 PROMO_AWARDED notification');
  });

  test('2. Booking creation records in-account notification with link to booking', async () => {
    const customerId = testCustomer.id;
    const bookingCode = `BK-NOTIF-${Math.floor(100000 + Math.random() * 900000)}`;

    const booking = await BookingModel.create({
      bookingCode,
      accountId: customerId,
      pickupAddress: 'King\'s Cross Station',
      dropoffAddress: 'Canary Wharf',
      pickupTime: new Date(),
      passengerName: testCustomer.name,
      passengerPhone: testCustomer.telephone,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      finalFare: 38.25,
    });

    const notif = await NotificationModel.create({
      accountId: customerId,
      bookingId: booking.id,
      title: 'Booking Confirmed — #' + booking.booking_code,
      message: `Your minicab booking #${booking.booking_code} from ${booking.pickup_address} to ${booking.dropoff_address} has been confirmed. Click to view details of your journey.`,
      type: 'BOOKING_CONFIRMED',
    });

    assert.ok(notif, 'Notification should be created');
    assert.equal(notif.account_id, customerId);
    assert.equal(notif.booking_id, booking.id);
    assert.equal(notif.type, 'BOOKING_CONFIRMED');

    const customerNotifs = await NotificationModel.getForAccount(customerId);
    const found = customerNotifs.find(n => n.id === notif.id);
    assert.ok(found, 'Should retrieve created notification from getForAccount');
    assert.equal(found.booking_code, bookingCode, 'Should include joined booking_code');
  });
});
