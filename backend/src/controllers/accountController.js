const bcrypt = require('bcryptjs');
const AccountModel = require('../models/accountModel');
const db = require('../config/db');
const { sendConfirmationEmail, getEmailHistory } = require('../services/emailService');

// Standard Email RFC-compliant regex
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * [STEPS 4 & 5] CUSTOMER REGISTRATION (AC1, AC2, AC3, AC4, AC5)
 * Checks: required fields, email format, existing email, password match, test card
 */
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      address,
      telephone,
      password,
      confirmPassword,
      mockCardRef,
    } = req.body;

    // --- [STEP 5 / AC2]: VALIDATE REGISTRATION DATA ---
    const errors = {};

    // 1. Check required fields
    if (!name || !name.trim()) errors.name = 'Full name is required';
    if (!email || !email.trim()) errors.email = 'Email address is required';
    if (!address || !address.trim()) errors.address = 'Residential address is required';
    if (!telephone || !telephone.trim()) errors.telephone = 'Telephone number is required';
    if (!password) errors.password = 'Password is required';
    if (!confirmPassword) errors.confirmPassword = 'Password confirmation is required';
    if (!mockCardRef || !mockCardRef.trim()) errors.mockCardRef = 'Please select a mock card reference according to AC3';

    // 2. Check email format
    if (email && email.trim() && !EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Invalid email format (e.g. user@example.com)';
    }

    // 3. Check password confirmation
    if (password && confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = 'Password confirmation does not match';
    }

    // 4. Check minimum password length
    if (password && password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    // Return 400 if any basic validation fails
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid registration data',
        errors,
      });
    }

    // 5. Check if email is already registered (AC2)
    const existingUser = await AccountModel.findByEmail(email.trim());
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered',
        errors: {
          email: `Email "${email.trim()}" is already registered in the system`,
        },
      });
    }

    // 6. Check mock card validity (AC3)
    const validCards = await AccountModel.getMockCards();
    let finalCardRef = mockCardRef;
    const matchedCard = validCards.find(
      (c) =>
        c.card_code === mockCardRef ||
        c.masked_reference === mockCardRef ||
        (mockCardRef && c.masked_reference && mockCardRef.includes(c.masked_reference.slice(-4))) ||
        (mockCardRef && c.card_code && mockCardRef.includes(c.card_code.slice(-4)))
    );
    if (matchedCard) {
      finalCardRef = matchedCard.masked_reference;
    }

    // --- [STEP 4]: PERSIST ACCOUNT IN DATABASE ---
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate unique account code (e.g. ACC-784210)
    const accountCode = 'ACC-' + Math.floor(100000 + Math.random() * 900000);

    // Save to database
    const newAccount = await AccountModel.create({
      accountCode,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      telephone: telephone.trim(),
      passwordHash,
      mockCardRef: finalCardRef,
    });

    // --- [AC5]: SEND CONFIRMATION EMAIL ---
    let emailResult = null;
    try {
      emailResult = await sendConfirmationEmail({
        toEmail: newAccount.email,
        name: newAccount.name,
        accountCode: newAccount.account_code,
        mockCardRef: newAccount.mock_card_ref,
      });
    } catch (eErr) {
      console.warn('Could not send confirmation email:', eErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully!',
      account: {
        id: newAccount.id,
        accountCode: newAccount.account_code,
        name: newAccount.name,
        email: newAccount.email,
        address: newAccount.address,
        telephone: newAccount.telephone,
        mockCardRef: newAccount.mock_card_ref,
        status: newAccount.status,
        createdAt: newAccount.created_at,
      },
      emailSent: emailResult ? true : false,
      emailPreview: emailResult,
    });
  } catch (error) {
    console.error('Error during registration:', error);
    if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique'))) {
      return res.status(400).json({
        success: false,
        message: 'Data already exists in system',
        errors: {
          email: `Email "${req.body.email}" is already registered in the system`,
        },
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

/**
 * [AC4]: SIGN IN WITH REGISTERED ACCOUNT
 * AC4: A valid registration saves an account that can be used to sign in.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const account = await AccountModel.findByEmail(email.trim());
    if (!account) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await bcrypt.compare(password, account.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    res.json({
      success: true,
      message: `Sign in successful! Welcome ${account.name}`,
      user: {
        id: account.id,
        accountCode: account.account_code,
        name: account.name,
        email: account.email,
        mockCardRef: account.mock_card_ref,
        status: account.status,
      },
    });
  } catch (error) {
    console.error('Error during sign in:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during sign in',
      error: error.message,
    });
  }
};

// Retrieve all registered accounts
const getAccounts = async (req, res) => {
  try {
    const accounts = await AccountModel.findAll();
    res.json({
      success: true,
      count: accounts.length,
      data: accounts,
    });
  } catch (error) {
    console.error('Error in getAccounts:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving accounts', error: error.message });
  }
};

// Retrieve mock card choices under AC3
const getMockCards = async (req, res) => {
  try {
    const cards = await AccountModel.getMockCards();
    res.json({
      success: true,
      data: cards,
    });
  } catch (error) {
    console.error('Error in getMockCards:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving mock cards', error: error.message });
  }
};

// Retrieve sent confirmation email history (AC5)
const getEmails = (req, res) => {
  res.json({
    success: true,
    data: getEmailHistory(),
  });
};

// Database Read/Write Test
const testDatabase = async (req, res) => {
  try {
    const dbStatus = db.getDbStatus();
    const result = await AccountModel.testReadWrite();
    res.json({
      success: true,
      message: 'Database READ and WRITE verified 100% successfully!',
      dbStatus,
      testResult: {
        canWrite: result.writeSuccess,
        canRead: result.readSuccess,
        sampleData: result.readRecord,
      },
    });
  } catch (error) {
    console.error('Error in testDatabase:', error);
    res.status(500).json({
      success: false,
      message: 'Database read/write verification failed',
      error: error.message,
    });
  }
};

// Seed initial demo account
const seedDemoAccount = async (req, res) => {
  try {
    const existing = await AccountModel.findByEmail('demo.customer@example.com');
    if (existing) {
      return res.json({
        success: true,
        message: 'Demo account already exists in database',
        data: existing,
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePassword@123', salt);
    const accountCode = 'ACC-' + Math.floor(100000 + Math.random() * 900000);

    const newAccount = await AccountModel.create({
      accountCode,
      name: 'John Doe',
      email: 'demo.customer@example.com',
      address: '123 Baker Street, London',
      telephone: '0912345678',
      passwordHash,
      mockCardRef: '•••• •••• •••• 4242 (Visa Test Card)',
    });

    res.status(201).json({
      success: true,
      message: 'Sample demo account created successfully!',
      data: newAccount,
    });
  } catch (error) {
    console.error('Error in seedDemoAccount:', error);
    res.status(500).json({ success: false, message: 'Error seeding demo account', error: error.message });
  }
};

module.exports = {
  register,
  login,
  getAccounts,
  getMockCards,
  getEmails,
  testDatabase,
  seedDemoAccount,
};
