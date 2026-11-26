import 'dotenv/config?override=true';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const admins = await pool.query(
      "SELECT email, role FROM users WHERE role IN ('admin','super_admin','staff') ORDER BY role, email LIMIT 15"
    );
    console.log('=== admins/staff ===');
    console.log(JSON.stringify(admins.rows, null, 1));

    const counts = await pool.query(`
      SELECT
        (SELECT count(*) FROM users) AS users,
        (SELECT count(*) FROM users WHERE role='user') AS citizens,
        (SELECT count(*) FROM users WHERE role='business') AS business_users,
        (SELECT count(*) FROM companies) AS companies,
        (SELECT count(*) FROM companies WHERE status='active') AS companies_active,
        (SELECT count(*) FROM companies WHERE status='pending') AS companies_pending,
        (SELECT count(*) FROM categories) AS categories
    `);
    console.log('=== inventario ===');
    console.log(JSON.stringify(counts.rows[0], null, 1));
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
