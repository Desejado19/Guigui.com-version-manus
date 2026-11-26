import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Ensure the session store uses a throwaway directory and a fixed secret.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-sessions-'));
process.env.GUIGUI_DATA_DIR = tempDir;
process.env.SESSION_COOKIE_SECRET = 'unit-test-session-secret';

// The session service reads `databasePool` from ./db at import time; force it to
// null so tests exercise the JSON-file backed implementation deterministically.
vi.mock('../../server/db', () => ({ databasePool: null, databaseConfigured: false }));

type SessionModule = typeof import('../../server/modules/identity-access/infrastructure/sessionRepository');
let sessionService: SessionModule;

// The service keeps an in-memory `sessions` array loaded once at import time, so
// each test reloads the module against a freshly emptied on-disk store.
async function freshModule(): Promise<SessionModule> {
  const storePath = path.join(tempDir, 'sessions.json');
  if (fs.existsSync(storePath)) fs.rmSync(storePath, { force: true });
  vi.resetModules();
  sessionService = await import('../../server/modules/identity-access/infrastructure/sessionRepository');
  return sessionService;
}

beforeEach(async () => {
  await freshModule();
});

afterEach(() => {
  vi.resetModules();
});

describe('createSession / getSession', () => {
  it('exposes the expected cookie name', () => {
    expect(sessionService.SESSION_COOKIE_NAME).toBe('guigui_session');
  });

  it('creates a session that can be looked up by its token', async () => {
    const token = await sessionService.createSession({ userId: 'u1', role: 'user' });
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const session = await sessionService.getSession(token);
    expect(session?.userId).toBe('u1');
    expect(session?.role).toBe('user');
    expect(session?.expiresAt).toBeTruthy();
  });

  it('persists sessions to disk', async () => {
    await sessionService.createSession({ userId: 'u1', role: 'admin' });
    const storePath = path.join(tempDir, 'sessions.json');
    const raw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    expect(raw).toHaveLength(1);
    expect(raw[0].userId).toBe('u1');
  });

  it('returns null for missing or unknown tokens', async () => {
    await sessionService.createSession({ userId: 'u1', role: 'user' });
    expect(await sessionService.getSession(undefined)).toBeNull();
    expect(await sessionService.getSession('not-a-real-token')).toBeNull();
  });

  it('does not expose the raw token in the stored record', async () => {
    const token = await sessionService.createSession({ userId: 'u1', role: 'user' });
    const session = await sessionService.getSession(token);
    expect(session?.tokenHash).toBeTruthy();
    expect(JSON.stringify(session)).not.toContain(token);
  });

  it('fails to load malformed session storage instead of treating it as empty', async () => {
    fs.writeFileSync(path.join(tempDir, 'sessions.json'), '{invalid json', 'utf8');
    vi.resetModules();

    await expect(
      import('../../server/modules/identity-access/infrastructure/sessionRepository'),
    ).rejects.toThrow(SyntaxError);
  });
});

describe('revokeSession', () => {
  it('revokes a single session', async () => {
    const token = await sessionService.createSession({ userId: 'u1', role: 'user' });
    expect(await sessionService.revokeSession(token)).toBe(true);
    expect(await sessionService.getSession(token)).toBeNull();
  });

  it('returns false when the token is unknown or absent', async () => {
    expect(await sessionService.revokeSession(undefined)).toBe(false);
    expect(await sessionService.revokeSession('missing')).toBe(false);
  });

  it('does not affect other sessions', async () => {
    const a = await sessionService.createSession({ userId: 'u1', role: 'user' });
    const b = await sessionService.createSession({ userId: 'u2', role: 'business' });
    await sessionService.revokeSession(a);
    expect(await sessionService.getSession(b)).not.toBeNull();
  });
});

describe('revokeAllUserSessions', () => {
  it('revokes every active session for a user', async () => {
    const first = await sessionService.createSession({ userId: 'u1', role: 'user' });
    const second = await sessionService.createSession({ userId: 'u1', role: 'user' });
    await sessionService.createSession({ userId: 'u2', role: 'business' });

    const revoked = await sessionService.revokeAllUserSessions('u1');
    expect(revoked).toBe(2);
    expect(await sessionService.getSession(first)).toBeNull();
    expect(await sessionService.getSession(second)).toBeNull();
  });

  it('returns 0 when the user has no active sessions', async () => {
    expect(await sessionService.revokeAllUserSessions('ghost')).toBe(0);
  });
});
