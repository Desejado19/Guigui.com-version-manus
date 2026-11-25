import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { sendTeamInvitation } = vi.hoisted(() => ({
  sendTeamInvitation: vi.fn(),
}));

vi.mock('../../server/integrations/simulatedAdapters', async () => {
  const actual = await vi.importActual<typeof import('../../server/integrations/simulatedAdapters')>('../../server/integrations/simulatedAdapters');
  return {
    ...actual,
    createSimulatedEmailAdapter: () => ({
      ...actual.createSimulatedEmailAdapter(),
      sendTeamInvitation,
    }),
  };
});

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-invitation-routes-'));
process.env.GUIGUI_DATA_DIR = tempDirectory;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'invitation-route-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'invitation-route-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'invitation-route-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

// Contrato CSRF da aplicação: os métodos que alteram estado exigem `Origin`, o
// cookie `_csrf` e o cabeçalho `X-CSRF-Token` com o mesmo valor (duplo envio).
// Estes testes usam `fetch` cru, sem o jar nem o wrapper da SPA, por isso o
// contrato é aplicado aqui; sem ele o convite morre em 403 CSRF_TOKEN_MISSING
// antes de chegar à rota.
const rawFetch = globalThis.fetch;
const CSRF_COOKIE_PATTERN = /(?:^|;\s*)_csrf=/;
let csrfToken = '';
let restoreFetch: (() => void) | undefined;

async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const response = await rawFetch(`${baseUrl}/api/csrf`);
  const payload = await response.json().catch(() => ({})) as { csrfToken?: string };
  csrfToken = typeof payload.csrfToken === 'string' ? payload.csrfToken : '';
  return csrfToken;
}

async function withCsrfContract(init: RequestInit | undefined): Promise<RequestInit | undefined> {
  const method = String(init?.method || 'GET').toUpperCase();
  if (!init || ['GET', 'HEAD', 'OPTIONS'].includes(method)) return init;
  const token = await fetchCsrfToken();
  const headers = new Headers(init.headers);
  headers.set('Origin', baseUrl);
  if (token) {
    headers.set('X-CSRF-Token', token);
    const cookies = headers.get('Cookie') || '';
    if (!CSRF_COOKIE_PATTERN.test(cookies)) {
      headers.set('Cookie', [cookies, `_csrf=${token}`].filter(Boolean).join('; '));
    }
  }
  return { ...init, headers };
}

function installCsrfContract(): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
    if (!url.startsWith(baseUrl)) return original(input as never, init);
    return original(input as never, await withCsrfContract(init));
  }) as typeof globalThis.fetch;
  return () => { globalThis.fetch = original; };
}

const editorPermissions = {
  profile: true,
  content: true,
  events: true,
  tickets: false,
  billing: false,
};

function invitationBody(overrides: Record<string, unknown> = {}) {
  return {
    recipientEmail: `member-${randomUUID()}@test.guigui`,
    recipientName: 'Team Member',
    businessId: 'biz-owner',
    businessName: 'Owner Business',
    role: 'editor',
    permissions: editorPermissions,
    roleLabel: 'Editor',
    token: `invitation-${randomUUID()}-${randomUUID()}`,
    ...overrides,
  };
}

