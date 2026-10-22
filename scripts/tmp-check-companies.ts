import 'dotenv/config';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const r = await pool.query("SELECT status, COUNT(*)::int AS n FROM companies GROUP BY status ORDER BY status");
  console.log('STATUS:', JSON.stringify(r.rows));
  const seed = await pool.query("SELECT COUNT(*)::int AS n FROM companies WHERE id LIKE 'seed-co-%'");
  console.log('SEED TOTAL:', seed.rows[0].n);
  const s = await pool.query('SELECT id, name, status, category_id FROM companies ORDER BY created_at DESC LIMIT 20');
  for (const row of s.rows) console.log(`${row.id} | ${row.name} | ${row.status} | ${row.category_id}`);
  const u = await pool.query("SELECT role, COUNT(*)::int AS n FROM users GROUP BY role ORDER BY role");
  console.log('USERS:', JSON.stringify(u.rows));
} finally {
  await pool.end();
}
