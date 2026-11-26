import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-security-routes-'));
process.env.GUIGUI_DATA_DIR = tempDir;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'security-route-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'security-route-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'security-route-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
let businessService: typeof import('../../server/postgresBusinessService');

// Contrato CSRF da aplicação: métodos que alteram estado exigem `Origin`, o
// cookie `_csrf` e o cabeçalho `X-CSRF-Token` com o mesmo valor (duplo envio).
// Os testes falam com o servidor por `fetch` cru, sem o jar nem o wrapper da
// SPA, por isso o contrato é aplicado aqui — sem ele a API responde
// 403 CSRF_ORIGIN_MISSING/CSRF_TOKEN_MISSING e nenhuma rota chega a correr.
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

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  expect(response.status, payload.error).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

async function postJson(pathname: string, cookie: string | undefined, body: Record<string, unknown>) {
  return fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function getJson(pathname: string, cookie: string | undefined) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

beforeAll(async () => {
  const { default: app } = await import('../../server');
  auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  businessService = await import('../../server/postgresBusinessService');
  const expressApp = app as Express;
  const password = 'CorrectHorse42';

  auth.createUser({ name: 'Empresa Um', email: 'empresa-um@test.guigui', password, role: 'business', phone: '+245955000001', neighborhood: 'Bissau', businessId: 'biz-1', businessName: 'Empresa Um' });
  auth.createUser({ name: 'Empresa Dois', email: 'empresa-dois@test.guigui', password, role: 'business', phone: '+245955000002', neighborhood: 'Bissau', businessId: 'biz-2', businessName: 'Empresa Dois' });
  auth.createUser({ name: 'Admin Teste', email: 'admin-teste@test.guigui', password, role: 'admin', phone: '+245955000003', neighborhood: 'Bissau' });
  auth.createUser({ name: 'Sem Empresa', email: 'sem-empresa@test.guigui', password, role: 'business', phone: '+245955000004', neighborhood: 'Bissau' });
  auth.createUser({ name: 'Cidadão Um', email: 'cidadao-um@test.guigui', password, role: 'user', phone: '+245955000005', neighborhood: 'Bissau' });
  auth.createUser({ name: 'Cidadão Dois', email: 'cidadao-dois@test.guigui', password, role: 'user', phone: '+245955000006', neighborhood: 'Bissau' });
  // Contas exclusivas dos testes de escrita: as contas acima são desactivadas
  // e eliminadas pelo bloco de ciclo de vida de conta e não podem ser reutilizadas.
  auth.createUser({ name: 'Cidadão Três', email: 'cidadao-tres@test.guigui', password, role: 'user', phone: '+245955000007', neighborhood: 'Bissau' });
  auth.createUser({ name: 'Cidadão Quatro', email: 'cidadao-quatro@test.guigui', password, role: 'user', phone: '+245955000008', neighborhood: 'Bissau' });
  await businessService.persistPostgresBusiness({
    id: 'biz-1',
    name: 'Empresa Um',
    status: 'active',
    ownerUserId: auth.findUserByEmail('empresa-um@test.guigui')?.id,
    data: { categoryId: 'services', description: 'Descrição de teste suficientemente longa para o perfil.' },
  });
  await businessService.persistPostgresBusiness({
    id: 'biz-2',
    name: 'Empresa Dois',
    status: 'active',
    ownerUserId: auth.findUserByEmail('empresa-dois@test.guigui')?.id,
    data: { categoryId: 'services', description: 'Descrição de teste suficientemente longa para o perfil.' },
  });

  server = await new Promise<Server>((resolve) => {
    const listener = expressApp.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
  restoreFetch = installCsrfContract();
}, 30_000);

afterAll(async () => {
  restoreFetch?.();
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('identity session routes', () => {
  it('returns a public identity DTO, session cookie, and lookup result after login', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'cidadao-um@test.guigui', password: 'CorrectHorse42' }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { success: boolean; user: Record<string, unknown> };
    expect(payload).toMatchObject({
      success: true,
      user: {
        id: auth.findUserByEmail('cidadao-um@test.guigui')?.id,
        email: 'cidadao-um@test.guigui',
        role: 'user',
      },
    });
    expect(payload.user).not.toHaveProperty('passwordHash');
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('guigui_session=');
    const session = await getJson('/api/auth/session', cookie!.split(';')[0]);
    const sessionBody = await session.json();
    expect(sessionBody).toMatchObject({
      authenticated: true,
      userId: payload.user.id,
      role: 'user',
    });
  });

  it('returns the session revocation result and clears the cookie on logout', async () => {
    const cookie = await login('cidadao-um@test.guigui', 'CorrectHorse42');
    const session = await getJson('/api/auth/session', cookie);
    expect(await session.json()).toMatchObject({ authenticated: true, role: 'user' });

    const response = await postJson('/api/auth/logout', cookie, {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, revoked: true });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    await expect((await getJson('/api/auth/session', cookie)).json()).resolves.toMatchObject({ authenticated: false });
  });

  it('reports the number of revoked sessions and clears the current cookie', async () => {
    auth.createUser({
      name: 'Revocation Test',
      email: 'revocation-test@test.guigui',
      password: 'CorrectHorse42',
      role: 'user',
      phone: '+245955000009',
      neighborhood: 'Bissau',
    });
    const currentCookie = await login('revocation-test@test.guigui', 'CorrectHorse42');
    const anotherCookie = await login('revocation-test@test.guigui', 'CorrectHorse42');

    const response = await postJson('/api/auth/sessions/revoke-all', currentCookie, {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, revoked: 2 });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    await expect((await getJson('/api/auth/session', anotherCookie)).json()).resolves.toMatchObject({ authenticated: false });
  });
});

describe('identity credential routes', () => {
  it('changes the password through the account credential port', async () => {
    const email = 'credential-change@test.guigui';
    auth.createUser({
      name: 'Credential Change',
      email,
      password: 'CorrectHorse42',
      role: 'user',
      phone: '+245955000010',
      neighborhood: 'Bissau',
    });

    const cookie = await login(email, 'CorrectHorse42');
    const response = await postJson('/api/auth/change-password', cookie, {
      email: email.toUpperCase(),
      currentPassword: 'CorrectHorse42',
      newPassword: 'UpdatedHorse42',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Palavra-passe atualizada com sucesso.',
    });
    expect((await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'UpdatedHorse42' }),
    })).status).toBe(200);
  });

  it('only reports recovery success after an accepted delivery and consumes valid tokens once', async () => {
    const email = 'credential-reset@test.guigui';
    auth.createUser({
      name: 'Credential Reset',
      email,
      password: 'CorrectHorse42',
      role: 'user',
      phone: '+245955000011',
      neighborhood: 'Bissau',
    });
    const token = auth.createPasswordReset(email);
    expect(token).toBeTruthy();

    // Sem fornecedor de email configurado o adaptador é simulado: o pedido não
    // pode dizer que as instruções foram enviadas.
    const request = await postJson('/api/auth/request-password-reset', undefined, { email });
    expect(request.status).toBe(503);
    const requestPayload = await request.json() as Record<string, unknown>;
    expect(requestPayload).toMatchObject({ success: false, code: 'PASSWORD_RESET_DELIVERY_FAILED' });
    expect(requestPayload).not.toHaveProperty('resetToken');

    const unknown = await postJson('/api/auth/request-password-reset', undefined, { email: 'unknown-reset@test.guigui' });
    expect(unknown.status).toBe(200);
    await expect(unknown.json()).resolves.toMatchObject({ success: true });

    const reset = await postJson('/api/auth/reset-password', undefined, {
      token,
      newPassword: 'ResetHorse42',
    });
    expect(reset.status).toBe(200);
    await expect(reset.json()).resolves.toEqual({
      success: true,
      message: 'Palavra-passe redefinida com sucesso.',
    });
    expect((await postJson('/api/auth/reset-password', undefined, {
      token,
      newPassword: 'SecondReset42',
    })).status).toBe(400);
  });

  it('returns the current invalid-MFA response when no database is configured', async () => {
    const cookie = await login('admin-teste@test.guigui', 'CorrectHorse42');

    const response = await postJson('/api/auth/mfa/enable', cookie, { code: '000000' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Código MFA inválido.',
      code: 'MFA_INVALID',
    });
  });
});

