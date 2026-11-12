const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { newDb } = require('pg-mem');
const fs = require('fs');
const path = require('path');

// Thiết lập pg-mem mock để test độc lập, siêu tốc và không ảnh hưởng DB chính
const setupTestDb = async () => {
  const memDb = newDb();
  const { Pool } = memDb.adapters.createPg();
  const pool = new Pool();

  const schemaPath = path.join(__dirname, '../src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);

  // Tạo 2 tài khoản mẫu
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('Password123!', salt);

  const acc1Res = await pool.query(`
    INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, status)
    VALUES ('ACC-100001', 'Alice Customer', 'alice@example.com', '10 Downing St, London', '0901111111', $1, '•••• •••• •••• 4242 (Visa Test Card)', 'ACTIVE')
    RETURNING *
  `, [hash]);

  const acc2Res = await pool.query(`
    INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, status)
    VALUES ('ACC-100002', 'Bob Customer', 'bob@example.com', '221B Baker St, London', '0902222222', $1, '•••• •••• •••• 5555 (Mastercard Test Card)', 'ACTIVE')
    RETURNING *
  `, [hash]);

  return {
    pool,
    alice: acc1Res.rows[0],
    bob: acc2Res.rows[0],
    password: 'Password123!',
  };
};

test('Sprint Feature: Email/Password Sign-In, Sign-Out, Session & Endpoint Protection', async (t) => {
  const { pool, alice, bob, password } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const authController = require('../src/controllers/authController');
  const bookingController = require('../src/controllers/bookingController');
  const { requireAuth, authorizeCustomerAccess } = require('../src/middleware/authMiddleware');

  let aliceToken = null;
  let bobToken = null;

  await t.test('1. Sign-in with valid email and password issues session token', async () => {
    let responseData = null;
    let statusCode = 200;

    const req = {
      body: { email: 'alice@example.com', password },
      ip: '127.0.0.1',
      headers: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await authController.login(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.ok(responseData.sessionToken);
    assert.equal(responseData.user.id, alice.id);
    assert.equal(responseData.user.name, 'Alice Customer');

    aliceToken = responseData.sessionToken;
  });

  await t.test('2. Sign-in with invalid password is rejected (401)', async () => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      body: { email: 'alice@example.com', password: 'WrongPassword!' },
      ip: '127.0.0.1',
      headers: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await authController.login(req, res);

    assert.equal(statusCode, 401);
    assert.equal(responseData.success, false);
    assert.match(responseData.message, /invalid email or password/i);
  });

  await t.test('3. Sign-in with non-existent email is rejected (401)', async () => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      body: { email: 'nonexistent@example.com', password },
      ip: '127.0.0.1',
      headers: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await authController.login(req, res);

    assert.equal(statusCode, 401);
    assert.equal(responseData.success, false);
  });

  await t.test('3b. Sign-in with invalid email format is rejected (400 Invalid format)', async () => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      body: { email: 'longlong', password },
      ip: '127.0.0.1',
      headers: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await authController.login(req, res);

    assert.equal(statusCode, 400);
    assert.equal(responseData.success, false);
    assert.equal(responseData.code, 'INVALID_EMAIL_FORMAT');
    assert.match(responseData.message, /invalid email format/i);
  });

  await t.test('4. Session verification (GET /session) succeeds with valid token', async () => {
    let statusCode = 200;
    let responseData = null;
    let nextCalled = false;

    const req = {
      headers: { authorization: `Bearer ${aliceToken}` },
      query: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.ok(req.user);
    assert.equal(req.user.id, alice.id);
    assert.equal(req.user.email, alice.email);
  });

  await t.test('5. PROTECT ENDPOINT: Unauthenticated visitor CANNOT submit online bookings (401)', async () => {
    let statusCode = 200;
    let responseData = null;
    let nextCalled = false;

    // Visitor gửi request không có token
    const req = {
      headers: {},
      query: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
    assert.equal(responseData.code, 'AUTH_REQUIRED');
    assert.match(responseData.message, /visitors cannot perform this operation/i);
  });

  await t.test('6. Authenticated customer CAN submit online booking (201)', async () => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      user: {
        id: alice.id,
        accountCode: alice.account_code,
        name: alice.name,
        telephone: alice.telephone,
        mockCardRef: alice.mock_card_ref,
      },
      body: {
        pickupAddress: 'Heathrow Airport Terminal 5',
        dropoffAddress: '10 Downing Street, London',
        carType: 'Executive Mercedes S-Class',
        fareAmount: 75.50,
      },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await bookingController.createBooking(req, res);

    assert.equal(statusCode, 201);
    assert.equal(responseData.success, true);
    assert.ok(responseData.booking.bookingCode.startsWith('BK-'));
    assert.equal(responseData.booking.accountId, alice.id);
    assert.equal(responseData.booking.pickupAddress, 'Heathrow Airport Terminal 5');
  });

  await t.test('6b. VALIDATION: Reject booking when passengers exceed vehicle capacity class (400)', async () => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      user: {
        id: alice.id,
        accountCode: alice.account_code,
        name: alice.name,
        telephone: alice.telephone,
        mockCardRef: alice.mock_card_ref,
      },
      body: {
        pickupAddress: 'Heathrow Airport Terminal 5',
        dropoffAddress: '10 Downing Street, London',
        passengerCount: 6,
        vehicleCapacity: 4,
      },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await bookingController.createBooking(req, res);

    assert.equal(statusCode, 400);
    assert.equal(responseData.success, false);
    assert.equal(responseData.code, 'PASSENGERS_EXCEED_CAPACITY');
  });

  await t.test('7. DATA ISOLATION: Customer can access their own protected profile (200)', async () => {
    let statusCode = 200;
    let responseData = null;
    let nextCalled = false;

    // Alice truy cập profile của chính Alice
    const req = {
      user: { id: alice.id, accountCode: alice.account_code },
      params: { id: alice.id.toString() },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    const middleware = authorizeCustomerAccess('id');
    middleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
  });

  await t.test('8. DATA ISOLATION: Customer CANNOT access another customer\'s protected information (403 Forbidden)', async () => {
    let statusCode = 200;
    let responseData = null;
    let nextCalled = false;

    // Alice cố tình truy cập profile của Bob (id = bob.id)
    const req = {
      user: { id: alice.id, accountCode: alice.account_code },
      params: { id: bob.id.toString() },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    const middleware = authorizeCustomerAccess('id');
    middleware(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.equal(responseData.code, 'FORBIDDEN_ACCESS');
    assert.match(responseData.message, /customers can access only their own protected information/i);
  });

  await t.test('9. DATA ISOLATION: Customer retrieves ONLY their own bookings', async () => {
    let statusCode = 200;
    let responseData = null;

    // Alice lấy danh sách bookings
    const req = {
      user: { id: alice.id },
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await bookingController.getMyBookings(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.count, 1);
    assert.equal(responseData.bookings[0].account_id, alice.id);

    // Bob lấy danh sách bookings (chưa có cuốc nào)
    const bobReq = { user: { id: bob.id } };
    let bobResponse = null;
    const bobRes = {
      status(code) { return this; },
      json(data) { bobResponse = data; return this; },
    };
    await bookingController.getMyBookings(bobReq, bobRes);
    assert.equal(bobResponse.count, 0); // Bob không nhìn thấy cuốc của Alice!
  });

  await t.test('10. Sign-out invalidates session token', async () => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      headers: { authorization: `Bearer ${aliceToken}` },
      body: {},
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { responseData = data; return this; },
    };

    await authController.logout(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseData.success, true);
    assert.match(responseData.message, /signed out successfully/i);

    // Kiểm tra token sau khi logout không còn hợp lệ nữa
    let checkStatus = 200;
    let checkData = null;
    let nextCheckCalled = false;

    const checkReq = {
      headers: { authorization: `Bearer ${aliceToken}` },
      query: {},
    };
    const checkRes = {
      status(code) { checkStatus = code; return this; },
      json(data) { checkData = data; return this; },
    };

    await requireAuth(checkReq, checkRes, () => { nextCheckCalled = true; });

    assert.equal(nextCheckCalled, false);
    assert.equal(checkStatus, 401);
  });
});
