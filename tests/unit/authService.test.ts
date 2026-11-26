import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate the JSON stores used by authService into a throwaway directory.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-auth-'));
process.env.GUIGUI_DATA_DIR = tempDir;

type AuthModule = typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
let auth: AuthModule;

// authService loads `store`, `demoPasswordStore`, `resetTokens` and
// `teamInvitations` once at import time, so each test reloads the module
// against a freshly emptied on-disk store for deterministic state.
async function freshModule(): Promise<AuthModule> {
  for (const file of ['auth.json', 'demo-passwords.json', 'password-reset-tokens.json', 'team-invitations.json']) {
    const full = path.join(tempDir, file);
    if (fs.existsSync(full)) fs.rmSync(full, { force: true });
  }
  vi.resetModules();
  auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  return auth;
}

beforeEach(async () => {
  await freshModule();
});

afterEach(() => {
  vi.resetModules();
});

describe('password hashing and verification (login primitive)', () => {
  it('round-trips a password', () => {
    const encoded = auth.hashPassword('CorrectHorse42');
    expect(encoded).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(auth.verifyPassword('CorrectHorse42', encoded)).toBe(true);
  });

  it('rejects the wrong password', () => {
    const encoded = auth.hashPassword('CorrectHorse42');
    expect(auth.verifyPassword('wrong', encoded)).toBe(false);
  });

  it('produces a different hash per call (random salt)', () => {
    expect(auth.hashPassword('same')).not.toBe(auth.hashPassword('same'));
  });

  it('rejects malformed encodings without throwing', () => {
    expect(auth.verifyPassword('x', 'not-a-valid-encoding')).toBe(false);
    expect(auth.verifyPassword('x', '')).toBe(false);
    expect(auth.verifyPassword('x', 'salt:zz')).toBe(false);
  });
});

describe('login path: findUserByEmail + verifyPassword', () => {
  it('finds a user created via createUser and validates the password', () => {
    const created = auth.createUser({ name: 'Fatou', email: 'Fatou@Guigui.com', password: 'secret123', role: 'user', phone: '+2459550000', neighborhood: 'Bissau' });
    expect(created).not.toBeNull();

    const found = auth.findUserByEmail('fatou@guigui.com');
    expect(found?.id).toBe(created?.id);
    expect(auth.verifyPassword('secret123', found!.passwordHash)).toBe(true);
    expect(auth.verifyPassword('nope', found!.passwordHash)).toBe(false);
  });

  it('is case-insensitive on email lookup', () => {
    auth.createUser({ name: 'Ali', email: 'ali@guigui.com', password: 'pw', role: 'business', phone: '+2459550001', neighborhood: 'Bissau' });
    expect(auth.findUserByEmail('ALI@GUIGUI.COM')).toBeTruthy();
    expect(auth.findUserByEmail('missing@guigui.com')).toBeUndefined();
  });

  it('does not expose the password hash via toPublicUser', () => {
    const created = auth.createUser({ name: 'Awa', email: 'awa@guigui.com', password: 'pw', role: 'user', phone: '+2459550002', neighborhood: 'Bissau' });
    const publicUser = auth.toPublicUser(created!);
    expect(publicUser).not.toHaveProperty('passwordHash');
    expect(publicUser).not.toHaveProperty('createdAt');
    expect(publicUser.email).toBe('awa@guigui.com');
  });

  it('rejects duplicate registration', () => {
    auth.createUser({ name: 'A', email: 'dup@guigui.com', password: 'pw', role: 'user', phone: '+1', neighborhood: 'Bissau' });
    expect(auth.createUser({ name: 'B', email: 'DUP@guigui.com', password: 'pw', role: 'user', phone: '+2', neighborhood: 'Bissau' })).toBeNull();
  });

  it('normalizes empty neighborhood to Bissau and trims fields', () => {
    const user = auth.createUser({ name: '  Trim  ', email: 'trim@guigui.com', password: 'pw', role: 'user', phone: '  +245 1  ', neighborhood: '' });
    expect(user?.name).toBe('Trim');
    expect(user?.phone).toBe('+245 1');
    expect(user?.neighborhood).toBe('Bissau');
  });
});

