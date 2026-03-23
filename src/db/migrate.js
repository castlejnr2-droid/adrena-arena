const fs = require('fs');
const path = require('path');
const { pool, query } = require('./index');

async function migrate() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await query(schema);
    console.log('✅ Arena database schema initialized');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
