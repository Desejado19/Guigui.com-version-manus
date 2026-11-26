import { randomBytes } from 'node:crypto';
import { databasePool } from './db';
import { hashPassword } from './modules/identity-access';
import { normaliseEmailForAccount } from '../shared/emailAddress';
import {
  accessFromLegacyPermissions,
  legacyPermissionsFromAccess,
  normalizeTeamAccess,
  type TeamModuleAccess,
} from '../src/config/teamAccess';

/**
 * Serviço de equipas e acessos.
 *
 * Fonte de verdade do RBAC: vínculos em `company_members` (empresas) e contas
 * com `access_permissions` (equipa administrativa). Toda a validação de
 * permissões acontece no servidor; o cliente só recebe o mapa já calculado.
 * As alterações relevantes ficam em `access_changes` e em `audit_logs`.
 */

export interface CompanyMemberView {
  userId: string;
  businessId: string;
  name: string;
  email: string;
  phone: string;
  jobTitle?: string;
  role: string;
  status: string;
  access: TeamModuleAccess;
  legacyPermissions: ReturnType<typeof legacyPermissionsFromAccess>;
  createdAt: string;
  lastActiveAt?: string;
}

export interface AccessChangeInput {
  scope: 'business' | 'admin';
  companyId?: string;
  actorUserId: string;
  targetUserId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

/** Os cargos personalizados são guardados como 'custom'; a função escolhida fica no cargo (jobTitle). */
function normalizeMemberRole(role: string | undefined): string {
  const allowed = ['owner', 'manager', 'editor', 'finance', 'support', 'custom'];
  const value = String(role || '').trim().toLowerCase();
  return allowed.includes(value) ? value : 'custom';
}

function requirePool() {
  if (!databasePool) throw new Error('TEAM_ACCESS_REQUIRES_DATABASE');
  return databasePool;
}

function parseAccess(value: unknown, scope: 'business' | 'admin'): TeamModuleAccess {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return normalizeTeamAccess(JSON.parse(value), scope);
    } catch {
      return {};
    }
  }
  return normalizeTeamAccess(value, scope);
}

export async function recordAccessChange(input: AccessChangeInput): Promise<void> {
  if (!databasePool) return;
  await databasePool.query(
    `INSERT INTO access_changes (id, actor_user_id, target_user_id, company_id, scope, action, before_data, after_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      `acc-${Date.now()}-${randomBytes(3).toString('hex')}`,
      input.actorUserId || null,
      input.targetUserId || null,
      input.companyId || null,
      input.scope,
      input.action,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
    ],
  );
}

export async function listCompanyMembers(companyId: string): Promise<CompanyMemberView[]> {
  const pool = requirePool();
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.access_status, u.created_at,
            cm.company_id, cm.member_role, cm.permissions, cm.access, cm.status, cm.job_title,
            (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_session_at
       FROM company_members cm
       JOIN users u ON u.id = cm.user_id
      WHERE cm.company_id = $1
      ORDER BY u.name ASC`,
    [companyId],
  );
  return result.rows.map((row) => {
    const legacyPermissions = row.permissions && typeof row.permissions === 'object'
      ? row.permissions as { profile?: boolean; content?: boolean; events?: boolean; tickets?: boolean; billing?: boolean }
      : undefined;
    const access = row.access
      ? parseAccess(row.access, 'business')
      : accessFromLegacyPermissions(legacyPermissions);
    return {
      userId: String(row.id),
      businessId: String(row.company_id),
      name: String(row.name),
      email: String(row.email),
      phone: String(row.phone || ''),
      jobTitle: row.job_title ? String(row.job_title) : undefined,
      role: String(row.member_role || 'manager'),
      status: String(row.status || row.access_status || 'active'),
      access,
      legacyPermissions: legacyPermissionsFromAccess(access),
      createdAt: new Date(row.created_at).toISOString(),
      lastActiveAt: row.last_session_at ? new Date(row.last_session_at).toISOString() : undefined,
    };
  });
}

export async function findCompanyMember(companyId: string, userId: string): Promise<CompanyMemberView | null> {
  const members = await listCompanyMembers(companyId);
  return members.find((member) => member.userId === userId) || null;
}

export interface CreateCompanyMemberInput {
  companyId: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  jobTitle?: string;
  role: string;
  access: unknown;
  status?: 'active' | 'pending';
}

export type CreateCompanyMemberResult =
  | { kind: 'created'; member: CompanyMemberView }
  | { kind: 'duplicate' }
  | { kind: 'invalid'; reason: string };

