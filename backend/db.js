const { Pool, types } = require('pg');
// OID 1082 is PostgreSQL DATE; preserve DATE values as YYYY-MM-DD strings.
types.setTypeParser(1082, (val) => val);
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('onrender.com') || process.env.DATABASE_URL.includes('sslmode')
          ? { rejectUnauthorized: false }
          : false,
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      }
);

// Log unexpected errors from idle clients to avoid crashing the process
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;