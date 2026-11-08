const test = require('node:test');
const assert = require('node:assert/strict');
const StaffController = require('../src/controllers/staffController');
const AccountModel = require('../src/models/accountModel');
const SpecialOfferModel = require('../src/models/specialOfferModel');

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

test('Sprint Feature: Phone Booking Desk Step 2 & Staff Account/Role Management', async (t) => {
  let testCustomer = null;

  await t.test('Setup: ensure test customer account exists', async () => {
    testCustomer = await AccountModel.findByEmail('david.test.staff@example.com');
    if (!testCustomer) {
      const code = 'CUST-TST-' + Math.floor(1000 + Math.random() * 9000);
      testCustomer = await AccountModel.create({
        accountCode: code,
        name: 'David Test',
        email: 'david.test.staff@example.com',
        address: '123 Test St, London',
        telephone: '+447000000001',
        passwordHash: 'dummyhash',
        mockCardRef: 'MOCK-CARD-1234',
      });
    }
    assert.ok(testCustomer);
  });

  await t.test('1. Staff Phone Booking with 7-Seat MPV, passenger count, and payment method', async () => {
    const req = {
      body: {
        customerId: testCustomer.id,
        pickupAddress: 'Paddington Station, London',
        dropoffAddress: 'Gatwick Airport',
        service: 'Airport transfer',
        vehicleCapacity: 7,
        passengerCount: 6,
        paymentMethod: 'INVOICE',
        notes: 'VIP Delegation',
      },
    };
    const res = createMockRes();

    await StaffController.createStaffBooking(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.booking.vehicle_capacity, 7);
    assert.equal(parseFloat(res.body.booking.base_fare), 65.00); // 7-passenger Airport transfer is £65.00
    assert.equal(parseFloat(res.body.booking.discount_amount), 0.00); // No 15% online discount
    assert.equal(res.body.booking.payment_method, 'INVOICE');
    assert.equal(res.body.booking.card_ref_used, 'Corporate Invoice Net-30');
    assert.equal(parseFloat(res.body.booking.final_fare), 65.00);
  });

  await t.test('2. Staff Phone Booking with Voucher Code applies discount to Table 8 fare', async () => {
    const voucherCode = 'TST-STAFF-VOUCHER-' + Math.floor(1000 + Math.random() * 9000);
    await SpecialOfferModel.createOffer({
      code: voucherCode,
      accountId: testCustomer.id,
      discountAmount: 15.00,
    });

    const req = {
      body: {
        customerId: testCustomer.id,
        pickupAddress: 'Vauxhall, London',
        dropoffAddress: 'Heathrow Airport Terminal 5',
        service: 'Airport transfer',
        vehicleCapacity: 4,
        passengerCount: 2,
        paymentMethod: 'MOCK_CARD',
        promoCode: voucherCode,
      },
    };
    const res = createMockRes();

    await StaffController.createStaffBooking(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(parseFloat(res.body.booking.base_fare), 45.00);
    assert.equal(parseFloat(res.body.booking.promo_discount), 15.00);
    assert.equal(parseFloat(res.body.booking.final_fare), 30.00); // £45 - £15 = £30
    assert.equal(res.body.booking.payment_method, 'MOCK_CARD');
    assert.equal(res.body.booking.payment_status, 'PAID');
  });

  await t.test('3. Verify Promo Code endpoint validates active voucher', async () => {
    const validReq = {
      body: { code: 'SAVE10', customerId: testCustomer.id },
    };
    const validRes = createMockRes();
    await StaffController.verifyPromoCode(validReq, validRes);
    assert.equal(validRes.statusCode, 200);
    assert.equal(validRes.body.valid, true);
    assert.equal(validRes.body.discountAmount, 10.00);

    const invalidReq = {
      body: { code: 'NONEXISTENT_CODE_XYZ', customerId: testCustomer.id },
    };
    const invalidRes = createMockRes();
    await StaffController.verifyPromoCode(invalidReq, invalidRes);
    assert.equal(invalidRes.statusCode, 400);
    assert.equal(invalidRes.body.valid, false);
  });

  await t.test('4. Staff getAllAccounts returns all database fields including role and updated_at', async () => {
    const req = { user: { role: 'STAFF', email: 'staff@privatehirecars.com' } };
    const res = createMockRes();
    await StaffController.getAllAccounts(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.accounts));
    assert.ok(res.body.accounts.length > 0);

    const sample = res.body.accounts[0];
    assert.ok('id' in sample);
    assert.ok('account_code' in sample);
    assert.ok('name' in sample);
    assert.ok('email' in sample);
    assert.ok('telephone' in sample);
    assert.ok('address' in sample);
    assert.ok('mock_card_ref' in sample);
    assert.ok('status' in sample);
    assert.ok('role' in sample);
    assert.ok('created_at' in sample);
  });

  await t.test('5. updateAccountRole rejects non-admin users with 403', async () => {
    const nonAdminReq = {
      user: { role: 'STAFF', email: 'regularstaff@privatehirecars.com' },
      params: { id: testCustomer.id },
      body: { role: 'ADMIN' },
    };
    const nonAdminRes = createMockRes();
    await StaffController.updateAccountRole(nonAdminReq, nonAdminRes);
    assert.equal(nonAdminRes.statusCode, 403);
    assert.equal(nonAdminRes.body.code, 'FORBIDDEN_ADMIN_ONLY');
  });

  await t.test('6. updateAccountRole allows ADMIN user to modify role', async () => {
    const adminReq = {
      user: { role: 'ADMIN', email: 'longhvn2006@gmail.com' },
      params: { id: testCustomer.id },
      body: { role: 'STAFF' },
    };
    const adminRes = createMockRes();
    await StaffController.updateAccountRole(adminReq, adminRes);
    assert.equal(adminRes.statusCode, 200);
    assert.equal(adminRes.body.account.role, 'STAFF');

    // Restore to CUSTOMER
    const restoreReq = {
      user: { role: 'ADMIN', email: 'nguyennhanduc20345@gmail.com' },
      params: { id: testCustomer.id },
      body: { role: 'CUSTOMER' },
    };
    const restoreRes = createMockRes();
    await StaffController.updateAccountRole(restoreReq, restoreRes);
    assert.equal(restoreRes.statusCode, 200);
    assert.equal(restoreRes.body.account.role, 'CUSTOMER');
  });
});