describe('GET /api/payments/transactions tenant isolation', () => {
  it('rejects anonymous access', async () => {
    const response = await getJson('/api/payments/transactions', undefined);
    expect(response.status).toBe(401);
  });

  it('returns only the authenticated company non-ticket transactions', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const response = await getJson('/api/payments/transactions', cookie);
    expect(response.status).toBe(200);
    const transactions = await response.json() as Array<{ businessId: string; useCase: string }>;
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.every((transaction) => transaction.businessId === 'biz-1')).toBe(true);
    expect(transactions.some((transaction) => transaction.useCase === 'event_tickets')).toBe(false);
  });

  it('rejects a query for another company', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const response = await getJson('/api/payments/transactions?businessId=biz-2', cookie);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_SCOPE_REQUIRED' });
  });

  it('rejects a business account without a company association', async () => {
    const cookie = await login('sem-empresa@test.guigui', 'CorrectHorse42');
    const response = await getJson('/api/payments/transactions', cookie);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_ACCOUNT_REQUIRED' });

  });

  it('keeps the platform-wide view for administrators', async () => {
    const cookie = await login('admin-teste@test.guigui', 'CorrectHorse42');
    const response = await getJson('/api/payments/transactions', cookie);
    expect(response.status).toBe(200);
    const transactions = await response.json() as Array<{ businessId: string; useCase: string }>;
    expect(transactions.map((transaction) => transaction.businessId)).toEqual(expect.arrayContaining(['biz-1', 'biz-2']));
    expect(transactions.some((transaction) => transaction.useCase === 'event_tickets')).toBe(false);
  });
});

