
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


