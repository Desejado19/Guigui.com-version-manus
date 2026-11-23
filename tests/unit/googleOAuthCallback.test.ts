import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { authenticateUser, type VerifiedGoogleIdentity } from '../../server/modules/identity-access/application/authentication';
import type { IdentityAccountRepository } from '../../server/modules/identity-access/application/identityAccessPorts';
import type { CreateIdentityAccount, IdentityAccount } from '../../server/modules/identity-access/domain/identityTypes';
import { createGoogleIdTokenVerifier } from '../../server/modules/identity-access/infrastructure/googleIdTokenVerifier';
import { createGoogleOAuthRouter } from '../../server/googleOAuthRoutes';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';
const CLIENT_SECRET = 'test-client-secret';
const REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

/** O `state` é agora assinado pelo servidor: obtém-se no arranque do fluxo. */
async function startFlow(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/google/start`, { redirect: 'manual' });
  expect(response.status).toBe(302);
  const location = response.headers.get('location') || '';
  const state = new URL(location).searchParams.get('state');
  expect(state).toBeTruthy();
  return state as string;
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signedGoogleToken(identity: VerifiedGoogleIdentity): string {
  const header = { alg: 'RS256', kid: 'key-1' };
  const payload = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: identity.googleId,
    email: identity.email,
    email_verified: true,
    name: identity.name,
    iat: Math.floor(Date.now() / 1000) - 30,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const unsigned = `${encode(header)}.${encode(payload)}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

function verifier() {
  // JWKS mockado: nenhum pedido a https://www.googleapis.com é feito.
  return createGoogleIdTokenVerifier({
    clientId: CLIENT_ID,
    loadKeys: async () => [{ kty: 'RSA', kid: 'key-1', n: publicJwk.n, e: publicJwk.e }],
    now: () => Date.now(),
  });
}

function accountRepository() {
  const users: IdentityAccount[] = [];
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
    linkGoogleSubject: async () => false,
    create,
    changePassword: async () => false,
    deactivate: async () => false,
    delete: async () => false,
  };
  return { repository, users, create };
}

function authenticationDependencies(
  repository: IdentityAccountRepository,
  verifyGoogleIdToken: (token: string) => Promise<VerifiedGoogleIdentity | null>,
) {
  const createSession = vi.fn(async () => 'session-token-do-callback');
  return {
    createSession,
    dependencies: {
      accounts: repository,
      sessions: {
        createSession,
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
      verifyPassword: () => false,
      demoAccountsEnabled: false,
      authenticateDemoAccount: async () => null,
      verifyGoogleIdToken,
    },
  };
}

describe('Google OAuth callback (HTTP, sem login Google real)', () => {
  it('cria a conta de cidadão com google_sub a partir de um ID token válido', async () => {
    const identity: VerifiedGoogleIdentity = {
      googleId: 'google-subject-callback-new',
      email: 'callback.novo@guigui.com',
      name: 'Conta Nova',
    };
    const { repository, users, create } = accountRepository();
    const { dependencies, createSession } = authenticationDependencies(repository, verifier());
    const idToken = signedGoogleToken(identity);

    // Só a troca do código é interceptada; o ID token é verificado a sério
    // contra a chave local gerada neste teste.
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(
      JSON.stringify({ id_token: idToken, token_type: 'Bearer', expires_in: 3600 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    const app = express();
    app.use('/api/auth/google', createGoogleOAuthRouter({
      env: {
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: REDIRECT_URI,
      },
      fetchImpl,
      authenticate: (input) => authenticateUser(input, dependencies),
    }));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const baseUrl = `http://127.0.0.1:${port}`;
      const state = await startFlow(baseUrl);
      const response = await fetch(
        `${baseUrl}/api/auth/google/callback?code=authorization-code-123&state=${encodeURIComponent(state)}`,
        { redirect: 'manual' },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/?google_login=ok');

      const cookies = response.headers.getSetCookie();
      expect(cookies.some((cookie) => cookie.startsWith('guigui_session=session-token-do-callback')
        && cookie.includes('HttpOnly')
        && cookie.includes('SameSite=Lax'))).toBe(true);

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [tokenUrl, tokenInit] = fetchImpl.mock.calls[0];
      expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
      const tokenBody = new URLSearchParams(String(tokenInit?.body));
      expect(tokenBody.get('code')).toBe('authorization-code-123');
      expect(tokenBody.get('client_secret')).toBe(CLIENT_SECRET);
      expect(tokenBody.get('redirect_uri')).toBe(REDIRECT_URI);

      expect(create).toHaveBeenCalledTimes(1);
      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        email: 'callback.novo@guigui.com',
        role: 'user',
        googleSubject: 'google-subject-callback-new',
        name: 'Conta Nova',
      });
      expect(createSession).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  it('recusa um state adulterado sem contactar a Google', async () => {
    const { repository } = accountRepository();
    const { dependencies } = authenticationDependencies(repository, verifier());
    const fetchImpl = vi.fn<typeof fetch>();

    const app = express();
    app.use('/api/auth/google', createGoogleOAuthRouter({
      env: {
        GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: REDIRECT_URI,
      },
      fetchImpl,
      authenticate: (input) => authenticateUser(input, dependencies),
    }));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const baseUrl = `http://127.0.0.1:${port}`;
      const state = await startFlow(baseUrl);
      const tampered = `${state.slice(0, -4)}aaaa`;
      const response = await fetch(
        `${baseUrl}/api/auth/google/callback?code=authorization-code-123&state=${encodeURIComponent(tampered)}`,
        { redirect: 'manual' },
      );

      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('/?google_login=error&google_reason=state');
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
