const ServiceModel = require('../models/serviceModel');
const db = require('../config/db');

/**
 * Controller quản lý dữ liệu 6 dịch vụ cố định (Table 8)
 */

// 1. Lấy danh sách 6 dịch vụ mẫu kèm độ phổ biến thực tế (booking count)
const getServices = async (req, res) => {
  try {
    let services = await ServiceModel.getAll();

    // Nếu bảng chưa có đủ 6 dịch vụ, tự động seed ngay
    if (!services || services.length < 6) {
      services = await ServiceModel.seedServices();
    }

    // Lấy số lượng đặt của từng dịch vụ từ bảng bookings
    const countsRes = await db.query(
      'SELECT service_name, COUNT(*) AS total FROM bookings GROUP BY service_name ORDER BY total DESC'
    ).catch(() => ({ rows: [] }));

    const countMap = {};
    let maxCount = 0;
    let mostPopularServiceName = null;
    for (const r of countsRes.rows) {
      const c = parseInt(r.total, 10) || 0;
      countMap[r.service_name] = c;
      if (c > maxCount) {
        maxCount = c;
        mostPopularServiceName = r.service_name;
      }
    }

    res.status(200).json({
      success: true,
      message: 'Seeded services retrieved successfully',
      count: services.length,
      currency: 'GBP',
      pricingRule: 'Fixed sample fare by service and vehicle capacity; not calculated from actual travel distance.',
      mostPopularService: mostPopularServiceName,
      services: services.map(s => {
        const fourFare = parseFloat(s.four_passenger_fare);
        const sevenFare = parseFloat(s.seven_passenger_fare);
        const bCount = countMap[s.service_name] || 0;
        const isPopular = Boolean(mostPopularServiceName && s.service_name.toLowerCase() === mostPopularServiceName.toLowerCase() && maxCount > 0);

        return {
          id: s.id,
          serviceCode: s.service_code,
          serviceName: s.service_name,
          description: s.description,
          fourPassengerFare: fourFare,
          sevenPassengerFare: sevenFare,
          occupiedDurationMinutes: parseInt(s.occupied_duration_minutes, 10),
          currency: s.currency || 'GBP',
          bookingCount: bCount,
          isMostPopular: isPopular,
          onlineDiscountPercent: 15,
          onlineFourPassengerFare: Math.round(fourFare * 0.85 * 100) / 100,
          onlineSevenPassengerFare: Math.round(sevenFare * 0.85 * 100) / 100,
          fares: {
            fourPassenger: {
              amount: fourFare,
              onlineAmount: Math.round(fourFare * 0.85 * 100) / 100,
              currency: s.currency || 'GBP',
              formatted: `£${fourFare.toFixed(2)}`,
              onlineFormatted: `£${(Math.round(fourFare * 0.85 * 100) / 100).toFixed(2)}`,
            },
            sevenPassenger: {
              amount: sevenFare,
              onlineAmount: Math.round(sevenFare * 0.85 * 100) / 100,
              currency: s.currency || 'GBP',
              formatted: `£${sevenFare.toFixed(2)}`,
              onlineFormatted: `£${(Math.round(sevenFare * 0.85 * 100) / 100).toFixed(2)}`,
            },
          },
          duration: {
            minutes: parseInt(s.occupied_duration_minutes, 10),
            formatted: `${s.occupied_duration_minutes} mins`,
          },
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve services',
      error: error.message,
    });
  }
};

// 2. Lấy chi tiết một dịch vụ
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await ServiceModel.findByCodeOrName(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: `Service with identifier "${id}" not found`,
      });
    }

    res.status(200).json({
      success: true,
      service: {
        id: service.id,
        serviceCode: service.service_code,
        serviceName: service.service_name,
        description: service.description,
        fourPassengerFare: parseFloat(service.four_passenger_fare),
        sevenPassengerFare: parseFloat(service.seven_passenger_fare),
        occupiedDurationMinutes: parseInt(service.occupied_duration_minutes, 10),
        currency: service.currency || 'GBP',
      },
    });
  } catch (error) {
    console.error('Error fetching service details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service details',
      error: error.message,
    });
  }
};

// 3. Tính báo giá và thời gian cố định dựa trên Service & Sức chứa xe (4 chỗ hoặc 7 chỗ)
const calculateFare = async (req, res) => {
  try {
    const serviceIdentifier = req.body.service || req.body.serviceId || req.body.serviceCode || req.body.serviceName || req.query.service;
    const vehicleCapacity = req.body.vehicleCapacity || req.body.capacity || req.body.passengers || req.query.capacity || 4;

    if (!serviceIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'service parameter (ID, code or name) is required to calculate fare',
      });
    }

    const quote = await ServiceModel.calculateFareAndDuration(serviceIdentifier, vehicleCapacity);

    res.status(200).json({
      success: true,
      quote,
    });
  } catch (error) {
    const isNotFound = error.message.includes('not found');
    res.status(isNotFound ? 404 : 400).json({
      success: false,
      message: error.message,
    });
  }
};

// 4. Endpoint cưỡng chế seed lại cơ sở dữ liệu
const seedServices = async (req, res) => {
  try {
    const services = await ServiceModel.seedServices();
    res.status(200).json({
      success: true,
      message: 'The six services have been seeded with fixed sample fares and durations.',
      count: services.length,
      services,
    });
  } catch (error) {
    console.error('Error seeding services:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed services',
      error: error.message,
    });
  }
};

module.exports = {
  getServices,
  getServiceById,
  calculateFare,
  seedServices,
};

