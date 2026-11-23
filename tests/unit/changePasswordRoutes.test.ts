import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-change-password-'));
process.env.GUIGUI_DATA_DIR = tempDir;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
// As contas demo são um dos três perfis cobertos por este teste.
process.env.ENABLE_DEMO_ACCOUNTS = 'true';
process.env.SESSION_COOKIE_SECRET = 'change-password-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'change-password-test-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'change-password-test-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

const PASSWORD = 'CorrectHorse42';
const CITIZEN_EMAIL = 'cidadao.fluxo@test.guigui';
const BUSINESS_EMAIL = 'empresa.fluxo@test.guigui';
const DEMO_ADMIN_EMAIL = 'admin.teste@guigui.com';
const DEMO_ADMIN_PASSWORD = 'Guigui@2026!';

const CITIZEN_NEW_PASSWORD = 'Citizen-Flow-92!';
const BUSINESS_NEW_PASSWORD = 'Business-Flow-92!';
const DEMO_ADMIN_NEW_PASSWORD = 'DemoAdmin-Flow-92!';

let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

async function login(email: string, password: string) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

async function loginCookie(email: string, password: string): Promise<string> {
  const response = await login(email, password);
  const payload = await response.json().catch(() => ({})) as { error?: string };
  expect(response.status, payload.error).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

async function changePassword(
  cookie: string | undefined,
  body: { currentPassword?: string; newPassword?: string; email?: string },
) {
  return fetch(`${baseUrl}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const { default: app } = await import('../../server');
  auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

  auth.createUser({
    name: 'Cidadão Fluxo', email: CITIZEN_EMAIL, password: PASSWORD, role: 'user',
    phone: '+245955000101', neighborhood: 'Bissau',
  });
  auth.createUser({
    name: 'Empresa Fluxo', email: BUSINESS_EMAIL, password: PASSWORD, role: 'business',
    phone: '+245955000102', neighborhood: 'Bissau', businessId: 'biz-fluxo', businessName: 'Empresa Fluxo',
  });

  server = (app as Express).listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 30_000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('POST /api/auth/change-password', () => {
  it('devolve 401 sem sessão', async () => {
    const response = await changePassword(undefined, {
      currentPassword: PASSWORD,
      newPassword: CITIZEN_NEW_PASSWORD,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('devolve 401 quando a palavra-passe atual está errada e mantém a antiga válida', async () => {
    const cookie = await loginCookie(CITIZEN_EMAIL, PASSWORD);

    const response = await changePassword(cookie, {
      currentPassword: 'WrongCurrent-Pass-92!',
      newPassword: CITIZEN_NEW_PASSWORD,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
    expect((await login(CITIZEN_EMAIL, PASSWORD)).status).toBe(200);
  });

  it('devolve 403 quando o e-mail do corpo pertence a outra conta', async () => {
    const cookie = await loginCookie(CITIZEN_EMAIL, PASSWORD);

    const response = await changePassword(cookie, {
      email: BUSINESS_EMAIL,
      currentPassword: PASSWORD,
      newPassword: CITIZEN_NEW_PASSWORD,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_IDENTITY_MISMATCH' });
    expect((await login(BUSINESS_EMAIL, PASSWORD)).status).toBe(200);
  });

  it('devolve 400 com os problemas da política para uma palavra-passe fraca', async () => {
    const cookie = await loginCookie(CITIZEN_EMAIL, PASSWORD);

    const response = await changePassword(cookie, {
      currentPassword: PASSWORD,
      newPassword: 'abc',
    });

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string; issues: string[] };
    expect(payload.code).toBe('PASSWORD_POLICY');
    expect(payload.issues.length).toBeGreaterThan(0);
    expect((await login(CITIZEN_EMAIL, PASSWORD)).status).toBe(200);
  });

  it('altera a palavra-passe de um cidadão e permite entrar com a nova', async () => {
    const cookie = await loginCookie(CITIZEN_EMAIL, PASSWORD);

    const response = await changePassword(cookie, {
      currentPassword: PASSWORD,
      newPassword: CITIZEN_NEW_PASSWORD,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect((await login(CITIZEN_EMAIL, CITIZEN_NEW_PASSWORD)).status).toBe(200);
    expect((await login(CITIZEN_EMAIL, PASSWORD)).status).toBe(401);
  });

  it('altera a palavra-passe de uma conta empresarial e permite entrar com a nova', async () => {
    const cookie = await loginCookie(BUSINESS_EMAIL, PASSWORD);

    const response = await changePassword(cookie, {
      currentPassword: PASSWORD,
      newPassword: BUSINESS_NEW_PASSWORD,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect((await login(BUSINESS_EMAIL, BUSINESS_NEW_PASSWORD)).status).toBe(200);
    expect((await login(BUSINESS_EMAIL, PASSWORD)).status).toBe(401);
  });

  it('altera a palavra-passe da conta demo de administração e permite entrar com a nova', async () => {
    const cookie = await loginCookie(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD);

    const response = await changePassword(cookie, {
      currentPassword: DEMO_ADMIN_PASSWORD,
      newPassword: DEMO_ADMIN_NEW_PASSWORD,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect((await login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_NEW_PASSWORD)).status).toBe(200);
    expect((await login(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD)).status).toBe(401);
  });
});
