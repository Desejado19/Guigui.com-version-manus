import { createHash, randomBytes } from 'node:crypto';
import { databasePool } from './db';
import { hashPassword } from './modules/identity-access';
import { normaliseEmailForAccount } from '../shared/emailAddress';
import {
  ADMIN_ACCESS_MODULES,
  BUSINESS_ACCESS_MODULES,
  grantedModules,
  normalizeTeamAccess,
  type TeamModuleAccess,
} from '../src/config/teamAccess';

/**
 * Convites de colaboradores (Administração e Empresas).
 *
 * Fonte de verdade dos convites: `team_invitations`. O token é gerado aqui,
 * devolvido uma única vez para envio por e-mail e guardado apenas como SHA-256.
 * A ativação cria a conta no sistema de autenticação central e grava os
 * módulos definidos pelo responsável — nunca valores enviados pelo colaborador.
 */

export type InvitationScope = 'admin' | 'business';
export type InvitationStatus = 'pending' | 'sent' | 'expired' | 'accepted' | 'revoked';

export const INVITATION_TTL_HOURS = 72;

export interface TeamInvitationRecord {
  id: string;
  scope: InvitationScope;
  companyId: string | null;
  email: string;
  name: string;
  jobTitle?: string;
  role: string;
  access: TeamModuleAccess;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  sentAt?: string;
  lastSentAt?: string;
  sendCount: number;
  acceptedAt?: string;
  invitedByUserId?: string;
}

export interface PublicTeamInvitation {
  name: string;
  email: string;
  scope: InvitationScope;
  organizationName: string;
  jobTitle?: string;
  roleLabel: string;
  modules: Array<{ id: string; label: string; actions: string[] }>;
  status: InvitationStatus;
  expiresAt: string;
}

export type CreateInvitationResult =
  | { kind: 'created'; invitation: TeamInvitationRecord; token: string; renewed: boolean }
  | { kind: 'invalid'; reason: string }
  | { kind: 'account_exists' };

export type AcceptInvitationResult =
  | { kind: 'accepted'; userId: string; email: string; name: string; scope: InvitationScope; companyId: string | null }
  | { kind: 'unavailable' }
  | { kind: 'account_exists' }
  | { kind: 'invalid'; reason: string };

interface InvitationRow {
  id: string;
  scope: InvitationScope;
  company_id: string | null;
  email: string;
  name: string;
  job_title: string | null;
  role: string;
  access: unknown;
  status: string;
  expires_at: Date | string;
  created_at: Date | string;
  sent_at: Date | string | null;
  last_sent_at: Date | string | null;
  send_count: number | string | null;
  accepted_at: Date | string | null;
  invited_by: string | null;
}

function requirePool() {
  if (!databasePool) throw new Error('TEAM_ACCESS_REQUIRES_DATABASE');
  return databasePool;
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

/** Um convite aberto cuja validade passou conta como expirado, sem escrita. */
function effectiveStatus(row: InvitationRow): InvitationStatus {
  const status = String(row.status) as InvitationStatus;
  if (status === 'pending' || status === 'sent') {
    const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(String(row.expires_at));
    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) return 'expired';
  }
  return status;
}

function mapInvitation(row: InvitationRow): TeamInvitationRecord {
  return {
    id: String(row.id),
    scope: row.scope === 'admin' ? 'admin' : 'business',
    companyId: row.company_id ? String(row.company_id) : null,
    email: String(row.email),
    name: String(row.name),
    jobTitle: row.job_title ? String(row.job_title) : undefined,
    role: String(row.role),
    access: normalizeTeamAccess(row.access, row.scope === 'admin' ? 'admin' : 'business'),
    status: effectiveStatus(row),
    expiresAt: iso(row.expires_at) || new Date().toISOString(),
    createdAt: iso(row.created_at) || new Date().toISOString(),
    sentAt: iso(row.sent_at),
    lastSentAt: iso(row.last_sent_at),
    sendCount: Number(row.send_count || 0),
    acceptedAt: iso(row.accepted_at),
    invitedByUserId: row.invited_by ? String(row.invited_by) : undefined,
  };
}

