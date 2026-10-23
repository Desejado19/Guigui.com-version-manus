import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { databasePool } from './db';

const dataDirectory = process.env.GUIGUI_DATA_DIR || path.resolve(process.cwd(), 'data');
const sessionStorePath = path.join(dataDirectory, 'sessions.json');
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_COOKIE_SECRET
  || (process.env.NODE_ENV === 'production' ? undefined : randomBytes(32).toString('hex'));

export const SESSION_COOKIE_NAME = 'guigui_session';

export interface StoredSession {
  id?: string;
  userId: string;
  role?: 'user' | 'business' | 'admin';
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

function loadSessions(): StoredSession[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(sessionStorePath, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed.filter((session): session is StoredSession => (
      Boolean(session)
      && typeof session === 'object'
      && typeof (session as StoredSession).userId === 'string'
      && typeof (session as StoredSession).tokenHash === 'string'
      && typeof (session as StoredSession).expiresAt === 'string'
    )) : [];
  } catch {
    return [];
  }
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
