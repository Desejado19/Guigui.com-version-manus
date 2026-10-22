import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const t = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
  );
  console.log('TABELAS: ' + t.rows.map((r) => r.table_name).join(', '));
  for (const r of t.rows) {
    try {
      const c = await pool.query(`SELECT COUNT(*)::int AS n FROM "${r.table_name}"`);
      console.log(`${r.table_name}: ${c.rows[0].n}`);
    } catch (e) {
      console.log(`${r.table_name}: ERRO ${(e as Error).message}`);
    }
  }
} finally {
  await pool.end();
}
