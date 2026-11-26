import 'dotenv/config?override=true';
import { Pool } from 'pg';
import { hashPassword } from '../server/modules/identity-access';

// Repoe a password do admin demo para 'Guigui2026!' (mesmo algoritmo scrypt da app)

// Ligação administrativa/migração: pode usar DATABASE_URL ou pooler/admin dedicado em ambiente real.
// Para não interferir com o pool de runtime do servidor, este script cria a sua própria ligação e
// liberta-a explicitamente no fim.
const connectionString =
  (process.env.DATABASE_POOLER_URL ?? process.env.DATABASE_URL)?.trim();
if (!connectionString) {
  console.error('ERRO: DATABASE_URL (ou DATABASE_POOLER_URL) não está definida.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
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
