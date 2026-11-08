# PrivateHire Cars Booking Platform — Full Build Specification

> Instruction to the AI: Build a **locally hosted web application prototype** exactly as specified below. Follow every rule, status, validation, and acceptance criterion (AC). Do not invent extra features. If something is not specified, choose the simplest option and list it as an assumption at the end of your answer.

---

## 1. Project Overview

- **Company:** PrivateHire Cars, a London-based private hire (minicab) company with 150+ vehicles and 15+ Call Centre staff.
- **Problem:** Telephone-only booking is slow and overloads Call Centre staff.
- **Goal:** A prototype with **customer interface + staff interface + backend + database** supporting customer self-service booking and staff-assisted booking (telephone / in-person).
- **Runs locally** and stores data in a database.
- **Out of scope (Won't Have):** deployment, live GPS tracking, real payment processing / external payment integration, separate mobile app.
- **Real vs simulated:**
  - **Real email delivery:** registration confirmation, booking confirmation, enquiry replies, offer recommendation.
  - **Simulated (test) transactions:** card payments, PayPal, VISA Check, cash collection records, refunds. No real money moves.
  - **Web notification** (not SMS/email) for approaching vehicle.
- Currency: **GBP, 2 decimal places**. Backend calculates all fares.

### User roles
1. **Guest** (not signed in): can only submit a *general* enquiry, register, sign in.
2. **Customer** (registered): books and manages own bookings.
3. **Authorised staff** (Call Centre): customer lookup, assisted bookings, availability, enquiries, fleet/driver management, refunds, cash collection, journey simulation, notifications, insights.

### Recommended screens/pages
Register, Sign in, Profile, Enquiry form, Service selection + booking form, Vehicle availability + booking review (fare breakdown + offer code), Payment screen (test), Booking list, Booking details (+ payment/refund info, receipt, amend, cancel, review), Printable receipt, Notifications, Offers, Staff dashboard, Caller verification / customer lookup, Staff availability search, Staff assisted booking, Staff enquiry reply, Vehicle management, Driver management + assignment + journey simulation controls, Refund queue, Cash collection, Popular vehicles & loyal customers.

---

## 2. Source Requirements (R1–R14)

| ID | Requirement |
|---|---|
| R1 | Customer registration with name, email, address, telephone, card details; registration confirmation email. |
| R2 | Customers can submit general enquiries or enquiries about a specific trip. |
| R3 | Online, telephone and in-person bookings; **15% discount for online bookings**. |
| R4 | Services: local, long-distance, airport transfer, hotel transfer, airport meet-and-greet, daily car-with-driver hire. |
| R5 | Online booking requires login + pickup location, destination, date/time, passenger count, vehicle size. |
| R6 | Booking confirmation email; approaching-vehicle notification ~10–15 min before arrival with vehicle registration, colour and/or make (**implemented as a web-account notification, manually triggered by staff**). |
| R7 | Check vehicle availability, calculate fare, process payment, verify card. PayPal + major cards (incl. American Express) with VISA Check. **Cash added as extra feature.** |
| R8 | Printable online receipt after payment with journey details and final cost. |
| R9 | Customers review and rate completed journey, vehicle and driver. |
| R10 | Customers cancel/amend bookings subject to **24-hour** condition. |
| R11 | Caller verification, retrieval of existing accounts, creation of accounts for new customers. |
| R12 | Staff access to vehicle and driver availability to give accurate price/availability info. |
| R13 | Staff can email customers, reply to enquiries, create customer accounts, add vehicles and drivers, make bookings. |
| R14 | Track popular vehicles and loyal customers; recommend offers; offer codes usable on next booking. |

---

## 3. Prototype Assumptions and Business Rules (P01–P09)

### P01 — Accounts and Access
- **Registration details:** name, email, address, telephone, password, and a provided **mock card reference**. Missing required info, invalid email, or already-registered email blocks account creation.
- **Mock card:** store only a mock card reference, shown **masked**. No real card details. The reference does not restrict the payment method chosen for a booking.
- **Registration confirmation:** successful registration sends a **real** confirmation email.
- **Account access:** sign in with email + password; sign out ends access to protected pages; customers see only their own profile, bookings, payment details, receipts.
- **Profile changes:** customers can update contact details and mock card reference; a changed email becomes the sign-in email.
- **Enquiries:** guests and signed-in customers can submit **general** enquiries with a valid reply email; **trip-specific** enquiries require a signed-in customer and a booking owned by them.
- **Staff access:** staff functions require an authorised staff account.

### P02 — Demonstration Fares and Availability Windows
- **Sample pricing** (illustrative; depends on service + vehicle capacity, **not** on distance):

| Service | 4-passenger (GBP) | 7-passenger (GBP) | Occupied duration (min) |
|---|---|---|---|
| Local journey | 20.00 | 30.00 | 60 |
| Long-distance journey | 80.00 | 120.00 | 180 |
| Airport transfer | 45.00 | 65.00 | 90 |
| Hotel transfer | 30.00 | 45.00 | 60 |
| Airport meet-and-greet | 55.00 | 80.00 | 120 |
| Driver and car daily hire | 200.00 | 280.00 | 480 |

- **Vehicle capacity:** passenger count = positive whole number within vehicle capacity (4 or 7).
- **Occupied period:** from pickup **up to but excluding** end time (pickup + service duration). Two journeys conflict if periods overlap. A journey ending 11:00 does **not** conflict with one starting 11:00.
- **Vehicle reservations:** **Confirmed, Assigned, EnRoute** bookings reserve their vehicle (including Unpaid cash bookings). **Pending does not reserve.**
- **Driver reservations:** driver unavailable during overlapping **Assigned or EnRoute** bookings.
- **Availability checks:** re-check before confirming a booking and before saving an amendment.
- **Discounts & rounding:** Online bookings get **15% discount** for card, PayPal and cash. Telephone and In-person get **no automatic discount**. Offer discount is applied **after** the online discount. GBP, 2 decimals.

### P03 — Booking and Payment Lifecycle
- **Separate statuses:**
  - Booking status: `Pending, Confirmed, Assigned, EnRoute, Completed, Cancelled`
  - Payment status: `Unpaid, Paid, Refunded`
  - Fare stored separately.
- **Initial booking:** new booking = **Pending + Unpaid**, gets a booking reference, **no vehicle reservation**.
- **Checks before confirmation:** future pickup time, backend-calculated fare, vehicle availability, any attached offer.
- **Electronic payment screen:** test PayPal, Visa, Mastercard, American Express with **Success / Failed** outcomes. Card path also has **VISA Check Pass/Fail**; Fail blocks success.
- **Successful electronic payment:** record payment → **Confirmed + Paid**, reserve vehicle, mark applied offer used.
- **Failed electronic payment:** stays **Pending + Unpaid**; no payment, reservation, paid receipt, or offer use. A booking already confirmed/paid/cancelled cannot enter the initial payment flow again.
- **Cash confirmation:** booking becomes **Confirmed + Unpaid**; vehicle reserved; offer consumed; amount due at end of journey shown.
- **Staff-assisted:** staff may run electronic payment or cash confirmation for Telephone/In-person bookings.
- **Journey progression:** assigning an available Active driver changes Confirmed → **Assigned**. Staff simulation controls: Assigned → **EnRoute** → **Completed** (in order, no real waiting). Completion does **not** auto-record payment.
- **Cash collection:** only staff, only for **Completed + Cash + Unpaid**. Show full amount due; staff click **Confirm cash received** (no retyping amount). Save amount, method, time, staff member; payment → **Paid**, booking stays **Completed**. Already Paid cannot be collected again.
- **Receipts:** payment info in booking details for every method. Unpaid cash shows amount due. Printable **paid receipt** after successful electronic payment or recorded cash. Payment and refund history visible to owner and staff.
- **Financial simulation:** all payments, cash records, refunds are test transactions.

### P04 — Notifications
- **Channels:** booking confirmation = **real email**; approaching-vehicle = **web account notification**. Booking form has **no** notification-channel choice.
- **Booking-confirmation email:** sent automatically when booking becomes **Confirmed** (including unpaid cash). **Not** sent for Pending or failed payment.
- **Contents:** booking reference, journey details, service and vehicle, total, payment method, payment status, amount still due. Sent to the contact email saved with the booking. **No duplicate** on reprocessing.
- **Staff trigger:** **Notify customer** button only when booking is **EnRoute** with assigned vehicle and driver.
- **Demo timing:** manual trigger represents ~10–15 min away; no countdown/GPS.
- **Web notification:** saved in the owner's **Notifications** page: booking reference, vehicle registration, make, colour, expected-arrival message, link to the booking.
- **Access/persistence:** customers only see their own; remains after reload/re-login, even if signed out when sent.
- **Duplicate prevention:** repeating for same booking creates no duplicate.
- **Ineligible:** Pending, Confirmed, Assigned, Completed, Cancelled, or missing vehicle/driver cannot send.
- **Cancellation:** blocks new notifications; stored ones remain in history.

### P05 — Amendments, Cancellations and Financial Adjustments
- **Eligibility:** only the **owner** can amend/cancel a Pending, Confirmed or Assigned booking when existing pickup is **≥ 24 hours away (exactly 24h allowed)**, measured before pickup (not from creation). EnRoute, Completed, Cancelled are ineligible.
- **Permitted amendments:** journey details, service, vehicle. Revised pickup in the future, passenger count fits vehicle, vehicle available; Assigned booking must keep driver availability. Conflict checks **exclude the booking's own** reservations.
- **Fare recalculation:** from sample table, keep **original channel** and **previously applied offer benefit**; show revised total before confirming.
- **Unpaid amendments:** update amount due; no payment, no refund. Pending stays Pending (no reservation); confirmed/assigned cash bookings keep state and update reservations.
- **Higher paid fare:** Paid booking with higher total needs a **successful test payment for the increase** before saving. Failure leaves booking and paid amount unchanged.
- **Lower/unchanged paid fare:** lower → create/update a **Pending refund request** for the decrease; unchanged → no adjustment.
- **Cancellation confirmation:** customer must confirm; dismissing leaves booking unchanged. Success → **Cancelled** immediately, release vehicle/driver reservations, block new notifications.
- **Refund eligibility:** Unpaid cancellation → no refund. Paid cancellation → request remaining **net amount paid** (successful payments − processed refunds).
- **One pending request:** at most one Pending refund request per booking; update it rather than creating a second.
- **Refund processing:** staff view refund queue and process in-app: record amount, time, staff member; status → **Processed**; cannot process twice.
- **Payment status after refund:** full refund of a Cancelled booking → **Refunded**; partial refund on active amended booking → stays **Paid**. Customer sees refund progress in booking details.
- **Failed amendments:** invalid/conflicting changes leave booking, reservations and financial records unchanged.
- **Offer treatment:** cancellation does **not** restore a consumed offer code.

### P06 — Staff Verification and Resource Records
- **Existing customers:** find by **email or telephone**, then verify supplied **name + telephone**. Failed verification blocks assisted booking for that account.
- **New customers:** staff confirm contact details and create account via the registration form; account then used for booking.
- **Booking channels:** record Telephone or In-person, keep customer and staff member; use shared pricing/payment/confirmation workflows.
- **Enquiry replies:** view enquiries and linked booking; save non-empty reply with author and time; send by real email; failed save does not mark answered.
- **Vehicle records:** unique registration, make, colour, capacity **4 or 7**, status Active/Unavailable. Updates keep booking links and cannot reduce capacity below an active booking's passenger count or make a reserved vehicle Unavailable.
- **Driver records:** name, telephone, unique driver reference, status Active/Unavailable. Only an available Active driver can be assigned. A driver with Assigned/EnRoute booking cannot be marked Unavailable.
- **Saved information:** customer, vehicle, driver, assignment records persist after reload.

### P07 — Reviews and Ratings
- **Eligibility:** only the owner of a **Completed** booking; Paid not required (completed unpaid cash can be reviewed).
- **Required:** non-empty review text + separate whole-number ratings **1–5** for **journey, vehicle, driver**.
- **Limit:** one review per booking; resubmission does not overwrite.
- **Saved:** linked to booking, customer, vehicle, driver; persists after reload.

### P08 — Popularity and Loyalty Metric
- **Vehicle popularity:** count of stored **Completed** bookings per vehicle.
- **Customer loyalty:** count of stored **Completed** bookings per customer (including Unpaid completed cash).
- **Period:** all sample history; other statuses excluded.
- **Presentation:** order by count **descending**; show an empty state if no data.

### P09 — Special Offers
- **Eligibility:** customer with **≥ 3 Completed bookings** and **no previous recommendation** → one customer-linked offer.
- **Trigger:** opening the signed-in customer's **Offers** page evaluates eligibility; eligible customer gets the offer in account + **real recommendation email**; reopening shows existing offer.
- **Value:** configurable discount (GBP 5 / GBP 10 are examples, not limits); **no expiry**.
- **Validation:** code must exist, belong to booking customer, be unused; invalid → error, no discount.
- **Calculation:** max one code per booking; deducted **after** online discount, for every channel and payment method; total never below 0.
- **Quote review:** show revised total before confirmation; if the code is no longer valid at confirmation, customer must review corrected total before continuing.
- **Consumption:** marked used only when booking becomes **Confirmed** via electronic payment or cash confirmation; failed confirmation doesn't consume; later cash collection doesn't consume again.
- **Amend/cancel:** eligible amendment keeps applied discount; cancellation doesn't restore the code.

---

## 4. Epics

| Epic | Name | Purpose |
|---|---|---|
| SCRUM-30 | Customer Accounts and Support | Identify customers, maintain their info, support communication. |
| SCRUM-31 | Booking and Journey Management | Arrange and manage journeys across channels. |
| SCRUM-32 | Payments and Receipts | Digital and cash payments with accurate records. |
| SCRUM-33 | Staff and Fleet Operations | Keep vehicles and drivers organised for staff. |
| SCRUM-34 | Customer Insights and Special Offers | Understand customers; encourage repeat bookings. |

---

## 5. User Stories and Acceptance Criteria

Priority: **M** = Must Have, **S** = Should Have, **C** = Could Have. SP = Story Points.

### Epic: Customer Accounts and Support

#### SCRUM-6 — Register account (M, 5 SP)
*As a new customer, I want to register an account so that I can book journeys and keep my customer details.*
- AC1: Register with name, email, address, telephone, password and a selected mock card reference.
- AC2: Missing required info, invalid email, or already-registered email → error, no account.
- AC3: Card info uses provided test-card choices, shown as masked reference; no real card details.
- AC4: Valid registration saves an account usable to sign in.
- AC5: After success, a confirmation email is sent to the registered email.

#### SCRUM-7 — Sign in / sign out (M, 3 SP)
*As a registered customer, I want to sign in and sign out so that I can access my own booking functions.*
- AC1: Sign in with correct email and password.
- AC2: Incorrect details → error, not signed in.
- AC3: Sign out ends access to protected customer pages.
- AC4: A visitor must sign in before submitting an online booking.
- AC5: Customers access only their own profiles, bookings, payment details, receipts.

#### SCRUM-8 — Maintain profile (S, 2 SP)
*As a registered customer, I want to maintain my profile so that my contact and prototype payment details remain accurate.*
- AC1: View own contact details and masked mock card reference.
- AC2: Update contact details and select another provided mock card reference.
- AC3: Missing info, invalid email, email used by another account, or unsupported mock card → cannot save; previous details unchanged.
- AC4: Saved changes persist after reload; updated email becomes sign-in email.

#### SCRUM-9 — Submit general or trip-specific enquiry (S, 3 SP)
*As a customer, I want to submit a general or trip-specific enquiry so that I can obtain help from PrivateHire Cars.*
- AC1: Form offers **General** and **Trip-specific** types.
- AC2: Guest or signed-in customer can submit a general enquiry with message + valid reply email, no booking needed.
- AC3: Trip-specific requires signed-in customer and one of their own bookings.
- AC4: Missing message, invalid reply email, or another customer's booking → error, not saved.
- AC5: Valid enquiry saved with a **reference number** so staff can retrieve and answer.

#### SCRUM-21 — Verify callers, find/create accounts (staff) (S, 3 SP)
*As a Call Centre staff member, I want to verify callers and locate or create their accounts so that I can assist the correct customer.*
- AC1: Only authorised staff access customer lookup and caller verification.
- AC2: Find existing account by email or telephone number.
- AC3: For an existing customer, staff must match supplied name and telephone; failed check blocks assisted booking for that account.
- AC4: For a new customer, staff confirm contact details and create account using the registration form.
- AC5: Selected/new account is passed to assisted booking.

#### SCRUM-24 — Reply to customer enquiries (staff) (S, 3 SP)
*As a Call Centre staff member, I want to reply to customer enquiries so that customers receive help about services or journeys.*
- AC1: Staff view enquiries, original messages, reply contacts, any linked booking.
- AC2: Save a non-empty reply with staff member and reply time.
- AC3: Reply is sent by email to the enquiry's reply email.
- AC4: Empty reply or failed save → error, enquiry not marked answered.
- AC5: Saved replies persist after reload.

### Epic: Booking and Journey Management

#### SCRUM-10 — Choose service (M, 2 SP)
*As a customer, I want to choose the service I need so that my booking matches the purpose of my journey.*
- AC1: Select local, long-distance, airport transfer, hotel transfer, airport meet-and-greet, or daily car-and-driver hire.
- AC2: A service must be selected before continuing to booking review.
- AC3: Changing the service updates sample base fare and journey duration while keeping valid common journey details.
- AC4: Selected service saved with booking and shown consistently to customer and staff.

#### SCRUM-11 — Submit online journey booking (M, 5 SP)
*As a signed-in customer, I want to submit my journey details so that I can request a suitable minicab.*
- AC1: Only a signed-in customer can submit an online booking.
- AC2: Form requires service, pickup location, destination, future pickup date/time, positive whole-number passenger count, suitable vehicle.
- AC3: Missing/invalid info, insufficient capacity, or unavailable vehicle → cannot submit.
- AC4: Valid submission saves booking under the account with reference, channel **Online**, status **Pending**, payment **Unpaid**.
- AC5: Customer can view saved journey details, fare and statuses on booking details page.
- AC6: Pending booking does not reserve a vehicle; reserved only after successful confirmation.

#### SCRUM-12 — See available suitable vehicles (M, 5 SP)
*As a customer, I want to see available suitable vehicles so that I can select a vehicle that can fulfil my journey.*
- AC1: Search shows only **Active** vehicles with enough capacity.
- AC2: Availability uses requested pickup time + service sample duration. A vehicle cannot be selected if it has an overlapping Confirmed/Assigned/EnRoute booking, including unpaid cash.
- AC3: Journey ending when another begins is not an overlap.
- AC4: No suitable vehicle → message shown, unavailable selection prevented.
- AC5: Availability re-checked before confirming electronic-payment or cash bookings and before saving an amendment.

#### SCRUM-13 — Clear calculated price (M, 3 SP)
*As a customer, I want to see a clear calculated price so that I understand what I will pay before confirming.*
- AC1: Backend calculates base fare from sample table using service + vehicle capacity.
- AC2: Online bookings get 15% discount for card, PayPal and cash.
- AC3: Telephone and In-person get no automatic online discount.
- AC4: Valid offer deducts its amount after online discount; total never negative. Example: GBP 20 online → GBP 17 after 15% → GBP 5 offer → GBP 12.
- AC5: Booking review shows base fare, discounts, final total in GBP to 2 decimals; saved total uses backend calculation.

#### SCRUM-14 — Booking confirmation email + view booking (M, 3 SP)
*As a customer, I want to receive a booking confirmation email and view my booking details so that I know my booking has been confirmed.*
- AC1: Confirmation uses email automatically; form has no notification-channel choice.
- AC2: When booking becomes Confirmed, a real email is sent to the contact email saved with the booking, including unpaid cash.
- AC3: Email shows booking reference, journey details, service and vehicle, total, payment method, payment status, amount still due.
- AC4: Signed-in customer can view same info in own booking details.
- AC5: Pending bookings and failed payments produce no confirmation email.
- AC6: Reprocessing the same confirmation does not send a duplicate.

#### SCRUM-15 — Approaching-vehicle web notification (S, 5 SP)
*As a customer, I want to receive an approaching-vehicle notification in my web account so that I can prepare for pickup and identify the correct vehicle.*
- AC1: Authorised staff can select **Notify customer** only when booking is EnRoute with assigned vehicle and driver.
- AC2: Sending creates a message in the owner's Notifications page; no channel choice.
- AC3: Notification shows booking reference, vehicle registration, make, colour, and says vehicle expected in approx. 10–15 minutes. Manual trigger demonstrates this; no countdown/GPS.
- AC4: Customer can open related booking from notification; sees only own notifications/bookings.
- AC5: Saved and available after reload/re-login, including if signed out when sent.
- AC6: Pending, Confirmed, Assigned, Completed, Cancelled bookings, or missing vehicle/driver, cannot create it.
- AC7: Repeating for same booking creates no duplicate.

#### SCRUM-18 — Amend eligible booking (S, 8 SP)
*As a customer, I want to amend an eligible booking so that I can update my journey plans.*
- AC1: Only owner can amend Pending/Confirmed/Assigned booking with pickup ≥ 24h away (exactly 24h ok). EnRoute, Completed, Cancelled cannot be amended.
- AC2: Can change journey details, service, vehicle. Revised pickup in future; passenger count fits vehicle.
- AC3: Vehicle must be available for revised period. Assigned booking must also have current driver available; own reservations excluded from conflict checks.
- AC4: Recalculate fare from sample table; keep original channel and previously applied offer benefit; show revised total before confirm.
- AC5: Unpaid booking: update amount due, no payment, no refund. Pending stays Pending w/o reservation; confirmed cash keeps state and updates reservation.
- AC6: Paid booking with higher total: customer must successfully complete a test payment for the increase before saving. Failed extra payment leaves previous booking and paid amount unchanged.
- AC7: Paid booking with lower total: create/update a Pending refund request for the decrease. Unchanged total → no adjustment.
- AC8: Successful amendment updates reservations and retains booking state. Invalid/conflicting changes leave previous booking unchanged.

#### SCRUM-19 — Cancel eligible booking (S, 8 SP)
*As a customer, I want to cancel an eligible booking so that I can withdraw a journey I no longer need.*
- AC1: Only owner can cancel Pending/Confirmed/Assigned booking with pickup ≥ 24h away (exactly 24h ok). Other states or shorter notice blocked.
- AC2: Customer must confirm; dismissing leaves booking unchanged.
- AC3: Success → **Cancelled** immediately, release vehicle and driver reservations, block new approaching notifications; stored notifications remain.
- AC4: If money remains to refund, create/update one Pending refund request for remaining net amount paid. Unpaid → no refund request. Existing pending partial refund is updated, not duplicated.
- AC5: Staff can view refund queue, booking reference, reason, amount, request status, and confirm refund processed.
- AC6: Processing records refund amount, time, staff member; marks Processed. Full refund on Cancelled booking → payment **Refunded**; partial refund on active amended booking → stays **Paid**.
- AC7: Processed request cannot be processed again. Customer sees refund progress in booking payment details.

#### SCRUM-23 — Create telephone / in-person booking (staff) (S, 5 SP)
*As a Call Centre staff member, I want to create a booking for a verified customer so that telephone and in-person customers can use the service.*
- AC1: Authorised staff create Telephone or In-person booking for a selected customer account.
- AC2: Customer context comes from successful caller check or account creation (SCRUM-21); form captures required journey details.
- AC3: Submission checks capacity and availability, calculates fare **without** automatic online discount.
- AC4: Valid submission saves Pending + Unpaid booking with correct customer, channel, staff member, reference.
- AC5: Staff confirm using shared electronic test-payment or cash flow: electronic success → Confirmed/Paid; cash → Confirmed/Unpaid. Both reserve vehicle and trigger confirmation email.
- AC6: Customer and staff views show the same booking details, totals, payment statuses.

### Epic: Payments and Receipts

#### SCRUM-16 — Simulated payment (M, 5 SP)
*As a customer, I want to complete a simulated payment so that the prototype can demonstrate a paid booking.*
- AC1: For a Pending, Unpaid booking the owner can start payment; staff can also process payment for Telephone/In-person bookings.
- AC2: Payment screen offers PayPal and example Visa, Mastercard, American Express cards; clearly labelled **test payment**.
- AC3: Simulation offers Success and Failed outcomes. Card path includes VISA Check Pass/Fail; Fail prevents success.
- AC4: Before saving success, check future pickup time, backend fare, vehicle availability, applied offer.
- AC5: Success records payment, sets Confirmed + Paid, reserves vehicle, marks applied offer used. Failure shows error, leaves Pending + Unpaid, no reservation/offer use.
- AC6: Already confirmed, paid, or cancelled booking cannot enter initial payment flow again.

#### SCRUM-17 — Printable receipt (M, 3 SP)
*As a paying customer, I want a printable receipt so that I have a record of my journey and final cost.*
- AC1: Booking details show payment information for electronic and cash bookings, incl. total and current payment status.
- AC2: Unpaid cash booking shows amount due and Unpaid status, not claiming payment received.
- AC3: After successful electronic payment or recorded cash collection, a receipt can be viewed from booking details.
- AC4: Receipt shows booking and payment references, journey details, payment method, discounts, amount actually recorded as paid; printable.
- AC5: Only booking owner and authorised staff can access. Payment and refund records persist after reload, including pending/completed refund.

#### SCRUM-36 — Confirm booking with cash (S, 3 SP)
*As a customer, I want to confirm a booking with cash payment so that I can pay at the end of my journey.*
- AC1: Owner, or staff assisting a Telephone/In-person booking, can select Cash for a Pending, Unpaid booking.
- AC2: Confirmation checks future pickup time, backend fare, vehicle availability, applied offer. Failed checks leave Pending + Unpaid, no reservation/offer use.
- AC3: Success records method Cash, sets Confirmed + Unpaid, reserves vehicle, marks valid offer used. Online cash bookings keep the 15% discount.
- AC4: Booking details show amount due at end of journey; confirmation email sent.
- AC5: No paid receipt created at this point; available only after staff record cash received.

#### SCRUM-37 — Record cash payment (staff) (S, 3 SP)
*As an authorised staff member, I want to record a cash payment for a completed booking so that its payment status and receipt reflect the amount received.*
- AC1: Only authorised staff can record cash for a Completed, Cash, Unpaid booking.
- AC2: System displays full amount due; staff click **Confirm cash received** without retyping amount.
- AC3: Save amount, method, time, staff member; payment → Paid; booking stays Completed (test transaction).
- AC4: Printable paid receipt becomes available in booking details.
- AC5: Already Paid booking cannot produce another cash-collection record.

### Epic: Staff and Fleet Operations

#### SCRUM-22 — View availability and prices (staff) (S, 3 SP)
*As a Call Centre staff member, I want to see available minicabs, drivers and prices so that I can give customers accurate booking information.*
- AC1: Only authorised staff open the staff availability view.
- AC2: Search by pickup time, service, passenger count → suitable vehicles + driver availability for sample duration.
- AC3: Unavailable resources/conflicts excluded or clearly identified. Drivers busy for overlapping Assigned/EnRoute bookings.
- AC4: Shows sample fare for selected channel, no automatic online discount for Telephone/In-person.
- AC5: Empty results clearly shown; an available vehicle and quote can be passed to assisted booking **without reserving** resources at search stage.

#### SCRUM-25 — Maintain minicab records (staff) (S, 5 SP)
*As an authorised staff member, I want to maintain minicab records so that bookings use accurate vehicle information.*
- AC1: Only authorised staff add/update vehicles.
- AC2: Vehicle has unique registration, make, colour, capacity of 4 or 7, Active/Unavailable status.
- AC3: Missing info, duplicate registration, invalid capacity → error, not saved.
- AC4: Saved details persist after reload; availability searches reflect valid changes.
- AC5: Updates keep booking links intact; cannot reduce capacity below an active booking's passenger count or make its reserved vehicle Unavailable.

#### SCRUM-26 — Maintain drivers and journey states (staff) (S, 5 SP)
*As an authorised staff member, I want to maintain driver availability and journey assignments so that I can manage a booked journey.*
- AC1: Only authorised staff add/update drivers (name, telephone, unique driver reference, Active/Unavailable).
- AC2: Only an Active driver without a conflicting Assigned/EnRoute reservation can be assigned to a Confirmed booking, including unpaid cash.
- AC3: Assigning records assignment and staff member; booking → **Assigned**.
- AC4: Journey simulation controls: Assigned → EnRoute (with vehicle + driver) → Completed, in order, without waiting.
- AC5: Completing a journey does not auto-mark unpaid cash booking Paid.
- AC6: Saved driver details/assignments persist; a driver with Assigned/EnRoute booking cannot be marked Unavailable.

### Epic: Customer Insights and Special Offers

#### SCRUM-20 — Review and rate (S, 3 SP)
*As a customer, I want to review and rate my completed journey, vehicle and driver so that I can share feedback about the service.*
- AC1: Only owner of a Completed booking can review; Paid not required.
- AC2: Form requires review text + separate whole-number ratings 1–5 for journey, vehicle, driver.
- AC3: Missing/blank/invalid ratings or text → error, not saved.
- AC4: Valid review saved against correct booking, customer, vehicle, driver; visible after reload.
- AC5: One review per booking; another submission does not replace it.

#### SCRUM-27 — Popular vehicles and loyal customers (staff) (C, 2 SP)
*As an authorised staff member, I want to see popular vehicles and loyal customers so that I can identify useful service and offer opportunities.*
- AC1: Only authorised staff view both lists.
- AC2: Vehicle popularity = count of all stored Completed bookings per vehicle.
- AC3: Customer loyalty = count of all stored Completed bookings per customer, including completed unpaid cash. Other states excluded from both.
- AC4: Ordered by count descending; empty state if none.

#### SCRUM-28 — Special-offer recommendation (C, 3 SP)
*As a customer, I want a relevant special-offer recommendation so that I can benefit from using PrivateHire Cars again.*
- AC1: Opening the signed-in customer's Offers page creates a recommendation only if the customer has ≥ 3 Completed bookings and has never received one.
- AC2: Shows a customer-linked offer code + configured discount (e.g. GBP 5 or 10; examples only); no expiry date.
- AC3: Offer appears in the account and a recommendation email is sent.
- AC4: Reopening shows the existing recommendation; no new one created.
- AC5: Only the linked customer can access/use it; redeemable for **one** confirmed booking.

#### SCRUM-29 — Apply offer code at booking (M, 5 SP)
*As a customer, I want to enter my special-offer code when booking so that I can redeem my eligible offer.*
- AC1: Customer, or staff assisting that customer, can enter an offer code during booking review.
- AC2: New code must exist, belong to booking customer, be unused. Invalid → error, no discount.
- AC3: Valid code deducts its amount after any online discount, for every channel and payment method; total never negative.
- AC4: At most one code per booking; show revised total before confirmation. If the code is no longer valid at confirmation, customer must review the corrected total before continuing.
- AC5: Code marked used only when booking becomes Confirmed via electronic payment or cash confirmation. Failed confirmation doesn't use it; later cash collection doesn't use it again.
- AC6: Eligible amendment keeps the discount already applied. Cancellation doesn't make a used code available again.

---

## 6. Core State Machines (implement exactly)

**Booking status flow**
```
Pending --(electronic payment success OR cash confirm)--> Confirmed
Confirmed --(staff assigns Active, free driver)--> Assigned
Assigned --(staff simulation)--> EnRoute --(staff simulation)--> Completed
Pending/Confirmed/Assigned --(owner cancel, >= 24h before pickup)--> Cancelled
```

**Payment status flow**
```
Unpaid --(electronic success)--> Paid
Unpaid (cash, Completed) --(staff Confirm cash received)--> Paid
Paid --(full refund processed on Cancelled booking)--> Refunded
Paid --(partial refund on amended booking)--> Paid (stays)
```

**Refund request:** `Pending → Processed` (max one Pending per booking; Processed is final).

**Vehicle reservation:** reserved by Confirmed / Assigned / EnRoute; **not** by Pending; released on Cancelled.

---

## 7. MoSCoW Summary and Build Order

- **Must Have (10):** SCRUM-6, 7, 10, 11, 12, 13, 14, 16, 17, 29
- **Should Have (14):** SCRUM-8, 9, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26, 36, 37
- **Could Have (2):** SCRUM-27, 28
- **Total story points:** 86

**MVP (build first):** register/sign in → choose service → enter journey details → pick available vehicle → review fare (15% online discount, offer code) → test card/PayPal payment → Confirmed booking + real confirmation email → view and print receipt. Use seeded vehicles, fixed sample fares, and pre-issued sample offer codes.

**Then add:** staff-assisted booking, caller verification, availability view, enquiries + replies, vehicle/driver management, journey simulation, cash confirmation/collection, amend/cancel/refunds, approaching-vehicle notification, reviews, insights, offer recommendation.

---

## 8. Seed Data (suggested for demo)

- Services and fares per the P02 table.
- Several vehicles (mix of capacity 4 and 7, Active and Unavailable) with unique registrations, make, colour.
- Several drivers (Active and Unavailable) with unique driver references.
- At least one staff account and a few customer accounts; some customers with 3+ Completed bookings, and some sample Completed history for popularity/loyalty lists.
- A few pre-issued sample offer codes linked to specific customers.
- Mock card choices: Visa, Mastercard, American Express (masked references).
- SMTP configuration via environment variables for real email delivery.

---

## 9. Cross-Cutting Requirements

- Role-based access control: guests / customers (own data only) / authorised staff.
- Server-side validation for all forms; show clear error messages.
- Backend is the source of truth for fares, discounts, availability and status transitions.
- Idempotency: no duplicate confirmation emails, no duplicate approaching-vehicle notifications, no double payment/refund/cash collection, one review per booking, one pending refund per booking.
- All persisted data survives reload and re-login.
- Booking reference generated for every booking; enquiry reference generated for every enquiry.
- Receipts are print-friendly (print stylesheet / print button).
- Clearly label all payment, cash and refund actions as **test transactions**.
- Responsive UI (desktop and mobile browser).
