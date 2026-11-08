const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initConnection } = require('./config/db');
const healthRoutes = require('./routes/healthRoutes');
const accountRoutes = require('./routes/accountRoutes');
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const staffRoutes = require('./routes/staffRoutes');
const customerFeatureRoutes = require('./routes/customerFeatureRoutes');

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
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api', customerFeatureRoutes);
app.use('/api/customer-features', customerFeatureRoutes);

const path = require('path');
const fs = require('fs');

const frontendDir = path.join(__dirname, '../../frontend');

// Serve static frontend files (HTML, CSS, JS, images, icons)
app.use(express.static(frontendDir));

// API Root Route
app.get('/api', (req, res) => {
  res.json({
    message: '🚀 SCRUM Backend API is running!',
    endpoints: {
      health: '/api/health',
      dbStatus: '/api/health/db',
      accounts: '/api/accounts',
      mockCards: '/api/accounts/mock-cards',
      auth: {
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        session: 'GET /api/auth/session',
      },
      customers: {
        profile: 'GET /api/customers/:id (Protected: own profile only)',
      },
      bookings: {
        create: 'POST /api/bookings (Protected: visitors blocked)',
        myBookings: 'GET /api/bookings/my-bookings (Protected: own bookings only)',
        saveDraft: 'POST /api/bookings/draft (Form State Persistence: auto-saves in-progress booking)',
        getDraft: 'GET /api/bookings/draft (Restores saved booking form draft)',
        clearDraft: 'DELETE /api/bookings/draft (Clears saved booking form draft)',
      },
      services: {
        list: 'GET /api/services (6 Seeded Services with Fixed Sample Fares and Durations)',
        details: 'GET /api/services/:id',
        quote: 'POST /api/services/quote (Calculates fixed fare by service & vehicle capacity: 4 or 7 passengers)',
      },
      staff: {
        bookings: 'GET /api/staff/bookings (Staff live dispatch queue)',
        assistedBooking: 'POST /api/staff/bookings (No 15% discount for phone bookings)',
        updateStatus: 'PATCH /api/staff/bookings/:id/status (Assigned, EnRoute, Completed)',
        approachingAlert: 'POST /api/staff/bookings/:id/approaching-alert (Approaching vehicle persistent alert)',
        collectCash: 'POST /api/staff/bookings/:id/collect-cash (Confirm cash received -> Paid)',
        refunds: 'GET/POST /api/staff/refunds',
        fleet: 'GET /api/staff/fleet (Vehicles and Drivers)',
        reports: 'GET /api/staff/reports/popularity-loyalty (P08 Metrics)',
      },
      features: {
        reviews: 'POST /api/reviews (1-5 star ratings on Completed journeys)',
        enquiries: 'POST /api/enquiries (Customer support ticket)',
        notifications: 'GET /api/notifications (Approaching vehicle alerts)',
        offers: 'GET /api/offers/my (Loyalty vouchers for >= 3 completed trips)',
      },
    },
  });
});

// Root route - serve index.html (Register page)
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Catch-all route for frontend HTML navigation or 404
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Endpoint không tồn tại' });
  }
  const requestedFile = path.join(frontendDir, req.path);
  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    return res.sendFile(requestedFile);
  }
  res.sendFile(path.join(frontendDir, 'index.html'));
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

