const test = require('node:test');
const assert = require('node:assert/strict');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');

const setupTestDb = async () => {
  const memDb = newDb();
  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  const schemaPath = path.join(__dirname, '../src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);

  return { pool };
};

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(d) {
      this.body = d;
      return this;
    },
  };
  return res;
}

test('Sprint Feature: Booking Amendments, Vehicle Selection & Authoritative Payment Adjustments', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingModel = require('../src/models/bookingModel');
  const AccountModel = require('../src/models/accountModel');
  const VehicleModel = require('../src/models/vehicleModel');
  const DriverModel = require('../src/models/driverModel');
  const RefundModel = require('../src/models/refundModel');
  const bookingController = require('../src/controllers/bookingController');

  // Create test customer
  const customer = await AccountModel.create({
    accountCode: 'ACC-AMEND-1',
    name: 'James Bond',
    email: '007.amend@mi6.gov.uk',
    address: 'Vauxhall Cross, London',
    telephone: '+44 20 7946 0007',
    passwordHash: 'hashed_pw',
    mockCardRef: '•••• •••• •••• 4242',
    role: 'CUSTOMER',
  });

  // Ensure active vehicles exist (Vehicle 1 is Saloon 4-seat, Vehicle 3 is MPV 7-seat)
  const vehSaloon = await VehicleModel.findById(1);
  const vehMpv = await VehicleModel.findById(3);

  let paidBooking;

  await t.test('1. 24-hour notice policy: >= 24h (inclusive of exact 24h) succeeds, < 24h fails', async () => {
    // Exactly 24 hours notice
    const pickupExact24h = new Date(Date.now() + 24 * 3600 * 1000);
    const booking24h = await BookingModel.create({
      bookingCode: 'BK-EXACT24H',
      accountId: customer.id,
      pickupAddress: 'Mayfair, London',
      dropoffAddress: 'Piccadilly Circus',
      pickupTime: pickupExact24h,
      serviceName: 'Local journey',
      vehicleCapacity: 4,
      baseFare: 20.00,
      discountAmount: 3.00,
      finalFare: 17.00,
      fareAmount: 17.00,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      vehicleId: vehSaloon.id,
      requestedDriverId: vehSaloon.driver_id,
      bookingChannel: 'ONLINE',
      passengerCount: 1,
    });
    // Set paid_amount
    await db.query('UPDATE bookings SET paid_amount = 17.00 WHERE id = $1', [booking24h.id]);

    const amendReq = {
      user: customer,
      params: { id: booking24h.id },
      body: { dropoffAddress: 'Covent Garden' },
    };
    const amendRes = createMockRes();
    await bookingController.amendBooking(amendReq, amendRes);
    assert.equal(amendRes.statusCode, 200, 'Should allow amendment with exact 24 hours notice');
    assert.equal(amendRes.body.booking.dropoff_address, 'Covent Garden');

    // < 24 hours notice (< 24h)
    const pickupShortNotice = new Date(Date.now() + 5 * 3600 * 1000);
    const bookingShort = await BookingModel.create({
      bookingCode: 'BK-SHORT-99',
      accountId: customer.id,
      pickupAddress: 'Mayfair',
      dropoffAddress: 'Heathrow',
      pickupTime: pickupShortNotice,
      serviceName: 'Local journey',
      vehicleCapacity: 4,
      baseFare: 20.00,
      discountAmount: 3.00,
      finalFare: 17.00,
      fareAmount: 17.00,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
    });

    const shortReq = {
      user: customer,
      params: { id: bookingShort.id },
      body: { dropoffAddress: 'Gatwick' },
    };
    const shortRes = createMockRes();
    await bookingController.amendBooking(shortReq, shortRes);
    assert.equal(shortRes.statusCode, 400);
    assert.equal(shortRes.body.code, 'NOTICE_LESS_THAN_24H');
  });

  await t.test('2. Paid increase (£17 -> £68): Failed payment keeps original booking, fare & reservations untouched', async () => {
    // Initial £17 booking (Local journey, 4-seat) 48h in future
    const pickupFuture = new Date(Date.now() + 48 * 3600 * 1000);
    paidBooking = await BookingModel.create({
      bookingCode: 'BK-PAID-17',
      accountId: customer.id,
      pickupAddress: 'Baker Street',
      dropoffAddress: 'Soho',
      pickupTime: pickupFuture,
      serviceName: 'Local journey',
      vehicleCapacity: 4,
      baseFare: 20.00,
      discountAmount: 3.00,
      finalFare: 17.00,
      fareAmount: 17.00,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      vehicleId: vehSaloon.id,
      requestedDriverId: vehSaloon.driver_id,
      bookingChannel: 'ONLINE',
      passengerCount: 2,
    });
    await db.query('UPDATE bookings SET paid_amount = 17.00 WHERE id = $1', [paidBooking.id]);

    // Amend to Long-distance journey (£80 base, 15% discount = £68.00). Difference = +£51.00
    // Test payment fails (e.g. Visa card check fail)
    const failReq = {
      user: customer,
      params: { id: paidBooking.id },
      body: {
        service: 'Long-distance journey',
        vehicleCapacity: 4,
        simulationResult: 'FAIL',
      },
    };
    const failRes = createMockRes();
    await bookingController.amendBooking(failReq, failRes);

    assert.equal(failRes.statusCode, 400);
    assert.equal(failRes.body.code, 'PAYMENT_DECLINED');
    assert.equal(failRes.body.fareDifference, 51.00);

    // Verify DB record is completely untouched
    const verified = await BookingModel.findById(paidBooking.id);
    assert.equal(parseFloat(verified.final_fare), 17.00, 'Original fare must remain £17.00');
    assert.equal(verified.payment_status, 'PAID', 'Payment status must remain PAID');
    assert.equal(verified.service_name, 'Local journey', 'Original service must remain Local journey');
    assert.equal(verified.status, 'CONFIRMED', 'Status must remain CONFIRMED');
    assert.equal(verified.vehicle_id, vehSaloon.id, 'Original vehicle must remain assigned');
  });

  await t.test('3. Paid increase (£17 -> £68): Successful payment updates fare to £68 and keeps PAID (never resets to UNPAID)', async () => {
    const successReq = {
      user: customer,
      params: { id: paidBooking.id },
      body: {
        service: 'Long-distance journey',
        vehicleCapacity: 4,
        simulationResult: 'SUCCESS',
      },
    };
    const successRes = createMockRes();
    await bookingController.amendBooking(successReq, successRes);

    assert.equal(successRes.statusCode, 200);
    assert.equal(successRes.body.fareDifference, 51.00);
    assert.equal(successRes.body.action, 'PAYMENT_COMPLETED');

    const updated = await BookingModel.findById(paidBooking.id);
    assert.equal(parseFloat(updated.final_fare), 68.00, 'New final fare must be £68.00');
    assert.equal(parseFloat(updated.paid_amount), 68.00, 'Paid amount must be recorded as £68.00');
    assert.equal(updated.payment_status, 'PAID', 'Must retain PAID status without resetting to UNPAID');
    assert.equal(updated.service_name, 'Long-distance journey');
    assert.equal(updated.status, 'CONFIRMED');
  });

  await t.test('4. Paid decrease (£68 -> £17): Creates or updates Pending refund for difference (£51)', async () => {
    // Amend back to Local journey (£17.00). Difference = -£51.00
    const reduceReq = {
      user: customer,
      params: { id: paidBooking.id },
      body: {
        service: 'Local journey',
        vehicleCapacity: 4,
      },
    };
    const reduceRes = createMockRes();
    await bookingController.amendBooking(reduceReq, reduceRes);

    assert.equal(reduceRes.statusCode, 200);
    assert.equal(reduceRes.body.fareDifference, -51.00);
    assert.equal(reduceRes.body.action, 'REFUND_QUEUED');

    const updated = await BookingModel.findById(paidBooking.id);
    assert.equal(parseFloat(updated.final_fare), 17.00);
    assert.equal(updated.payment_status, 'PAID', 'Remains PAID while refund is pending');

    // Verify Pending refund in DB
    const pendingRefunds = await db.query('SELECT * FROM refund_requests WHERE booking_id = $1', [paidBooking.id]);
    assert.equal(pendingRefunds.rows.length, 1);
    assert.equal(parseFloat(pendingRefunds.rows[0].amount), 51.00);
    assert.equal(pendingRefunds.rows[0].status, 'PENDING');

    // Amend again to Hotel transfer (£30 - 15% = £25.50). Difference = £68 - £25.50 = £42.50
    const reAdjustReq = {
      user: customer,
      params: { id: paidBooking.id },
      body: {
        service: 'Hotel transfer',
        vehicleCapacity: 4,
      },
    };
    const reAdjustRes = createMockRes();
    await bookingController.amendBooking(reAdjustReq, reAdjustRes);
    assert.equal(reAdjustRes.statusCode, 200);

    // Verify the existing pending refund was updated rather than creating duplicate row
    const refundsAfter = await db.query('SELECT * FROM refund_requests WHERE booking_id = $1', [paidBooking.id]);
    assert.equal(refundsAfter.rows.length, 1, 'Should update existing pending refund without duplicate');
    assert.equal(parseFloat(refundsAfter.rows[0].amount), 42.50);
  });

  await t.test('5. Unpaid booking amendment: Only updates amount due, creates NO payment or refund', async () => {
    const pickupUnpaid = new Date(Date.now() + 72 * 3600 * 1000);
    const unpaidBooking = await BookingModel.create({
      bookingCode: 'BK-UNPAID-CASH',
      accountId: customer.id,
      pickupAddress: 'Knightsbridge',
      dropoffAddress: 'Chelsea',
      pickupTime: pickupUnpaid,
      serviceName: 'Local journey',
      vehicleCapacity: 4,
      baseFare: 20.00,
      discountAmount: 3.00,
      finalFare: 17.00,
      fareAmount: 17.00,
      paymentMethod: 'CASH',
      paymentStatus: 'UNPAID',
      status: 'CONFIRMED',
      vehicleId: vehSaloon.id,
      requestedDriverId: vehSaloon.driver_id,
      bookingChannel: 'ONLINE',
      passengerCount: 1,
    });

    const amendUnpaidReq = {
      user: customer,
      params: { id: unpaidBooking.id },
      body: {
        service: 'Long-distance journey',
        vehicleCapacity: 4,
      },
    };
    const amendUnpaidRes = createMockRes();
    await bookingController.amendBooking(amendUnpaidReq, amendUnpaidRes);

    assert.equal(amendUnpaidRes.statusCode, 200);
    const updatedUnpaid = await BookingModel.findById(unpaidBooking.id);
    assert.equal(parseFloat(updatedUnpaid.final_fare), 68.00);
    assert.equal(updatedUnpaid.payment_status, 'UNPAID', 'Must remain UNPAID');

    // Ensure NO refund requests created
    const refunds = await db.query('SELECT * FROM refund_requests WHERE booking_id = $1', [unpaidBooking.id]);
    assert.equal(refunds.rows.length, 0, 'No refund requests should be created for unpaid booking');
  });

  await t.test('6. Vehicle selection: Conflicting vehicle is rejected, available vehicle succeeds', async () => {
    const pickupSlot = new Date(Date.now() + 96 * 3600 * 1000);

    // Create another confirmed booking on Vehicle 1 at this exact slot
    await BookingModel.create({
      bookingCode: 'BK-BLOCK-VEH1',
      accountId: customer.id,
      pickupAddress: 'Victoria',
      dropoffAddress: 'Gatwick',
      pickupTime: pickupSlot,
      serviceName: 'Airport transfer',
      vehicleCapacity: 4,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      vehicleId: vehSaloon.id,
      requestedDriverId: vehSaloon.driver_id,
      occupiedDurationMinutes: 60,
    });

    // Attempt to amend paidBooking into this conflicting slot using Vehicle 1
    const conflictReq = {
      user: customer,
      params: { id: paidBooking.id },
      body: {
        pickupTime: pickupSlot.toISOString(),
        vehicleId: vehSaloon.id,
        service: 'Airport transfer',
      },
    };
    const conflictRes = createMockRes();
    await bookingController.amendBooking(conflictReq, conflictRes);

    assert.equal(conflictRes.statusCode, 400);
    assert.equal(conflictRes.body.code, 'VEHICLE_CONFLICT');

    // Customer selects available 7-Seat MPV (Vehicle 2) for this slot (succeeds)
    const validVehReq = {
      user: customer,
      params: { id: paidBooking.id },
      body: {
        pickupTime: pickupSlot.toISOString(),
        vehicleId: vehMpv.id,
        vehicleCapacity: 7,
        service: 'Airport transfer',
        simulationResult: 'SUCCESS',
      },
    };
    const validVehRes = createMockRes();
    await bookingController.amendBooking(validVehReq, validVehRes);

    assert.equal(validVehRes.statusCode, 200);
    const updatedBooking = await BookingModel.findById(paidBooking.id);
    assert.equal(updatedBooking.vehicle_id, vehMpv.id);
    assert.equal(updatedBooking.vehicle_capacity, 7);
  });

  await t.test('7. Amend Quote preview endpoint returns old fare, new fare, difference and action', async () => {
    const quoteReq = {
      user: customer,
      params: { id: paidBooking.id },
      query: {
        service: 'Driver and car daily hire',
        vehicleCapacity: '7',
      },
    };
    const quoteRes = createMockRes();
    await bookingController.getAmendQuote(quoteReq, quoteRes);

    assert.equal(quoteRes.statusCode, 200);
    assert.equal(quoteRes.body.success, true);
    // Table 8 Daily Hire (7 seats) = £280. 15% online discount = £42. Final = £238.00
    assert.equal(quoteRes.body.newBaseFare, 280.00);
    assert.equal(quoteRes.body.newDiscount, 42.00);
    assert.equal(quoteRes.body.newFinalFare, 238.00);
    assert.equal(quoteRes.body.actionRequired, 'PAYMENT');
  });
});