describe('ticket account visibility in local simulation', () => {
  it('returns a confirmed purchase only to its buyer', async () => {
    const adminCookie = await login('admin-teste@test.guigui', 'CorrectHorse42');
    const buyerCookie = await login('cidadao-um@test.guigui', 'CorrectHorse42');
    const otherBuyerCookie = await login('cidadao-dois@test.guigui', 'CorrectHorse42');
    const eventId = `ticket-account-${Date.now()}`;
    const eventResponse = await postJson('/api/events', adminCookie, {
      id: eventId,
      title: 'Evento de teste de bilhetes',
      status: 'published',
      businessId: 'biz-1',
      date: '2027-12-01',
      time: '19:00',
      salesOpen: true,
      ticketTypes: [{
        id: `${eventId}-vip`,
        name: 'VIP',
        priceXOF: 5000,
        availableQuantity: 2,
        soldQuantity: 0,
        salesOpen: true,
      }],
    });
    expect(eventResponse.status).toBe(200);

    const purchaseResponse = await postJson('/api/tickets/purchase', buyerCookie, {
      eventId,
      ticketTypeId: `${eventId}-vip`,
      ticketTypeName: 'VIP',
      priceXOF: 5000,
      pricePerTicketXOF: 5000,
      quantity: 1,
      buyerName: 'Nome não confiável',
      buyerPhone: '+245955000000',
      paymentMethod: 'orange_money',
      policyAccepted: true,
      policyVersion: '1.0',
      policyAcceptedAt: new Date().toISOString(),
    });
    expect(purchaseResponse.status).toBe(200);
    const purchase = await purchaseResponse.json() as { tickets: Array<{ id: string; buyerUserId: string }> };
    expect(purchase.tickets).toHaveLength(1);
    expect(purchase.tickets[0].buyerUserId).toBeTruthy();

    const buyerTicketsResponse = await getJson('/api/tickets/mine', buyerCookie);
    expect(buyerTicketsResponse.status).toBe(200);
    const buyerTickets = await buyerTicketsResponse.json() as { tickets: Array<{ id: string }> };
    expect(buyerTickets.tickets.map((ticket) => ticket.id)).toContain(purchase.tickets[0].id);

    const otherBuyerResponse = await getJson('/api/tickets/mine', otherBuyerCookie);
    expect(otherBuyerResponse.status).toBe(200);
    await expect(otherBuyerResponse.json()).resolves.toMatchObject({ tickets: [] });
  });
});

