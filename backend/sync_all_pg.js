const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, 'src/database/schema.sql'), 'utf8');

async function syncServer(port, version) {
  try {
    const root = new Pool({
      host: '127.0.0.1',
      port: port,
      user: 'postgres',
      password: 'postgres',
      database: 'postgres',
      connectionTimeoutMillis: 2000,
    });

    await root.query("ALTER USER postgres WITH PASSWORD 'postgres';");
    
    for (const dbName of ['scrum_db', 'privatehire_db']) {
      const check = await root.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (check.rows.length === 0) {
        await root.query(`CREATE DATABASE ${dbName};`);
      }
    }
    await root.end();

    for (const dbName of ['scrum_db', 'privatehire_db']) {
      const app = new Pool({
        host: '127.0.0.1',
        port: port,
        user: 'postgres',
        password: 'postgres',
        database: dbName,
        connectionTimeoutMillis: 2000,
      });
      await app.query(sql);
      const res = await app.query('SELECT count(*) FROM accounts');
      console.log(`✅ [PostgreSQL ${version} on Port ${port}] DB "${dbName}": OK (${res.rows[0].count} accounts)`);
      await app.end();
    }
  } catch (err) {
    console.log(`ℹ️ [PostgreSQL ${version} on Port ${port}]: ${err.message}`);
  }
}

async function main() {
  await syncServer(5432, '18');
  await syncServer(5433, '14');
  await syncServer(5434, '15');
}

main();