function catalogueFor(scope: InvitationScope) {
  return scope === 'admin' ? ADMIN_ACCESS_MODULES : BUSINESS_ACCESS_MODULES;
}

export function invitationModuleSummary(scope: InvitationScope, access: TeamModuleAccess): Array<{ id: string; label: string; actions: string[] }> {
  const catalogue = catalogueFor(scope);
  return grantedModules(access).map((moduleId) => {
    const module = catalogue.find((candidate) => candidate.id === moduleId);
    return {
      id: moduleId,
      label: module?.label || moduleId,
      actions: Array.isArray(access[moduleId]) ? [...access[moduleId]] : ['view'],
    };
  });
}

/** Cargo legível: usa o cargo livre do convite ou o preset escolhido. */
export function invitationRoleLabel(jobTitle: string | undefined, role: string): string {
  const title = (jobTitle || '').trim();
  if (title) return title;
  return role === 'custom' ? 'Colaborador' : role;
}

export async function listTeamInvitations(scope: InvitationScope, companyId?: string | null): Promise<TeamInvitationRecord[]> {
  const pool = requirePool();
  const result = scope === 'admin'
    ? await pool.query('SELECT * FROM team_invitations WHERE scope = $1 ORDER BY created_at DESC LIMIT 200', ['admin'])
    : await pool.query('SELECT * FROM team_invitations WHERE scope = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 200', ['business', companyId || '']);
  return result.rows.map((row) => mapInvitation(row as InvitationRow));
}

export interface CreateInvitationInput {
  scope: InvitationScope;
  companyId?: string | null;
  name: string;
  email: string;
  jobTitle?: string;
  role: string;
  access: unknown;
  invitedByUserId: string;
  ttlHours?: number;
}

export async function createTeamInvitationRecord(input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const pool = requirePool();
  const emailCheck = normaliseEmailForAccount(input.email);
  const email = emailCheck.email ?? '';
  const name = input.name.trim();
  if (!name) return { kind: 'invalid', reason: 'Indique o nome completo do colaborador.' };
  if (!emailCheck.ok) return { kind: 'invalid', reason: 'Indique um e-mail válido.' };
  if (input.scope === 'business' && !input.companyId) return { kind: 'invalid', reason: 'O convite tem de estar associado a uma empresa.' };

  const access = normalizeTeamAccess(input.access, input.scope);
  if (grantedModules(access).length === 0) {
    return { kind: 'invalid', reason: 'Selecione pelo menos um módulo para o colaborador.' };
  }

  const existingAccount = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
  if (existingAccount.rowCount) return { kind: 'account_exists' };

  const token = generateToken();
  const expiresHours = Math.min(Math.max(input.ttlHours || INVITATION_TTL_HOURS, 1), 24 * 30);
  const invitedBy = input.invitedByUserId || null;

  // Reutiliza o convite aberto do mesmo e-mail: renova token e validade em vez
  // de acumular registos pendentes.
  const open = await pool.query(
    `SELECT id FROM team_invitations
      WHERE scope = $1 AND COALESCE(company_id, '') = $2 AND LOWER(email) = LOWER($3)
        AND status IN ('pending', 'sent')
      LIMIT 1`,
    [input.scope, input.companyId || '', email],
  );
  if (open.rowCount) {
    const id = String(open.rows[0].id);
    await pool.query(
      `UPDATE team_invitations
          SET name=$1, job_title=$2, role=$3, access=$4, token_hash=$5, status='pending',
              expires_at=NOW() + ($6 || ' hours')::interval, invited_by=$7, send_count=send_count+1,
              last_sent_at=NOW()
        WHERE id=$8`,
      [name, input.jobTitle?.trim() || null, input.role || 'custom', JSON.stringify(access), hashInvitationToken(token), String(expiresHours), invitedBy, id],
    );
    const updated = await pool.query('SELECT * FROM team_invitations WHERE id = $1', [id]);
    return { kind: 'created', invitation: mapInvitation(updated.rows[0] as InvitationRow), token, renewed: true };
  }

  const id = `tinv-${Date.now()}-${randomBytes(4).toString('hex')}`;
  await pool.query(
    `INSERT INTO team_invitations
       (id, scope, company_id, email, name, job_title, role, access, token_hash, status, expires_at, invited_by, send_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',NOW() + ($10 || ' hours')::interval,$11,1)`,
    [
      id,
      input.scope,
      input.scope === 'business' ? input.companyId || null : null,
      email,
      name,
      input.jobTitle?.trim() || null,
      input.role || 'custom',
      JSON.stringify(access),
      hashInvitationToken(token),
      String(expiresHours),
      invitedBy,
    ],
  );
  const created = await pool.query('SELECT * FROM team_invitations WHERE id = $1', [id]);
  return { kind: 'created', invitation: mapInvitation(created.rows[0] as InvitationRow), token, renewed: false };
}

