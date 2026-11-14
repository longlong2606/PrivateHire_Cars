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

test('Sprint Feature: Edit Vehicle/Driver Status Normalization & Reservation Protection', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingModel = require('../src/models/bookingModel');
  const AccountModel = require('../src/models/accountModel');
  const VehicleModel = require('../src/models/vehicleModel');
  const DriverModel = require('../src/models/driverModel');
  const StaffController = require('../src/controllers/staffController');

  // Create Staff account
  const staff = await AccountModel.create({
    accountCode: 'ACC-STF-FLEET',
    name: 'Fleet Manager',
    email: 'fleet.manager@privatehire.co.uk',
    address: '10 Fleet Way, London',
    telephone: '+44 20 7946 0111',
    passwordHash: 'hashed_pw',
    mockCardRef: '•••• •••• •••• 1111',
  });
  await AccountModel.updateRole(staff.id, 'STAFF');
  staff.role = 'STAFF';

  // Seed sample vehicle and driver
  const driver = await DriverModel.create({
    driverCode: 'DRV-777',
    name: 'Arthur Conan',
    telephone: '+44 20 7946 0222',
    referenceNumber: 'PCO-DRV-777',
    status: 'ACTIVE',
  });

  const vehicle = await VehicleModel.create({
    regNumber: 'LD68 ABC',
    makeModel: 'Mercedes-Benz E-Class',
    colour: 'Obsidian Black',
    capacity: 4,
    status: 'ACTIVE',
    driverId: driver.id,
  });

  await t.test('1. Update Vehicle: status "AVAILABLE" is normalized to "ACTIVE" in DB and API response', async () => {
    const req = {
      user: staff,
      params: { id: vehicle.id },
      body: {
        status: 'AVAILABLE',
      },
    };
    const res = createMockRes();
    await StaffController.updateVehicle(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.vehicle.status, 'ACTIVE');

    const dbCheck = await VehicleModel.findById(vehicle.id);
    assert.equal(dbCheck.status, 'ACTIVE');
  });

  await t.test('2. Update Vehicle: status "ACTIVE" is accepted and saved', async () => {
    const req = {
      user: staff,
      params: { id: vehicle.id },
      body: {
        status: 'ACTIVE',
      },
    };
    const res = createMockRes();
    await StaffController.updateVehicle(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.vehicle.status, 'ACTIVE');
  });

  await t.test('3. Update Vehicle: empty or invalid status is rejected with 400', async () => {
    // Empty string status
    const reqEmpty = {
      user: staff,
      params: { id: vehicle.id },
      body: { status: '   ' },
    };
    const resEmpty = createMockRes();
    await StaffController.updateVehicle(reqEmpty, resEmpty);
    assert.equal(resEmpty.statusCode, 400);

    // Invalid status string
    const reqInvalid = {
      user: staff,
      params: { id: vehicle.id },
      body: { status: 'BROKEN_STATUS' },
    };
    const resInvalid = createMockRes();
    await StaffController.updateVehicle(reqInvalid, resInvalid);
    assert.equal(resInvalid.statusCode, 400);
  });

  await t.test('4. Update Vehicle: status "UNAVAILABLE" succeeds when no active/upcoming bookings exist', async () => {
    const req = {
      user: staff,
      params: { id: vehicle.id },
      body: { status: 'UNAVAILABLE' },
    };
    const res = createMockRes();
    await StaffController.updateVehicle(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.vehicle.status, 'UNAVAILABLE');

    // Reset back to ACTIVE for next tests
    await VehicleModel.update(vehicle.id, { status: 'ACTIVE' });
  });

  await t.test('5. Guard: Update Vehicle to "UNAVAILABLE" is BLOCKED (400 VEHICLE_CURRENTLY_HELD) if vehicle is reserved', async () => {
    const futurePickup = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    await BookingModel.create({
      bookingCode: 'BK-HELD-VEH-01',
      accountId: staff.id,
      pickupAddress: 'Mayfair',
      dropoffAddress: 'Heathrow',
      pickupTime: futurePickup,
      occupiedDurationMinutes: 90,
      carType: 'Executive Saloon',
      vehicleId: vehicle.id,
      driverId: driver.id,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    });

    const req = {
      user: staff,
      params: { id: vehicle.id },
      body: { status: 'UNAVAILABLE' },
    };
    const res = createMockRes();
    await StaffController.updateVehicle(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, 'VEHICLE_CURRENTLY_HELD');
  });

  await t.test('6. Chauffeur Status: "AVAILABLE" normalizes to "ACTIVE", invalid/empty rejected, held chauffeur blocked', async () => {
    // Normalization test
    const reqAvail = {
      user: staff,
      params: { id: driver.id },
      body: { status: 'AVAILABLE' },
    };
    const resAvail = createMockRes();
    await StaffController.updateDriver(reqAvail, resAvail);
    assert.equal(resAvail.statusCode, 200);
    assert.equal(resAvail.body.driver.status, 'ACTIVE');

    // Empty status rejected
    const reqEmpty = {
      user: staff,
      params: { id: driver.id },
      body: { status: '' },
    };
    const resEmpty = createMockRes();
    await StaffController.updateDriver(reqEmpty, resEmpty);
    assert.equal(resEmpty.statusCode, 400);

    // Chauffeur held by upcoming booking cannot be set to UNAVAILABLE
    const reqUnavail = {
      user: staff,
      params: { id: driver.id },
      body: { status: 'UNAVAILABLE' },
    };
    const resUnavail = createMockRes();
    await StaffController.updateDriver(reqUnavail, resUnavail);
    assert.equal(resUnavail.statusCode, 400);
    assert.equal(resUnavail.body.code, 'DRIVER_CURRENTLY_HELD');
  });
});
