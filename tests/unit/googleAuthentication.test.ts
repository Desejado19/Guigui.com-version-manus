import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { authenticateUser, type VerifiedGoogleIdentity } from '../../server/modules/identity-access/application/authentication';
import type { IdentityAccountRepository } from '../../server/modules/identity-access/application/identityAccessPorts';
import type { CreateIdentityAccount, IdentityAccount } from '../../server/modules/identity-access/domain/identityTypes';
import { createGoogleIdTokenVerifier } from '../../server/modules/identity-access/infrastructure/googleIdTokenVerifier';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function googleToken(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'key-1' }): string {
  const unsigned = `${encode(header)}.${encode(payload)}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: 'google-subject-1',
    email: 'Fatou@Guigui.com',
    email_verified: true,
    name: 'Fatou Google',
    picture: 'https://example.com/avatar.png',
    iat: Math.floor(Date.now() / 1000) - 30,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function verifier() {
  return createGoogleIdTokenVerifier({
    clientId: CLIENT_ID,
    loadKeys: async () => [{ kty: 'RSA', kid: 'key-1', n: publicJwk.n, e: publicJwk.e }],
    now: () => Date.now(),
  });
}

const seedAccount: IdentityAccount = {
  id: 'user-existing',
  name: 'Fatou',
  email: 'fatou@guigui.com',
  role: 'user',
  phone: '',
  neighborhood: 'Bissau',
  avatarUrl: '',
  passwordHash: 'unused',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function accountRepository(seed: IdentityAccount[] = []) {
  const users = [...seed];
  const create = vi.fn(async (input: CreateIdentityAccount): Promise<IdentityAccount | null> => {
    if (users.some((user) => user.email === input.email.toLowerCase())) return null;
    const created: IdentityAccount = {
      ...input,
      email: input.email.toLowerCase(),
      id: `user-${users.length + 1}`,
      avatarUrl: input.avatarUrl || '',
      passwordHash: 'random',
      createdAt: new Date().toISOString(),
    };
    users.push(created);
    return created;
  });
  const repository: IdentityAccountRepository = {
    findByEmail: async (email) => users.find((user) => user.email === email.toLowerCase()) ?? null,
    findById: async (id) => users.find((user) => user.id === id) ?? null,
    findByGoogleSubject: async (subject) => users.find((user) => user.googleSubject === subject) ?? null,
    linkGoogleSubject: async (userId, subject) => {
      const user = users.find((candidate) => candidate.id === userId);
      if (!user || (user.googleSubject && user.googleSubject !== subject)) return false;
      if (users.some((candidate) => candidate.googleSubject === subject && candidate.id !== userId)) return false;
      user.googleSubject = subject;
      return true;
    },
    create,
    changePassword: async () => false,
    deactivate: async () => false,
    delete: async () => false,
  };
  return { repository, users, create };
}

function authDependencies(
  repository: IdentityAccountRepository,
  identity: VerifiedGoogleIdentity | null,
  correctPassword?: string,
  verifyGoogleIdToken?: (token: string) => Promise<VerifiedGoogleIdentity | null>,
) {
  return {
    accounts: repository,
    sessions: {
      createSession: vi.fn(async () => 'session-token'),
      getSession: async () => null,
      revokeSession: async () => false,
      revokeAllUserSessions: async () => 0,
    },
    mfa: {
      hasEnabledMfa: async () => false,
      beginMfaSetup: async () => ({ secret: '', otpauthUrl: '' }),
      enableMfa: async () => false,
      verifyUserMfa: async () => false,
    },
    verifyPassword: (password: string) => Boolean(correctPassword) && password === correctPassword,
    demoAccountsEnabled: false,
    authenticateDemoAccount: async () => null,
    verifyGoogleIdToken: verifyGoogleIdToken ?? (async () => identity),
  };
}

describe('Google ID token verifier', () => {
  it('accepts a signed token with the configured audience and verified e-mail', async () => {
    const identity = await verifier()(googleToken(validPayload()));

    expect(identity).toEqual({
      googleId: 'google-subject-1',
      email: 'fatou@guigui.com',
      name: 'Fatou Google',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('rejects a token issued for another client', async () => {
    const identity = await verifier()(googleToken(validPayload({ aud: 'other-client.apps.googleusercontent.com' })));
    expect(identity).toBeNull();
  });

  it('rejects an unverified e-mail', async () => {
    const identity = await verifier()(googleToken(validPayload({ email_verified: false })));
    expect(identity).toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const token = googleToken(validPayload());
    const [header, payload] = token.split('.');
    const forged = `${header}.${payload}.${Buffer.from('forged').toString('base64url')}`;
    expect(await verifier()(forged)).toBeNull();
  });
});

describe('Google authentication account resolution', () => {
  const identity: VerifiedGoogleIdentity = {
    googleId: 'google-subject-1',
    email: 'fatou@guigui.com',
    name: 'Fatou Google',
  };

  it('does not link an existing password account on e-mail match alone', async () => {
    const { repository, users, create } = accountRepository([{ ...seedAccount }]);

    const result = await authenticateUser({ googleIdToken: 'token' }, authDependencies(repository, identity));

    expect(result).toEqual({ kind: 'rejected', reason: 'google_link_required', email: 'fatou@guigui.com' });
    expect(users).toHaveLength(1);
    expect(users[0].googleSubject).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('links an existing e-mail account after password confirmation', async () => {
    const { repository, users, create } = accountRepository([{ ...seedAccount }]);

    const result = await authenticateUser(
      { googleIdToken: 'token', password: 'correct-password' },
      authDependencies(repository, identity, 'correct-password'),
    );

    expect(result.kind).toBe('authenticated');
    expect(users).toHaveLength(1);
    expect(users[0].googleSubject).toBe('google-subject-1');
    expect(create).not.toHaveBeenCalled();
    expect(result.kind === 'authenticated' ? result.user : null).not.toHaveProperty('googleSubject');
  });

  it('rejects an incorrect password instead of linking the account', async () => {
    const { repository, users } = accountRepository([{ ...seedAccount }]);

    const result = await authenticateUser(
      { googleIdToken: 'token', password: 'wrong-password' },
      authDependencies(repository, identity, 'correct-password'),
    );

    expect(result).toEqual({ kind: 'rejected', reason: 'google_link_required', email: 'fatou@guigui.com' });
    expect(users[0].googleSubject).toBeUndefined();
  });

  it('returns a conflict instead of throwing when the Google subject is taken during linking', async () => {
    const { repository, users } = accountRepository([{ ...seedAccount }]);
    repository.linkGoogleSubject = async () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint "users_google_sub_key"'), { code: '23505' });
    };

    const result = await authenticateUser(
      { googleIdToken: 'token', password: 'correct-password' },
      authDependencies(repository, identity, 'correct-password'),
    );

    expect(result).toEqual({ kind: 'rejected', reason: 'google_link_conflict', email: 'fatou@guigui.com' });
    expect(users[0].googleSubject).toBeUndefined();
  });

  it('creates one citizen account for a new Google identity', async () => {
    const { repository, users, create } = accountRepository();

    const result = await authenticateUser({ googleIdToken: 'token' }, authDependencies(repository, identity));

    expect(result.kind).toBe('authenticated');
    expect(create).toHaveBeenCalledTimes(1);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      email: 'fatou@guigui.com',
      role: 'user',
      googleSubject: 'google-subject-1',
    });
  });

  it('reuses the account already linked to the Google subject even if the e-mail changed', async () => {
    const { repository, users, create } = accountRepository([{ ...seedAccount, googleSubject: 'google-subject-1' }]);

    const result = await authenticateUser(
      { googleIdToken: 'token' },
      authDependencies(repository, { ...identity, email: 'nova-conta@guigui.com' }),
    );

    expect(result.kind).toBe('authenticated');
    expect(users).toHaveLength(1);
    expect(users[0].id).toBe('user-existing');
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an e-mail already linked to a different Google identity', async () => {
    const { repository, users } = accountRepository([{ ...seedAccount, googleSubject: 'another-google-subject' }]);

    const result = await authenticateUser({ googleIdToken: 'token' }, authDependencies(repository, identity));

    expect(result).toEqual({ kind: 'rejected', reason: 'google_link_conflict', email: 'fatou@guigui.com' });
    expect(users).toHaveLength(1);
  });
});

describe('Google authentication with a signed ID token (mocked JWKS, no network)', () => {
  const identity: VerifiedGoogleIdentity = {
    googleId: 'google-subject-new',
    email: 'novo.cidadao@guigui.com',
    name: 'Novo Cidadão',
  };

  function signedTokenFor(target: VerifiedGoogleIdentity): string {
    return googleToken(validPayload({
      sub: target.googleId,
      email: target.email,
      name: target.name,
      picture: undefined,
    }));
  }

  it('creates a citizen account with role user and google_sub filled for a new sub', async () => {
    const { repository, users, create } = accountRepository();
    const token = signedTokenFor(identity);

    const result = await authenticateUser(
      { googleIdToken: token },
      authDependencies(repository, null, undefined, verifier()),
    );

    expect(result.kind).toBe('authenticated');
    expect(create).toHaveBeenCalledTimes(1);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      email: 'novo.cidadao@guigui.com',
      role: 'user',
      googleSubject: 'google-subject-new',
    });

    // A conta nasce como cidadã e com uma password aleatória inutilizável,
    // nunca com o ID token do Google.
    const createdInput = create.mock.calls[0]?.[0];
    expect(createdInput).toMatchObject({ role: 'user', googleSubject: 'google-subject-new' });
    expect(createdInput?.password).toMatch(/^[a-f0-9]{64}$/);
    expect(createdInput?.password).not.toBe(token);
  });

  it('requires password confirmation for an existing password account instead of linking it', async () => {
    const { repository, users, create } = accountRepository([
      { ...seedAccount, email: identity.email },
    ]);
    const linkGoogleSubject = vi.fn(repository.linkGoogleSubject);
    repository.linkGoogleSubject = linkGoogleSubject;
    const token = signedTokenFor(identity);

    const result = await authenticateUser(
      { googleIdToken: token },
      authDependencies(repository, null, 'correct-password', verifier()),
    );

    expect(result).toEqual({
      kind: 'rejected',
      reason: 'google_link_required',
      email: 'novo.cidadao@guigui.com',
    });
    expect(linkGoogleSubject).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(users).toHaveLength(1);
    expect(users[0].googleSubject).toBeUndefined();
  });
});
