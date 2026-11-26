import { readSnapshot, runImport, type ImportPool } from './importRunner';

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

async function importUser(user: AuthUser, pool: ImportPool): Promise<void> {
  await pool.query(
    `INSERT INTO users (id, name, email, phone, neighborhood, avatar_url, role, account_status, password_hash, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone,
     neighborhood=EXCLUDED.neighborhood, avatar_url=EXCLUDED.avatar_url, role=EXCLUDED.role,
     account_status=EXCLUDED.account_status, password_hash=EXCLUDED.password_hash, updated_at=NOW()`,
    [user.id, user.name, user.email.toLowerCase(), user.phone || '', user.neighborhood || '', user.avatarUrl || null, user.role, user.accountStatus || 'active', user.passwordHash, user.createdAt || new Date().toISOString()],
  );
}

await runImport({
  label: 'utilizadores',
  records: users,
  importRecord: (user, pool) => importUser(user, pool),
  summary: (_pool, records) => `postgres-users-import: ${records.length} utilizador(es) importado(s)`,
});
