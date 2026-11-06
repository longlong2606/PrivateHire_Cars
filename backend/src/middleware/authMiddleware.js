const SessionModel = require('../models/sessionModel');

/**
 * Middleware: requireAuth
 * Bảo vệ các endpoint của khách hàng:
 * - Chặn hoàn toàn khách vãng lai (visitors) chưa đăng nhập (Trả về 401 Unauthorized)
 * - Xác thực token phiên làm việc (Session Token) còn hiệu lực
 * - Gắn thông tin khách hàng vào `req.user`
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    // 1. Lấy token từ header Authorization (Bearer <token>)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fallback: lấy từ header x-session-token hoặc cookie/query
    if (!token && req.headers['x-session-token']) {
      token = req.headers['x-session-token'].trim();
    }
    if (!token && req.query.session_token) {
      token = req.query.session_token.trim();
    }

    // Nếu không có token -> Chặn khách vãng lai (Visitors)
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. Visitors cannot perform this operation. Please sign in or register first.',
      });
    }

    // 3. Kiểm tra tính hợp lệ và thời hạn của Session trong Database
    const session = await SessionModel.findValidSession(token);
    if (!session) {
      return res.status(401).json({
        success: false,
        code: 'SESSION_INVALID_OR_EXPIRED',
        message: 'Your session has expired or is invalid. Please sign in again.',
      });
    }

    // 4. Gắn thông tin người dùng đã xác thực vào request
    req.user = {
      id: session.account_id,
      accountCode: session.account_code,
      name: session.name,
      email: session.email,
      address: session.address,
      telephone: session.telephone,
      mockCardRef: session.mock_card_ref,
      status: session.status,
    };
    req.sessionToken = token;
    req.sessionId = session.session_id;

    next();
  } catch (error) {
    console.error('Error in requireAuth middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying session',
      error: error.message,
    });
  }
};

/**
 * Middleware: authorizeCustomerAccess
 * Bảo vệ quyền riêng tư dữ liệu (Data Isolation):
 * - Đảm bảo khách hàng chỉ có thể truy cập thông tin của chính mình
 * - Nếu khách hàng A cố tình xem thông tin của khách hàng B -> Trả về 403 Forbidden
 * 
 * @param {string} paramKey - Tên tham số URL đại diện cho ID hoặc AccountCode (mặc định: 'id')
 */
const authorizeCustomerAccess = (paramKey = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
      });
    }

    const requestedIdentifier = req.params[paramKey];
    if (!requestedIdentifier) {
      return next();
    }

    // Cho phép nếu identifier khớp với id hoặc accountCode của chính người dùng đăng nhập
    const isOwnerById = req.user.id.toString() === requestedIdentifier.toString();
    const isOwnerByCode = req.user.accountCode.toLowerCase() === requestedIdentifier.toString().toLowerCase();

    if (!isOwnerById && !isOwnerByCode) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_ACCESS',
        message: 'Access denied: Customers can access only their own protected information.',
      });
    }

    next();
  };
};

module.exports = {
  requireAuth,
  authorizeCustomerAccess,
};

