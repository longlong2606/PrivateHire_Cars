const test = require('node:test');
const assert = require('node:assert/strict');
const BookingModel = require('../src/models/bookingModel');
const AccountModel = require('../src/models/accountModel');
const RefundModel = require('../src/models/refundModel');
const bookingController = require('../src/controllers/bookingController');
const staffController = require('../src/controllers/staffController');
const db = require('../src/config/db');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

test('Sprint Feature: Official Receipt, Distinct Payment Reference & Payment/Refund History', async (t) => {
  let testCustomer;
  let staffUser;

  // Setup: create test customer and staff account
  const customerEmail = `receipt.test.${Date.now()}@example.com`;
  const existingCust = await AccountModel.findByEmail(customerEmail);
  if (!existingCust) {
    testCustomer = await AccountModel.create({
      accountCode: 'CUST-REC-' + Date.now(),
      name: 'Oliver Twist',
      email: customerEmail,
      address: '48 Doughty Street, London WC1N 2LX',
      telephone: '+44 20 7405 2127',
      passwordHash: 'dummyhash',
      mockCardRef: '•••• •••• •••• 4242',
    });
  } else {
    testCustomer = existingCust;
  }

  staffUser = await AccountModel.findByEmail('staff@privatehirecars.com');
  if (!staffUser) {
    staffUser = { id: 1, name: 'Staff Dispatcher', email: 'staff@privatehirecars.com', role: 'STAFF' };
  }

  await t.test('1. CARD booking generates TXN-CARD-... reference and preserves masked card string', async () => {
    const pickupTime = new Date(Date.now() + 48 * 3600000);
    const req = {
      user: testCustomer,
      body: {
        pickupAddress: 'Mayfair, London W1',
        dropoffAddress: 'Heathrow Airport Terminal 2',
        pickupTime: pickupTime.toISOString(),
        service: 'Airport transfer',
        vehicleCapacity: 4,
        paymentMethod: 'MOCK_CARD',
        status: 'CONFIRMED',
      },
    };
    const res = createMockRes();
    await bookingController.createBooking(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    const bk = res.body.booking;

    assert.ok(bk.payment_reference.startsWith('TXN-CARD-'), `Expected TXN-CARD- prefix, got: ${bk.payment_reference}`);
    assert.equal(bk.card_ref_used, '•••• •••• •••• 4242');
    assert.equal(bk.payment_status, 'PAID');

    // Retrieve receipt
    const receiptReq = { user: testCustomer, params: { id: bk.booking_code } };
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptRes);

    assert.equal(receiptRes.statusCode, 200);
    assert.equal(receiptRes.body.success, true);
    const receipt = receiptRes.body.receipt;

    assert.ok(receipt.receiptNumber.startsWith('REC-'), `Expected REC- prefix, got ${receipt.receiptNumber}`);
    assert.equal(receipt.paymentReference, bk.payment_reference);
    assert.equal(receipt.pricing.cardRefUsed, '•••• •••• •••• 4242');
    assert.equal(receipt.pricing.paymentMethod, 'MOCK_CARD');
    assert.equal(receipt.paymentHistory.length, 1);
    assert.equal(receipt.paymentHistory[0].type, 'CHARGE');
    assert.equal(receipt.paymentHistory[0].status, 'PAID');
  });

  await t.test('2. CASH booking generates TXN-CSH-... reference and NEVER includes card reference', async () => {
    const pickupTime = new Date(Date.now() + 72 * 3600000);
    const req = {
      user: testCustomer,
      body: {
        pickupAddress: 'Canary Wharf, London E14',
        dropoffAddress: 'London City Airport, E16',
        pickupTime: pickupTime.toISOString(),
        service: 'Local journey',
        vehicleCapacity: 4,
        paymentMethod: 'CASH',
        status: 'PENDING',
      },
    };
    const res = createMockRes();
    await bookingController.createBooking(req, res);

    assert.equal(res.statusCode, 201);
    const bk = res.body.booking;

    assert.ok(bk.payment_reference.startsWith('TXN-CSH-'), `Expected TXN-CSH- prefix, got: ${bk.payment_reference}`);
    assert.equal(bk.card_ref_used, null, 'Cash booking MUST NOT contain card reference string');
    assert.equal(bk.payment_status, 'UNPAID');

    // Pending unpaid booking CANNOT view paid receipt yet
    const receiptReq = { user: testCustomer, params: { id: bk.booking_code } };
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptRes);

    assert.equal(receiptRes.statusCode, 400);
    assert.equal(receiptRes.body.success, false);
  });

  await t.test('3. PAYPAL simulated booking generates TXN-PP-... reference and omits card reference', async () => {
    const pickupTime = new Date(Date.now() + 96 * 3600000);
    const req = {
      user: testCustomer,
      body: {
        pickupAddress: 'Kensington Palace Gardens, London W8',
        dropoffAddress: 'Gatwick Airport South Terminal, RH6',
        pickupTime: pickupTime.toISOString(),
        service: 'Airport transfer',
        vehicleCapacity: 4,
        paymentMethod: 'PAYPAL',
        status: 'CONFIRMED',
      },
    };
    const res = createMockRes();
    await bookingController.createBooking(req, res);

    assert.equal(res.statusCode, 201);
    const bk = res.body.booking;

    assert.ok(bk.payment_reference.startsWith('TXN-PP-'), `Expected TXN-PP- prefix, got: ${bk.payment_reference}`);
    assert.equal(bk.card_ref_used, null, 'PayPal booking MUST NOT use Visa card string');
  });

  await t.test('4. CANCELLED and REFUNDED booking: Owner can still retrieve receipt and statement with refund history', async () => {
    const pickupTime = new Date(Date.now() + 120 * 3600000);
    // Create paid booking
    const req = {
      user: testCustomer,
      body: {
        pickupAddress: 'Baker Street, London NW1',
        dropoffAddress: 'St Pancras International, N1C',
        pickupTime: pickupTime.toISOString(),
        service: 'Local journey',
        vehicleCapacity: 4,
        paymentMethod: 'MOCK_CARD',
        status: 'CONFIRMED',
      },
    };
    const res = createMockRes();
    await bookingController.createBooking(req, res);
    const bk = res.body.booking;

    // Cancel booking (>= 24h eligible)
    const cancelReq = { user: testCustomer, params: { id: bk.booking_code }, body: { reason: 'Trip rescheduled' } };
    const cancelRes = createMockRes();
    await bookingController.cancelBooking(cancelReq, cancelRes);

    assert.equal(cancelRes.statusCode, 200);
    assert.equal(cancelRes.body.refundCreated, true);

    // Staff processes the pending refund
    const pendingRefunds = await RefundModel.getPending();
    const targetRefund = pendingRefunds.find(r => r.booking_id === bk.id);
    assert.ok(targetRefund, 'Expected refund request to be queued');

    const procReq = { user: staffUser, params: { id: targetRefund.id }, body: { staffNotes: 'Customer cancellation approved per policy' } };
    const procRes = createMockRes();
    await staffController.processRefund(procReq, procRes);
    assert.equal(procRes.statusCode, 200);

    // Verify booking payment status is now REFUNDED
    const reloadedBooking = await BookingModel.findById(bk.id);
    assert.equal(reloadedBooking.status, 'CANCELLED');
    assert.equal(reloadedBooking.payment_status, 'REFUNDED');

    // Customer reloads page and retrieves receipt for CANCELLED / REFUNDED booking
    const receiptReq = { user: testCustomer, params: { id: bk.booking_code } };
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(receiptReq, receiptRes);

    assert.equal(receiptRes.statusCode, 200, 'Owner MUST still be able to access receipt & statement after REFUNDED');
    assert.equal(receiptRes.body.success, true);
    const receipt = receiptRes.body.receipt;

    assert.equal(receipt.paymentHistory.length, 1);
    assert.equal(receipt.paymentHistory[0].type, 'CHARGE');
    assert.equal(receipt.paymentHistory[0].status, 'REFUNDED');

    assert.equal(receipt.refundHistory.length, 1);
    assert.equal(receipt.refundHistory[0].type, 'REFUND');
    assert.equal(receipt.refundHistory[0].status, 'PROCESSED');
    assert.equal(receipt.refundHistory[0].reference, `REF-${targetRefund.id}`);
    assert.equal(receipt.refundHistory[0].amount, parseFloat(bk.finalFare || bk.final_fare));
  });

  await t.test('6. Confirm Booking endpoint returns real receiptNumber and booking_code, never placeholders', async () => {
    const pickupTime = new Date(Date.now() + 48 * 3600000);
    // Create PENDING booking
    const createReq = {
      user: testCustomer,
      body: {
        pickupAddress: 'Paddington Station, London W2',
        dropoffAddress: 'Gatwick Airport South Terminal',
        pickupTime: pickupTime.toISOString(),
        service: 'Airport transfer',
        vehicleCapacity: 4,
        paymentMethod: 'MOCK_CARD',
        status: 'PENDING',
      },
    };
    const createRes = createMockRes();
    await bookingController.createBooking(createReq, createRes);
    assert.equal(createRes.statusCode, 201);
    const pendingBk = createRes.body.booking;

    // Confirm booking via simulatePayment
    const confirmReq = {
      user: testCustomer,
      params: { id: pendingBk.id },
      body: {
        paymentMethod: 'MOCK_CARD',
        simulationResult: 'SUCCESS',
      },
    };
    const confirmRes = createMockRes();
    await bookingController.simulatePayment(confirmReq, confirmRes);

    assert.equal(confirmRes.statusCode, 200);
    assert.equal(confirmRes.body.success, true);
    assert.ok(confirmRes.body.booking, 'Expected confirmed booking in response');
    assert.ok(confirmRes.body.receiptNumber, 'Expected receiptNumber in response');

    const expectedSuffix = confirmRes.body.booking.booking_code.replace(/^BK-/, '');
    assert.equal(confirmRes.body.receiptNumber, `REC-${expectedSuffix}`);
    assert.ok(!confirmRes.body.receiptNumber.includes('SUCCESS'), 'receiptNumber MUST NOT contain SUCCESS placeholder');
    assert.ok(!confirmRes.body.booking.booking_code.includes('SUCCESS'), 'booking_code MUST NOT contain SUCCESS placeholder');
  });
});
