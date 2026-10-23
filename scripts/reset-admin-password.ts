import 'dotenv/config';
import { Pool } from 'pg';
import { hashPassword } from '../server/modules/identity-access';

// Repoe a password do admin demo para 'Guigui2026!' (mesmo algoritmo scrypt da app)
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const email = 'admin.teste@guigui.com';
    const hash = hashPassword('Guigui2026!');
    const r = await pool.query(
      'UPDATE users SET password_hash=$1, updated_at=NOW() WHERE email=$2 RETURNING email, role',
      [hash, email]
    );
    if (r.rowCount === 0) {
      console.log('NENHUM utilizador encontrado com email:', email);
    } else {
      console.log('Password reposta para:', JSON.stringify(r.rows[0]));
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