describe('metrics route access', () => {
  it('rejects anonymous access to JSON metrics', async () => {
    const response = await getJson('/api/metrics', undefined);

    expect(response.status).toBe(401);
  });

  it('allows an authenticated admin to read JSON metrics', async () => {
    const cookie = await login('admin-teste@test.guigui', 'CorrectHorse42');
    const response = await getJson('/api/metrics', cookie);
    const metrics = await response.json() as {
      totalRequests: number;
      errors: number;
      routes: unknown[];
      database: unknown;
    };

    expect(response.status).toBe(200);
    expect(typeof metrics.totalRequests).toBe('number');
    expect(typeof metrics.errors).toBe('number');
    expect(Array.isArray(metrics.routes)).toBe(true);
    expect(metrics.database).toBeNull();
  });

  it('keeps Prometheus metrics publicly accessible', async () => {
    const response = await getJson('/metrics', undefined);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(body).toContain('# TYPE guigui_http_requests_total counter');
  });
});

describe('account lifecycle security', () => {
  it('requires an authenticated session for deactivation and deletion', async () => {
    const deactivation = await postJson('/api/account/deactivate', undefined, { email: 'cidadao-um@test.guigui', currentPassword: 'CorrectHorse42' });
    expect(deactivation.status).toBe(401);
    const deletion = await postJson('/api/account/delete', undefined, { email: 'cidadao-um@test.guigui', currentPassword: 'CorrectHorse42' });
    expect(deletion.status).toBe(401);
  });

  it('does not allow a session to target another account email', async () => {
    const cookie = await login('cidadao-um@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/account/deactivate', cookie, { email: 'cidadao-dois@test.guigui', currentPassword: 'CorrectHorse42' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_IDENTITY_MISMATCH' });
    expect(auth.findUserByEmail('cidadao-um@test.guigui')?.accountStatus || 'active').toBe('active');
  });

  it('deactivates the session account and revokes its sessions', async () => {
    const cookie = await login('cidadao-um@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/account/deactivate', cookie, { currentPassword: 'CorrectHorse42' });
    expect(response.status).toBe(200);
    expect(auth.findUserByEmail('cidadao-um@test.guigui')?.accountStatus).toBe('deactivated');
    const session = await getJson('/api/auth/session', cookie);
    await expect(session.json()).resolves.toMatchObject({ authenticated: false });
  });

  it('deletes only the session account and revokes its sessions', async () => {
    const cookie = await login('cidadao-dois@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/account/delete', cookie, { currentPassword: 'CorrectHorse42' });
    expect(response.status).toBe(200);
    expect(auth.findUserByEmail('cidadao-dois@test.guigui')).toBeUndefined();
    const session = await getJson('/api/auth/session', cookie);
    await expect(session.json()).resolves.toMatchObject({ authenticated: false });
  });
});


describe('escrita de recursos partilhados exige sessão autenticada', () => {
  it('bloqueia a criação anónima de empresas', async () => {
    const response = await postJson('/api/businesses', undefined, { id: 'biz-malicioso', name: 'Empresa Invasora' });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('bloqueia a criação anónima de eventos', async () => {
    const response = await postJson('/api/events', undefined, { id: 'evt-malicioso', title: 'Evento Invasor' });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('bloqueia a escrita anónima do estado da plataforma', async () => {
    const response = await postJson('/api/app-state/guigui_businesses', undefined, { value: [{ id: 'x', name: 'X' }] });
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('continua a permitir a leitura pública do directório e do estado', async () => {
    expect((await getJson('/api/businesses', undefined)).status).toBe(200);
    expect((await getJson('/api/events', undefined)).status).toBe(200);
    expect((await getJson('/api/app-state/guigui_promotions', undefined)).status).toBe(200);
  });
});

describe('isolamento entre empresas na escrita', () => {
  it('impede uma empresa de gravar a ficha de outra', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/businesses', cookie, { id: 'biz-2', name: 'Empresa Dois Invadida' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_SCOPE_REQUIRED' });
  });

  it('permite a uma empresa gravar a sua própria ficha', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/businesses', cookie, { id: 'biz-1', name: 'Empresa Um' });
    expect(response.status).toBe(200);
  });

  it('impede um cidadão de criar empresas ou eventos', async () => {
    const cookie = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const business = await postJson('/api/businesses', cookie, { id: 'biz-1', name: 'Empresa Um' });
    expect(business.status).toBe(403);
    await expect(business.json()).resolves.toMatchObject({ code: 'BUSINESS_WRITE_FORBIDDEN' });

    const event = await postJson('/api/events', cookie, { id: 'evt-1', title: 'Evento do cidadão' });
    expect(event.status).toBe(403);
    await expect(event.json()).resolves.toMatchObject({ code: 'EVENT_WRITE_FORBIDDEN' });
  });

  it('recusa a conta de negócio sem empresa associada', async () => {
    const cookie = await login('sem-empresa@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/businesses', cookie, { id: 'biz-3', name: 'Sem Empresa' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_ACCOUNT_REQUIRED' });
  });
});

describe('escrita do estado da plataforma por perfil', () => {
  it('impede um cidadão de sobrescrever o directório de empresas', async () => {
    const cookie = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/app-state/guigui_businesses', cookie, { value: [] });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'APP_STATE_WRITE_FORBIDDEN' });
  });

  it('rejeita chaves de estado fora da lista permitida', async () => {
    const cookie = await login('admin-teste@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/app-state/chave_inventada', cookie, { value: 1 });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'APP_STATE_KEY_NOT_ALLOWED' });
  });

  it('permite a cada utilizador gravar apenas a sua preferência de idioma', async () => {
    const ownerId = auth.findUserByEmail('cidadao-tres@test.guigui')?.id;
    expect(ownerId).toBeTruthy();
    const ownKey = `/api/app-state/user_language_${ownerId}`;

    const own = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    expect((await postJson(ownKey, own, { value: 'pt' })).status).toBe(200);

    const other = await login('cidadao-quatro@test.guigui', 'CorrectHorse42');
    const stolen = await postJson(ownKey, other, { value: 'en' });
    expect(stolen.status).toBe(403);
    await expect(stolen.json()).resolves.toMatchObject({ code: 'APP_STATE_NOT_OWNER' });
  });

  it('permite à administração gravar o estado da plataforma', async () => {
    const cookie = await login('admin-teste@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/app-state/guigui_promotions', cookie, { value: [] });
    expect(response.status).toBe(200);
  });
});


describe('registo público de contas e empresas', () => {
  const uniqueEmail = () => `registo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.guigui`;
  const validBusinessProfile = (businessName: string) => ({
    businessName,
    categoryId: 'services',
    subcategoryId: 'tailoring',
    description: 'Costura e reparação de roupas.',
    businessPhone: '+245 955 123 456',
    businessNeighborhood: 'Bissau Velho',
  });

  it('cria uma conta empresarial nova sem aceitar um businessId externo', async () => {
    const email = uniqueEmail();
    const response = await postJson('/api/auth/register', undefined, {
      name: 'Nova Empresa',
      email,
      password: 'CorrectHorse42',
      role: 'business',
      ...validBusinessProfile('Nova Empresa'),
      businessId: 'biz-1',
    });
    expect(response.status).toBe(201);
    const payload = await response.json() as { user?: { role: string; businessId?: string }; business?: { id: string } };
    expect(payload.user?.role).toBe('business');
    expect(payload.user?.businessId).toBeTruthy();
    expect(payload.business?.id).toBe(payload.user?.businessId);
    expect(payload.business?.id).not.toBe('biz-1');
    expect(response.headers.get('set-cookie')).toBeTruthy();
  });

  it('cria uma conta empresarial mesmo sem businessId fornecido pelo cliente', async () => {
    const response = await postJson('/api/auth/register', undefined, {
      name: 'Empresa Independente',
      email: uniqueEmail(),
      password: 'CorrectHorse42',
      role: 'business',
      ...validBusinessProfile('Empresa Independente'),
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ user: { role: 'business' }, business: { status: 'pending' } });
  });

  it('mantém a associação da nova conta empresarial no armazenamento', async () => {
    const email = uniqueEmail();
    const response = await postJson('/api/auth/register', undefined, {
      name: 'Empresa Guardada',
      email,
      password: 'CorrectHorse42',
      role: 'business',
      ...validBusinessProfile('Empresa Guardada'),
      businessId: 'biz-1',
    });

    expect(response.status).toBe(201);
    const user = auth.findUserByEmail(email);
    expect(user?.businessId).toBeTruthy();
    expect(user?.businessId).not.toBe('biz-1');
  });

  it('continua a permitir o registo normal de cidadão', async () => {
    const email = uniqueEmail();
    const response = await postJson('/api/auth/register', undefined, {
      name: 'Cidadão Anónimo',
      email,
      password: 'CorrectHorse42',
      role: 'user',
    });
    expect(response.status).toBe(201);
    const payload = await response.json() as { user?: { email: string; role: string } };
    expect(payload.user?.email).toBe(email);
    expect(payload.user?.role).toBe('user');
  });

  it('ignora uma empresa indicada pelo cliente e mantém o servidor saudável', async () => {
    const response = await postJson('/api/auth/register', undefined, {
      name: 'Ataque',
      email: uniqueEmail(),
      password: 'CorrectHorse42',
      role: 'business',
      ...validBusinessProfile('Ataque'),
      businessId: 'empresa-que-nao-existe',
    });
    expect(response.status).toBe(201);

    // O servidor continua a responder depois do pedido malicioso.
    const health = await getJson('/api/health', undefined);
    expect(health.status).toBe(200);
  });

  it('publica saúde sem credenciais nem detalhes internos', async () => {
    // O contrato público expõe os booleanos de estado (o marketplace escolhe
    // PostgreSQL vs modo local por `database.configured`), mas nunca a
    // configuração do pool, credenciais ou diagnósticos.
    const response = await getJson('/api/health', undefined);
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      status: 'ok',
      app: 'Guigui.com Bissau',
    });
    expect(body.database).toEqual({ configured: false, connected: false });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('diagnostics');
  });
});

describe('leitura do estado da plataforma sem sessão', () => {
  it('não expõe a configuração do modelo de negócio a visitantes', async () => {
    const response = await getJson('/api/app-state/guigui_admin_business_model_config', undefined);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('nega a configuração do modelo de negócio a cidadãos e empresas', async () => {
    const citizen = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const citizenResponse = await getJson('/api/app-state/guigui_admin_business_model_config', citizen);
    expect(citizenResponse.status).toBe(403);
    await expect(citizenResponse.json()).resolves.toMatchObject({ code: 'APP_STATE_READ_FORBIDDEN' });

    const business = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const businessResponse = await getJson('/api/app-state/guigui_admin_business_model_config', business);
    expect(businessResponse.status).toBe(403);
    await expect(businessResponse.json()).resolves.toMatchObject({ code: 'APP_STATE_READ_FORBIDDEN' });
  });

  it('mantém a configuração do modelo de negócio legível e gravável pela administração', async () => {
    const cookie = await login('admin-teste@test.guigui', 'CorrectHorse42');
    const response = await getJson('/api/app-state/guigui_admin_business_model_config', cookie);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ key: 'guigui_admin_business_model_config' });
  });

  it('mantém públicos os catálogos e o directório sem sessão', async () => {
    for (const key of ['guigui_businesses', 'guigui_events', 'guigui_promotions', 'guigui_subscription_plans', 'guigui_monetization_catalog']) {
      const response = await getJson(`/api/app-state/${key}`, undefined);
      expect(response.status, key).toBe(200);
    }
  });
});

describe('autorização antes da validação do corpo', () => {
  it('nega uma empresa com corpo inválido em ficha de outra empresa (403, não 400)', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    // Sem o campo `name`, o corpo é inválido — mas a posse deve ser decidida primeiro.
    const response = await postJson('/api/businesses', cookie, { id: 'biz-2' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_SCOPE_REQUIRED' });
  });

  it('nega um cidadão com corpo inválido em empresa (403, não 400)', async () => {
    const cookie = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/businesses', cookie, {});
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_WRITE_FORBIDDEN' });
  });

  it('nega um cidadão com corpo inválido em eventos (403, não 400)', async () => {
    const cookie = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/events', cookie, {});
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'EVENT_WRITE_FORBIDDEN' });
  });

  it('mantém 400 para empresa com posse e corpo inválido', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    // Empresa biz-1 a criar evento sem campos: autorizada, depois 400.
    const event = await postJson('/api/events', cookie, {});
    expect(event.status).toBe(400);
    // Empresa biz-1 a gravar a sua ficha sem nome: autorizada, depois 400.
    const profile = await postJson('/api/businesses', cookie, { id: 'biz-1' });
    expect(profile.status).toBe(400);
  });
});

