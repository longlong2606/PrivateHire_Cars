# Product Requirements Document (PRD): PrivateHire Cars Web Application

## 1. Project Overview
A web application prototype for PrivateHire Cars (London-based) to support online customer self-service and staff-assisted bookings. The system aims to reduce Call Centre workload, manage bookings, calculate fares, handle simulated payments, and support staff workflows.

---

## 2. Prototype Assumptions & Business Rules (9 Core Rules)

**P01 — Accounts and Access**
*   **Registration:** Requires name, email, address, telephone, password, and a mock card reference. Emails must be unique. Real confirmation email is sent upon success.
*   **Mock Cards:** Stored and displayed masked. No real card details are entered.
*   **Access:** Customers log in via email/password. Can only access their own data. Staff functions require an authorized staff account.

**P02 — Demonstration Fares and Availability**
*   **Sample Pricing:** Fixed prices based on Service Type and Vehicle Capacity (4 or 7 passengers). Not calculated by distance.
    *   *Local:* 4-pax (£20) / 7-pax (£30) / 60 mins
    *   *Long-distance:* £80 / £120 / 180 mins
    *   *Airport transfer:* £45 / £65 / 90 mins
    *   *Hotel transfer:* £30 / £45 / 60 mins
    *   *Airport meet-and-greet:* £55 / £80 / 120 mins
    *   *Driver & car daily hire:* £200 / £280 / 480 mins
*   **Availability:** Vehicle is unavailable if it has an overlapping `Confirmed`, `Assigned`, or `EnRoute` booking. `Pending` does not reserve a vehicle.
*   **Discounts:** Online bookings get an automatic 15% discount. Telephone/In-person do not. Special offers deduct a fixed amount *after* the 15% discount. Total cannot be negative.

**P03 — Booking and Payment Lifecycle**
*   **Statuses:** 
    *   Booking Statuses: `Pending`, `Confirmed`, `Assigned`, `EnRoute`, `Completed`, `Cancelled`.
    *   Payment Statuses: `Unpaid`, `Paid`, `Refunded`.
*   **Creation:** Starts as `Pending` + `Unpaid`. No vehicle reserved.
*   **Payment (Card/PayPal):** Simulated. Success -> `Confirmed` + `Paid`, vehicle reserved, offer used.
*   **Payment (Cash):** Customer/Staff selects Cash. Success -> `Confirmed` + `Unpaid`, vehicle reserved, offer used.
*   **Journey:** Staff moves state: `Assigned` (needs active driver) -> `EnRoute` -> `Completed`.
*   **Cash Collection:** Staff records cash for `Completed` + `Cash` + `Unpaid` booking -> Status becomes `Paid`. Receipt generated.

**P04 — Notifications**
*   **Booking Confirmation:** Automatic real email sent when booking becomes `Confirmed` (including unpaid cash bookings).
*   **Approaching Vehicle:** Staff manually triggers this when booking is `EnRoute`. Creates a persistent web notification in the customer's account (no real-time GPS needed). Cannot duplicate.

**P05 — Amendments, Cancellations, and Adjustments**
*   **Eligibility:** Must be >= 24 hours before pickup time. `Pending`, `Confirmed`, or `Assigned` only.
*   **Amendments:** Can change journey details, service, vehicle. Recalculates fare. Higher fare requires additional simulated payment. Lower fare creates a Pending refund request.
*   **Cancellations:** Sets status to `Cancelled`, frees vehicle/driver. Creates Pending refund request for net paid amount. Staff process refunds manually in the app.

**P06 — Staff Verification and Resource Records**
*   **Callers:** Staff find account by email/phone. Must verify name/phone before assisting. Can create accounts for new callers.
*   **Fleet:** Vehicles have Registration, Make, Colour, Capacity (4/7), Status (Active/Unavailable).
*   **Drivers:** Have Name, Phone, Reference, Status (Active/Unavailable).

**P07 — Reviews and Ratings**
*   Only owners of a `Completed` booking can review. Paid status not required.
*   Requires text and 1-5 ratings for journey, vehicle, and driver. 1 review per booking.

**P08 — Popularity and Loyalty Metrics**
*   **Vehicle Popularity:** Count of `Completed` bookings per vehicle.
*   **Customer Loyalty:** Count of `Completed` bookings per customer.
*   Results ordered descending.

**P09 — Special Offers**
*   Customers with >= 3 `Completed` bookings get a recommendation (e.g., £5 or £10 off) generated once.
*   Code applied at checkout. Validated for ownership and unused status. Marked "used" only on successful confirmation.

