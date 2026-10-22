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
let auth: typeof import('../../server/authService');

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
  auth = await import('../../server/authService');
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

  server = await new Promise<Server>((resolve) => {
    const listener = expressApp.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 30_000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
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

  it('cria uma conta empresarial nova sem aceitar um businessId externo', async () => {
    const email = uniqueEmail();
    const response = await postJson('/api/auth/register', undefined, {
      name: 'Nova Empresa',
      email,
      password: 'CorrectHorse42',
      role: 'business',
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
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ user: { role: 'business' }, business: { status: 'pending' } });
  });

  it('mantém a associação da nova conta empresarial no armazenamento', async () => {
    const email = uniqueEmail();
    const response = await postJson('/api/auth/register', undefined, { name: 'Empresa Guardada', email, password: 'CorrectHorse42', role: 'business', businessId: 'biz-1' });

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
      businessId: 'empresa-que-nao-existe',
    });
    expect(response.status).toBe(201);

    // O servidor continua a responder depois do pedido malicioso.
    const health = await getJson('/api/health', undefined);
    expect(health.status).toBe(200);
  });

  it('reports healthy local JSON mode when PostgreSQL is not configured', async () => {
    const response = await getJson('/api/health', undefined);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      database: { configured: false, connected: false },
    });
  });
});
