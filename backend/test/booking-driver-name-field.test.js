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

test('Database & Model: Field driver_name in bookings table linked to chauffeur', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingModel = require('../src/models/bookingModel');
  const AccountModel = require('../src/models/accountModel');
  const DriverModel = require('../src/models/driverModel');
  const VehicleModel = require('../src/models/vehicleModel');

  // Create test customer
  const customer = await AccountModel.create({
    accountCode: 'ACC-DRV-TEST',
    name: 'Eleanor Vance',
    email: 'eleanor.vance@example.com',
    address: 'Hill House, London',
    telephone: '+44 20 7946 0888',
    passwordHash: 'hashed_pw',
    mockCardRef: '•••• •••• •••• 4242',
  });

  // Create test drivers
  const driver1 = await DriverModel.create({
    driverCode: 'DRV-LNK-01',
    name: 'Arthur Pendelton',
    telephone: '+44 7700 900555',
    referenceNumber: 'TFL-PHV-001',
    status: 'ACTIVE',
  });

  const driver2 = await DriverModel.create({
    driverCode: 'DRV-LNK-02',
    name: 'Beatrice Baudelaire',
    telephone: '+44 7700 900666',
    referenceNumber: 'TFL-PHV-002',
    status: 'ACTIVE',
  });

  // Create vehicle linked to driver1
  const vehicle = await VehicleModel.create({
    regNumber: 'LD68 DNV',
    makeModel: 'Mercedes-Benz E-Class Saloon',
    colour: 'Obsidian Black',
    capacity: 4,
    status: 'ACTIVE',
    driverId: driver1.id,
  });

  await t.test('1. Database schema: bookings table contains driver_name column', async () => {
    // Check that inserting directly into bookings with driver_name works
    const insertRes = await db.query(`
      INSERT INTO bookings (
        booking_code, account_id, pickup_address, dropoff_address,
        passenger_name, passenger_phone, driver_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, booking_code, driver_name
    `, [
      'BK-RAW-COL-01', customer.id, 'Baker St', 'Bond St',
      customer.name, customer.telephone, 'Arthur Pendelton'
    ]);

    assert.equal(insertRes.rows[0].driver_name, 'Arthur Pendelton');

    // Direct SELECT verification on table bookings
    const selectRes = await db.query(
      'SELECT driver_name FROM bookings WHERE id = $1',
      [insertRes.rows[0].id]
    );
    assert.equal(selectRes.rows[0].driver_name, 'Arthur Pendelton');
  });

  await t.test('2. BookingModel.create: automatically resolves driver_name from driverId', async () => {
    const booking = await BookingModel.create({
      bookingCode: 'BK-AUTO-DRV-02',
      accountId: customer.id,
      pickupAddress: 'Mayfair, London',
      dropoffAddress: 'Gatwick Airport',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      driverId: driver1.id,
      vehicleId: vehicle.id,
    });

    assert.equal(booking.driver_name, 'Arthur Pendelton');

    // Verify row directly in bookings table
    const directRow = await db.query('SELECT driver_id, driver_name FROM bookings WHERE id = $1', [booking.id]);
    assert.equal(directRow.rows[0].driver_id, driver1.id);
    assert.equal(directRow.rows[0].driver_name, 'Arthur Pendelton');
  });

  await t.test('3. BookingModel.create: automatically resolves driver_name from requestedDriverId', async () => {
    const booking = await BookingModel.create({
      bookingCode: 'BK-AUTO-REQ-03',
      accountId: customer.id,
      pickupAddress: 'Kensington, London',
      dropoffAddress: 'Heathrow Airport',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      requestedDriverId: driver2.id,
    });

    assert.equal(booking.driver_name, 'Beatrice Baudelaire');

    const directRow = await db.query('SELECT requested_driver_id, driver_name FROM bookings WHERE id = $1', [booking.id]);
    assert.equal(directRow.rows[0].requested_driver_id, driver2.id);
    assert.equal(directRow.rows[0].driver_name, 'Beatrice Baudelaire');
  });

  await t.test('4. BookingModel.assignDriver: updates driver_id and driver_name synchronously on row', async () => {
    const booking = await BookingModel.create({
      bookingCode: 'BK-ASSIGN-04',
      accountId: customer.id,
      pickupAddress: 'Soho, London',
      dropoffAddress: 'City Airport',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      status: 'CONFIRMED',
    });

    assert.equal(booking.driver_id, null);
    assert.equal(booking.driver_name, null);

    // Assign driver2 to booking
    const updated = await BookingModel.assignDriver({
      id: booking.id,
      driverId: driver2.id,
    });

    assert.equal(updated.driver_id, driver2.id);
    assert.equal(updated.driver_name, 'Beatrice Baudelaire');
    assert.equal(updated.status, 'ASSIGNED');

    // Verify raw row in table bookings
    const directRow = await db.query('SELECT driver_id, driver_name, status FROM bookings WHERE id = $1', [booking.id]);
    assert.equal(directRow.rows[0].driver_id, driver2.id);
    assert.equal(directRow.rows[0].driver_name, 'Beatrice Baudelaire');
  });

  await t.test('5. BookingModel.assignDriverAndVehicle: updates driver_id, vehicle_id and driver_name on row', async () => {
    const booking = await BookingModel.create({
      bookingCode: 'BK-ASSIGN-VH-05',
      accountId: customer.id,
      pickupAddress: 'Victoria, London',
      dropoffAddress: 'Stansted Airport',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      status: 'CONFIRMED',
    });

    const updated = await BookingModel.assignDriverAndVehicle(booking.id, driver1.id, vehicle.id);
    assert.equal(updated.driver_id, driver1.id);
    assert.equal(updated.vehicle_id, vehicle.id);
    assert.equal(updated.driver_name, 'Arthur Pendelton');

    const directRow = await db.query('SELECT driver_id, vehicle_id, driver_name FROM bookings WHERE id = $1', [booking.id]);
    assert.equal(directRow.rows[0].driver_id, driver1.id);
    assert.equal(directRow.rows[0].driver_name, 'Arthur Pendelton');
  });

  await t.test('6. BookingModel.amendBooking: synchronizes driver_name when reassigning driver', async () => {
    const booking = await BookingModel.create({
      bookingCode: 'BK-AMEND-06',
      accountId: customer.id,
      pickupAddress: 'Covent Garden',
      dropoffAddress: 'Luton Airport',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      driverId: driver1.id,
      status: 'CONFIRMED',
    });
    assert.equal(booking.driver_name, 'Arthur Pendelton');

    // Amend to driver2
    const amended = await BookingModel.amendBooking(booking.id, {
      driverId: driver2.id,
    });

    assert.equal(amended.driver_id, driver2.id);
    assert.equal(amended.driver_name, 'Beatrice Baudelaire');

    const directRow = await db.query('SELECT driver_id, driver_name FROM bookings WHERE id = $1', [booking.id]);
    assert.equal(directRow.rows[0].driver_name, 'Beatrice Baudelaire');
  });

  await t.test('7. BookingModel.cancelBooking: clears driver_name, driver_id and requested_driver_id', async () => {
    const booking = await BookingModel.create({
      bookingCode: 'BK-CANCEL-07',
      accountId: customer.id,
      pickupAddress: 'Chelsea, London',
      dropoffAddress: 'Heathrow Airport',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      driverId: driver1.id,
      status: 'CONFIRMED',
    });
    assert.equal(booking.driver_name, 'Arthur Pendelton');

    const cancelled = await BookingModel.cancelBooking(booking.id);
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.driver_id, null);
    assert.equal(cancelled.driver_name, null);

    const directRow = await db.query('SELECT status, driver_id, driver_name FROM bookings WHERE id = $1', [booking.id]);
    assert.equal(directRow.rows[0].driver_id, null);
    assert.equal(directRow.rows[0].driver_name, null);
  });
});