describe('account state affecting login', () => {
  it('flags and reports deactivation', () => {
    auth.createUser({ name: 'Deact', email: 'deact@guigui.com', password: 'pw', role: 'user', phone: '+1', neighborhood: 'Bissau' });
    expect(auth.deactivateUserAccount('deact@guigui.com')).toBe(true);
    expect(auth.findUserByEmail('deact@guigui.com')?.accountStatus).toBe('deactivated');
    expect(auth.deactivateUserAccount('ghost@guigui.com')).toBe(false);
  });

  it('deletes an account', () => {
    auth.createUser({ name: 'Del', email: 'del@guigui.com', password: 'pw', role: 'user', phone: '+1', neighborhood: 'Bissau' });
    expect(auth.deleteUserAccount('DEL@guigui.com')).toBe(true);
    expect(auth.findUserByEmail('del@guigui.com')).toBeUndefined();
    expect(auth.deleteUserAccount('del@guigui.com')).toBe(false);
  });

  it('changes password only when the current one matches', () => {
    auth.createUser({ name: 'Pwd', email: 'pwd@guigui.com', password: 'old-pass', role: 'user', phone: '+1', neighborhood: 'Bissau' });
    expect(auth.changeUserPassword('pwd@guigui.com', 'wrong', 'new-pass')).toBe(false);
    expect(auth.changeUserPassword('pwd@guigui.com', 'old-pass', 'new-pass')).toBe(true);
    expect(auth.verifyPassword('new-pass', auth.findUserByEmail('pwd@guigui.com')!.passwordHash)).toBe(true);
  });
});

