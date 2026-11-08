const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const AccountModel = require('../models/accountModel');
const SessionModel = require('../models/sessionModel');
const db = require('../config/db');

/**
 * [AUTH]: Sign-in with Email (or Telephone) and Password
 */
const login = async (req, res) => {
  try {
    const { email, password, rememberDevice } = req.body;

    // 1. Kiểm tra tham số đầu vào
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const trimmedIdentifier = email.trim();

    // Kiểm tra định dạng email hợp lệ (RFC regex) hoặc số điện thoại
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const isPhone = /^[0-9+() -]{8,20}$/.test(trimmedIdentifier);
    if (!EMAIL_REGEX.test(trimmedIdentifier) && !isPhone) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_EMAIL_FORMAT',
        message: 'Invalid email format (e.g. user@example.com)',
      });
    }

    // 2. Tìm tài khoản theo Email hoặc Số điện thoại
    let account = await AccountModel.findByEmail(trimmedIdentifier);
    if (!account) {
      // Tìm thử theo số điện thoại (hỗ trợ trường "Email or Mobile Number")
      const phoneRes = await db.query(
        'SELECT * FROM accounts WHERE telephone = $1 LIMIT 1',
        [trimmedIdentifier]
      );
      if (phoneRes.rows && phoneRes.rows.length > 0) {
        account = phoneRes.rows[0];
      }
    }

    if (!account) {
      return res.status(401).json({
        success: false,
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account does not exist. Please check your email or register.',
      });
    }

    // 3. So khớp mật khẩu với BCrypt Hash đã lưu trong Database
    const isMatch = await bcrypt.compare(password, account.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_PASSWORD',
        message: 'Incorrect password. Invalid email or password.',
      });
    }

    // 4. Tạo Session Token ngẫu nhiên chuẩn mã hóa an toàn (Cryptographically secure)
    const sessionToken = 'sess_' + crypto.randomBytes(32).toString('hex');

    // 5. Tính thời gian hết hạn (Remember device: 14 ngày, bình thường: 24 giờ)
    const durationDays = rememberDevice ? 14 : 1;
    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const clientIp = req.ip || req.connection.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;

    // 6. Lưu Session vào cơ sở dữ liệu
    await SessionModel.create({
      accountId: account.id,
      sessionToken,
      expiresAt,
      ipAddress: clientIp,
      userAgent: userAgent ? userAgent.substring(0, 250) : null,
    });

    // 7. Trả về kết quả đăng nhập thành công kèm Session Token
    res.json({
      success: true,
      message: `Sign in successful! Welcome back ${account.name}.`,
      sessionToken,
      expiresAt,
      user: {
        id: account.id,
        accountCode: account.account_code,
        name: account.name,
        email: account.email,
        telephone: account.telephone,
        address: account.address,
        mockCardRef: account.mock_card_ref,
        role: account.role || 'CUSTOMER',
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

/**
 * [AUTH]: Sign-out (Hủy phiên đăng nhập hiện tại)
 */
const logout = async (req, res) => {
  try {
    let token = null;

    // Lấy token từ header hoặc body
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    if (!token && req.headers['x-session-token']) {
      token = req.headers['x-session-token'].trim();
    }
    if (!token && req.body && req.body.sessionToken) {
      token = req.body.sessionToken.trim();
    }

    if (token) {
      await SessionModel.deleteByToken(token);
    }

    res.json({
      success: true,
      message: 'Signed out successfully. Session invalidated.',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during sign out',
      error: error.message,
    });
  }
};

/**
 * [AUTH]: Lấy thông tin phiên hiện tại (Check Session)
 */
const getSession = async (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: req.user,
    sessionToken: req.sessionToken,
  });
};

/**
 * [CUSTOMER PROTECTED ENDPOINT]: Xem thông tin chi tiết khách hàng
 * Được bảo vệ bởi authorizeCustomerAccess: Khách chỉ được xem thông tin của chính mình!
 */
const getCustomerProfile = async (req, res) => {
  try {
    const customerId = req.params.id;
    const account = await AccountModel.findById(customerId);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    res.json({
      success: true,
      customer: {
        id: account.id,
        accountCode: account.account_code,
        name: account.name,
        email: account.email,
        address: account.address,
        telephone: account.telephone,
        mockCardRef: account.mock_card_ref,
        role: account.role || 'CUSTOMER',
        status: account.status,
        createdAt: account.created_at,
      },
    });
  } catch (error) {
    console.error('Error in getCustomerProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving customer profile',
      error: error.message,
    });
  }
};

module.exports = {
  login,
  logout,
  getSession,
  getCustomerProfile,
};

