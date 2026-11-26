import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { databasePool } from '../../../db';
import type { IdentitySessionRepository } from '../application/identityAccessPorts';
import type { StoredSession as IdentityStoredSession } from '../domain/identityTypes';

const dataDirectory = process.env.GUIGUI_DATA_DIR || path.resolve(process.cwd(), 'data');
const sessionStorePath = path.join(dataDirectory, 'sessions.json');
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
// O token de sessão é guardado apenas como HMAC, por isso um segredo diferente
// a cada arranque invalida todas as sessões existentes (o browser recebia 401 e
// voltava ao ecrã de login em cada reinício do servidor). Em produção continua a
// ser obrigatório vir do ambiente; em desenvolvimento é gerado uma vez e
// persistido em data/.session-secret.
function resolveSessionSecret(): string | undefined {
  const provided = process.env.SESSION_COOKIE_SECRET?.trim();
  if (provided) return provided;
  if (process.env.NODE_ENV === 'production') return undefined;
  const secretPath = path.join(dataDirectory, '.session-secret');
  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing) return existing;
  } catch {
    /* ficheiro ainda não existe */
  }
  const generated = randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.writeFileSync(secretPath, generated, { encoding: 'utf8', mode: 0o600 });
  } catch {
    /* sem permissão de escrita: usa o segredo apenas neste processo */
  }
  return generated;
}

const sessionSecret = resolveSessionSecret();

export const SESSION_COOKIE_NAME = 'guigui_session';

export type StoredSession = IdentityStoredSession;

function loadSessions(): StoredSession[] {
  let contents: string;
  try {
    contents = fs.readFileSync(sessionStorePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }

  const parsed: unknown = JSON.parse(contents);
  if (!Array.isArray(parsed)) throw new Error(`Invalid session store format: ${sessionStorePath}`);
  return parsed.filter((session): session is StoredSession => (
    Boolean(session)
    && typeof session === 'object'
    && typeof (session as StoredSession).userId === 'string'
    && typeof (session as StoredSession).tokenHash === 'string'
    && typeof (session as StoredSession).expiresAt === 'string'
  ));
}

const sessions = loadSessions();

function persistSessions() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(sessionStorePath, JSON.stringify(sessions, null, 2), 'utf8');
}

function hashToken(token: string): string {
  if (!sessionSecret) throw new Error('SESSION_COOKIE_SECRET não está configurado.');
  return createHmac('sha256', sessionSecret).update(token).digest('hex');
}

function removeExpiredSessions() {
  const now = Date.now();
  const active = sessions.filter((session) => Date.parse(session.expiresAt) > now && !session.revokedAt);
  if (active.length !== sessions.length) {
    sessions.splice(0, sessions.length, ...active);
    persistSessions();
  }
}

export async function createSession(input: { userId: string; role: 'user' | 'business' | 'admin'; ipAddress?: string; userAgent?: string }): Promise<string> {
  removeExpiredSessions();
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  sessions.push({
    userId: input.userId,
    role: input.role,
    tokenHash: hashToken(token),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + sessionTtlMs).toISOString(),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent?.slice(0, 512),
  });
  if (databasePool) {
    await databasePool.query(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7)`,
      [randomBytes(16).toString('hex'), input.userId, hashToken(token), new Date(now + sessionTtlMs), new Date(now), input.ipAddress || null, input.userAgent?.slice(0, 512) || null],
    );
  }
  persistSessions();
  return token;
}

export async function getSession(token: string | undefined): Promise<StoredSession | null> {
  if (!token) return null;
  if (databasePool) {
    const result = await databasePool.query('SELECT s.user_id, u.role, s.token_hash, s.expires_at, s.revoked_at, s.created_at, s.ip_address, s.user_agent FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > NOW() LIMIT 1', [hashToken(token)]);
    const row = result.rows[0];
    return row ? { userId: row.user_id, role: row.role, tokenHash: row.token_hash, expiresAt: new Date(row.expires_at).toISOString(), createdAt: new Date(row.created_at).toISOString(), revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : undefined, ipAddress: row.ip_address || undefined, userAgent: row.user_agent || undefined } : null;
  }
  removeExpiredSessions();
  const tokenHash = hashToken(token);
  return sessions.find((session) => session.tokenHash === tokenHash && !session.revokedAt) || null;
}

export async function revokeSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const tokenHash = hashToken(token);
  if (databasePool) {
    const result = await databasePool.query('UPDATE sessions SET revoked_at=NOW() WHERE token_hash=$1 AND revoked_at IS NULL RETURNING id', [tokenHash]);
    return result.rowCount === 1;
  }
  const session = sessions.find((candidate) => candidate.tokenHash === tokenHash && !candidate.revokedAt);
  if (!session) return false;
  session.revokedAt = new Date().toISOString();
  persistSessions();
  return true;
}

export async function revokeAllUserSessions(userId: string): Promise<number> {
  if (databasePool) {
    const result = await databasePool.query(
      `UPDATE sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL RETURNING id`,
      [userId],
    );
    return result.rowCount || 0;
  }
  const revokedAt = new Date().toISOString();
  let count = 0;
  sessions.forEach((session) => {
    if (session.userId === userId && !session.revokedAt) {
      session.revokedAt = revokedAt;
      count += 1;
    }
  });
  if (count > 0) persistSessions();
  return count;
}

export interface UserSessionSummary {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Sessões activas de um utilizador, com a sessão usada no pedido marcada. */
export async function listUserSessions(userId: string, currentToken?: string): Promise<UserSessionSummary[]> {
  const currentHash = currentToken ? hashToken(currentToken) : '';
  if (databasePool) {
    const result = await databasePool.query(
      `SELECT id, token_hash, created_at, last_seen_at, expires_at, ip_address, user_agent
         FROM sessions
        WHERE user_id=$1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      current: Boolean(currentHash) && row.token_hash === currentHash,
      createdAt: new Date(row.created_at).toISOString(),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
      expiresAt: new Date(row.expires_at).toISOString(),
      ipAddress: row.ip_address || null,
      userAgent: row.user_agent || null,
    }));
  }
  removeExpiredSessions();
  return sessions
    .filter((session) => session.userId === userId && !session.revokedAt && Date.parse(session.expiresAt) > Date.now())
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .map((session) => ({
      id: session.tokenHash.slice(0, 32),
      current: session.tokenHash === currentHash,
      createdAt: session.createdAt,
      lastSeenAt: null,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
    }));
}

/** Revoga uma sessão do próprio utilizador; sessões de outras contas não são tocadas. */
export async function revokeUserSessionById(userId: string, sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  if (databasePool) {
    const result = await databasePool.query(
      `UPDATE sessions SET revoked_at=NOW()
        WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL
        RETURNING id`,
      [sessionId, userId],
    );
    return result.rowCount === 1;
  }
  const session = sessions.find(
    (candidate) => candidate.userId === userId && !candidate.revokedAt && candidate.tokenHash.slice(0, 32) === sessionId,
  );
  if (!session) return false;
  session.revokedAt = new Date().toISOString();
  persistSessions();
  return true;
}

export function createSessionRepository(): IdentitySessionRepository {
  return { createSession, getSession, revokeSession, revokeAllUserSessions };
}
