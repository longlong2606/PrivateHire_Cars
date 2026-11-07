const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

// GET /api/services - Danh sách 6 dịch vụ mẫu với giá và thời gian cố định
router.get('/', serviceController.getServices);

// POST /api/services/quote - Tính giá vé cố định theo dịch vụ và số lượng hành khách / sức chứa xe
router.post('/quote', serviceController.calculateFare);
router.post('/calculate-fare', serviceController.calculateFare);
router.get('/calculate-fare', serviceController.calculateFare);

// POST /api/services/seed - Kích hoạt seed dữ liệu thủ công
router.post('/seed', serviceController.seedServices);

// GET /api/services/:id - Lấy chi tiết 1 dịch vụ
router.get('/:id', serviceController.getServiceById);

module.exports = router;
