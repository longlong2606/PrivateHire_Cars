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

test('Comprehensive Verification: Pending Booking Flow, Resource Holding & Staff Driver Assignment', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingModel = require('../src/models/bookingModel');
  const AccountModel = require('../src/models/accountModel');
  const DriverModel = require('../src/models/driverModel');
  const VehicleModel = require('../src/models/vehicleModel');
  const bookingController = require('../src/controllers/bookingController');
  const StaffController = require('../src/controllers/staffController');

  // 1. Create Customer 1, Customer 2, and Staff
  const customer1 = await AccountModel.create({
    accountCode: 'ACC-VERIFY-1',
    name: 'Sherlock Holmes',
    telephone: '+44 7700 900001',
    email: 'sherlock.verify@bakerstreet.co.uk',
    address: '221B Baker Street, London',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    mockCardRef: '•••• •••• •••• 4242 (Visa Test Card)',
  });

  const customer2 = await AccountModel.create({
    accountCode: 'ACC-VERIFY-2',
    name: 'John Watson',
    telephone: '+44 7700 900002',
    email: 'watson.verify@bakerstreet.co.uk',
    address: '221B Baker Street, London',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    mockCardRef: '•••• •••• •••• 4242 (Visa Test Card)',
  });

  const staff = await AccountModel.create({
    accountCode: 'STAFF-VERIFY-001',
    name: 'Inspector Lestrade',
    telephone: '+44 20 7946 0999',
    email: 'lestrade.verify@scotlandyard.gov.uk',
    address: 'Scotland Yard, London',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    mockCardRef: '•••• •••• •••• 4242 (Visa Test Card)',
  });
  await pool.query("UPDATE accounts SET role = 'STAFF' WHERE id = $1", [staff.id]);
  staff.role = 'STAFF';

  // Chauffeur 1 and Vehicle 1 already exist in schema.sql:
  // Driver 1: 'Arthur Pendelton', Vehicle 1: 'LD68 PHC' (driver_id = 1)
  // Driver 2: 'Marcus Sterling', Vehicle 2: 'LJ23 MPV' (driver_id = 2)

  const slotStart = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
  let pendingBooking = null;

  await t.test('1. Customer clicking Proceed creates PENDING / UNPAID booking without reserving vehicle/driver', async () => {
    const req = {
      user: customer1,
      body: {
        pickupAddress: '221B Baker Street, London',
        dropoffAddress: 'Heathrow Airport Terminal 2',
        serviceName: 'Airport transfer',
        vehicleCapacity: 4,
        vehicleId: 1,
        pickupTime: slotStart.toISOString(),
        passengerCount: 2,
      },
    };
    const res = createMockRes();

    await bookingController.createBooking(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.booking.status, 'PENDING');
    assert.equal(res.body.booking.paymentStatus, 'UNPAID');
    assert.equal(res.body.booking.vehicleId, 1);
    pendingBooking = res.body.booking;

    // Verify in DB that requested_driver_id is populated from vehicle's driver, but driver_id is null
    const row = await BookingModel.findById(pendingBooking.id);
    assert.equal(row.requested_driver_id, 1);
    assert.equal(row.driver_id, null, 'Assigned driver_id must remain null while booking is PENDING');

    // Rule: PENDING does NOT hold resources. Customer 2 can still book the same vehicle for the same slot!
    const conflictCheck = await BookingModel.hasVehicleConflict({
      vehicleId: 1,
      pickupTime: slotStart,
      durationMinutes: 60,
    });
    assert.equal(conflictCheck, false, 'Pending booking must not hold vehicle');
  });

  await t.test('2. Staff CANNOT dispatch, alert, or assign a PENDING booking', async () => {
    // Attempt to assign driver
    const assignRes = createMockRes();
    await StaffController.updateJourneyStatus(
      { params: { id: pendingBooking.id }, body: { status: 'ASSIGNED', driverId: 1 }, user: staff },
      assignRes
    );
    assert.equal(assignRes.statusCode, 400);
    assert.equal(assignRes.body.code, 'PENDING_NOT_DISPATCHABLE');

    // Attempt to set EnRoute
    const enRouteRes = createMockRes();
    await StaffController.updateJourneyStatus(
      { params: { id: pendingBooking.id }, body: { status: 'ENROUTE' }, user: staff },
      enRouteRes
    );
    assert.equal(enRouteRes.statusCode, 400);

    // Attempt to get receipt on PENDING booking
    const receiptRes = createMockRes();
    await bookingController.getPrintableReceipt(
      { params: { id: pendingBooking.id }, user: customer1 },
      receiptRes
    );
    assert.equal(receiptRes.statusCode, 400, 'Receipt must be blocked for PENDING booking');
  });

  await t.test('3. Confirm Booking with Electronic Payment succeeds and transitions PENDING -> CONFIRMED / PAID', async () => {
    const confirmReq = {
      user: customer1,
      params: { id: pendingBooking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'SUCCESS' },
    };
    const confirmRes = createMockRes();

    await bookingController.simulatePayment(confirmReq, confirmRes);
    assert.equal(confirmRes.statusCode, 200);
    assert.equal(confirmRes.body.booking.status, 'CONFIRMED');
    assert.equal(confirmRes.body.booking.payment_status, 'PAID');
    assert.equal(confirmRes.body.booking.requested_driver_id, 1);
    assert.equal(confirmRes.body.booking.driver_id, null, 'driver_id remains null until staff allocates');

    // Now CONFIRMED booking HOLDS vehicle 1 and requested chauffeur 1!
    const vHeld = await BookingModel.hasVehicleConflict({
      vehicleId: 1,
      pickupTime: slotStart,
      durationMinutes: 60,
    });
    assert.equal(vHeld, true, 'Vehicle 1 must now be held by CONFIRMED booking');

    const dHeld = await BookingModel.hasDriverConflict({
      driverId: 1,
      pickupTime: slotStart,
      durationMinutes: 60,
    });
    assert.equal(dHeld, true, 'Chauffeur 1 must now be held by CONFIRMED booking');

    // Attempt by Customer 2 to book same vehicle at overlapping time is now BLOCKED!
    const cust2Req = {
      user: customer2,
      body: {
        pickupAddress: '221B Baker Street',
        dropoffAddress: 'Gatwick Airport',
        serviceName: 'Airport transfer',
        vehicleCapacity: 4,
        vehicleId: 1,
        pickupTime: slotStart.toISOString(),
        passengerCount: 1,
      },
    };
    const cust2Res = createMockRes();
    await bookingController.createBooking(cust2Req, cust2Res);
    assert.equal(cust2Res.statusCode, 400);
    assert.equal(cust2Res.body.code, 'VEHICLE_CONFLICT');
  });

  await t.test('4. Contiguous journeys are permitted (half-open interval [start, end))', async () => {
    // Journey 1 is [slotStart, slotStart + 90 mins) (Airport transfer duration is 90 mins).
    // Journey 2 starts exactly at slotStart + 90 mins.
    const contiguousTime = new Date(slotStart.getTime() + 90 * 60 * 1000);
    const hasConflict = await BookingModel.hasVehicleConflict({
      vehicleId: 1,
      pickupTime: contiguousTime,
      durationMinutes: 60,
    });
    assert.equal(hasConflict, false, 'Contiguous journey starting when previous ends must not conflict');
  });

  await t.test('5. Staff Assign Driver MUST match requested_driver_id; mismatched driver is rejected', async () => {
    // Staff attempts to assign Driver 2 to a booking where requested_driver_id is 1
    const mismatchReq = {
      params: { id: pendingBooking.id },
      body: { status: 'ASSIGNED', driverId: 2 },
      user: staff,
    };
    const mismatchRes = createMockRes();

    await StaffController.updateJourneyStatus(mismatchReq, mismatchRes);
    assert.equal(mismatchRes.statusCode, 400);
    assert.equal(mismatchRes.body.code, 'DRIVER_MISMATCH');
    assert.equal(
      mismatchRes.body.message,
      'The assigned driver must match the driver selected for this booking.'
    );

    // Verify booking is still CONFIRMED and unassigned
    const bCheck = await BookingModel.findById(pendingBooking.id);
    assert.equal(bCheck.status, 'CONFIRMED');
    assert.equal(bCheck.driver_id, null);
  });

  await t.test('6. Staff Assign Driver with matching requested chauffeur succeeds (CONFIRMED -> ASSIGNED)', async () => {
    const matchReq = {
      params: { id: pendingBooking.id },
      body: { status: 'ASSIGNED', driverId: 1 },
      user: staff,
    };
    const matchRes = createMockRes();

    await StaffController.updateJourneyStatus(matchReq, matchRes);
    assert.equal(matchRes.statusCode, 200);
    assert.equal(matchRes.body.booking.status, 'ASSIGNED');
    assert.equal(matchRes.body.booking.driver_id, 1);
    assert.equal(matchRes.body.booking.assigned_staff_id, staff.id);
    assert.ok(matchRes.body.booking.assigned_at, 'assigned_at timestamp must be recorded');

    // Re-assigning same driver is idempotent
    const repeatRes = createMockRes();
    await StaffController.updateJourneyStatus(matchReq, repeatRes);
    assert.equal(repeatRes.statusCode, 200);
  });

  await t.test('7. Chauffeur cannot be marked UNAVAILABLE while held by active/upcoming booking', async () => {
    let errCaught = null;
    try {
      await DriverModel.updateStatus(1, 'UNAVAILABLE');
    } catch (err) {
      errCaught = err;
    }
    assert.ok(errCaught, 'Should throw error when setting held chauffeur to UNAVAILABLE');
    assert.equal(errCaught.code, 'DRIVER_CURRENTLY_HELD');
  });

  await t.test('8. Paid Receipt is accessible after confirmation and payment', async () => {
    const receiptReq = {
      params: { id: pendingBooking.id },
      user: customer1,
    };
    const receiptRes = createMockRes();

    await bookingController.getPrintableReceipt(receiptReq, receiptRes);
    assert.equal(receiptRes.statusCode, 200);
    assert.equal(receiptRes.body.success, true);
    assert.equal(receiptRes.body.receipt.journey.bookingCode, pendingBooking.bookingCode || pendingBooking.booking_code);
  });
});
