
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

INSERT INTO accounts (account_code, name, email, address, telephone, password_hash, mock_card_ref, status)
VALUES 
    (
        'ACC-10001', 'John Doe', 'john.doe@example.com', '123 Oxford Street, London', '0712345678', 
        '$2b$10$XltJeJwW/Oz71H7M.m5n5uVKyNFtJ4jwe8usfhKeB7zmhedCWabdS', '•••• •••• •••• 4242 (Visa Test Card)', 'ACTIVE'
    ),
    (
        'ACC-10002', 'Jane Smith', 'jane.smith@example.com', '456 Baker Street, London', '0798765432', 
        '$2b$10$XltJeJwW/Oz71H7M.m5n5uVKyNFtJ4jwe8usfhKeB7zmhedCWabdS', '•••• •••• •••• 5555 (Mastercard Test Card)', 'ACTIVE'
    )
ON CONFLICT (email) DO NOTHING;



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
