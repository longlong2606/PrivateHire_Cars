/**
 * Seed 150 Executive Vehicles and 150 Licensed Chauffeurs into PostgreSQL
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('../config/db');

const FIRST_NAMES = [
  'Arthur', 'Marcus', 'Elizabeth', 'James', 'Oliver', 'William', 'Thomas', 'George', 'Alexander', 'Henry',
  'Edward', 'Charles', 'Samuel', 'Benjamin', 'Lucas', 'Daniel', 'Matthew', 'David', 'Joseph', 'Michael',
  'Robert', 'Richard', 'Anthony', 'Christopher', 'Andrew', 'Paul', 'Simon', 'Nicholas', 'Philip', 'Stephen',
  'Jonathan', 'Timothy', 'Patrick', 'Sean', 'Colin', 'Ian', 'Graham', 'Alan', 'Brian', 'Kenneth',
  'Derek', 'Trevor', 'Malcolm', 'Keith', 'Victor', 'Nigel', 'Julian', 'Adrian', 'Martin', 'Geoffrey',
  'Amir', 'Tariq', 'Farhan', 'Hassan', 'Zayn', 'Raza', 'Bilal', 'Imran', 'Rashid', 'Karim',
  'Luca', 'Matteo', 'Marco', 'Andrea', 'Antonio', 'Giovanni', 'Davide', 'Fabio', 'Roberto', 'Lorenzo',
  'Pierre', 'Jean', 'Louis', 'Henri', 'Antoine', 'Guillaume', 'Maxime', 'Nicolas', 'Julien', 'Alexandre',
  'Stefan', 'Lukas', 'Maximilian', 'Felix', 'Florian', 'Leon', 'Tobias', 'Jonas', 'Paul', 'Niklas',
  'Mateo', 'Carlos', 'Alejandro', 'Diego', 'Gabriel', 'Daniel', 'Javier', 'Adrian', 'Manuel', 'Alvaro',
  'Liam', 'Noah', 'Ethan', 'Mason', 'Logan', 'Aiden', 'Jackson', 'Elijah', 'Oliver', 'Lucas',
  'Oscar', 'Harry', 'Leo', 'Archie', 'Jack', 'Freddie', 'Alfie', 'Jacob', 'Charlie', 'Theodore',
  'Sebastian', 'Finley', 'Harrison', 'Reuben', 'Isaac', 'Evelyn', 'Arthur', 'Louis', 'Lucas', 'Roman',
  'Ronnie', 'Caleb', 'Hudson', 'Rowan', 'Rory', 'Eli', 'Miles', 'Ezra', 'Luca', 'Jasper',
  'Nathan', 'Adam', 'Aaron', 'Lewis', 'Harvey', 'Bradley', 'Connor', 'Callum', 'Jordan', 'Dominic'
];

const LAST_NAMES = [
  'Pendelton', 'Sterling', 'Clark', 'Bennett', 'Davis', 'Taylor', 'Hughes', 'Walker', 'Harrison', 'Crawford',
  'Sinclair', 'Montgomery', 'Kensington', 'Chamberlain', 'Wellington', 'Somerset', 'Beaumont', 'Fitzgerald', 'Harrington', 'Lancaster',
  'Radcliffe', 'Hawthorne', 'Blackwood', 'Ashford', 'Fairfax', 'Vanderbilt', 'Kingsley', 'Thornton', 'Whitmore', 'Cunningham',
  'Pembroke', 'Abernathy', 'Winslow', 'Lockwood', 'Huntington', 'Standish', 'Davenport', 'Ellington', 'Cartwright', 'Preston',
  'Bradford', 'Aldridge', 'Wakefield', 'Sinclair', 'Everett', 'Collingwood', 'Ravenscroft', 'Brampton', 'Ashbury', 'Holt',
  'Khan', 'Ahmed', 'Ali', 'Malik', 'Hussain', 'Chaudhry', 'Mahmood', 'Rahman', 'Siddiqui', 'Farooq',
  'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
  'Moreau', 'Laurent', 'Lefebvre', 'Mercier', 'Dupont', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Guerin',
  'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Koch', 'Bauer',
  'Garcia', 'Rodriguez', 'Gonzalez', 'Fernandez', 'Lopez', 'Martinez', 'Sanchez', 'Perez', 'Gomez', 'Martin',
  'Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Johnson', 'Davies', 'Robinson', 'Wright', 'Thompson',
  'White', 'Edwards', 'Green', 'Hall', 'Wood', 'Harris', 'Martin', 'Jackson', 'Clarke', 'Turner',
  'Hill', 'Cooper', 'Ward', 'Morris', 'King', 'Watson', 'Baker', 'Harrison', 'Morgan', 'Patel',
  'Young', 'Allen', 'Anderson', 'Phillips', 'Lee', 'Bell', 'Parker', 'Davis', 'Miller', 'Shaw',
  'Reynolds', 'Saunders', 'Barrett', 'Stevens', 'Fletcher', 'Walsh', 'Rowe', 'Pearce', 'Fuller', 'Palmer'
];

const SALOON_MODELS = [
  'Mercedes-Benz E-Class Saloon',
  'BMW 5-Series Executive',
  'Audi A6 S-Line Executive',
  'Mercedes-Benz S-Class LWB',
  'BMW 7-Series Luxury',
  'Audi A8 Quattro Executive',
  'Tesla Model S Dual Motor',
  'Jaguar XF Prestige',
  'Mercedes-Benz EQE Electric Saloon',
  'Genesis G80 Executive'
];

const MPV_MODELS = [
  'Mercedes-Benz V-Class Luxury MPV',
  'Volkswagen Caravelle Executive',
  'Mercedes-Benz Vito Tourer Premium',
  'Ford Tourneo Custom Titanium',
  'Mercedes-Benz EQV Electric Luxury MPV'
];

const COLOURS = [
  'Obsidian Black',
  'Metallic Silver',
  'Cavansite Blue',
  'Diamond White',
  'Selenite Grey',
  'Imperial Blue',
  'Iridium Silver',
  'Midnight Black',
  'Emerald Green',
  'Graphite Grey'
];

const LONDON_REG_PREFIXES = ['LD', 'LN', 'LJ', 'LA', 'LF', 'LK', 'LM', 'LO', 'LP', 'LR', 'LS', 'LT'];
const REG_YEARS = ['20', '21', '22', '23', '24', '70', '71', '72', '73', '74'];

function generateRegNumber(index) {
  const prefix = LONDON_REG_PREFIXES[index % LONDON_REG_PREFIXES.length];
  const year = REG_YEARS[Math.floor(index / LONDON_REG_PREFIXES.length) % REG_YEARS.length];
  // 3 letters from index
  const l1 = String.fromCharCode(65 + (index % 26));
  const l2 = String.fromCharCode(65 + ((Math.floor(index / 26) + 3) % 26));
  const l3 = String.fromCharCode(65 + ((Math.floor(index / (26 * 26)) + 7) % 26));
  return `${prefix}${year} ${l1}${l2}${l3}`;
}

async function runSeed() {
  console.log('--- Bắt đầu kiểm tra và bổ sung cho đủ 150 Xe & 150 Tài xế ---');

  // Chờ kết nối
  await new Promise(r => setTimeout(r, 2000));

  // 1. Kiểm tra xe hiện tại
  const vRes = await db.query('SELECT COUNT(*) FROM vehicles');
  let currentVCount = parseInt(vRes.rows[0].count, 10);
  console.log(`Hiện tại có: ${currentVCount} xe trong cơ sở dữ liệu.`);

  if (currentVCount < 150) {
    const neededVehicles = 150 - currentVCount;
    console.log(`Đang bổ sung thêm ${neededVehicles} xe để đạt đúng 150 xe...`);

    const existingRegs = new Set(
      (await db.query('SELECT reg_number FROM vehicles')).rows.map(r => r.reg_number)
    );

    let addedVehicles = 0;
    let seedIdx = 10;
    while (currentVCount + addedVehicles < 150) {
      const reg = generateRegNumber(seedIdx);
      seedIdx++;
      if (existingRegs.has(reg)) continue;

      // 70% Saloon (4 pax), 30% MPV (7 pax)
      const isMpv = (addedVehicles % 3 === 0);
      const capacity = isMpv ? 7 : 4;
      const makeModel = isMpv
        ? MPV_MODELS[addedVehicles % MPV_MODELS.length]
        : SALOON_MODELS[addedVehicles % SALOON_MODELS.length];
      const colour = COLOURS[(addedVehicles + seedIdx) % COLOURS.length];
      const status = (addedVehicles % 15 === 0) ? 'UNAVAILABLE' : 'ACTIVE';

      await db.query(
        `INSERT INTO vehicles (reg_number, make_model, colour, capacity, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (reg_number) DO NOTHING`,
        [reg, makeModel, colour, capacity, status]
      );

      existingRegs.add(reg);
      addedVehicles++;
    }
    console.log(`✅ Đã thêm ${addedVehicles} xe mới thành công!`);
  } else {
    console.log(`✅ Đã đủ 150 xe (Hiện tại: ${currentVCount} xe).`);
  }

  // 2. Kiểm tra tài xế hiện tại
  const dRes = await db.query('SELECT COUNT(*) FROM drivers');
  let currentDCount = parseInt(dRes.rows[0].count, 10);
  console.log(`Hiện tại có: ${currentDCount} tài xế trong cơ sở dữ liệu.`);

  if (currentDCount < 150) {
    const neededDrivers = 150 - currentDCount;
    console.log(`Đang bổ sung thêm ${neededDrivers} tài xế để đạt đúng 150 tài xế...`);

    const existingCodes = new Set(
      (await db.query('SELECT driver_code FROM drivers')).rows.map(r => r.driver_code)
    );

    let addedDrivers = 0;
    let drvNumber = 4;
    while (currentDCount + addedDrivers < 150) {
      const padNum = String(drvNumber).padStart(3, '0');
      const driverCode = `DRV-${padNum}`;
      drvNumber++;

      if (existingCodes.has(driverCode)) continue;

      const firstName = FIRST_NAMES[(drvNumber * 7) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(drvNumber * 11) % LAST_NAMES.length];
      const name = `${firstName} ${lastName}`;
      const telephone = `+44 7700 900${String(100 + (drvNumber % 900)).padStart(3, '0')}`;
      const referenceNumber = `TFL-PHD-${40000 + drvNumber}`;
      const status = (addedDrivers % 12 === 0) ? 'OFF_DUTY' : 'ACTIVE';

      await db.query(
        `INSERT INTO drivers (driver_code, name, telephone, reference_number, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (driver_code) DO NOTHING`,
        [driverCode, name, telephone, referenceNumber, status]
      );

      existingCodes.add(driverCode);
      addedDrivers++;
    }
    console.log(`✅ Đã thêm ${addedDrivers} tài xế mới thành công!`);
  } else {
    console.log(`✅ Đã đủ 150 tài xế (Hiện tại: ${currentDCount} tài xế).`);
  }

  // 3. Xác thực số lượng cuối cùng
  const finalV = await db.query('SELECT COUNT(*) FROM vehicles');
  const finalD = await db.query('SELECT COUNT(*) FROM drivers');
  console.log('---------------------------------------------------------');
  console.log(`🎉 KẾT QUẢ CUỐI CÙNG:`);
  console.log(`🚗 Tổng số xe (Vehicles): ${finalV.rows[0].count} / 150`);
  console.log(`👨‍✈️ Tổng số tài xế (Drivers): ${finalD.rows[0].count} / 150`);
  console.log('---------------------------------------------------------');

  process.exit(0);
}

runSeed().catch(err => {
  console.error('Lỗi khi seed xe và tài xế:', err);
  process.exit(1);
});

