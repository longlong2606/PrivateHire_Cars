const ServiceModel = require('../models/serviceModel');

/**
 * Controller quản lý dữ liệu 6 dịch vụ cố định (Table 8)
 */

// 1. Lấy danh sách 6 dịch vụ mẫu
const getServices = async (req, res) => {
  try {
    let services = await ServiceModel.getAll();

    // Nếu bảng chưa có đủ 6 dịch vụ, tự động seed ngay
    if (!services || services.length < 6) {
      services = await ServiceModel.seedServices();
    }

    res.status(200).json({
      success: true,
      message: 'Seeded services retrieved successfully',
      count: services.length,
      currency: 'GBP',
      pricingRule: 'Fixed sample fare by service and vehicle capacity; not calculated from actual travel distance.',
      services: services.map(s => ({
        id: s.id,
        serviceCode: s.service_code,
        serviceName: s.service_name,
        description: s.description,
        fourPassengerFare: parseFloat(s.four_passenger_fare),
        sevenPassengerFare: parseFloat(s.seven_passenger_fare),
        occupiedDurationMinutes: parseInt(s.occupied_duration_minutes, 10),
        currency: s.currency || 'GBP',
        fares: {
          fourPassenger: {
            amount: parseFloat(s.four_passenger_fare),
            currency: s.currency || 'GBP',
            formatted: `£${parseFloat(s.four_passenger_fare).toFixed(2)}`,
          },
          sevenPassenger: {
            amount: parseFloat(s.seven_passenger_fare),
            currency: s.currency || 'GBP',
            formatted: `£${parseFloat(s.seven_passenger_fare).toFixed(2)}`,
          },
        },
        duration: {
          minutes: parseInt(s.occupied_duration_minutes, 10),
          formatted: `${s.occupied_duration_minutes} mins`,
        },
      })),
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

