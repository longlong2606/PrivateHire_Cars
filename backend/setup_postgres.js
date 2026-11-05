const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const rootPool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
});

async function run() {
  try {
    console.log('Connecting to PostgreSQL 18 root database...');
    // 1. Reset postgres user password to 'postgres'
    await rootPool.query("ALTER USER postgres WITH PASSWORD 'postgres';");
    console.log('✅ Set password for user "postgres" to "postgres" successfully!');

    // 2. Check if scrum_db exists, if not create it
    const dbCheck = await rootPool.query("SELECT 1 FROM pg_database WHERE datname = 'scrum_db'");
    if (dbCheck.rows.length === 0) {
      await rootPool.query("CREATE DATABASE scrum_db;");
      console.log('✅ Created database "scrum_db" successfully!');
    } else {
      console.log('ℹ️ Database "scrum_db" already exists.');
    }

    // 3. Check if privatehire_db exists, if not create it as an alias / dedicated DB
    const phCheck = await rootPool.query("SELECT 1 FROM pg_database WHERE datname = 'privatehire_db'");
    if (phCheck.rows.length === 0) {
      await rootPool.query("CREATE DATABASE privatehire_db;");
      console.log('✅ Created database "privatehire_db" successfully!');
    } else {
      console.log('ℹ️ Database "privatehire_db" already exists.');
    }

    await rootPool.end();

    // 4. Connect to scrum_db and execute schema.sql
    console.log('\nConnecting to "scrum_db" to deploy tables...');
    const appPool = new Pool({
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      database: 'scrum_db',
    });

    const schemaPath = path.join(__dirname, 'src/database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await appPool.query(sql);
    console.log('✅ Applied schema.sql to "scrum_db" successfully!');

    // Verify tables
    const tables = await appPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('Tables in scrum_db:', tables.rows.map(r => r.table_name));

    // Verify accounts count
    const accCount = await appPool.query('SELECT count(*) FROM accounts;');
    console.log('Accounts in PostgreSQL:', accCount.rows[0].count);

    // Verify mock_cards count
    const cardCount = await appPool.query('SELECT count(*) FROM mock_cards;');
    console.log('Mock Cards in PostgreSQL:', cardCount.rows[0].count);

    await appPool.end();

    // 5. Connect to privatehire_db and execute schema.sql as well
    const phPool = new Pool({
      host: '127.0.0.1',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      database: 'privatehire_db',
    });
    await phPool.query(sql);
    console.log('✅ Applied schema.sql to "privatehire_db" as well!');
    await phPool.end();

    console.log('\n🎉 ALL DONE! PostgreSQL setup & database deployment complete!');
  } catch (error) {
    console.error('❌ Error during setup:', error);
  }
}

run();

