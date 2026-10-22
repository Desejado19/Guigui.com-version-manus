import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const users = await pool.query(
    'SELECT role, account_status, COUNT(*)::int AS n FROM users GROUP BY role, account_status ORDER BY role',
  );
  console.log('USERS', JSON.stringify(users.rows));
  const companies = await pool.query('SELECT status, COUNT(*)::int AS n FROM companies GROUP BY status');
  console.log('COMPANIES', JSON.stringify(companies.rows));
  const demos = await pool.query(
    "SELECT email, role, account_status FROM users WHERE email IN ('admin.teste@guigui.com','cidadao.teste@guigui.com','empresa.teste@guigui.com') ORDER BY email",
  );
  console.log('DEMOS', JSON.stringify(demos.rows));
  const appState = await pool.query(
    "SELECT key, pg_column_size(value::text) AS sz FROM app_state WHERE key='guigui_businesses'",
  );
  console.log('APPSTATE_ROW', JSON.stringify(appState.rows));
  await pool.end();
}

main().catch((error) => {
  console.error('CHECK FALHOU:', error instanceof Error ? error.message : error);
  process.exit(1);
});
