const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Kiểm tra trạng thái server Backend
router.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'PrivateHire Cars Backend API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Kiểm tra trạng thái kết nối Database (Bước 2)
router.get('/db', async (req, res) => {
  const dbStatus = db.getDbStatus();
  try {
    const result = await db.query('SELECT NOW() as server_time');
    res.json({
      success: true,
      database: dbStatus,
      ping: 'PONG',
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      database: dbStatus,
      error: error.message,
    });
  }
});

module.exports = router;
