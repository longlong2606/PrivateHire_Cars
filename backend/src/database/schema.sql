
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    account_code VARCHAR(50) UNIQUE NOT NULL,       
    name VARCHAR(100) NOT NULL,                    
    email VARCHAR(150) UNIQUE NOT NULL,            
    address VARCHAR(255) NOT NULL,                
    telephone VARCHAR(20) NOT NULL,                
    password_hash VARCHAR(255) NOT NULL,           
    mock_card_ref VARCHAR(100) NOT NULL,           
    status VARCHAR(20) DEFAULT 'ACTIVE',           
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_account_code ON accounts(account_code);

-- Seed accounts can be registered fresh via the registration form
-- INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, status)
-- VALUES 
--     ('ACC-10001', 'John Doe', 'john.doe@example.com', '123 Oxford Street, London', '0712345678', '$2b$10$XltJeJwW/Oz71H7M.m5n5uVKyNFtJ4jwe8usfhKeB7zmhedCWabdS', '•••• •••• •••• 4242 (Visa Test Card)', 'ACTIVE'),
--     ('ACC-10002', 'Jane Smith', 'jane.smith@example.com', '456 Baker Street, London', '0798765432', '$2b$10$XltJeJwW/Oz71H7M.m5n5uVKyNFtJ4jwe8usfhKeB7zmhedCWabdS', '•••• •••• •••• 5555 (Mastercard Test Card)', 'ACTIVE')
-- ON CONFLICT (email) DO NOTHING;



