const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'hotel_user',
  password: process.env.DB_PASSWORD || 'hotel_pass',
  database: process.env.DB_NAME || 'hotel_db',
});

module.exports = pool;