describe('token issuance: password reset', () => {
  it('migrates legacy reset records without invalidating unexpired tokens', async () => {
    auth.createUser({ name: 'R', email: 'legacy-reset@guigui.com', password: 'old', role: 'user', phone: '+1', neighborhood: 'Bissau' });
    const token = auth.createPasswordReset('legacy-reset@guigui.com')!;
    const resetStorePath = path.join(tempDir, 'password-reset-tokens.json');
    const currentStore = JSON.parse(fs.readFileSync(resetStorePath, 'utf8')) as Record<string, unknown>;
    const record = currentStore[Object.keys(currentStore)[0]];
    fs.writeFileSync(resetStorePath, JSON.stringify({ [token]: record }), 'utf8');

    vi.resetModules();
    auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

    const migratedStore = fs.readFileSync(resetStorePath, 'utf8');
    expect(migratedStore).not.toContain(token);
    expect(auth.resetPassword(token, 'new-password')).toBe(true);
  });

  it('persists newly issued reset tokens by hash instead of plaintext', () => {
    const token = auth.createPasswordReset('admin@guigui.com')!;
    const resetStorePath = path.join(tempDir, 'password-reset-tokens.json');
    const persisted = fs.readFileSync(resetStorePath, 'utf8');

    expect(persisted).not.toContain(token);
    const records = JSON.parse(persisted) as Record<string, { tokenHash: string }>;
    expect(Object.keys(records)).toEqual([records[Object.keys(records)[0]].tokenHash]);
  });

  it('rejects reset tokens that have expired', async () => {
    const token = auth.createPasswordReset('admin@guigui.com')!;
    const resetStorePath = path.join(tempDir, 'password-reset-tokens.json');
    const records = JSON.parse(fs.readFileSync(resetStorePath, 'utf8')) as Record<string, { expiresAt: number }>;
    records[Object.keys(records)[0]].expiresAt = Date.now() - 1;
    fs.writeFileSync(resetStorePath, JSON.stringify(records), 'utf8');
    vi.resetModules();
    auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

    expect(auth.resetPassword(token, 'new-password')).toBe(false);
  });

  it('fails explicitly when the reset-token JSON is corrupt', async () => {
    const resetStorePath = path.join(tempDir, 'password-reset-tokens.json');
    fs.writeFileSync(resetStorePath, '{broken', 'utf8');
    vi.resetModules();

    await expect(import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository')).rejects.toThrow('password-reset-tokens.json');
  });

  it('fails explicitly when a stored reset record is malformed', async () => {
    const resetStorePath = path.join(tempDir, 'password-reset-tokens.json');
    fs.writeFileSync(resetStorePath, JSON.stringify({ broken: { email: 'reset@guigui.com' } }), 'utf8');
    vi.resetModules();

    await expect(import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository')).rejects.toThrow('password-reset-tokens.json');
  });

  it('issues a reset token for a known user and consumes it', () => {
    auth.createUser({ name: 'R', email: 'reset@guigui.com', password: 'old', role: 'user', phone: '+1', neighborhood: 'Bissau' });
    const token = auth.createPasswordReset('reset@guigui.com');
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    expect(auth.resetPassword(token!, 'brand-new')).toBe(true);
    expect(auth.verifyPassword('brand-new', auth.findUserByEmail('reset@guigui.com')!.passwordHash)).toBe(true);
    // Token is single-use.
    expect(auth.resetPassword(token!, 'again')).toBe(false);
  });

  it('issues a reset token for seeded demo accounts', () => {
    expect(auth.createPasswordReset('admin@guigui.com')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns null for unknown accounts', () => {
    expect(auth.createPasswordReset('nobody@guigui.com')).toBeNull();
  });

  it('rejects an invalid or unknown reset token', () => {
    expect(auth.resetPassword('deadbeef', 'new')).toBe(false);
    expect(auth.resetPassword('', 'new')).toBe(false);
  });
});

describe('token issuance: team invitations', () => {
  const invite = {
    email: 'Member@Guigui.com',
    name: 'Member',
    businessId: 'biz-1',
    businessName: 'Biz',
    role: 'manager' as const,
    permissions: { profile: true, content: false, events: true, tickets: true, billing: false },
  };

  it('creates and inspects an invitation using the raw token', () => {
    const key = auth.createTeamInvitation(invite, 'invite-token-1');
    expect(key).toMatch(/^[0-9a-f]{32}$/);

    const inspected = auth.inspectTeamInvitation('invite-token-1');
    expect(inspected?.email).toBe('member@guigui.com');
    expect(inspected?.businessId).toBe('biz-1');
  });

  it('does not accept a wrong token', () => {
    auth.createTeamInvitation(invite, 'right-token');
    expect(auth.inspectTeamInvitation('wrong-token')).toBeNull();
  });

  it('accepts an invitation once and creates the member user', () => {
    auth.createTeamInvitation(invite, 'accept-token');
    const user = auth.acceptTeamInvitation('accept-token', 'member-pass', '+2459550003', 'Bissau');
    expect(user?.email).toBe('member@guigui.com');
    expect(user?.businessId).toBe('biz-1');

    // The invitation is now used and cannot be reused.
    expect(auth.acceptTeamInvitation('accept-token', 'another-pass')).toBeNull();
    expect(auth.inspectTeamInvitation('accept-token')).toBeNull();
  });

  it('consumes an invitation once through the module repository without persisting its raw token', async () => {
    const invitations = auth.createJsonTeamInvitationRepository();
    const token = 'repository-invitation-token';
    await invitations.create(invite, token);

    expect(await invitations.inspect(token)).toMatchObject({
      email: 'member@guigui.com',
      businessId: 'biz-1',
    });
    expect(fs.readFileSync(path.join(tempDir, 'team-invitations.json'), 'utf8')).not.toContain(token);
    await expect(invitations.consume(token)).resolves.toBe(true);
    await expect(invitations.inspect(token)).resolves.toBeNull();
    await expect(invitations.consume(token)).resolves.toBe(false);
  });

  it('expires invitations after 48 hours', () => {
    vi.useFakeTimers();
    const createdAt = Date.now();
    try {
      auth.createTeamInvitation(invite, 'expires-after-48-hours');
      vi.setSystemTime(createdAt + 48 * 60 * 60 * 1000 + 1);
      expect(auth.inspectTeamInvitation('expires-after-48-hours')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null when accepting an unknown invitation', () => {
    expect(auth.acceptTeamInvitation('nope', 'some-pass')).toBeNull();
  });
});

describe('demo password overrides', () => {
  it('falls back to the provided password when no override exists', () => {
    expect(auth.verifyDemoPassword('empresa@guigui.com', '123456', '123456')).toBe(true);
    expect(auth.verifyDemoPassword('empresa@guigui.com', 'bad', '123456')).toBe(false);
  });

  it('changes a demo password and verifies against the new hash', () => {
    expect(auth.changeDemoPassword('empresa@guigui.com', 'wrong', 'new-demo')).toBe(false);
    expect(auth.changeDemoPassword('empresa@guigui.com', '123456', 'new-demo')).toBe(true);
    expect(auth.verifyDemoPassword('empresa@guigui.com', 'new-demo', 'unused')).toBe(true);
  });
});
