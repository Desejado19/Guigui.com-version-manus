import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hashPassword } from '../../server/modules/identity-access/infrastructure/passwordHash';

const QA_DATABASE_NAME = 'guigui_pg18_synthetic_target';
const QA_ADMIN_ID = 'qa-admin-fixture';
const QA_ADMIN_EMAIL = 'admin.teste@guigui.com';

export interface FixtureDatabase {
  query(
    statement: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export function parseQaDatabaseName(connectionString: string): string {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error('QA_DATABASE_URL must be a valid loopback PostgreSQL URL.');
  }

  if (
    (databaseUrl.protocol !== 'postgres:' && databaseUrl.protocol !== 'postgresql:')
    || !['127.0.0.1', '::1', '[::1]'].includes(databaseUrl.hostname)
  ) {
    throw new Error('QA_DATABASE_URL must use PostgreSQL on loopback.');
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  } catch {
    throw new Error('QA_DATABASE_URL must name the reserved synthetic QA database.');
  }
  if (databaseName !== QA_DATABASE_NAME) {
    throw new Error(`QA_DATABASE_URL must name ${QA_DATABASE_NAME}.`);
  }
  return databaseName;
}

export async function seedAdminFixture(
  database: FixtureDatabase,
  databaseName: string,
  password: string,
): Promise<void> {
  if (databaseName !== QA_DATABASE_NAME) {
    throw new Error(`Refusing to seed an administrator outside ${QA_DATABASE_NAME}.`);
  }
  if (!password.trim()) {
    throw new Error('QA_ADMIN_FIXTURE_PASSWORD must not be empty.');
  }

  const inserted = await database.query(
    `INSERT INTO users (id, name, email, phone, neighborhood, avatar_url, role, account_status, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, 'admin', 'active', $7)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      QA_ADMIN_ID,
      'Admin QA Sintetico',
      QA_ADMIN_EMAIL,
      '+245900000001',
      'Bissau',
      null,
      hashPassword(password),
    ],
  );
  if (inserted.rows.length !== 1) {
    throw new Error('The synthetic QA administrator could not be created; refusing to reuse an existing fixture.');
  }

  const verification = await database.query(
    `SELECT COUNT(*) AS fixture_count
     FROM users
     WHERE id = $1 AND LOWER(email) = LOWER($2) AND role = 'admin' AND account_status = 'active'`,
    [QA_ADMIN_ID, QA_ADMIN_EMAIL],
  );
  if (Number(verification.rows[0]?.fixture_count) !== 1) {
    throw new Error('The synthetic QA administrator fixture count was not exactly one.');
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.QA_DATABASE_URL?.trim();
  if (!connectionString) throw new Error('QA_DATABASE_URL is required for the admin fixture.');
  const databaseName = parseQaDatabaseName(connectionString);
  const password = process.env.QA_ADMIN_FIXTURE_PASSWORD;
  if (!password) {
    throw new Error('QA_ADMIN_FIXTURE_PASSWORD must be set locally to match the existing E2E fixture.');
  }

  const pool = new Pool({ connectionString });
  try {
    await seedAdminFixture(pool, databaseName, password);
  } finally {
    await pool.end();
  }

  console.log('Created and verified one synthetic QA administrator fixture.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(
      '[qa:fixture] Failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
