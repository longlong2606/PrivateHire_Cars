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

test('Sprint Feature: Telephone/In-person Assisted Booking Two-Step Flow (Pending -> Confirm)', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingModel = require('../src/models/bookingModel');
  const AccountModel = require('../src/models/accountModel');
  const VehicleModel = require('../src/models/vehicleModel');
  const SpecialOfferModel = require('../src/models/specialOfferModel');
  const StaffController = require('../src/controllers/staffController');
  const bookingController = require('../src/controllers/bookingController');

  // Create Staff and Customer accounts
  const staff = await AccountModel.create({
    accountCode: 'ACC-STF-DISPATCH',
    name: 'Officer John Watson',
    email: 'watson.staff@bakerstreet.co.uk',
    address: '221B Baker St, London',
    telephone: '+44 20 7946 0999',
    passwordHash: 'hashed_pw',
    mockCardRef: '•••• •••• •••• 9999',
  });
  await AccountModel.updateRole(staff.id, 'STAFF');
  staff.role = 'STAFF';

  const customer = await AccountModel.create({
    accountCode: 'ACC-CALLER-1',
    name: 'Irene Adler',
    email: 'irene.caller@opera.co.uk',
    address: 'St Johns Wood, London',
    telephone: '+44 20 7946 0888',
    passwordHash: 'hashed_pw',
    mockCardRef: '•••• •••• •••• 8888',
    role: 'CUSTOMER',
  });

  const vehSaloon = await VehicleModel.findById(1);

  // Create an active voucher for customer
  const voucherCode = 'PROMO-STAFF-15';
  await SpecialOfferModel.createOffer({
    code: voucherCode,
    accountId: customer.id,
    discountAmount: 15.00,
  });

  let pendingBooking;

  await t.test('1. Create Booking (Step 1): saves as PENDING/UNPAID, does not hold resources, does not consume voucher, no email/receipt', async () => {
    const pickupSlot = new Date(Date.now() + 48 * 3600 * 1000);
    const createReq = {
      user: staff,
      body: {
        customerId: customer.id,
        channel: 'TELEPHONE',
        status: 'PENDING',
        pickupAddress: 'St Johns Wood',
        dropoffAddress: 'Royal Opera House, Covent Garden',
        pickupTime: pickupSlot.toISOString(),
        service: 'Airport transfer', // Table 8 base fare £45.00 (No 15% online discount)
        vehicleCapacity: 4,
        passengerCount: 2,
        vehicleId: vehSaloon.id,
        promoCode: voucherCode,
      },
    };
    const createRes = createMockRes();
    await StaffController.createStaffBooking(createReq, createRes);

    assert.equal(createRes.statusCode, 201);
    assert.equal(createRes.body.booking.status, 'PENDING');
    assert.equal(createRes.body.booking.payment_status, 'UNPAID');
    assert.equal(createRes.body.booking.booking_channel, 'TELEPHONE');
    assert.equal(parseFloat(createRes.body.booking.discount_amount), 0.00, 'Telephone bookings must have 0.00 online discount');
    assert.equal(parseFloat(createRes.body.booking.base_fare), 45.00);
    assert.equal(parseFloat(createRes.body.booking.promo_discount), 15.00);
    assert.equal(parseFloat(createRes.body.booking.final_fare), 30.00); // £45 - £15 = £30
    assert.equal(createRes.body.booking.driver_id, null, 'Driver is not officially assigned while Pending');

    pendingBooking = createRes.body.booking;

    // Verify voucher is NOT marked as used while booking is Pending
    const offerCheck = await SpecialOfferModel.findByCode(voucherCode);
    assert.equal(offerCheck.is_used, false, 'Voucher must remain UNUSED while booking is in PENDING status');

    // Verify resources are NOT held: Vehicle 1 can still be queried as available for this exact slot
    const hasVConflict = await BookingModel.hasVehicleConflict({
      vehicleId: vehSaloon.id,
      pickupTime: pickupSlot,
      durationMinutes: 60,
    });
    assert.equal(hasVConflict, false, 'Pending booking must NOT block vehicle availability');

    // Verify Paid Receipt is NOT accessible while Pending / Unpaid
    const receiptReq = {
      user: staff,
      params: { id: pendingBooking.id },
    };
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptRes);
    assert.equal(receiptRes.statusCode, 400, 'Paid receipt must not be accessible for Pending/Unpaid booking');
  });

  await t.test('2. Confirm Booking with Failed Payment: retains PENDING/UNPAID, no resources held, voucher unused', async () => {
    const failReq = {
      user: staff,
      params: { id: pendingBooking.id },
      body: {
        paymentMethod: 'CARD',
        simulationResult: 'FAIL',
      },
    };
    const failRes = createMockRes();
    await StaffController.confirmStaffBooking(failReq, failRes);

    assert.equal(failRes.statusCode, 400);
    assert.equal(failRes.body.code, 'PAYMENT_DECLINED');

    // Verify booking remains PENDING / UNPAID
    const bCheck = await BookingModel.findById(pendingBooking.id);
    assert.equal(bCheck.status, 'PENDING');
    assert.equal(bCheck.payment_status, 'UNPAID');

    // Verify voucher is still unused
    const offerCheck = await SpecialOfferModel.findByCode(voucherCode);
    assert.equal(offerCheck.is_used, false);
  });

  await t.test('3. Confirm Booking with CASH: transitions to CONFIRMED/UNPAID, holds resources, marks voucher used, receipt only after collectCash', async () => {
    const cashReq = {
      user: staff,
      params: { id: pendingBooking.id },
      body: {
        paymentMethod: 'CASH',
        simulationResult: 'SUCCESS',
      },
    };
    const cashRes = createMockRes();
    await StaffController.confirmStaffBooking(cashReq, cashRes);

    assert.equal(cashRes.statusCode, 200);
    assert.equal(cashRes.body.booking.status, 'CONFIRMED');
    assert.equal(cashRes.body.booking.payment_status, 'UNPAID');

    // Verify resources ARE now held
    const hasVConflict = await BookingModel.hasVehicleConflict({
      vehicleId: vehSaloon.id,
      pickupTime: new Date(pendingBooking.pickup_time),
      durationMinutes: 60,
    });
    assert.equal(hasVConflict, true, 'Confirmed cash booking must hold vehicle');

    // Verify voucher IS now marked used
    const offerCheck = await SpecialOfferModel.findByCode(voucherCode);
    assert.equal(offerCheck.is_used, true, 'Voucher must be marked used upon confirmation');

    // Paid receipt is NOT accessible yet (because cash is unpaid)
    const receiptReq = { user: staff, params: { id: pendingBooking.id } };
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptRes);
    assert.equal(receiptRes.statusCode, 400, 'Receipt not accessible while Cash is still unpaid');

    // Complete the journey and Staff collects Cash
    await BookingModel.updateStatus(pendingBooking.id, 'COMPLETED');
    const collectCashReq = { user: staff, params: { id: pendingBooking.id } };
    const collectCashRes = createMockRes();
    await StaffController.collectCash(collectCashReq, collectCashRes);
    assert.equal(collectCashRes.statusCode, 200);
    assert.equal(collectCashRes.body.booking.payment_status, 'PAID');

    // Now Paid Receipt IS accessible
    const receiptOkRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptOkRes);
    assert.equal(receiptOkRes.statusCode, 200);
    assert.equal(receiptOkRes.body.receipt.pricing.actualPaidAmount, 30.00);
  });

  await t.test('4. Confirm Booking with CARD (Electronic Payment): transitions to CONFIRMED/PAID, receipt accessible immediately', async () => {
    const pickupSlot2 = new Date(Date.now() + 72 * 3600 * 1000);
    const cardBookingReq = {
      user: staff,
      body: {
        customerId: customer.id,
        channel: 'IN_PERSON',
        status: 'PENDING',
        pickupAddress: 'London Bridge',
        dropoffAddress: 'Canary Wharf',
        pickupTime: pickupSlot2.toISOString(),
        service: 'Local journey', // Table 8 base fare £20.00
        vehicleCapacity: 4,
        passengerCount: 1,
        vehicleId: vehSaloon.id,
      },
    };
    const cardBookingRes = createMockRes();
    await StaffController.createStaffBooking(cardBookingReq, cardBookingRes);
    assert.equal(cardBookingRes.statusCode, 201);
    assert.equal(cardBookingRes.body.booking.status, 'PENDING');

    // Confirm with CARD
    const confirmCardReq = {
      user: staff,
      params: { id: cardBookingRes.body.booking.id },
      body: {
        paymentMethod: 'CARD',
        simulationResult: 'SUCCESS',
      },
    };
    const confirmCardRes = createMockRes();
    await StaffController.confirmStaffBooking(confirmCardReq, confirmCardRes);

    assert.equal(confirmCardRes.statusCode, 200);
    assert.equal(confirmCardRes.body.booking.status, 'CONFIRMED');
    assert.equal(confirmCardRes.body.booking.payment_status, 'PAID');

    // Paid receipt accessible immediately
    const receiptReq = { user: staff, params: { id: cardBookingRes.body.booking.id } };
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptRes);
    assert.equal(receiptRes.statusCode, 200);
    assert.equal(receiptRes.body.receipt.pricing.actualPaidAmount, 20.00);
  });

  await t.test('5. Idempotency: Duplicate confirm request returns existing confirmed booking without re-processing', async () => {
    const dupReq = {
      user: staff,
      params: { id: pendingBooking.id },
      body: { paymentMethod: 'CASH', simulationResult: 'SUCCESS' },
    };
    const dupRes = createMockRes();
    await StaffController.confirmStaffBooking(dupReq, dupRes);
    assert.equal(dupRes.statusCode, 200);
    assert.equal(dupRes.body.message, 'Booking is already confirmed.');
  });
});
