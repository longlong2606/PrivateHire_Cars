const test = require('node:test');
const assert = require('node:assert/strict');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');

// Setup in-memory test database using pg-mem
const setupTestDb = async () => {
  const memDb = newDb();
  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  const schemaPath = path.join(__dirname, '../src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);

  return { pool };
};

test('Sprint Feature: Seed Six Services with Fixed Sample Fares and Durations (Table 8)', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const ServiceModel = require('../src/models/serviceModel');
  const serviceController = require('../src/controllers/serviceController');
  const bookingController = require('../src/controllers/bookingController');

  await t.test('1. Database contains exactly six seeded services from Table 8', async () => {
    const services = await ServiceModel.getAll();
    assert.equal(services.length, 6, 'There must be exactly 6 seeded services');

    const expectedServices = [
      { name: 'Local journey', fourFare: 20.00, sevenFare: 30.00, duration: 60 },
      { name: 'Long-distance journey', fourFare: 80.00, sevenFare: 120.00, duration: 180 },
      { name: 'Airport transfer', fourFare: 45.00, sevenFare: 65.00, duration: 90 },
      { name: 'Hotel transfer', fourFare: 30.00, sevenFare: 45.00, duration: 60 },
      { name: 'Airport meet-and-greet', fourFare: 55.00, sevenFare: 80.00, duration: 120 },
      { name: 'Driver and car daily hire', fourFare: 200.00, sevenFare: 280.00, duration: 480 },
    ];

    for (const exp of expectedServices) {
      const found = services.find(s => s.service_name === exp.name);
      assert.ok(found, `Service "${exp.name}" must exist in seeded table`);
      assert.equal(parseFloat(found.four_passenger_fare), exp.fourFare, `4-passenger fare for ${exp.name} must be £${exp.fourFare}`);
      assert.equal(parseFloat(found.seven_passenger_fare), exp.sevenFare, `7-passenger fare for ${exp.name} must be £${exp.sevenFare}`);
      assert.equal(parseInt(found.occupied_duration_minutes, 10), exp.duration, `Occupied duration for ${exp.name} must be ${exp.duration} mins`);
      assert.equal(found.currency, 'GBP', `Currency must be GBP`);
      assert.equal(found.is_active, true, `Service must be active`);
    }
  });

  await t.test('2. Calculate fare: Four-passenger vs Seven-passenger vehicle pricing', async () => {
    // Local journey: 4-passenger (£20.00, 60 mins)
    const local4 = await ServiceModel.calculateFareAndDuration('Local journey', 4);
    assert.equal(local4.fixedFare, 20.00);
    assert.equal(local4.occupiedDurationMinutes, 60);
    assert.equal(local4.vehicleCapacity, 4);

    // Local journey: 7-passenger (£30.00, 60 mins)
    const local7 = await ServiceModel.calculateFareAndDuration('Local journey', 7);
    assert.equal(local7.fixedFare, 30.00);
    assert.equal(local7.occupiedDurationMinutes, 60);
    assert.equal(local7.vehicleCapacity, 7);

    // Airport transfer: 4-passenger (£45.00, 90 mins)
    const airport4 = await ServiceModel.calculateFareAndDuration('Airport transfer', 4);
    assert.equal(airport4.fixedFare, 45.00);
    assert.equal(airport4.occupiedDurationMinutes, 90);

    // Airport transfer: 7-passenger (£65.00, 90 mins)
    const airport7 = await ServiceModel.calculateFareAndDuration('Airport transfer', 7);
    assert.equal(airport7.fixedFare, 65.00);
    assert.equal(airport7.occupiedDurationMinutes, 90);

    // Driver and car daily hire: 4-passenger (£200.00, 480 mins)
    const hire4 = await ServiceModel.calculateFareAndDuration('Driver and car daily hire', 4);
    assert.equal(hire4.fixedFare, 200.00);
    assert.equal(hire4.occupiedDurationMinutes, 480);

    // Driver and car daily hire: 7-passenger (£280.00, 480 mins)
    const hire7 = await ServiceModel.calculateFareAndDuration('Driver and car daily hire', 7);
    assert.equal(hire7.fixedFare, 280.00);
    assert.equal(hire7.occupiedDurationMinutes, 480);
  });

  await t.test('3. API GET /api/services returns list of all 6 services with structured format', async () => {
    let responseData = null;
    let statusCode = 200;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await serviceController.getServices(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.count, 6);
    assert.equal(responseData.services.length, 6);
    assert.ok(responseData.pricingRule.includes('not calculated from actual travel distance'));

    const localSvc = responseData.services.find(s => s.serviceName === 'Local journey');
    assert.ok(localSvc);
    assert.equal(localSvc.fares.fourPassenger.amount, 20.00);
    assert.equal(localSvc.fares.sevenPassenger.amount, 30.00);
    assert.equal(localSvc.duration.minutes, 60);
  });

  await t.test('4. API POST /api/services/quote calculates fixed fare and duration', async () => {
    let responseData = null;
    let statusCode = 200;

    const req = {
      body: {
        service: 'Airport meet-and-greet',
        vehicleCapacity: 7,
      },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await serviceController.calculateFare(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.quote.fixedFare, 80.00);
    assert.equal(responseData.quote.currency, 'GBP');
    assert.equal(responseData.quote.occupiedDurationMinutes, 120);
    assert.equal(responseData.quote.vehicleCapacity, 7);
  });

  await t.test('5. Online Booking with service selection records fixed fare and duration', async () => {
    // Seed a customer account in test db
    const accRes = await pool.query(`
      INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, status)
      VALUES ('ACC-TEST-777', 'David Beckham', 'david@example.com', 'Mayfair, London', '07700900123', 'fakehash', '•••• •••• •••• 4242 (Visa Test Card)', 'ACTIVE')
      RETURNING *
    `);
    const customer = accRes.rows[0];

    let responseData = null;
    let statusCode = 200;

    const req = {
      user: customer,
      body: {
        pickupAddress: 'The Dorchester Hotel, Park Lane',
        dropoffAddress: 'Heathrow Airport Terminal 5',
        service: 'Airport transfer',
        vehicleCapacity: 4,
      },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await bookingController.createBooking(req, res);

    assert.equal(statusCode, 201);
    assert.equal(responseData.success, true);
    assert.equal(responseData.booking.serviceName, 'Airport transfer');
    assert.equal(parseFloat(responseData.booking.fareAmount), 45.00);
    assert.equal(responseData.booking.occupiedDurationMinutes, 90);
    assert.equal(responseData.booking.vehicleCapacity, 4);
  });

  await t.test('6. Idempotency: Multiple seed executions do not produce duplicates', async () => {
    await ServiceModel.seedServices();
    await ServiceModel.seedServices();

    const countRes = await pool.query('SELECT COUNT(*) FROM services');
    assert.equal(parseInt(countRes.rows[0].count, 10), 6, 'Services table must maintain exactly 6 rows');
  });
});

