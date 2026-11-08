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

test('Sprint Feature: Form State Persistence for Chauffeur Booking Data', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingDraftModel = require('../src/models/bookingDraftModel');
  const bookingController = require('../src/controllers/bookingController');
  const AccountModel = require('../src/models/accountModel');

  // Seed a test registered customer account
  const customerAccount = await AccountModel.create({
    accountCode: 'ACC-PERSIST-999',
    name: 'Sarah Connor',
    telephone: '+44 7911 123456',
    email: 'sarah.connor@sky.test',
    address: '10 Downing Street, London',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    mockCardRef: '•••• •••• •••• 4242 (Visa Test Card)',
  });

  await t.test('1. Visitor saves in-progress booking form draft (POST /api/bookings/draft)', async () => {
    const visitorToken = 'vst-test-visitor-token-123';
    let statusCode = 0;
    let responseBody = null;

    const mockReq = {
      user: null,
      headers: {},
      query: {},
      body: {
        draftToken: visitorToken,
        pickupAddress: 'Heathrow Airport Terminal 5',
        dropoffAddress: 'The Ritz London, Piccadilly',
        service: 'Airport transfer',
        vehicleCapacity: 4,
      },
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await bookingController.saveBookingDraft(mockReq, mockRes);

    assert.equal(statusCode, 200, 'Should return HTTP 200 on saving draft');
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.draftToken, visitorToken);
    assert.equal(responseBody.draft.pickupAddress, 'Heathrow Airport Terminal 5');
    assert.equal(responseBody.draft.dropoffAddress, 'The Ritz London, Piccadilly');
    assert.equal(responseBody.draft.serviceName, 'Airport transfer');
    assert.equal(responseBody.draft.vehicleCapacity, 4);
    assert.equal(responseBody.draft.fareAmount, 45.00, 'Calculates fixed Table 8 fare: £45.00 for Airport transfer (4 passengers)');
    assert.equal(responseBody.draft.occupiedDurationMinutes, 90, 'Table 8 duration: 90 mins');
  });

  await t.test('2. Multiple auto-save triggers update existing draft without duplicates (Idempotency)', async () => {
    const visitorToken = 'vst-test-visitor-token-123';
    let statusCode = 0;
    let responseBody = null;

    // Visitor changes destination and vehicle capacity to 7
    const mockReq = {
      user: null,
      headers: {},
      query: {},
      body: {
        draftToken: visitorToken,
        pickupAddress: 'Heathrow Airport Terminal 5',
        dropoffAddress: 'The Savoy Hotel, Strand, London',
        service: 'Airport transfer',
        vehicleCapacity: 7,
      },
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await bookingController.saveBookingDraft(mockReq, mockRes);

    assert.equal(statusCode, 200);
    assert.equal(responseBody.draft.dropoffAddress, 'The Savoy Hotel, Strand, London');
    assert.equal(responseBody.draft.vehicleCapacity, 7);
    assert.equal(responseBody.draft.fareAmount, 65.00, '7-passenger fare for Airport transfer is £65.00');

    // Verify there is still only 1 row in booking_drafts for this token
    const dbRows = await pool.query('SELECT COUNT(*) AS total FROM booking_drafts WHERE draft_token = $1', [visitorToken]);
    assert.equal(parseInt(dbRows.rows[0].total, 10), 1, 'Must maintain exactly one draft record per draftToken');
  });

  await t.test('3. Retrieve persisted booking form draft (GET /api/bookings/draft)', async () => {
    const visitorToken = 'vst-test-visitor-token-123';
    let statusCode = 0;
    let responseBody = null;

    const mockReq = {
      user: null,
      headers: {},
      query: { draftToken: visitorToken },
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await bookingController.getBookingDraft(mockReq, mockRes);

    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);
    assert.equal(responseBody.hasDraft, true);
    assert.equal(responseBody.draft.pickupAddress, 'Heathrow Airport Terminal 5');
    assert.equal(responseBody.draft.dropoffAddress, 'The Savoy Hotel, Strand, London');
    assert.equal(responseBody.draft.serviceName, 'Airport transfer');
    assert.equal(responseBody.draft.vehicleCapacity, 7);
    assert.equal(responseBody.draft.fareAmount, 65.00);
  });

  await t.test('4. Auth Transition: Authenticated user saves & retrieves draft linked to accountId', async () => {
    let statusCode = 0;
    let responseBody = null;

    const mockReq = {
      user: customerAccount,
      headers: {},
      query: {},
      body: {
        pickupAddress: 'Canary Wharf, London',
        dropoffAddress: 'Gatwick Airport',
        service: 'Driver and car daily hire',
        vehicleCapacity: 4,
      },
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await bookingController.saveBookingDraft(mockReq, mockRes);

    assert.equal(statusCode, 200);
    assert.equal(responseBody.draft.accountId, customerAccount.id);
    assert.equal(responseBody.draft.serviceName, 'Driver and car daily hire');
    assert.equal(responseBody.draft.fareAmount, 200.00);
    assert.equal(responseBody.draft.occupiedDurationMinutes, 480);

    // Fetch draft by authenticated user session (without draftToken query param)
    const getReq = {
      user: customerAccount,
      headers: {},
      query: {},
    };
    let getStatus = 0;
    let getBody = null;
    const getRes = {
      status(c) { getStatus = c; return this; },
      json(d) { getBody = d; return this; },
    };

    await bookingController.getBookingDraft(getReq, getRes);
    assert.equal(getStatus, 200);
    assert.equal(getBody.hasDraft, true);
    assert.equal(getBody.draft.pickupAddress, 'Canary Wharf, London');
    assert.equal(getBody.draft.accountId, customerAccount.id);
  });

  await t.test('5. Manually clear booking draft (DELETE /api/bookings/draft)', async () => {
    const visitorToken = 'vst-test-visitor-token-123';
    let statusCode = 0;
    let responseBody = null;

    const mockReq = {
      user: null,
      headers: {},
      query: { draftToken: visitorToken },
    };

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    await bookingController.clearBookingDraft(mockReq, mockRes);
    assert.equal(statusCode, 200);
    assert.equal(responseBody.success, true);

    // Verify it is gone
    const checkDraft = await BookingDraftModel.getDraft({ draftToken: visitorToken });
    assert.equal(checkDraft, null, 'Draft should be deleted from database');
  });

  await t.test('6. Confirmed booking submission automatically clears the active draft', async () => {
    // 1. Customer has an active draft
    await BookingDraftModel.saveDraft({
      accountId: customerAccount.id,
      draftToken: `usr-${customerAccount.id}`,
      pickupAddress: 'Mayfair, London',
      dropoffAddress: 'Big Ben, Westminster',
      serviceName: 'Local journey',
      vehicleCapacity: 4,
      fareAmount: 20.00,
    });

    const draftBefore = await BookingDraftModel.getDraft({ accountId: customerAccount.id });
    assert.ok(draftBefore, 'Active draft must exist before confirmed booking');

    // 2. Customer submits confirmed booking
    let bookStatusCode = 0;
    let bookResponse = null;

    const bookReq = {
      user: customerAccount,
      headers: {},
      body: {
        draftToken: `usr-${customerAccount.id}`,
        pickupAddress: 'Mayfair, London',
        dropoffAddress: 'Big Ben, Westminster',
        service: 'Local journey',
        vehicleCapacity: 4,
      },
    };

    const bookRes = {
      status(code) {
        bookStatusCode = code;
        return this;
      },
      json(data) {
        bookResponse = data;
        return this;
      },
    };

    await bookingController.createBooking(bookReq, bookRes);

    assert.equal(bookStatusCode, 201, 'Booking must be created with 201 Created');
    assert.equal(bookResponse.success, true);

    // 3. Verify draft was automatically cleared
    const draftAfter = await BookingDraftModel.getDraft({ accountId: customerAccount.id });
    assert.equal(draftAfter, null, 'Active draft must be automatically deleted once booking is confirmed');
  });
});