describe('auditoria: autorização antes da validação do corpo (restantes rotas)', () => {
  it('campanhas: empresa alheia com corpo inválido recebe 403 (não 400)', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    // biz-2 não é desta empresa: deve ser 403 mesmo sem id/name.
    const foreign = await postJson('/api/marketing/campaigns', cookie, { businessId: 'biz-2' });
    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toMatchObject({ error: 'A campanha não pertence à empresa autenticada.' });
    // Dona com corpo inválido: continua 400.
    const own = await postJson('/api/marketing/campaigns', cookie, { businessId: 'biz-1' });
    expect(own.status).toBe(400);
    // Dona com corpo válido: sucesso.
    const valid = await postJson('/api/marketing/campaigns', cookie, { businessId: 'biz-1', id: 'cmp-1', name: 'Campanha' });
    expect(valid.status).toBe(201);
  });

  it('promoções: empresa alheia com corpo inválido recebe 403', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const foreign = await postJson('/api/marketing/promotions', cookie, { businessId: 'biz-2' });
    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toMatchObject({ error: 'A promoção não pertence à empresa autenticada.' });
    const own = await postJson('/api/marketing/promotions', cookie, { businessId: 'biz-1' });
    expect(own.status).toBe(400);
  });

  it('agendamentos: não pode agendar itens para outra empresa (403 com corpo inválido)', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const foreign = await postJson('/api/marketing/scheduled-items', cookie, { businessId: 'biz-2' });
    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toMatchObject({ error: 'O agendamento não pertence à empresa autenticada.' });
    const own = await postJson('/api/marketing/scheduled-items', cookie, { businessId: 'biz-1' });
    expect(own.status).toBe(400);
  });

  it('pedidos comerciais: empresa alheia com corpo inválido recebe 403', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const foreign = await postJson('/api/monetization/requests', cookie, { businessId: 'biz-2', kind: 'advertising' });
    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toMatchObject({ error: 'O pedido não pertence à empresa autenticada.' });
    const own = await postJson('/api/monetization/requests', cookie, { businessId: 'biz-1', kind: 'advertising' });
    expect(own.status).toBe(400);
  });

  it('convites de equipa: empresa alheia com corpo inválido recebe 403', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const foreign = await postJson('/api/business/team/invitations', cookie, { businessId: 'biz-2' });
    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toMatchObject({ code: 'BUSINESS_INVITATION_FORBIDDEN' });
  });

  it('resposta a avaliação: empresa sem negócio com corpo inválido recebe 403', async () => {
    const cookie = await login('sem-empresa@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/reviews/review-x/reply', cookie, { ownerReply: 'x' });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'REVIEW_REPLY_FORBIDDEN' });
  });

  it('cancelamento de bilhetes: empresa sem negócio com corpo inválido recebe 403', async () => {
    const cookie = await login('sem-empresa@test.guigui', 'CorrectHorse42');
    const response = await postJson('/api/tickets/cancel', cookie, {});
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_ACCOUNT_REQUIRED' });
  });

  it('compra de bilhetes: anónimo com corpo inválido recebe 401 (não 400)', async () => {
    const response = await postJson('/api/tickets/purchase', undefined, {});
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    const cookie = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const invalid = await postJson('/api/tickets/purchase', cookie, {});
    expect(invalid.status).toBe(400);
  });

  it('resposta de suporte: sem acesso com corpo inválido recebe 403 (não 400)', async () => {
    // Nota: cidadao-um e cidadao-dois são mutados pelo bloco "account lifecycle
    // security" acima (desactivação/eliminação) — usa contas estáveis aqui.
    const ownerCookie = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const ticketResponse = await postJson('/api/support/tickets', ownerCookie, { subject: 'Problema', description: 'Detalhe' });
    expect(ticketResponse.status).toBe(201);
    const ticket = await ticketResponse.json() as { ticket: { id: string } };

    const otherCookie = await login('cidadao-quatro@test.guigui', 'CorrectHorse42');
    const foreign = await postJson(`/api/support/tickets/${ticket.ticket.id}/replies`, otherCookie, {});
    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toMatchObject({ error: 'Sem acesso a este pedido de suporte.' });
    const own = await postJson(`/api/support/tickets/${ticket.ticket.id}/replies`, ownerCookie, {});
    expect(own.status).toBe(400);
  });

  it('scanner: código de portaria inválido com âmbito em falta recebe 403 (não 400)', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const wrongCode = await postJson('/api/tickets/scanner-auth', cookie, { doorCode: 'wrong-code' });
    expect(wrongCode.status).toBe(403);
    await expect(wrongCode.json()).resolves.toMatchObject({ code: 'SCANNER_UNAUTHORIZED' });
    const wrongManifest = await postJson('/api/tickets/offline-manifest', cookie, { doorCode: 'wrong-code' });
    expect(wrongManifest.status).toBe(403);
    const wrongValidate = await postJson('/api/tickets/validate', cookie, { doorCode: 'wrong-code' });
    expect(wrongValidate.status).toBe(403);
  });

  it('campanhas (PATCH): estado inválido continua 400 para a empresa dona', async () => {
    const cookie = await login('empresa-um@test.guigui', 'CorrectHorse42');
    const invalid = await fetch(`${baseUrl}/api/marketing/campaigns/camp-x`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ status: 'bogus' }),
    });
    expect(invalid.status).toBe(400);
    const valid = await fetch(`${baseUrl}/api/marketing/campaigns/camp-x`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ status: 'draft' }),
    });
    expect(valid.status).toBe(200);
    const asCitizen = await fetch(`${baseUrl}/api/marketing/campaigns/camp-x`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: await login('cidadao-tres@test.guigui', 'CorrectHorse42') },
      body: JSON.stringify({ status: 'draft' }),
    });
    expect(asCitizen.status).toBe(403);
  });

  it('resposta a avaliação: a empresa só responde a avaliações suas (403 a outra empresa)', async () => {
    const citizenCookie = await login('cidadao-tres@test.guigui', 'CorrectHorse42');
    const phone = `+245955${String(Date.now()).slice(-7)}`;
    const created = await postJson('/api/businesses/biz-1/reviews', citizenCookie, {
      qualitativeScore: 'gostei',
      comment: 'Prova de posse da resposta.',
      authorName: 'Autor Prova',
      authorPhone: phone,
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { review: { id: string } };
    const reviewId = createdBody.review.id;

    // Empresa de outra ficha (biz-2) NÃO pode responder — 403, e a fila de
    // reviews nunca é alterada (anti-escalação de resposta no troco).
    const foreign = await postJson(`/api/reviews/${reviewId}/reply`, await login('empresa-dois@test.guigui', 'CorrectHorse42'), {
      ownerReply: 'Queria responder aqui.',
    });
    expect(foreign.status).toBe(403);
    await expect(foreign.json()).resolves.toMatchObject({ code: 'REVIEW_REPLY_FORBIDDEN' });

    // Cidadão não pode responder (gate de papel).
    const asCitizen = await postJson(`/api/reviews/${reviewId}/reply`, citizenCookie, {
      ownerReply: 'Sou cidadã.',
    });
    expect(asCitizen.status).toBe(403);

    // A empresa dona responde — 200.
    const owner = await postJson(`/api/reviews/${reviewId}/reply`, await login('empresa-um@test.guigui', 'CorrectHorse42'), {
      ownerReply: 'Obrigado pela avaliação.',
    });
    expect(owner.status).toBe(200);
    const ownerBody = await owner.json() as { review: { ownerReply?: string } };
    expect(ownerBody.review.ownerReply).toBe('Obrigado pela avaliação.');
  });
});
