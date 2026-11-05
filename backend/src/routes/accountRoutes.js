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

// [Bước 4 & 5] API Đăng ký tài khoản (AC1 - AC5)
router.post('/register', register);

// [AC4] API Đăng nhập
router.post('/login', login);

// [AC5] API xem email xác nhận đã gửi
router.get('/emails', getEmails);

// [Bước 3] Lấy danh sách tài khoản
router.get('/', getAccounts);

// [Bước 3 & AC3] Lấy danh sách thẻ giả lập theo AC
router.get('/mock-cards', getMockCards);

// [Bước 2] Endpoint test đọc/ghi dữ liệu vào database
router.get('/test-db-io', testDatabase);

// [Bước 3] Endpoint tạo tài khoản mẫu vào bảng
router.post('/seed-demo', seedDemoAccount);

module.exports = router;
