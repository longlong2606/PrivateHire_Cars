const db = require('../config/db');

/**
 * Service Model
 * Implements Table 8: Demonstration fares and journey durations
 * 
 * Rules:
 * - 6 Fixed Services
 * - Four-passenger vehicle fare (GBP)
 * - Seven-passenger vehicle fare (GBP)
 * - Occupied duration (minutes)
 * - Fares are based on service and vehicle capacity, NOT travel distance.
 */
class ServiceModel {
  /**
   * Seed definitions from Table 8
   */
  static DEMO_SERVICES = [
    {
      service_code: 'LOCAL_JOURNEY',
      service_name: 'Local journey',
      description: 'Standard urban travel within local city boundaries.',
      four_passenger_fare: 20.00,
      seven_passenger_fare: 30.00,
      occupied_duration_minutes: 60,
      currency: 'GBP',
    },
    {
      service_code: 'LONG_DISTANCE_JOURNEY',
      service_name: 'Long-distance journey',
      description: 'Intercity transit and long-range chauffeured travel.',
      four_passenger_fare: 80.00,
      seven_passenger_fare: 120.00,
      occupied_duration_minutes: 180,
      currency: 'GBP',
    },
    {
      service_code: 'AIRPORT_TRANSFER',
      service_name: 'Airport transfer',
      description: 'Punctual point-to-point airport dropoff or pickup.',
      four_passenger_fare: 45.00,
      seven_passenger_fare: 65.00,
      occupied_duration_minutes: 90,
      currency: 'GBP',
    },
    {
      service_code: 'HOTEL_TRANSFER',
      service_name: 'Hotel transfer',
      description: 'Hotel pickup, luggage assistance, and hospitality transfer.',
      four_passenger_fare: 30.00,
      seven_passenger_fare: 45.00,
      occupied_duration_minutes: 60,
      currency: 'GBP',
    },
    {
      service_code: 'AIRPORT_MEET_AND_GREET',
      service_name: 'Airport meet-and-greet',
      description: 'Terminal personalized arrival greeting, flight delay monitoring, and luggage handling.',
      four_passenger_fare: 55.00,
      seven_passenger_fare: 80.00,
      occupied_duration_minutes: 120,
      currency: 'GBP',
    },
    {
      service_code: 'DRIVER_CAR_DAILY_HIRE',
      service_name: 'Driver and car daily hire',
      description: 'Full-day dedicated chauffeur and vehicle hire at client disposal.',
      four_passenger_fare: 200.00,
      seven_passenger_fare: 280.00,
      occupied_duration_minutes: 480,
      currency: 'GBP',
    },
  ];

  /**
   * Lấy toàn bộ 6 dịch vụ đang hoạt động
   */
  static async getAll() {
    const sql = `
      SELECT 
        id,
        service_code,
        service_name,
        description,
        four_passenger_fare,
        seven_passenger_fare,
        occupied_duration_minutes,
        currency,
        is_active,
        created_at,
        updated_at
      FROM services 
      WHERE is_active = TRUE 
      ORDER BY id ASC
    `;
    const result = await db.query(sql);
    return result.rows;
  }

  /**
   * Lấy dịch vụ theo ID
   */
  static async findById(id) {
    const sql = `SELECT * FROM services WHERE id = $1`;
    const result = await db.query(sql, [id]);
    return result.rows[0] || null;
  }

  /**
   * Lấy dịch vụ theo Code hoặc Name
   */
  static async findByCodeOrName(identifier) {
    if (!identifier) return null;
    const str = String(identifier).trim();
    
    // Nếu là số, thử tìm theo ID
    if (/^\d+$/.test(str)) {
      const byId = await this.findById(parseInt(str, 10));
      if (byId) return byId;
    }

    const sql = `
      SELECT * FROM services 
      WHERE UPPER(service_code) = UPPER($1) 
         OR UPPER(service_name) = UPPER($1)
      LIMIT 1
    `;
    const result = await db.query(sql, [str]);
    return result.rows[0] || null;
  }

  /**
   * Tính giá vé cố định và thời gian di chuyển dựa trên dịch vụ và sức chứa xe (4 chỗ vs 7 chỗ)
   * Đặc tả: "it is not calculated from actual travel distance."
   */
  static async calculateFareAndDuration(serviceIdentifier, vehicleCapacity = 4) {
    const service = await this.findByCodeOrName(serviceIdentifier);
    if (!service) {
      throw new Error(`Service "${serviceIdentifier}" not found.`);
    }

    // Chuẩn hóa sức chứa xe: 4 chỗ hoặc 7 chỗ
    const capNum = parseInt(vehicleCapacity, 10);
    const isSevenSeater = capNum > 4 || String(vehicleCapacity).toLowerCase().includes('seven') || String(vehicleCapacity).toLowerCase().includes('7');
    
    const capacity = isSevenSeater ? 7 : 4;
    const capacityLabel = isSevenSeater ? 'Seven-passenger vehicle' : 'Four-passenger vehicle';
    const fare = isSevenSeater 
      ? parseFloat(service.seven_passenger_fare) 
      : parseFloat(service.four_passenger_fare);

    return {
      serviceId: service.id,
      serviceCode: service.service_code,
      serviceName: service.service_name,
      description: service.description,
      vehicleCapacity: capacity,
      vehicleCapacityLabel: capacityLabel,
      fixedFare: fare,
      currency: service.currency || 'GBP',
      formattedFare: `£${fare.toFixed(2)}`,
      occupiedDurationMinutes: service.occupied_duration_minutes,
      durationFormatted: `${service.occupied_duration_minutes} minutes`,
      calculationBasis: 'Fixed sample fare by service and vehicle capacity (not calculated from travel distance)',
    };
  }

  /**
   * Khởi tạo và đảm bảo 6 dịch vụ mẫu luôn có trong cơ sở dữ liệu (Idempotent seed)
   */
  static async seedServices() {
    for (const s of this.DEMO_SERVICES) {
      const sql = `
        INSERT INTO services (
          service_code, 
          service_name, 
          description, 
          four_passenger_fare, 
          seven_passenger_fare, 
          occupied_duration_minutes, 
          currency, 
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (service_code) DO UPDATE SET
          service_name = EXCLUDED.service_name,
          description = EXCLUDED.description,
          four_passenger_fare = EXCLUDED.four_passenger_fare,
          seven_passenger_fare = EXCLUDED.seven_passenger_fare,
          occupied_duration_minutes = EXCLUDED.occupied_duration_minutes,
          currency = EXCLUDED.currency,
          is_active = EXCLUDED.is_active,
          updated_at = CURRENT_TIMESTAMP
      `;
      await db.query(sql, [
        s.service_code,
        s.service_name,
        s.description,
        s.four_passenger_fare,
        s.seven_passenger_fare,
        s.occupied_duration_minutes,
        s.currency,
        true,
      ]);
    }
    return await this.getAll();
  }
}

module.exports = ServiceModel;

