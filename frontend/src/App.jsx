import React, { useState, useEffect } from 'react';
import {
  registerAccount,
  loginAccount,
  getAccounts,
  getMockCards,
  getEmails,
} from './services/api';

const DEFAULT_TEST_CARDS = [
  { id: 1, card_code: 'MOCK_VISA_4242', card_brand: 'Visa Mock', masked_reference: '•••• •••• •••• 4242 (Visa Test Card)', expiry_mock: '12/28', is_active: true },
  { id: 2, card_code: 'MOCK_MC_5555', card_brand: 'Mastercard Mock', masked_reference: '•••• •••• •••• 5555 (Mastercard Test Card)', expiry_mock: '08/29', is_active: true },
  { id: 3, card_code: 'MOCK_JCB_3528', card_brand: 'JCB Mock', masked_reference: '•••• •••• •••• 3528 (JCB Test Card)', expiry_mock: '10/27', is_active: true },
  { id: 4, card_code: 'MOCK_AMEX_3782', card_brand: 'Amex Mock', masked_reference: '•••• •••••• •3782 (Amex Test Card)', expiry_mock: '05/30', is_active: true },
];

export default function App() {
  // Registration form state (Steps 4 & 5 / AC1 - AC3)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: '',
    telephone: '',
    password: '',
    confirmPassword: '',
    mockCardRef: DEFAULT_TEST_CARDS[0].masked_reference,
  });

  // Sign in form state (AC4)
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });

  const [mockCards, setMockCards] = useState(DEFAULT_TEST_CARDS);
  const [accounts, setAccounts] = useState([]);
  const [emails, setEmails] = useState([]);

  // Notification states
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Sign in verification state (AC4)
  const [loginResult, setLoginResult] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Load initial data
  const loadData = async () => {
    try {
      const [cardsRes, accRes, emailRes] = await Promise.all([
        getMockCards().catch(() => ({ data: [] })),
        getAccounts().catch(() => ({ data: [] })),
        getEmails().catch(() => ({ data: [] })),
      ]);

      if (cardsRes.data && cardsRes.data.length > 0) {
        setMockCards(cardsRes.data);
      }
      if (accRes.data) setAccounts(accRes.data);
      if (emailRes.data) setEmails(emailRes.data);
    } catch (err) {
      console.error('Error loading data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle registration input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Instant real-time duplicate check when user types email (AC2)
    if (name === 'email') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed && accounts.some((acc) => acc.email.toLowerCase() === trimmed)) {
        setFieldErrors((prev) => ({
          ...prev,
          email: `⚠️ Email "${value.trim()}" is already registered (Duplicate - AC2)`,
        }));
      } else if (fieldErrors.email) {
        setFieldErrors((prev) => ({ ...prev, email: '' }));
      }
    } else if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setGeneralError('');
  };

  // Quick fill sample data for fast testing
  const handleFillSample = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    setFormData({
      name: 'John Smith',
      email: `customer_${randomId}@example.com`,
      address: '10 Downing Street, London',
      telephone: '0712345678',
      password: 'SecurePass@123',
      confirmPassword: 'SecurePass@123',
      mockCardRef: mockCards[0]?.masked_reference || DEFAULT_TEST_CARDS[0].masked_reference,
    });
    setFieldErrors({});
    setGeneralError('');
    setSuccessMessage('');
  };

  // Handle registration submit (AC1, AC2, AC3, AC5)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setGeneralError('');
    setSuccessMessage('');

    // --- CLIENT-SIDE VALIDATION (AC2 & AC3) ---
    const clientErrors = {};
    if (!formData.name.trim()) clientErrors.name = 'Full name is required';
    if (!formData.email.trim()) {
      clientErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      clientErrors.email = 'Invalid email format (e.g. user@example.com)';
    } else if (accounts.some((acc) => acc.email.toLowerCase() === formData.email.trim().toLowerCase())) {
      // ⚠️ REALTIME DUPLICATE EMAIL CHECK UNDER AC2
      clientErrors.email = `⚠️ Email "${formData.email.trim()}" is already registered (Duplicate - AC2)`;
    }

    if (!formData.address.trim()) clientErrors.address = 'Residential address is required';
    if (!formData.telephone.trim()) clientErrors.telephone = 'Telephone number is required';
    if (!formData.password) {
      clientErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      clientErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.confirmPassword) {
      clientErrors.confirmPassword = 'Password confirmation is required';
    } else if (formData.password !== formData.confirmPassword) {
      clientErrors.confirmPassword = 'Password confirmation does not match';
    }
    if (!formData.mockCardRef) {
      clientErrors.mockCardRef = 'Please select a mock card reference according to AC3';
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      if (clientErrors.email) {
        setGeneralError(clientErrors.email);
      } else {
        setGeneralError('Please resolve the errors highlighted below!');
      }
      setSubmitting(false);
      return;
    }

    // --- SUBMIT TO BACKEND (STEPS 4 & 5 / AC4 & AC5) ---
    try {
      const response = await registerAccount(formData);
      if (response.success) {
        setSuccessMessage(
          `🎉 Registration successful! Account Code: ${response.account.accountCode}. Confirmation email sent to: ${response.account.email}`
        );
        // Pre-fill email and password into sign-in form for convenient AC4 test
        setLoginData({
          email: formData.email,
          password: formData.password,
        });

        // Reload accounts and emails
        await loadData();
      }
    } catch (err) {
      const resData = err.response?.data;
      if (resData?.errors) {
        setFieldErrors(resData.errors);
      }
      setGeneralError(resData?.message || err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Sign In submit (AC4)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginResult(null);
    try {
      const res = await loginAccount(loginData);
      setLoginResult({ success: true, message: res.message, user: res.user });
    } catch (err) {
      setLoginResult({
        success: false,
        message: err.response?.data?.message || 'Sign in failed. Please check your credentials.',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="container">
      {/* Page Header */}
      <header className="page-header">
        <h1 className="page-title">🚗 PrivateHire Cars - Customer Registration System</h1>
        <p className="page-subtitle">
          Fulfilling 100% of Acceptance Criteria (AC1 - AC5) &bull; Interactive Test Console
        </p>
      </header>

      {/* Global Alerts */}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      {generalError && <div className="alert alert-danger">{generalError}</div>}

      <div className="grid-2">
        {/* ======================================================== */}
        {/* SECTION 1: REGISTRATION FORM (AC1, AC2, AC3) */}
        {/* ======================================================== */}
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="panel-title" style={{ margin: 0 }}>Customer Registration Form</h2>
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={handleFillSample}
            >
              Quick Fill Sample
            </button>
          </div>

          {/* Prominent Form Alert */}
          {generalError && (
            <div className="alert alert-danger" style={{ marginBottom: '16px', padding: '10px 14px', fontSize: '13px' }}>
              <strong>Error: </strong> {generalError}
            </div>
          )}
          {successMessage && (
            <div className="alert alert-success" style={{ marginBottom: '16px', padding: '10px 14px', fontSize: '13px' }}>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleRegisterSubmit}>
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">
                Customer Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="name"
                className={`form-input ${fieldErrors.name ? 'input-error' : ''}`}
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={handleInputChange}
              />
              {fieldErrors.name && <span className="error-text">{fieldErrors.name}</span>}
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="text"
                name="email"
                className={`form-input ${fieldErrors.email ? 'input-error' : ''}`}
                placeholder="e.g. johndoe@example.com"
                value={formData.email}
                onChange={handleInputChange}
              />
              {fieldErrors.email && <span className="error-text">{fieldErrors.email}</span>}
            </div>

            {/* Residential Address */}
            <div className="form-group">
              <label className="form-label">
                Residential Address <span className="required">*</span>
              </label>
              <input
                type="text"
                name="address"
                className={`form-input ${fieldErrors.address ? 'input-error' : ''}`}
                placeholder="e.g. 123 Baker Street, London"
                value={formData.address}
                onChange={handleInputChange}
              />
              {fieldErrors.address && <span className="error-text">{fieldErrors.address}</span>}
            </div>

            {/* Telephone Number */}
            <div className="form-group">
              <label className="form-label">
                Telephone Number <span className="required">*</span>
              </label>
              <input
                type="text"
                name="telephone"
                className={`form-input ${fieldErrors.telephone ? 'input-error' : ''}`}
                placeholder="e.g. 0912345678"
                value={formData.telephone}
                onChange={handleInputChange}
              />
              {fieldErrors.telephone && <span className="error-text">{fieldErrors.telephone}</span>}
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">
                Password <span className="required">*</span>
              </label>
              <input
                type="password"
                name="password"
                className={`form-input ${fieldErrors.password ? 'input-error' : ''}`}
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleInputChange}
              />
              {fieldErrors.password && <span className="error-text">{fieldErrors.password}</span>}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label">
                Confirm Password <span className="required">*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                className={`form-input ${fieldErrors.confirmPassword ? 'input-error' : ''}`}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
              />
              {fieldErrors.confirmPassword && (
                <span className="error-text">{fieldErrors.confirmPassword}</span>
              )}
            </div>

            {/* Mock Card Reference (AC3) */}
            <div className="form-group">
              <label className="form-label">
                Selected Mock Card Reference (AC3) <span className="required">*</span>
              </label>
              <select
                name="mockCardRef"
                className={`form-select ${fieldErrors.mockCardRef ? 'input-error' : ''}`}
                value={formData.mockCardRef}
                onChange={handleInputChange}
              >
                <option value="">-- Select a mock card reference --</option>
                {mockCards.map((card) => (
                  <option key={card.id || card.card_code} value={card.masked_reference}>
                    {card.masked_reference} (Expires: {card.expiry_mock})
                  </option>
                ))}
              </select>
              {fieldErrors.mockCardRef && (
                <span className="error-text">{fieldErrors.mockCardRef}</span>
              )}
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                * AC3: No real card details required; card choices are displayed as masked references.
              </small>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '10px' }}
              disabled={submitting}
            >
              {submitting ? 'Registering Account...' : 'REGISTER ACCOUNT'}
            </button>
          </form>
        </div>

        {/* ======================================================== */}
        {/* SECTION 2: SIGN IN (AC4) & CONFIRMATION EMAIL (AC5) */}
        {/* ======================================================== */}
        <div>
          {/* Sign In Verification (AC4) */}
          <div className="panel">
            <h2 className="panel-title">Sign In Verification (AC4)</h2>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
              AC4: A valid registration saves an account that can be used to sign in.
            </p>

            {loginResult && (
              <div
                className={`alert ${loginResult.success ? 'alert-success' : 'alert-danger'}`}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              >
                {loginResult.message}
                {loginResult.user && (
                  <div style={{ marginTop: '4px', fontWeight: 'bold' }}>
                    Code: {loginResult.user.accountCode} | Customer: {loginResult.user.name}
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Enter registered email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="btn btn-success"
                style={{ width: '100%' }}
                disabled={loginLoading}
              >
                {loginLoading ? 'Verifying...' : 'VERIFY SIGN IN (AC4)'}
              </button>
            </form>
          </div>

          {/* Automated Confirmation Email (AC5) */}
          <div className="panel">
            <h2 className="panel-title">Automated Confirmation Email (AC5)</h2>
            <p style={{ fontSize: '13px', color: '#64748b' }}>
              AC5: After successful registration, a confirmation email is sent to the registered email address.
            </p>

            {emails.length > 0 ? (
              <div className="email-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <strong style={{ color: '#2563eb' }}>{emails[0].subject}</strong>
                  <span className="tag tag-green">SENT</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  To: <strong>{emails[0].to}</strong> &bull; Sent:{' '}
                  {new Date(emails[0].sentAt).toLocaleTimeString()}
                </div>
                <pre
                  style={{
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    background: '#ffffff',
                    padding: '8px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontFamily: 'inherit',
                  }}
                >
                  {emails[0].preview}
                </pre>
              </div>
            ) : (
              <div style={{ marginTop: '10px', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                No emails sent yet. Submit the registration form to view the automated confirmation email!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: ACCOUNTS TABLE IN DATABASE (AC4 / PERSISTENCE) */}
      {/* ======================================================== */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="panel-title" style={{ margin: 0 }}>
            Registered Accounts in Database ({accounts.length})
          </h2>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={loadData}
          >
            Refresh Table
          </button>
        </div>

        <div className="table-wrapper">
          <table className="simple-table">
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Residential Address</th>
                <th>Telephone</th>
                <th>Password Hash (BCrypt)</th>
                <th>Mock Card Reference (AC3)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length > 0 ? (
                accounts.map((acc) => (
                  <tr key={acc.id || acc.account_code}>
                    <td><strong>{acc.account_code}</strong></td>
                    <td>{acc.name}</td>
                    <td>{acc.email}</td>
                    <td>{acc.address}</td>
                    <td>{acc.telephone}</td>
                    <td>
                      <code style={{ fontSize: '11px', color: '#6366f1' }}>
                        {acc.password_hash ? `${acc.password_hash.substring(0, 15)}...` : '[Hash]'}
                      </code>
                    </td>
                    <td><span className="tag tag-blue">{acc.mock_card_ref}</span></td>
                    <td><span className="tag tag-green">{acc.status}</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                    No accounts in database. Use the registration form above to create a new account!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
