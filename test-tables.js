const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(async () => {
    const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '' ORDER BY table_name`);
    console.log('Tables:', res.rows.map(r => r.table_name).join(', '));
  })
  .catch(err => {
    console.error('Error:', err.message);
  })
  .finally(() => {
    client.end();
  });