CREATE TABLE IF NOT EXISTS mock_cards (
    id SERIAL PRIMARY KEY,
    card_code VARCHAR(50) UNIQUE NOT NULL,         
    card_brand VARCHAR(50) NOT NULL,               
    masked_reference VARCHAR(100) NOT NULL,       
    expiry_mock VARCHAR(10) NOT NULL,            
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO mock_cards (card_code, card_brand, masked_reference, expiry_mock, is_active)
VALUES 
    ('MOCK_VISA_4242', 'Visa Mock', '•••• •••• •••• 4242 (Visa Test Card)', '12/28', TRUE),
    ('MOCK_MC_5555', 'Mastercard Mock', '•••• •••• •••• 5555 (Mastercard Test Card)', '08/29', TRUE),
    ('MOCK_JCB_3528', 'JCB Mock', '•••• •••• •••• 3528 (JCB Test Card)', '10/27', TRUE),
    ('MOCK_AMEX_3782', 'Amex Mock', '•••• •••••• •3782 (Amex Test Card)', '05/30', TRUE)
ON CONFLICT (card_code) DO NOTHING;

-- ===================================================================
-- CUSTOMER SESSIONS TABLE (Sign-in, Sign-out and Session Handling)
-- ===================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    ip_address VARCHAR(100),
    user_agent VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_account_id ON sessions(account_id);

-- ===================================================================
-- CUSTOMER BOOKINGS TABLE (Protected: visitors cannot submit online bookings)
-- ===================================================================
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    booking_code VARCHAR(50) UNIQUE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    pickup_address VARCHAR(255) NOT NULL,
    dropoff_address VARCHAR(255) NOT NULL,
    pickup_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    passenger_name VARCHAR(100) NOT NULL,
    passenger_phone VARCHAR(50) NOT NULL,
    car_type VARCHAR(50) DEFAULT 'Executive Saloon',
    fare_amount NUMERIC(10, 2) NOT NULL DEFAULT 45.00,
    payment_method VARCHAR(50) DEFAULT 'MOCK_CARD',
    card_ref_used VARCHAR(100),
    status VARCHAR(50) DEFAULT 'CONFIRMED',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookings_account_id ON bookings(account_id);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(booking_code);

-- ===================================================================
-- 5. SERVICES TABLE (Demonstration Fares and Journey Durations)
-- Requirement: Table 8 - 6 Services with Fixed Sample Fares and Durations
-- Note: Fare is based on service and vehicle capacity, not travel distance.
-- ===================================================================
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    service_code VARCHAR(50) UNIQUE NOT NULL,
    service_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    four_passenger_fare NUMERIC(10, 2) NOT NULL,
    seven_passenger_fare NUMERIC(10, 2) NOT NULL,
    occupied_duration_minutes INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'GBP',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_code ON services(service_code);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(service_name);

-- Seed the six services with Table 8 demonstration fares and journey durations
INSERT INTO services (service_code, service_name, description, four_passenger_fare, seven_passenger_fare, occupied_duration_minutes, currency, is_active)
VALUES 
    ('LOCAL_JOURNEY', 'Local journey', 'Standard urban travel within local city boundaries.', 20.00, 30.00, 60, 'GBP', TRUE),
    ('LONG_DISTANCE_JOURNEY', 'Long-distance journey', 'Intercity transit and long-range chauffeured travel.', 80.00, 120.00, 180, 'GBP', TRUE),
    ('AIRPORT_TRANSFER', 'Airport transfer', 'Punctual point-to-point airport dropoff or pickup.', 45.00, 65.00, 90, 'GBP', TRUE),
    ('HOTEL_TRANSFER', 'Hotel transfer', 'Hotel pickup, luggage assistance, and hospitality transfer.', 30.00, 45.00, 60, 'GBP', TRUE),
    ('AIRPORT_MEET_AND_GREET', 'Airport meet-and-greet', 'Terminal personalized arrival greeting, flight delay monitoring, and luggage handling.', 55.00, 80.00, 120, 'GBP', TRUE),
    ('DRIVER_CAR_DAILY_HIRE', 'Driver and car daily hire', 'Full-day dedicated chauffeur and vehicle hire at client disposal.', 200.00, 280.00, 480, 'GBP', TRUE)
ON CONFLICT (service_code) DO UPDATE SET
    service_name = EXCLUDED.service_name,
    description = EXCLUDED.description,
    four_passenger_fare = EXCLUDED.four_passenger_fare,
    seven_passenger_fare = EXCLUDED.seven_passenger_fare,
    occupied_duration_minutes = EXCLUDED.occupied_duration_minutes,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- Optional service linkage on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_id INTEGER REFERENCES services(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS service_name VARCHAR(100);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_capacity INTEGER DEFAULT 4;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fare_currency VARCHAR(10) DEFAULT 'GBP';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS occupied_duration_minutes INTEGER DEFAULT 60;

-- ===================================================================
-- 6. FORM STATE PERSISTENCE TABLE (Booking Drafts & Session In-Progress States)
-- Requirement: Form State Persistence for booking data
-- Persists in-progress booking form entries (pickup, dropoff, service, vehicle, notes)
-- across page refreshes, browser restarts, and authentication redirects.
-- ===================================================================
CREATE TABLE IF NOT EXISTS booking_drafts (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    draft_token VARCHAR(255) UNIQUE NOT NULL,
    pickup_address TEXT,
    dropoff_address TEXT,
    service_id INTEGER REFERENCES services(id),
    service_name VARCHAR(100),
    vehicle_capacity INTEGER DEFAULT 4,
    fare_amount NUMERIC(10, 2),
    fare_currency VARCHAR(10) DEFAULT 'GBP',
    occupied_duration_minutes INTEGER,
    car_type VARCHAR(100),
    notes TEXT,
    form_metadata TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_booking_drafts_account ON booking_drafts(account_id);
CREATE INDEX IF NOT EXISTS idx_booking_drafts_token ON booking_drafts(draft_token);

-- ===================================================================
-- 7. ROLES & FLEET MANAGEMENT (P01, P06)
-- Staff accounts & fleet resources
-- ===================================================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'CUSTOMER';

-- Seed default staff account (Staff123! hashed with bcrypt)
INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, role, status)
VALUES (
    'STAFF-001', 
    'London Operations Dispatcher', 
    'staff@privatehirecars.com', 
    'PrivateHire Cars Heathrow Control Centre, London TW6 1AP', 
    '+44 20 7946 0991', 
    '$2b$10$XltJeJwW/Oz71H7M.m5n5uVKyNFtJ4jwe8usfhKeB7zmhedCWabdS', 
    '•••• •••• •••• 4242 (Visa Test Card)', 
    'STAFF', 
    'ACTIVE'
)
ON CONFLICT (email) DO UPDATE SET role = 'STAFF';

-- Chauffeur Drivers Table (P06)
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    driver_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    telephone VARCHAR(30) NOT NULL,
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, UNAVAILABLE
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO drivers (driver_code, name, telephone, reference_number, status)
VALUES
    ('DRV-001', 'Arthur Pendelton', '+44 7700 900123', 'TFL-PHD-48291', 'ACTIVE'),
    ('DRV-002', 'Marcus Sterling', '+44 7700 900456', 'TFL-PHD-59382', 'ACTIVE'),
    ('DRV-003', 'Elizabeth Clark', '+44 7700 900789', 'TFL-PHD-61029', 'ACTIVE')
ON CONFLICT (driver_code) DO NOTHING;

-- Fleet Vehicles Table (P06)
CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    reg_number VARCHAR(20) UNIQUE NOT NULL,
    make_model VARCHAR(100) NOT NULL,
    colour VARCHAR(50) NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, UNAVAILABLE
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many Chauffeur-Vehicle Assignment Junction (Supports multiple shift drivers per vehicle)
CREATE TABLE IF NOT EXISTS vehicle_drivers (
    id SERIAL PRIMARY KEY,
    vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_vehicle_driver UNIQUE (vehicle_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_drivers_vehicle ON vehicle_drivers(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_drivers_driver ON vehicle_drivers(driver_id);

INSERT INTO vehicles (reg_number, make_model, colour, capacity, status, driver_id)
VALUES
    ('LD68 PHC', 'Mercedes-Benz E-Class Saloon', 'Obsidian Black', 4, 'ACTIVE', 1),
    ('LN21 XEC', 'BMW 5-Series Executive', 'Imperial Blue', 4, 'ACTIVE', 2),
    ('LJ23 MPV', 'Mercedes-Benz V-Class Luxury MPV', 'Metallic Silver', 7, 'ACTIVE', 3),
    ('LA20 PHV', 'Volkswagen Caravelle Executive', 'Deep Black', 7, 'ACTIVE', 1)
ON CONFLICT (reg_number) DO NOTHING;

-- Extend Bookings Table for Lifecycle, Pricing & Resources (P02, P03)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'UNPAID';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS vehicle_id INTEGER REFERENCES vehicles(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES drivers(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_channel VARCHAR(20) DEFAULT 'ONLINE';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS base_fare NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS final_fare NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS approaching_alert BOOLEAN DEFAULT FALSE;

-- ===================================================================
-- 8. SPECIAL OFFERS & LOYALTY (P09)
-- Automatic promo codes for >= 3 completed bookings
-- ===================================================================
CREATE TABLE IF NOT EXISTS special_offers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_special_offers_code ON special_offers(code);
CREATE INDEX IF NOT EXISTS idx_special_offers_account ON special_offers(account_id);

-- ===================================================================
-- 9. REVIEWS & RATINGS (P07)
-- Ratings 1-5 for journey, vehicle, driver on completed bookings
-- ===================================================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    journey_rating INTEGER NOT NULL CHECK (journey_rating BETWEEN 1 AND 5),
    vehicle_rating INTEGER NOT NULL CHECK (vehicle_rating BETWEEN 1 AND 5),
    driver_rating INTEGER NOT NULL CHECK (driver_rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_account ON reviews(account_id);

-- ===================================================================
-- 10. REFUND REQUESTS & CANCELLATIONS (P05)
-- Pending refund queue for staff manual processing
-- ===================================================================
CREATE TABLE IF NOT EXISTS refund_requests (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING',
    processed_by_staff_id INTEGER REFERENCES accounts(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_requests(status);

-- ===================================================================
-- 11. CUSTOMER ENQUIRIES & SUPPORT (Epic 1)
-- General & Trip-specific questions with staff reply
-- ===================================================================
CREATE TABLE IF NOT EXISTS enquiries (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    staff_reply TEXT,
    replied_by_staff_id INTEGER REFERENCES accounts(id),
    status VARCHAR(20) DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    replied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);

-- ===================================================================
-- 12. WEB NOTIFICATIONS (P04)
-- Persistent in-account alerts (e.g. Approaching Vehicle)
-- ===================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_account ON notifications(account_id);



