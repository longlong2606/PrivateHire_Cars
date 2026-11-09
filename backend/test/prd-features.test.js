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

test('PRD Compliance Test Suite: 9 Core Business Rules & Epics', async (t) => {
  const { pool } = await setupTestDb();
  const db = require('../src/config/db');
  db.query = (sql, params) => pool.query(sql, params);

  const BookingModel = require('../src/models/bookingModel');
  const AccountModel = require('../src/models/accountModel');
  const bookingController = require('../src/controllers/bookingController');
  const StaffController = require('../src/controllers/staffController');
  const CustomerFeatureController = require('../src/controllers/customerFeatureController');

  // Seed Customer and Staff accounts
  const customer = await AccountModel.create({
    accountCode: 'ACC-CUST-101',
    name: 'James Bond',
    telephone: '+44 7700 900007',
    email: '007@mi6.gov.uk',
    address: 'Vauxhall Cross, London',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    mockCardRef: '•••• •••• •••• 4242 (Visa Test Card)',
  });

  const staff = await AccountModel.create({
    accountCode: 'STAFF-101',
    name: 'Moneypenny Dispatcher',
    telephone: '+44 20 7946 0000',
    email: 'moneypenny@privatehirecars.com',
    address: 'London Control Centre',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890',
    mockCardRef: '•••• •••• •••• 4242 (Visa Test Card)',
  });
  await pool.query("UPDATE accounts SET role = 'STAFF' WHERE id = $1", [staff.id]);
  staff.role = 'STAFF';

  let createdBooking = null;

  await t.test('1. P02: Online booking receives 15% automatic discount; Staff assisted does not', async () => {
    // 1. Online booking for Airport transfer (4 pax: £45 base -> £38.25 final)
    const req = {
      user: customer,
      body: {
        pickupAddress: 'Vauxhall Cross, London',
        dropoffAddress: 'Heathrow Airport Terminal 2',
        service: 'Airport transfer',
        vehicleCapacity: 4,
        pickupTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h in future
      },
    };
    const res = createMockRes();

    await bookingController.createBooking(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.booking.baseFare, 45.00);
    assert.equal(res.body.booking.onlineDiscount, 6.75, '15% of £45.00 is £6.75');
    assert.equal(res.body.booking.finalFare, 38.25, '£45.00 - £6.75 = £38.25');
    createdBooking = res.body.booking;

    // 2. Staff assisted booking for same service (NO 15% discount)
    const staffReq = {
      user: staff,
      body: {
        customerId: customer.id,
        pickupAddress: 'Vauxhall Cross, London',
        dropoffAddress: 'Heathrow Airport Terminal 2',
        service: 'Airport transfer',
        vehicleCapacity: 4,
        paymentMethod: 'CASH',
      },
    };
    const staffRes = createMockRes();

    await StaffController.createStaffBooking(staffReq, staffRes);
    assert.equal(staffRes.statusCode, 201);
    assert.equal(staffRes.body.booking.discount_amount, 0.00, 'Staff phone bookings must have 0% discount');
    assert.equal(staffRes.body.booking.final_fare, 45.00, 'Full Table 8 base fare charged');
  });

  await t.test('2. P03: Simulated Payment handles Success vs Fail paths (Visa check failure)', async () => {
    // Fail path: Card declined / Visa check failure
    const failReq = {
      user: customer,
      params: { id: createdBooking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'FAIL' },
    };
    const failRes = createMockRes();

    await bookingController.simulatePayment(failReq, failRes);
    assert.equal(failRes.statusCode, 400);
    assert.equal(failRes.body.code, 'PAYMENT_DECLINED');

    // Success path: Card approved
    const okReq = {
      user: customer,
      params: { id: createdBooking.id },
      body: { paymentMethod: 'CARD', simulationResult: 'SUCCESS' },
    };
    const okRes = createMockRes();

    await bookingController.simulatePayment(okReq, okRes);
    assert.equal(okRes.statusCode, 200);
    assert.equal(okRes.body.booking.payment_status, 'PAID');
    assert.equal(okRes.body.booking.status, 'CONFIRMED');
  });

  await t.test('3. P05: Amendments & Cancellations enforce >= 24 hours eligibility rule', async () => {
    // Attempt to amend with < 24h notice (fail)
    const urgentBooking = await BookingModel.create({
      bookingCode: 'BK-URGENT-999',
      accountId: customer.id,
      pickupAddress: 'Mayfair',
      dropoffAddress: 'Gatwick',
      pickupTime: new Date(Date.now() + 5 * 60 * 60 * 1000), // 5 hours in future (< 24h)
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      fareAmount: 45.00,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    });

    const amendReq = {
      user: customer,
      params: { id: urgentBooking.id },
      body: { dropoffAddress: 'Stansted Airport' },
    };
    const amendRes = createMockRes();

    await bookingController.amendBooking(amendReq, amendRes);
    assert.equal(amendRes.statusCode, 400, 'Must reject amendment when < 24 hours notice');

    // Attempt cancellation with >= 24h notice on createdBooking (48h) (success)
    const cancelReq = {
      user: customer,
      params: { id: createdBooking.id },
      body: { reason: 'Flight rescheduled' },
    };
    const cancelRes = createMockRes();

    await bookingController.cancelBooking(cancelReq, cancelRes);
    assert.equal(cancelRes.statusCode, 200);
    assert.equal(cancelRes.body.booking.status, 'CANCELLED');
    assert.equal(cancelRes.body.refundCreated, true, 'Creates pending refund request for paid booking');
  });

  await t.test('4. P06 & P04: Staff dispatches journey (Assigned -> EnRoute -> Approaching Alert -> Completed)', async () => {
    const journey = await BookingModel.create({
      bookingCode: 'BK-DISPATCH-777',
      accountId: customer.id,
      pickupAddress: 'Piccadilly Circus, London',
      dropoffAddress: 'The O2 Arena, Greenwich',
      pickupTime: new Date(Date.now() + 30 * 60 * 1000),
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      fareAmount: 30.00,
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      paymentMethod: 'CASH',
    });

    // 1. Move to ASSIGNED (requires active driver)
    const assignRes = createMockRes();
    await StaffController.updateJourneyStatus(
      { params: { id: journey.id }, body: { status: 'ASSIGNED', driverId: 1, vehicleId: 1 } },
      assignRes
    );
    assert.equal(assignRes.statusCode, 200);
    assert.equal(assignRes.body.booking.status, 'ASSIGNED');

    // 2. Move to ENROUTE
    const enRouteRes = createMockRes();
    await StaffController.updateJourneyStatus(
      { params: { id: journey.id }, body: { status: 'ENROUTE' } },
      enRouteRes
    );
    assert.equal(enRouteRes.statusCode, 200);

    // 3. P04: Staff manually triggers Approaching Vehicle Alert
    const alertRes = createMockRes();
    await StaffController.sendApproachingAlert(
      { params: { id: journey.id } },
      alertRes
    );
    assert.equal(alertRes.statusCode, 200);
    assert.equal(alertRes.body.notification.type, 'APPROACHING_VEHICLE');

    // 3b. Verify Duplicate Approaching Alert is rejected
    const dupRes = createMockRes();
    await StaffController.sendApproachingAlert(
      { params: { id: journey.id } },
      dupRes
    );
    assert.equal(dupRes.statusCode, 400, 'Duplicate approaching alerts must be blocked (P04)');

    // 4. Move to COMPLETED
    const compRes = createMockRes();
    await StaffController.updateJourneyStatus(
      { params: { id: journey.id }, body: { status: 'COMPLETED' } },
      compRes
    );
    assert.equal(compRes.statusCode, 200);

    // 5. P03 Staff confirms cash received on completed cash booking
    const cashRes = createMockRes();
    await StaffController.collectCash(
      { params: { id: journey.id } },
      cashRes
    );
    assert.equal(cashRes.statusCode, 200);
    assert.equal(cashRes.body.booking.payment_status, 'PAID');
  });

  await t.test('5. P07: Reviews only permitted for Completed journeys', async () => {
    // Attempt review on cancelled booking (fail)
    const failRes = createMockRes();
    await CustomerFeatureController.submitReview(
      { user: customer, body: { bookingId: createdBooking.id, journeyRating: 5, vehicleRating: 5, driverRating: 5, reviewText: 'Great' } },
      failRes
    );
    assert.equal(failRes.statusCode, 400);

    // Review on completed journey (success)
    const completedBooking = await BookingModel.create({
      bookingCode: 'BK-REVIEW-TEST',
      accountId: customer.id,
      pickupAddress: 'Savoy',
      dropoffAddress: 'Heathrow',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      fareAmount: 45.00,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
    });

    const okRes = createMockRes();
    await CustomerFeatureController.submitReview(
      { user: customer, body: { bookingId: completedBooking.id, journeyRating: 5, vehicleRating: 5, driverRating: 4, reviewText: 'Excellent service' } },
      okRes
    );
    assert.equal(okRes.statusCode, 201);
    assert.equal(okRes.body.review.journey_rating, 5);

    // Test specific rating combination 3-star journey, 3-star vehicle, 2-star chauffeur
    const completedBooking332 = await BookingModel.create({
      bookingCode: 'BK-REV-332',
      accountId: customer.id,
      pickupAddress: 'Mayfair',
      dropoffAddress: 'Gatwick',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      fareAmount: 65.00,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
    });

    const res332 = createMockRes();
    await CustomerFeatureController.submitReview(
      { user: customer, body: { bookingCode: 'BK-REV-332', journeyRating: 3, vehicleRating: 3, driverRating: 2, reviewText: 'Driver was a bit late but vehicle was decent.' } },
      res332
    );
    assert.equal(res332.statusCode, 201);
    assert.equal(res332.body.review.journey_rating, 3);
    assert.equal(res332.body.review.vehicle_rating, 3);
    assert.equal(res332.body.review.driver_rating, 2);
  });

  await t.test('6. P08: Vehicle Popularity and Customer Loyalty Metrics', async () => {
    const repRes = createMockRes();
    await StaffController.getPopularityAndLoyaltyReports({}, repRes);

    assert.equal(repRes.statusCode, 200);
    assert.ok(Array.isArray(repRes.body.vehiclePopularity));
    assert.ok(Array.isArray(repRes.body.customerLoyalty));
  });

  await t.test('7. P09: Customer with >= 3 completed trips is awarded a Special Loyalty Promo', async () => {
    // Seed 2 completed trips first
    await BookingModel.create({
      bookingCode: 'BK-COMPL-1',
      accountId: customer.id,
      pickupAddress: 'A',
      dropoffAddress: 'B',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      status: 'COMPLETED',
    });
    await BookingModel.create({
      bookingCode: 'BK-COMPL-2',
      accountId: customer.id,
      pickupAddress: 'C',
      dropoffAddress: 'D',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      status: 'COMPLETED',
    });

    // Complete the 3rd trip via Staff updateJourneyStatus
    const trip3 = await BookingModel.create({
      bookingCode: 'BK-TRIP-3',
      accountId: customer.id,
      pickupAddress: 'London Bridge',
      dropoffAddress: 'Paddington',
      passengerName: customer.name,
      passengerPhone: customer.telephone,
      status: 'CONFIRMED',
    });

    const updateRes = createMockRes();
    await StaffController.updateJourneyStatus(
      { params: { id: trip3.id }, body: { status: 'COMPLETED' } },
      updateRes
    );
    assert.equal(updateRes.statusCode, 200);

    const SpecialOfferModel = require('../src/models/specialOfferModel');
    const offers = await SpecialOfferModel.getOffersForAccount(customer.id);
    assert.ok(offers.length >= 1, 'Loyalty promo voucher must be awarded upon 3rd completed booking');
    assert.equal(parseFloat(offers[0].discount_amount), 10.00, 'Award is £10 off');
  });

  await t.test('8. SCRUM-8: Customer maintains profile with valid details, duplicate email blocked', async () => {
    const { updateCustomerProfile } = require('../src/controllers/authController');

    // 8a. Update profile successfully
    const updateRes = createMockRes();
    await updateCustomerProfile(
      {
        params: { id: customer.id },
        body: {
          name: 'James Bond 007',
          email: 'bond.james@mi6.gov.uk',
          telephone: '+44 7700 900007',
          address: 'MI6 Headquarters, Vauxhall Cross, London',
          mockCardRef: 'MOCK_AMEX_3782',
        },
      },
      updateRes
    );
    assert.equal(updateRes.statusCode, 200);
    assert.equal(updateRes.body.customer.name, 'James Bond 007');
    assert.equal(updateRes.body.customer.email, 'bond.james@mi6.gov.uk');

    // 8b. Block duplicate email used by another account
    const dupRes = createMockRes();
    await updateCustomerProfile(
      {
        params: { id: customer.id },
        body: {
          name: 'James Bond',
          email: 'staff@privatehirecars.com',
          telephone: '+44 7700 900007',
        },
      },
      dupRes
    );
    assert.equal(dupRes.statusCode, 400);
    assert.match(dupRes.body.message, /already in use/i);
  });

  await t.test('9. SCRUM-9: Submit General vs Trip-specific customer enquiries', async () => {
    // 9a. General enquiry (by guest or customer)
    const genRes = createMockRes();
    await CustomerFeatureController.submitEnquiry(
      {
        body: {
          enquiryType: 'GENERAL',
          name: 'Anonymous Visitor',
          email: 'visitor@example.com',
          subject: 'Corporate Rates',
          message: 'Do you offer monthly corporate invoicing?',
        },
      },
      genRes
    );
    assert.equal(genRes.statusCode, 201);
    assert.ok(genRes.body.referenceNumber.startsWith('ENQ-'));

    // 9b. Trip-specific enquiry without login blocked (401)
    const tripFailRes = createMockRes();
    await CustomerFeatureController.submitEnquiry(
      {
        body: {
          enquiryType: 'TRIP_SPECIFIC',
          name: 'Visitor',
          email: 'visitor@example.com',
          message: 'Where is my car?',
        },
      },
      tripFailRes
    );
    assert.equal(tripFailRes.statusCode, 401);

    // 9c. Trip-specific enquiry by signed-in customer with valid booking (201)
    const tripOkRes = createMockRes();
    await CustomerFeatureController.submitEnquiry(
      {
        user: customer,
        body: {
          enquiryType: 'TRIP_SPECIFIC',
          bookingId: createdBooking.id,
          name: 'James Bond',
          email: 'bond.james@mi6.gov.uk',
          message: 'Please ensure driver has bottled still water in vehicle.',
        },
      },
      tripOkRes
    );
    assert.equal(tripOkRes.statusCode, 201);
    assert.ok(tripOkRes.body.referenceNumber.startsWith('ENQ-'));
  });

  await t.test('10. SCRUM-12 & SCRUM-22: Vehicle & Driver Availability Search', async () => {
    const { checkVehicleAvailability } = require('../src/controllers/bookingController');

    // 10a. Customer checks vehicle availability
    const availRes = createMockRes();
    await checkVehicleAvailability(
      {
        query: {
          pickupTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          service: 'Airport transfer',
          vehicleCapacity: '4',
        },
      },
      availRes
    );
    assert.equal(availRes.statusCode, 200);
    assert.ok(availRes.body.count >= 1);

    // 10b. Staff checks availability and quote (SCRUM-22)
    const staffAvailRes = createMockRes();
    await StaffController.checkAvailability(
      {
        query: {
          pickupTime: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          service: 'Airport transfer',
          passengerCount: '3',
          channel: 'TELEPHONE',
        },
      },
      staffAvailRes
    );
    assert.equal(staffAvailRes.statusCode, 200);
    assert.equal(staffAvailRes.body.quote.baseFare, 45.00);
    assert.equal(staffAvailRes.body.quote.automaticOnlineDiscount, 0.00, 'Telephone has no online discount');
    assert.ok(staffAvailRes.body.availableVehicles.length >= 1);
  });
});
