import { randomBytes } from 'node:crypto';
import { databasePool } from '../../../db';
import { hashPassword, verifyPassword } from './jsonIdentityRepository';
import type { IdentityAccountRepository } from '../application/identityAccessPorts';
import type { PublicUser } from './jsonIdentityRepository';

interface StoredPostgresUser extends PublicUser {
  passwordHash: string;
  createdAt: string;
}

function requirePool() {
  if (!databasePool) throw new Error('PostgreSQL não está configurado.');
  return databasePool;
}

function mapUser(row: Record<string, unknown>): StoredPostgresUser {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as StoredPostgresUser['role'],
    phone: String(row.phone || ''),
    neighborhood: String(row.neighborhood || ''),
    avatarUrl: String(row.avatar_url || ''),
    accountStatus: row.account_status as StoredPostgresUser['accountStatus'],
    businessId: row.business_id ? String(row.business_id) : undefined,
    passwordHash: String(row.password_hash),
    createdAt: String(row.created_at),
  };
}

export async function findPostgresUserByEmail(email: string): Promise<StoredPostgresUser | null> {
  const result = await requirePool().query('SELECT u.*, cm.company_id AS business_id FROM users u LEFT JOIN LATERAL (SELECT company_id FROM company_members WHERE user_id=u.id ORDER BY accepted_at DESC NULLS LAST LIMIT 1) cm ON TRUE WHERE LOWER(u.email) = LOWER($1) LIMIT 1', [email.trim()]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findPostgresUserById(id: string): Promise<StoredPostgresUser | null> {
  const result = await requirePool().query('SELECT u.*, cm.company_id AS business_id FROM users u LEFT JOIN LATERAL (SELECT company_id FROM company_members WHERE user_id=u.id ORDER BY accepted_at DESC NULLS LAST LIMIT 1) cm ON TRUE WHERE u.id=$1 LIMIT 1', [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createPostgresUser(input: Omit<PublicUser, 'id' | 'avatarUrl'> & { avatarUrl?: string; password: string }): Promise<StoredPostgresUser | null> {
  const pool = requirePool();
  const email = input.email.trim().toLowerCase();
  const id = `usr-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const result = await pool.query(
    `INSERT INTO users (id, name, email, phone, neighborhood, avatar_url, role, account_status, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [id, input.name.trim(), email, input.phone.trim(), input.neighborhood.trim() || 'Bissau', input.avatarUrl || null, input.role, hashPassword(input.password)],
  );
  const row = result.rows[0];
  if (!row) return null;

  const user = mapUser(row);
  if (input.role === 'business' && input.businessId) {
    try {
      await pool.query(
        `INSERT INTO company_members (company_id,user_id,member_role,accepted_at)
         VALUES ($1,$2,'manager',NOW()) ON CONFLICT (company_id,user_id) DO NOTHING`,
        [input.businessId, user.id],
      );
    } catch (error) {
      try {
        await pool.query('DELETE FROM users WHERE id=$1', [user.id]);
      } catch (rollbackError) {
        const originalMessage = error instanceof Error ? error.message : String(error);
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
        throw new Error(`Business user creation failed (${originalMessage}); account rollback failed (${rollbackMessage}).`);
      }
      throw error;
    }
    return { ...user, businessId: input.businessId };
  }
  return user;
}

export async function changePostgresUserPassword(email: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const pool = requirePool();
  const user = await findPostgresUserByEmail(email);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) return false;
  await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hashPassword(newPassword), user.id]);
  return true;
}

export async function deactivatePostgresUser(email: string): Promise<boolean> {
  const result = await requirePool().query('UPDATE users SET account_status=\'deactivated\', updated_at=NOW() WHERE LOWER(email)=LOWER($1) RETURNING id', [email.trim()]);
  return result.rowCount === 1;
}

export async function deletePostgresUser(email: string): Promise<boolean> {
  const result = await requirePool().query('DELETE FROM users WHERE LOWER(email)=LOWER($1) RETURNING id', [email.trim()]);
  return result.rowCount === 1;
}

export function createPostgresIdentityRepository(): IdentityAccountRepository {
  return {
    findByEmail: async (email) => findPostgresUserByEmail(email),
    findById: async (id) => findPostgresUserById(id),
    create: async (input) => createPostgresUser(input),
    changePassword: async (email, currentPassword, newPassword) => changePostgresUserPassword(email, currentPassword, newPassword),
    deactivate: async (email) => deactivatePostgresUser(email),
    delete: async (email) => deletePostgresUser(email),
  };
}
