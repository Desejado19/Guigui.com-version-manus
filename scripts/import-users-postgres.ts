import { readSnapshot, runImportFromCli, type ImportPool } from './importRunner';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'business' | 'admin';
  phone?: string;
  neighborhood?: string;
  avatarUrl?: string;
  passwordHash: string;
  createdAt?: string;
  accountStatus?: 'active' | 'deactivated';
}

interface AuthSnapshot {
  users?: AuthUser[];
}

const source = readSnapshot<AuthSnapshot>('auth.json', {});
const users = Array.isArray(source.users) ? source.users : [];

async function importUser(user: AuthUser, pool: ImportPool): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO users (id, name, email, phone, neighborhood, avatar_url, role, account_status, password_hash, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     ON CONFLICT (id) DO NOTHING`,
    [user.id, user.name, user.email.toLowerCase(), user.phone || '', user.neighborhood || '', user.avatarUrl || null, user.role, user.accountStatus || 'active', user.passwordHash, user.createdAt || new Date().toISOString()],
  );
  return result.rowCount === 1;
}

await runImportFromCli({
  label: 'utilizadores',
  records: users,
  recordKey: (user) => user.id,
  validateRecord: (user) => Boolean(
    user
    && typeof user.id === 'string'
    && user.id.trim()
    && typeof user.name === 'string'
    && typeof user.email === 'string'
    && typeof user.passwordHash === 'string'
    && ['user', 'business', 'admin'].includes(user.role)
    && (!user.accountStatus || ['active', 'deactivated'].includes(user.accountStatus)),
  ),
  hasConflict: async (user, pool) => (
    await pool.query(
      'SELECT 1 FROM users WHERE id = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
      [user.id, user.email],
    )
  ).rows.length > 0,
  importRecord: (user, pool) => importUser(user, pool),
});
