import { randomBytes } from 'node:crypto';
import { databasePool } from '../../../db';
import { accessFromLegacyPermissions, normalizeTeamAccess } from '../../../../src/config/teamAccess';
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

function parseJsonColumn(value: unknown): unknown {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

function mapUser(row: Record<string, unknown>): StoredPostgresUser {
  // O titular da empresa (companies.owner_user_id) tem sempre acesso total,
  // mesmo que exista um vínculo em company_members como 'manager'.
  const isCompanyOwner = Boolean(row.company_owner_user_id && row.id && String(row.company_owner_user_id) === String(row.id));
  const legacyPermissions = isCompanyOwner ? undefined : parseJsonColumn(row.member_permissions) as StoredPostgresUser['teamPermissions'] | undefined;
  const rawAccess = isCompanyOwner ? undefined : parseJsonColumn(row.member_access);
  // Só é colaborador restringido quem tem um acesso explícito (novo RBAC) ou as
  // permissões legadas preenchidas. Vínculos antigos sem permissões continuam a
  // ser tratados como titulares, preservando as contas já existentes.
  const hasLegacyPermissions = Boolean(legacyPermissions && typeof legacyPermissions === 'object' && Object.keys(legacyPermissions).length > 0);
  const hasExplicitAccess = Boolean(rawAccess) || hasLegacyPermissions;
  const teamRole = !isCompanyOwner && hasExplicitAccess && row.member_role
    ? String(row.member_role) as StoredPostgresUser['teamRole']
    : undefined;
  const teamAccess = rawAccess
    ? normalizeTeamAccess(rawAccess, 'business')
    : (legacyPermissions ? accessFromLegacyPermissions(legacyPermissions) : undefined);
  const adminAccess = parseJsonColumn(row.access_permissions);
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as StoredPostgresUser['role'],
    phone: String(row.phone || ''),
    neighborhood: String(row.neighborhood || ''),
    avatarUrl: String(row.avatar_url || ''),
    accountStatus: row.account_status as StoredPostgresUser['accountStatus'],
    accessStatus: (row.access_status ? String(row.access_status) : 'active') as StoredPostgresUser['accessStatus'],
    jobTitle: row.member_job_title
      ? String(row.member_job_title)
      : (row.job_title ? String(row.job_title) : undefined),
    businessId: row.business_id ? String(row.business_id) : undefined,
    teamRole,
    teamPermissions: hasLegacyPermissions ? legacyPermissions : undefined,
    teamAccess: teamRole ? teamAccess : undefined,
    adminAccess: adminAccess ? normalizeTeamAccess(adminAccess, 'admin') : undefined,
    passwordHash: String(row.password_hash),
    createdAt: String(row.created_at),
  };
}

const USER_WITH_MEMBERSHIP_SELECT = `SELECT u.*, cm.company_id AS business_id, cm.member_role, cm.permissions AS member_permissions,
       cm.access AS member_access, cm.job_title AS member_job_title, cm.status AS member_status,
       (SELECT c.owner_user_id FROM companies c WHERE c.id = cm.company_id) AS company_owner_user_id
  FROM users u
  LEFT JOIN LATERAL (
    SELECT company_id, member_role, permissions, access, job_title, status
      FROM company_members WHERE user_id=u.id
     ORDER BY accepted_at DESC NULLS LAST LIMIT 1
  ) cm ON TRUE`;

export async function findPostgresUserByEmail(email: string): Promise<StoredPostgresUser | null> {
  const result = await requirePool().query(`${USER_WITH_MEMBERSHIP_SELECT} WHERE LOWER(u.email) = LOWER($1) LIMIT 1`, [email.trim()]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findPostgresUserById(id: string): Promise<StoredPostgresUser | null> {
  const result = await requirePool().query(`${USER_WITH_MEMBERSHIP_SELECT} WHERE u.id=$1 LIMIT 1`, [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createPostgresUser(input: Omit<PublicUser, 'id' | 'avatarUrl'> & { avatarUrl?: string; password: string }): Promise<StoredPostgresUser | null> {
  const pool = requirePool();
  const email = input.email.trim().toLowerCase();
  const id = `usr-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const result = await pool.query(
    `INSERT INTO users (id, name, email, phone, neighborhood, avatar_url, role, account_status, password_hash, access_status, job_title, access_permissions)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      id,
      input.name.trim(),
      email,
      input.phone.trim(),
      input.neighborhood.trim() || 'Bissau',
      input.avatarUrl || null,
      input.role,
      hashPassword(input.password),
      input.accessStatus || 'active',
      input.jobTitle || null,
      input.adminAccess ? JSON.stringify(input.adminAccess) : null,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;

  const user = mapUser(row);
  if (input.role === 'business' && input.businessId) {
    try {
      await pool.query(
        `INSERT INTO company_members (company_id,user_id,member_role,accepted_at,permissions,access,status,job_title)
         VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7) ON CONFLICT (company_id,user_id) DO UPDATE
           SET member_role=EXCLUDED.member_role, permissions=EXCLUDED.permissions, access=EXCLUDED.access,
               status=EXCLUDED.status, job_title=EXCLUDED.job_title, updated_at=NOW()`,
        [
          input.businessId,
          user.id,
          input.teamRole || 'manager',
          input.teamPermissions ? JSON.stringify(input.teamPermissions) : null,
          input.teamAccess ? JSON.stringify(input.teamAccess) : null,
          input.accessStatus || 'active',
          input.jobTitle || null,
        ],
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
    return {
      ...user,
      businessId: input.businessId,
      teamRole: input.teamRole,
      teamPermissions: input.teamPermissions,
      teamAccess: input.teamAccess ?? (input.teamPermissions ? accessFromLegacyPermissions(input.teamPermissions) : undefined),
      jobTitle: input.jobTitle,
      accessStatus: input.accessStatus || 'active',
    };
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