export async function markInvitationSent(id: string): Promise<void> {
  if (!databasePool) return;
  await databasePool.query(
    "UPDATE team_invitations SET status = CASE WHEN status = 'pending' THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, NOW()), last_sent_at = NOW() WHERE id = $1",
    [id],
  );
}

function scopedWhere(scope: InvitationScope, companyId?: string | null): { clause: string; params: string[] } {
  return scope === 'admin'
    ? { clause: 'scope = $1', params: ['admin'] }
    : { clause: 'scope = $1 AND company_id = $2', params: ['business', companyId || ''] };
}

/** Reenvia: novo token, nova validade e contagem de envios. */
export async function resendTeamInvitation(id: string, scope: InvitationScope, companyId?: string | null): Promise<{ invitation: TeamInvitationRecord; token: string } | null> {
  const pool = requirePool();
  const where = scopedWhere(scope, companyId);
  const current = await pool.query(
    `SELECT * FROM team_invitations WHERE id = $${where.params.length + 1} AND ${where.clause}`,
    [...where.params, id],
  );
  if (!current.rowCount) return null;
  const row = current.rows[0] as InvitationRow;
  if (effectiveStatus(row) === 'accepted' || effectiveStatus(row) === 'revoked') return null;

  const token = generateToken();
  await pool.query(
    `UPDATE team_invitations
        SET token_hash=$1, status='sent', expires_at=NOW() + ($2 || ' hours')::interval,
            send_count=send_count+1, sent_at=COALESCE(sent_at,NOW()), last_sent_at=NOW()
      WHERE id=$3`,
    [hashInvitationToken(token), String(INVITATION_TTL_HOURS), id],
  );
  const updated = await pool.query('SELECT * FROM team_invitations WHERE id = $1', [id]);
  return { invitation: mapInvitation(updated.rows[0] as InvitationRow), token };
}

export async function revokeTeamInvitation(id: string, scope: InvitationScope, companyId?: string | null): Promise<boolean> {
  const pool = requirePool();
  const where = scopedWhere(scope, companyId);
  const result = await pool.query(
    `UPDATE team_invitations SET status='revoked'
      WHERE id = $${where.params.length + 1} AND ${where.clause} AND status IN ('pending','sent','expired')
      RETURNING id`,
    [...where.params, id],
  );
  return Boolean(result.rowCount);
}

/** Leitura pública de um convite (para a página de ativação). */
export async function inspectTeamInvitation(token: string): Promise<PublicTeamInvitation | null> {
  if (!token || token.trim().length < 32) return null;
  const pool = requirePool();
  const result = await pool.query(
    `SELECT i.*, c.name AS company_name
       FROM team_invitations i
       LEFT JOIN companies c ON c.id = i.company_id
      WHERE i.token_hash = $1
      LIMIT 1`,
    [hashInvitationToken(token)],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0] as InvitationRow & { company_name: string | null };
  const status = effectiveStatus(row);
  if (status !== 'pending' && status !== 'sent') {
    // Exposto apenas o estado, sem dados pessoais, para a página explicar o motivo.
    return {
      name: '',
      email: '',
      scope: row.scope === 'admin' ? 'admin' : 'business',
      organizationName: '',
      roleLabel: '',
      modules: [],
      status,
      expiresAt: iso(row.expires_at) || new Date().toISOString(),
    };
  }
  const scope: InvitationScope = row.scope === 'admin' ? 'admin' : 'business';
  const access = normalizeTeamAccess(row.access, scope);
  return {
    name: String(row.name),
    email: String(row.email),
    scope,
    organizationName: scope === 'admin' ? 'Administração Guigui.com' : String(row.company_name || 'Guigui.com'),
    jobTitle: row.job_title ? String(row.job_title) : undefined,
    roleLabel: invitationRoleLabel(row.job_title ? String(row.job_title) : undefined, String(row.role)),
    modules: invitationModuleSummary(scope, access),
    status,
    expiresAt: iso(row.expires_at) || new Date().toISOString(),
  };
}