---

## 3. Functional Requirements (Summarized from User Stories & ACs)

### Epic 1: Customer Accounts and Support
*   **Registration & Auth:**
    *   Form: Name, Email, Phone, Address, Password, Confirm Password, Mock Card Dropdown.
    *   Validations: Required fields, valid email format, email uniqueness, password match.
    *   Actions: Hash password, store in DB, send real welcome email.
    *   Login: Authenticate via Email/Password. Issue session. Sign out terminates session. Protect routes (only view own data).
*   **Profile Management:** View/Update contact details and mock card. Updated email becomes new login.
*   **Enquiries:**
    *   General: Guest or logged in. Requires message and reply email.
    *   Trip-specific: Logged in only. Must select one of their own bookings.
*   **Staff Functions:**
    *   Search customer by email/phone. Verify details. Create new accounts for callers.
    *   View enquiries and reply. Reply sends real email to customer.

### Epic 2: Booking and Journey Management
*   **Create Booking (Customer - Online):**
    *   Must be logged in. Select service type -> alters base fare and duration.
    *   Input: Pickup, Destination, Date/Time (Future), Pax count, Vehicle.
    *   System checks capacity and overlap availability. Saves as `Pending` / `Unpaid`.
*   **Create Booking (Staff - Assisted):**
    *   Staff select customer, enter journey. Fare has NO 15% online discount.
*   **Fare Calculation:** Base fare (Table 8) - (15% if Online) - (Promo Code) = Total. Display in GBP (2 decimals).
*   **Amend Booking:** Customer edits future booking (>= 24h notice). System re-checks availability. Recalculates fare. Prompts for extra payment if higher.
*   **Cancel Booking:** Customer cancels (>= 24h notice). Frees resources.

### Epic 3: Payments and Receipts
*   **Simulate Electronic Payment:** Provide mock UI for Visa, Mastercard, Amex, PayPal. Include "Success" and "Fail" (VISA Check fail) paths. Re-check availability before confirming.
*   **Cash Confirmation:** Customer selects "Cash". Booking becomes `Confirmed`/`Unpaid`.
*   **Staff Cash Collection:** For `Completed` cash bookings, staff click "Confirm cash received" -> updates to `Paid`.
*   **Receipts:** Printable view available only *after* payment is successful (Electronic Success or Staff Cash Collection). Shows breakdown, discounts, amount paid.
*   **Refunds (Staff):** Staff view a queue of Pending refunds (from cancellations/amendments). Click "Process" -> logs staff ID, time, updates status to `Refunded` (or keeps `Paid` if partial).

### Epic 4: Staff and Fleet Operations
*   **Availability View:** Staff search by date/time/service/pax to see available vehicles and drivers with quotes (no 15% discount).
*   **Manage Fleet:** Add/Edit Vehicles (Reg, Make, Colour, Cap: 4/7, Status). Cannot lower capacity below active reservations.
*   **Manage Drivers:** Add/Edit Drivers (Name, Phone, Ref, Status).
*   **Journey Simulation:** Staff manually assign Driver to `Confirmed` booking -> becomes `Assigned`. Then click to move to `EnRoute` -> `Completed`.

### Epic 5: Customer Insights and Special Offers
*   **Reviews:** Customer submits form (1-5 stars for Journey, Vehicle, Driver + Text) on `Completed` bookings.
*   **Reports (Staff):** View top vehicles and top loyal customers based on `Completed` bookings count.
*   **Offers:** 
    *   Auto-generate code when customer hits 3 completed bookings. Send email.
    *   Checkout UI allows code input. Validate ownership, usage limit (1 time), calculate deduction.

---

## 4. Technical Integration Notes for AI
1.  **Frontend:** Build responsive UI (Desktop/Mobile). Implement form validations (red borders, inline errors).
2.  **Backend:** Create RESTful APIs or Server Actions to handle business logic, fare calculation (strictly using Table 8), and state transitions.
3.  **Database:** Store Accounts, Bookings, Vehicles, Drivers, Enquiries, Reviews, Notifications, Refunds, and Offers.
4.  **Simulations:** 
    *   Payment gateway is a mock UI component returning Success/Fail.
    *   Emails should be sent using a real SMTP configuration (e.g., Nodemailer).
5.  **Role-Based Access Control (RBAC):** Distinct views/routes for `Customer` vs `Staff`. Customer can NEVER access staff screens. Customer can ONLY see their own `customer_id` records.