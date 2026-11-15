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

test('Sprint Feature: Confirm Booking Bug Fix & Robust Transaction Handling (Customer & Staff)', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingModel = require('../src/models/bookingModel');
  const AccountModel = require('../src/models/accountModel');
  const VehicleModel = require('../src/models/vehicleModel');
  const DriverModel = require('../src/models/driverModel');
  const SpecialOfferModel = require('../src/models/specialOfferModel');
  const bookingController = require('../src/controllers/bookingController');
  const staffController = require('../src/controllers/staffController');

  // Create accounts
  const customer = await AccountModel.create({
    accountCode: 'ACC-CUST-CFM',
    name: 'Alice Confirm',
    email: 'alice.confirm@example.com',
    address: '10 Downing St, London',
    telephone: '+44 20 7946 0111',
    passwordHash: 'hashed_pw',
    mockCardRef: '•••• •••• •••• 4242',
  });
  customer.role = 'CUSTOMER';

  const staff = await AccountModel.create({
    accountCode: 'ACC-STF-CFM',
    name: 'Officer Bob Staff',
    email: 'bob.staff@example.com',
    address: 'Scotland Yard, London',
    telephone: '+44 20 7946 0222',
    passwordHash: 'hashed_pw',
    mockCardRef: '•••• •••• •••• 9999',
  });
  await AccountModel.updateRole(staff.id, 'STAFF');
  staff.role = 'STAFF';

  const driver = await DriverModel.create({
    driverCode: 'DRV-CFM-01',
    name: 'James Chauffeur',
    telephone: '+44 7700 900111',
    referenceNumber: 'REF-DRV-01',
    status: 'ACTIVE',
  });

  const vehicle = await VehicleModel.create({
    regNumber: 'CFM-01-V',
    makeModel: 'Mercedes-Benz E-Class',
    colour: 'Black',
    capacity: 4,
    status: 'ACTIVE',
    driverId: driver.id,
  });

  await t.test('1. Customer Online Confirm with PayPal: transitions to CONFIRMED/PAID, TXN-PP- reference, cardRefUsed is null', async () => {
    const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const booking = await BookingModel.create({
      bookingCode: 'BK-CUST-PP-01',
      accountId: customer.id,
      pickupAddress: 'Paddington Station',
      dropoffAddress: 'Heathrow Terminal 5',
      pickupTime: futureDate,
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      carType: 'Executive Saloon',
      fareAmount: 45.00,
      baseFare: 45.00,
      finalFare: 38.25,
      vehicleCapacity: 4,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      vehicleId: vehicle.id,
    });

    const req = {
      params: { id: booking.id },
      body: { paymentMethod: 'PAYPAL', simulationResult: 'SUCCESS' },
      user: customer,
    };
    const res = createMockRes();

    await bookingController.simulatePayment(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.booking.status, 'CONFIRMED');
    assert.equal(res.body.booking.payment_status, 'PAID');
    assert.equal(res.body.booking.payment_method, 'PAYPAL');
    assert.ok(res.body.booking.payment_reference.startsWith('TXN-PP-'), `Expected TXN-PP- prefix, got: ${res.body.booking.payment_reference}`);
    assert.equal(res.body.booking.card_ref_used, null, 'PayPal must NOT set card_ref_used');
    assert.equal(parseFloat(res.body.booking.paid_amount), 38.25, 'Paid amount must match finalFare');
  });

  await t.test('2. Staff Assisted Confirm with Cash: transitions to CONFIRMED/UNPAID, TXN-CSH- reference, receipt blocked until collectCash', async () => {
    const futureDate = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const booking = await BookingModel.create({
      bookingCode: 'BK-STF-CSH-02',
      accountId: customer.id,
      pickupAddress: 'Kings Cross',
      dropoffAddress: 'Luton Airport',
      pickupTime: futureDate,
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      carType: 'Executive Saloon',
      fareAmount: 50.00,
      baseFare: 50.00,
      finalFare: 50.00,
      vehicleCapacity: 4,
      bookingChannel: 'PHONE',
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      vehicleId: vehicle.id,
    });

    // Staff confirms booking via Cash using bookingCode route param
    const confirmReq = {
      params: { bookingCode: booking.booking_code },
      body: { paymentMethod: 'CASH', simulationResult: 'SUCCESS' },
      user: staff,
    };
    const confirmRes = createMockRes();

    await staffController.confirmStaffBooking(confirmReq, confirmRes);

    assert.equal(confirmRes.statusCode, 200);
    assert.equal(confirmRes.body.success, true);
    assert.equal(confirmRes.body.booking.status, 'CONFIRMED');
    assert.equal(confirmRes.body.booking.payment_status, 'UNPAID');
    assert.equal(confirmRes.body.booking.payment_method, 'CASH');
    assert.ok(confirmRes.body.booking.payment_reference.startsWith('TXN-CSH-'), `Expected TXN-CSH- prefix, got: ${confirmRes.body.booking.payment_reference}`);
    assert.equal(confirmRes.body.booking.card_ref_used, null, 'Cash must NEVER display card_ref_used');
    assert.equal(parseFloat(confirmRes.body.booking.paid_amount), 0.00, 'Cash pending payment must have 0 paid_amount');

    // Customer attempts to view paid receipt before cash is collected -> rejected
    const receiptReq = {
      params: { id: booking.id },
      user: customer,
    };
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptRes);

    assert.equal(receiptRes.statusCode, 400);
    assert.equal(receiptRes.body.success, false);
    assert.match(receiptRes.body.message, /Receipt is available only after payment/);

    // Complete journey and Staff collects cash
    await BookingModel.updateStatus(booking.id, 'COMPLETED');
    const collectReq = {
      params: { id: booking.id },
      user: staff,
    };
    const collectRes = createMockRes();
    await staffController.collectCash(collectReq, collectRes);

    assert.equal(collectRes.statusCode, 200);
    assert.equal(collectRes.body.booking.payment_status, 'PAID');
    assert.equal(parseFloat(collectRes.body.booking.paid_amount), 50.00);

    // Now receipt is accessible
    const paidReceiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, paidReceiptRes);
    assert.equal(paidReceiptRes.statusCode, 200);
    assert.equal(paidReceiptRes.body.success, true);
    assert.equal(paidReceiptRes.body.receipt.paymentHistory[0].status, 'PAID');
    assert.equal(paidReceiptRes.body.receipt.pricing.netPaid, 50.00);
  });

  await t.test('3. Staff Assisted Confirm with PayPal: transitions to CONFIRMED/PAID via confirmStaffBooking', async () => {
    const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const booking = await BookingModel.create({
      bookingCode: 'BK-STF-PP-03',
      accountId: customer.id,
      pickupAddress: 'Victoria Coach Station',
      dropoffAddress: 'Gatwick Airport',
      pickupTime: futureDate,
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      carType: 'Executive Saloon',
      fareAmount: 60.00,
      baseFare: 60.00,
      finalFare: 60.00,
      vehicleCapacity: 4,
      bookingChannel: 'PHONE',
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    });

    const req = {
      params: { id: booking.id },
      body: { paymentMethod: 'PAYPAL', simulationResult: 'SUCCESS' },
      user: staff,
    };
    const res = createMockRes();

    await staffController.confirmStaffBooking(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.booking.status, 'CONFIRMED');
    assert.equal(res.body.booking.payment_status, 'PAID');
    assert.equal(res.body.booking.payment_method, 'PAYPAL');
    assert.ok(res.body.booking.payment_reference.startsWith('TXN-PP-'));
    assert.equal(parseFloat(res.body.booking.paid_amount), 60.00);
  });

  await t.test('4. Customer Online Confirm with Card: Approved -> CONFIRMED/PAID, Declined -> retains PENDING/UNPAID', async () => {
    const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const booking = await BookingModel.create({
      bookingCode: 'BK-CUST-CARD-04',
      accountId: customer.id,
      pickupAddress: 'Baker Street',
      dropoffAddress: 'London Bridge',
      pickupTime: futureDate,
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      carType: 'Executive Saloon',
      fareAmount: 30.00,
      baseFare: 30.00,
      finalFare: 25.50,
      vehicleCapacity: 4,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    });

    // Branch A: Visa card decline / simulation failure
    const failReq = {
      params: { id: booking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'FAIL' },
      user: customer,
    };
    const failRes = createMockRes();
    await bookingController.simulatePayment(failReq, failRes);

    assert.equal(failRes.statusCode, 400);
    assert.equal(failRes.body.code, 'PAYMENT_DECLINED');

    const freshBookingFail = await BookingModel.findById(booking.id);
    assert.equal(freshBookingFail.status, 'PENDING', 'Booking must remain PENDING on payment failure');
    assert.equal(freshBookingFail.payment_status, 'UNPAID', 'Payment status must remain UNPAID');

    // Branch B: Card approved / simulation success
    const passReq = {
      params: { id: booking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'SUCCESS' },
      user: customer,
    };
    const passRes = createMockRes();
    await bookingController.simulatePayment(passReq, passRes);

    assert.equal(passRes.statusCode, 200);
    assert.equal(passRes.body.booking.status, 'CONFIRMED');
    assert.equal(passRes.body.booking.payment_status, 'PAID');
    assert.ok(passRes.body.booking.payment_reference.startsWith('TXN-CARD-'));
    assert.equal(parseFloat(passRes.body.booking.paid_amount), 25.50);
  });

  await t.test('5. Offer Consumption & Rollback: Valid voucher marked used on success, remains unused on failed payment', async () => {
    // Create voucher for customer
    const voucher = await SpecialOfferModel.createOffer({
      code: 'CFM-TEST-10',
      accountId: customer.id,
      discountAmount: 10.00,
    });

    const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const booking = await BookingModel.create({
      bookingCode: 'BK-VOUCHER-05',
      accountId: customer.id,
      pickupAddress: 'Euston',
      dropoffAddress: 'Canary Wharf',
      pickupTime: futureDate,
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      carType: 'Executive Saloon',
      fareAmount: 40.00,
      baseFare: 40.00,
      finalFare: 30.00,
      voucherCode: voucher.code,
      promoDiscount: 10.00,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    });

    // 1. Payment failure -> voucher must NOT be marked used
    const failReq = {
      params: { id: booking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'FAIL', voucherCode: voucher.code },
      user: customer,
    };
    const failRes = createMockRes();
    await bookingController.simulatePayment(failReq, failRes);

    const voucherAfterFail = await SpecialOfferModel.findByCode(voucher.code);
    assert.equal(voucherAfterFail.is_used, false, 'Voucher must remain UNUSED after payment failure');

    // 2. Payment success -> voucher marked used
    const okReq = {
      params: { id: booking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'SUCCESS', voucherCode: voucher.code },
      user: customer,
    };
    const okRes = createMockRes();
    await bookingController.simulatePayment(okReq, okRes);

    assert.equal(okRes.statusCode, 200);
    const voucherAfterOk = await SpecialOfferModel.findByCode(voucher.code);
    assert.equal(voucherAfterOk.is_used, true, 'Voucher must be marked USED after confirmation');
  });

  await t.test('6. Concurrency & Idempotency: Duplicate confirmation request returns existing confirmed booking', async () => {
    const futureDate = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const booking = await BookingModel.create({
      bookingCode: 'BK-IDEM-06',
      accountId: customer.id,
      pickupAddress: 'Canary Wharf',
      dropoffAddress: 'City Airport',
      pickupTime: futureDate,
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      fareAmount: 35.00,
      finalFare: 35.00,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
    });

    const req1 = {
      params: { id: booking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'SUCCESS' },
      user: customer,
    };
    const res1 = createMockRes();
    await bookingController.simulatePayment(req1, res1);

    assert.equal(res1.statusCode, 200);
    const initialPaymentRef = res1.body.booking.payment_reference;

    // Second request (simulating double-click or replay)
    const req2 = {
      params: { id: booking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'SUCCESS' },
      user: customer,
    };
    const res2 = createMockRes();
    await bookingController.simulatePayment(req2, res2);

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.message, 'Booking is already confirmed.');
    assert.equal(res2.body.booking.payment_reference, initialPaymentRef, 'Payment reference must not change');
  });
});
