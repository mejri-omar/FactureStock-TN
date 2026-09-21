const { Pool, types } = require('pg');
// OID 1082 is PostgreSQL DATE; preserve DATE values as YYYY-MM-DD strings.
types.setTypeParser(1082, (val) => val);
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Log unexpected errors from idle clients to avoid crashing the process
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});

module.exports = pool;