async function postJson(pathname: string, body: Record<string, unknown>, cookie?: string) {
  return fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function login(email: string, password: string): Promise<string> {
  const response = await postJson('/api/auth/login', { email, password });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

beforeAll(async () => {
  sendTeamInvitation.mockResolvedValue({
    mode: 'simulated',
    state: 'simulated',
    reference: 'SIM-EMAIL-INVITATION-test',
  });
  const { default: app } = await import('../../server');
  auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  auth.createUser({
    name: 'Owner',
    email: 'owner@test.guigui',
    password: 'CorrectHorse42',
    role: 'business',
    phone: '+245955000001',
    neighborhood: 'Bissau',
    businessId: 'biz-owner',
    businessName: 'Owner Business',
  });
  auth.createUser({
    name: 'Other Owner',
    email: 'other-owner@test.guigui',
    password: 'CorrectHorse42',
    role: 'business',
    phone: '+245955000002',
    neighborhood: 'Bissau',
    businessId: 'biz-other',
    businessName: 'Other Business',
  });
  server = await new Promise<Server>((resolve) => {
    const listener = (app as Express).listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  restoreFetch = installCsrfContract();
}, 30_000);

afterAll(async () => {
  restoreFetch?.();
  if (server) {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('identity team invitation routes', () => {
  it('rejects an invitation for a different business than the authenticated inviter', async () => {
    const cookie = await login('owner@test.guigui', 'CorrectHorse42');

    const response = await postJson('/api/business/team/invitations', invitationBody({
      businessId: 'biz-other',
      businessName: 'Other Business',
    }), cookie);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_INVITATION_FORBIDDEN' });
  });

  it('rejects role permissions that differ from the canonical role mapping', async () => {
    const cookie = await login('owner@test.guigui', 'CorrectHorse42');

    const response = await postJson('/api/business/team/invitations', invitationBody({
      permissions: { ...editorPermissions, billing: true },
    }), cookie);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_INVITATION_FORBIDDEN' });
  });

  it('creates, inspects, and accepts a valid invitation with the business association', async () => {
    const cookie = await login('owner@test.guigui', 'CorrectHorse42');
    const body = invitationBody();

    const created = await postJson('/api/business/team/invitations', body, cookie);
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      success: true,
      simulated: true,
      message: 'Convite registado. O envio por e-mail está simulado e não foi realizado.',
    });

    const inspectedResponse = await fetch(`${baseUrl}/api/business/team/invitations/${encodeURIComponent(String(body.token))}`);
    expect(inspectedResponse.status).toBe(200);
    await expect(inspectedResponse.json()).resolves.toMatchObject({
      invitation: {
        email: body.recipientEmail,
        name: 'Team Member',
        businessId: 'biz-owner',
        role: 'editor',
        permissions: editorPermissions,
      },
    });

    const accepted = await postJson('/api/business/team/invitations/accept', {
      token: body.token,
      password: 'MemberHorse42',
      phone: '+245955000003',
    });
    expect(accepted.status).toBe(201);
    const payload = await accepted.json() as { user: Record<string, unknown> };
    expect(payload.user).toMatchObject({
      email: body.recipientEmail,
      role: 'business',
      businessId: 'biz-owner',
      teamRole: 'editor',
      teamPermissions: editorPermissions,
    });
    expect(payload.user).not.toHaveProperty('passwordHash');
    expect(auth.findUserByEmail(String(body.recipientEmail))?.businessId).toBe('biz-owner');
  });

  it('preserves the existing not-found and conflict responses for invalid or duplicate invitations', async () => {
    const invalidInspection = await fetch(`${baseUrl}/api/business/team/invitations/not-a-token`);
    expect(invalidInspection.status).toBe(404);

    const duplicateEmail = `duplicate-${randomUUID()}@test.guigui`;
    auth.createUser({
      name: 'Existing',
      email: duplicateEmail,
      password: 'CorrectHorse42',
      role: 'user',
      phone: '+245955000004',
      neighborhood: 'Bissau',
    });
    const cookie = await login('owner@test.guigui', 'CorrectHorse42');
    const body = invitationBody({ recipientEmail: duplicateEmail });
    expect((await postJson('/api/business/team/invitations', body, cookie)).status).toBe(201);

    const accepted = await postJson('/api/business/team/invitations/accept', {
      token: body.token,
      password: 'MemberHorse42',
    });
    expect(accepted.status).toBe(409);
    await expect(accepted.json()).resolves.toMatchObject({ code: 'TEAM_INVITATION_UNAVAILABLE' });
  });

  it('returns the existing service-unavailable response when simulated email delivery fails', async () => {
    sendTeamInvitation.mockRejectedValueOnce(new Error('simulated email unavailable'));
    const cookie = await login('owner@test.guigui', 'CorrectHorse42');
    const body = invitationBody();

    const response = await postJson('/api/business/team/invitations', body, cookie);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'TEAM_INVITATION_SIMULATION_FAILED' });
    const inspection = await fetch(`${baseUrl}/api/business/team/invitations/${encodeURIComponent(String(body.token))}`);
    expect(inspection.status).toBe(200);
  });

  it('retains request validation and requires a business session to create invitations', async () => {
    expect((await postJson('/api/business/team/invitations', invitationBody())).status).toBe(401);

    const cookie = await login('owner@test.guigui', 'CorrectHorse42');
    const invalid = await postJson('/api/business/team/invitations', invitationBody({ role: 'owner' }), cookie);
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ code: 'INVALID_TEAM_INVITATION' });
  });
});