export async function createCompanyMember(input: CreateCompanyMemberInput): Promise<CreateCompanyMemberResult> {
  const pool = requirePool();
  const emailCheck = normaliseEmailForAccount(input.email);
  const email = emailCheck.email ?? '';
  const name = input.name.trim();
  if (!name || !emailCheck.ok) return { kind: 'invalid', reason: 'Indique nome e e-mail válidos.' };
  if (input.password.length < 8) return { kind: 'invalid', reason: 'A palavra-passe inicial precisa de pelo menos 8 caracteres.' };

  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
  if (existing.rowCount) return { kind: 'duplicate' };

  const access = normalizeTeamAccess(input.access, 'business');
  if (!access.overview) access.overview = ['view'];
  const userId = `usr-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const status = input.status === 'pending' ? 'pending' : 'active';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, name, email, phone, neighborhood, role, account_status, access_status, job_title, password_hash)
       VALUES ($1,$2,$3,$4,'Bissau','business','active',$5,$6,$7)`,
      [userId, name, email, input.phone?.trim() || '', status === 'pending' ? 'pending' : 'active', input.jobTitle?.trim() || null, hashPassword(input.password)],
    );
    await client.query(
      `INSERT INTO company_members (company_id, user_id, member_role, accepted_at, permissions, access, status, job_title)
       VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7)`,
      [
        input.companyId,
        userId,
        normalizeMemberRole(input.role),
        JSON.stringify(legacyPermissionsFromAccess(access)),
        JSON.stringify(access),
        status,
        input.jobTitle?.trim() || null,
      ],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  const member = await findCompanyMember(input.companyId, userId);
  if (!member) return { kind: 'invalid', reason: 'O colaborador foi criado mas o vínculo não pôde ser lido.' };
  return { kind: 'created', member };
}

export interface UpdateCompanyMemberInput {
  companyId: string;
  userId: string;
  role?: string;
  access?: unknown;
  jobTitle?: string;
  status?: 'active' | 'pending' | 'suspended' | 'disabled';
  password?: string;
}

export async function updateCompanyMember(input: UpdateCompanyMemberInput): Promise<CompanyMemberView | null> {
  const pool = requirePool();
  const member = await findCompanyMember(input.companyId, input.userId);
  if (!member) return null;

  const nextAccess = input.access !== undefined ? normalizeTeamAccess(input.access, 'business') : member.access;
  if (input.access !== undefined && !nextAccess.overview) nextAccess.overview = ['view'];
  const nextStatus = input.status || member.status;
  const nextRole = input.role ? normalizeMemberRole(input.role) : member.role;
  const nextJobTitle = input.jobTitle !== undefined ? input.jobTitle.trim() || null : (member.jobTitle || null);

  await pool.query(
    `UPDATE company_members
        SET member_role=$1, permissions=$2, access=$3, status=$4, job_title=$5, updated_at=NOW()
      WHERE company_id=$6 AND user_id=$7`,
    [
      nextRole,
      JSON.stringify(legacyPermissionsFromAccess(nextAccess)),
      JSON.stringify(nextAccess),
      nextStatus,
      nextJobTitle,
      input.companyId,
      input.userId,
    ],
  );
  await pool.query(
    'UPDATE users SET access_status=$1, job_title=$2, updated_at=NOW() WHERE id=$3',
    [nextStatus === 'invited' || nextStatus === 'pending' ? 'pending' : nextStatus, nextJobTitle, input.userId],
  );
  if (input.password && input.password.length >= 8) {
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hashPassword(input.password), input.userId]);
  }
  return findCompanyMember(input.companyId, input.userId);
}

export async function removeCompanyMember(companyId: string, userId: string): Promise<boolean> {
  const pool = requirePool();
  const result = await pool.query('DELETE FROM company_members WHERE company_id=$1 AND user_id=$2 RETURNING user_id', [companyId, userId]);
  if (!result.rowCount) return false;
  // A conta do colaborador deixa de poder autenticar-se na plataforma.
  await pool.query("UPDATE users SET access_status='disabled', account_status='deactivated', updated_at=NOW() WHERE id=$1", [userId]);
  return true;
}

export interface AccessActivityEntry {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  targetUserId: string | null;
  targetName: string | null;
  createdAt: string;
  scope: string;
}

export async function listAccessActivity(companyId: string, limit = 50): Promise<AccessActivityEntry[]> {
  const pool = requirePool();
  const result = await pool.query(
    `SELECT c.id, c.action, c.actor_user_id, c.target_user_id, c.created_at, c.scope,
            actor.name AS actor_name, target.name AS target_name
       FROM access_changes c
       LEFT JOIN users actor ON actor.id = c.actor_user_id
       LEFT JOIN users target ON target.id = c.target_user_id
      WHERE c.company_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2`,
    [companyId, Math.min(Math.max(limit, 1), 200)],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    action: String(row.action),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorName: row.actor_name ? String(row.actor_name) : null,
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    targetName: row.target_name ? String(row.target_name) : null,
    createdAt: new Date(row.created_at).toISOString(),
    scope: String(row.scope),
  }));
}