export interface AcceptInvitationInput {
  token: string;
  password: string;
  phone?: string;
  neighborhood?: string;
}

/**
 * Ativa a conta: cria o utilizador no sistema central, liga-o à empresa ou ao
 * painel administrativo com os módulos do convite e consome o token uma vez.
 */
export async function acceptTeamInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult> {
  if (!input.token || input.token.trim().length < 32) return { kind: 'unavailable' };
  if (typeof input.password !== 'string' || input.password.length < 8) {
    return { kind: 'invalid', reason: 'A palavra-passe precisa de pelo menos 8 caracteres.' };
  }
  const pool = requirePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query(
      'SELECT * FROM team_invitations WHERE token_hash = $1 FOR UPDATE',
      [hashInvitationToken(input.token)],
    );
    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return { kind: 'unavailable' };
    }
    const row = found.rows[0] as InvitationRow;
    const status = effectiveStatus(row);
    if (status !== 'pending' && status !== 'sent') {
      await client.query('ROLLBACK');
      return { kind: 'unavailable' };
    }

    const email = String(row.email).trim().toLowerCase();
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return { kind: 'account_exists' };
    }

    const scope: InvitationScope = row.scope === 'admin' ? 'admin' : 'business';
    const access = normalizeTeamAccess(row.access, scope);
    if (grantedModules(access).length === 0) {
      await client.query('ROLLBACK');
      return { kind: 'invalid', reason: 'O convite não tem módulos atribuídos.' };
    }
    const userId = `usr-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const phone = (input.phone || '').trim();
    const neighborhood = (input.neighborhood || 'Bissau').trim() || 'Bissau';
    const jobTitle = row.job_title ? String(row.job_title) : null;
    const role = String(row.role || 'custom');

    await client.query(
      `INSERT INTO users (id, name, email, phone, neighborhood, role, account_status, access_status, job_title, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,'active','active',$7,$8)`,
      [userId, String(row.name), email, phone, neighborhood, scope === 'admin' ? 'admin' : 'business', jobTitle, hashPassword(input.password)],
    );

    if (scope === 'admin') {
      await client.query(
        'UPDATE users SET access_preset=$1, access_permissions=$2, updated_at=NOW() WHERE id=$3',
        [role === 'custom' ? 'staff' : role, JSON.stringify(access), userId],
      );
    } else {
      await client.query(
        `INSERT INTO company_members (company_id, user_id, member_role, invited_at, accepted_at, permissions, access, status, job_title, invited_by, updated_at)
         VALUES ($1,$2,$3,NOW(),NOW(),$4,$5,'active',$6,$7,NOW())`,
        [
          String(row.company_id),
          userId,
          ['owner', 'manager', 'editor', 'finance', 'support'].includes(role) ? role : 'custom',
          JSON.stringify({ profile: false, content: false, events: false, tickets: false, billing: false }),
          JSON.stringify(access),
          jobTitle,
          row.invited_by ? String(row.invited_by) : null,
        ],
      );
    }

    const consumed = await client.query(
      `UPDATE team_invitations
          SET status='accepted', accepted_at=NOW(), accepted_user_id=$1, token_hash=$2
        WHERE id=$3 AND status IN ('pending','sent')
        RETURNING id`,
      [userId, `used-${randomBytes(16).toString('hex')}`, String(row.id)],
    );
    if (!consumed.rowCount) {
      await client.query('ROLLBACK');
      return { kind: 'unavailable' };
    }
    await client.query('COMMIT');
    return { kind: 'accepted', userId, email, name: String(row.name), scope, companyId: row.company_id ? String(row.company_id) : null };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
