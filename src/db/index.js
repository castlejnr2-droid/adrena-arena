const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false
});

async function query(sql, params = []) {
  return pool.query(sql, params);
}

module.exports = { pool, query };
