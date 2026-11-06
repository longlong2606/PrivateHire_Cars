const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initConnection } = require('./config/db');
const healthRoutes = require('./routes/healthRoutes');
const accountRoutes = require('./routes/accountRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/accounts', accountRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 SCRUM Backend API is running!',
    endpoints: {
      health: '/api/health',
      dbStatus: '/api/health/db',
      accounts: '/api/accounts',
      mockCards: '/api/accounts/mock-cards',
      testDatabaseIO: '/api/accounts/test-db-io',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
});

// Khởi chạy server và kết nối DB
const startServer = async () => {
  try {
    // Kết nối database trước khi lắng nghe port
    await initConnection();

    const server = app.listen(PORT, () => {
      console.log('=========================================================');
      console.log(`🚀 [Backend Server] Đang chạy tại: http://localhost:${PORT}`);
      console.log(`🌐 [API Docs/Health]: http://localhost:${PORT}/api/health`);
      console.log(`📊 [Database Status]: http://localhost:${PORT}/api/health/db`);
      console.log('=========================================================');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`⚠️ [Cổng ${PORT} đang bận] Một tiến trình khác đang chạy trên cổng ${PORT}.`);
        console.error(`👉 Hãy đóng cửa sổ node cũ hoặc chạy file run-all.bat để tự động giải phóng.`);
      } else {
        console.error('❌ Lỗi máy chủ:', err.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Không thể khởi động server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;