/** Histórico das alterações de acesso da equipa administrativa. */
export async function listAdminAccessActivity(limit = 50): Promise<AccessActivityEntry[]> {
  const pool = requirePool();
  const result = await pool.query(
    `SELECT c.id, c.action, c.actor_user_id, c.target_user_id, c.created_at, c.scope,
            actor.name AS actor_name, target.name AS target_name
       FROM access_changes c
       LEFT JOIN users actor ON actor.id = c.actor_user_id
       LEFT JOIN users target ON target.id = c.target_user_id
      WHERE c.scope = 'admin'
      ORDER BY c.created_at DESC
      LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    action: String(row.action),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorName: row.actor_name ? String(row.actor_name) : null,
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    targetName: row.target_name ? String(row.target_name) : null,
    createdAt: new Date(row.created_at).toISOString(),
    scope: String(row.scope),
  }));
}

// ---------------------------------------------------------------------------
// Equipa administrativa da plataforma
// ---------------------------------------------------------------------------

export interface AdminStaffView {
  userId: string;
  name: string;
  email: string;
  phone: string;
  jobTitle?: string;
  role: string;
  status: string;
  access: TeamModuleAccess;
  createdAt: string;
  lastActiveAt?: string;
}

export async function listAdminStaff(): Promise<AdminStaffView[]> {
  const pool = requirePool();
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.job_title, u.access_status, u.access_preset,
            u.access_permissions, u.created_at,
            (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_session_at
       FROM users u
      WHERE u.role = 'admin'
      ORDER BY u.name ASC`,
  );
  return result.rows.map((row) => ({
    userId: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone || ''),
    jobTitle: row.job_title ? String(row.job_title) : undefined,
    role: row.access_preset ? String(row.access_preset) : 'admin',
    status: String(row.access_status || 'active'),
    access: parseAccess(row.access_permissions, 'admin'),
    createdAt: new Date(row.created_at).toISOString(),
    lastActiveAt: row.last_session_at ? new Date(row.last_session_at).toISOString() : undefined,
  }));
}

export interface CreateAdminStaffInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  jobTitle?: string;
  preset: string;
  access: unknown;
}

export async function createAdminStaff(input: CreateAdminStaffInput): Promise<CreateCompanyMemberResult & { staff?: AdminStaffView }> {
  const pool = requirePool();
  const emailCheck = normaliseEmailForAccount(input.email);
  const email = emailCheck.email ?? '';
  if (!input.name.trim() || !emailCheck.ok) return { kind: 'invalid', reason: 'Indique nome e e-mail válidos.' };
  if (input.password.length < 8) return { kind: 'invalid', reason: 'A palavra-passe inicial precisa de pelo menos 8 caracteres.' };
  const existing = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [email]);
  if (existing.rowCount) return { kind: 'duplicate' };

  const access = normalizeTeamAccess(input.access, 'admin');
  const userId = `usr-${Date.now()}-${randomBytes(3).toString('hex')}`;
  await pool.query(
    `INSERT INTO users (id, name, email, phone, neighborhood, role, account_status, access_status, job_title, access_preset, access_permissions, password_hash)
     VALUES ($1,$2,$3,$4,'Bissau','admin','active','active',$5,$6,$7,$8)`,
    [userId, input.name.trim(), email, input.phone?.trim() || '', input.jobTitle?.trim() || null, input.preset || 'custom', JSON.stringify(access), hashPassword(input.password)],
  );
  const staff = (await listAdminStaff()).find((member) => member.userId === userId);
  if (!staff) return { kind: 'invalid', reason: 'A conta foi criada mas não pôde ser lida.' };
  return { kind: 'created', member: {
    userId: staff.userId,
    businessId: '',
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    jobTitle: staff.jobTitle,
    role: staff.role,
    status: staff.status,
    access: staff.access,
    legacyPermissions: { profile: false, content: false, events: false, tickets: false, billing: false },
    createdAt: staff.createdAt,
    lastActiveAt: staff.lastActiveAt,
  }, staff };
}

export async function updateAdminStaff(input: {
  userId: string;
  access?: unknown;
  preset?: string;
  jobTitle?: string;
  status?: 'active' | 'suspended' | 'disabled';
  password?: string;
}): Promise<AdminStaffView | null> {
  const pool = requirePool();
  const current = (await listAdminStaff()).find((member) => member.userId === input.userId);
  if (!current) return null;
  const access = input.access !== undefined ? normalizeTeamAccess(input.access, 'admin') : current.access;
  const status = input.status || current.status;
  await pool.query(
    `UPDATE users SET access_status=$1, access_permissions=$2, access_preset=$3, job_title=$4, updated_at=NOW()
      WHERE id=$5 AND role='admin'`,
    [status, JSON.stringify(access), input.preset || current.role, input.jobTitle !== undefined ? input.jobTitle.trim() || null : current.jobTitle || null, input.userId],
  );
  if (input.password && input.password.length >= 8) {
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hashPassword(input.password), input.userId]);
  }
  return (await listAdminStaff()).find((member) => member.userId === input.userId) || null;
}

export async function removeAdminStaff(userId: string): Promise<boolean> {
  const pool = requirePool();
  const result = await pool.query(
    "UPDATE users SET access_status='disabled', account_status='deactivated', updated_at=NOW() WHERE id=$1 AND role='admin' RETURNING id",
    [userId],
  );
  return result.rowCount === 1;
}
