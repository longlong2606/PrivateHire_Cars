const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getAccounts,
  getMockCards,
  getEmails,
  testDatabase,
  seedDemoAccount,
} = require('../controllers/accountController');
const StaffController = require('../controllers/staffController');
const { logout } = require('../controllers/authController');
const { requireAuth, requireStaff } = require('../middleware/authMiddleware');

// [Bước 4 & 5] API Đăng ký tài khoản (AC1 - AC5)
router.post('/register', register);

// [AC4] API Đăng nhập
router.post('/login', login);

// API Đăng xuất (Sign-out & hủy phiên làm việc)
router.post('/logout', logout);

// [AC5] API xem email xác nhận đã gửi
router.get('/emails', getEmails);

// [Bước 3] Lấy danh sách tài khoản (Chỉ dành cho Staff / Admin)
router.get('/', requireAuth, requireStaff, getAccounts);

// Cập nhật role tài khoản (Chỉ Admin)
router.patch('/:id/role', requireAuth, StaffController.updateAccountRole);

// [Bước 3 & AC3] Lấy danh sách thẻ giả lập theo AC
router.get('/mock-cards', getMockCards);

// [Bước 2] Endpoint test đọc/ghi dữ liệu vào database
router.get('/test-db-io', testDatabase);

// [Bước 3] Endpoint tạo tài khoản mẫu vào bảng
router.post('/seed-demo', seedDemoAccount);

module.exports = router;
