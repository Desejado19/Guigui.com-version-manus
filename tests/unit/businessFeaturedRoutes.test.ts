import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-business-featured-routes-'));
process.env.GUIGUI_DATA_DIR = tempDirectory;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'business-featured-routes-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'business-featured-routes-test-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'business-featured-routes-test-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

const password = 'CorrectHorse42';
let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/authService');
let businessService: typeof import('../../server/postgresBusinessService');

async function login(email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

async function saveFeaturedBusinesses(cookie: string | undefined, businessIds: string[]) {
  return fetch(`${baseUrl}/api/admin/businesses/featured`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ businessIds }),
  });
}

async function getFeaturedBusinesses() {
  return fetch(`${baseUrl}/api/businesses/featured`);
}

beforeAll(async () => {
  const { default: app } = await import('../../server');
  auth = await import('../../server/authService');
  businessService = await import('../../server/postgresBusinessService');

  auth.createUser({
    name: 'Administrador de Destaques',
    email: 'featured-admin@test.guigui',
    password,
    role: 'admin',
    phone: '+245955000003',
    neighborhood: 'Bissau',
  });
  auth.createUser({
    name: 'Conta Empresarial',
    email: 'featured-business@test.guigui',
    password,
    role: 'business',
    phone: '+245955000004',
    neighborhood: 'Bissau',
    businessId: 'featured-active-a',
    businessName: 'Empresa A',
  });
  auth.createUser({
    name: 'Cidadão',
    email: 'featured-citizen@test.guigui',
    password,
    role: 'user',
    phone: '+245955000005',
    neighborhood: 'Bissau',
  });

  await businessService.persistPostgresBusiness({
    id: 'featured-active-a',
    name: 'Empresa A',
    status: 'active',
    data: { featured: true, tier: 'premium', description: 'Dados que devem permanecer.' },
  });
  await businessService.persistPostgresBusiness({
    id: 'featured-active-b',
    name: 'Empresa B',
    status: 'active',
    data: { featured: false, tier: 'basic' },
  });
  await businessService.persistPostgresBusiness({
    id: 'featured-pending',
    name: 'Empresa Pendente',
    status: 'pending',
    data: { tier: 'enterprise' },
  });
  await businessService.persistPostgresBusiness({
    id: 'featured-suspended',
    name: 'Empresa Suspensa',
    status: 'suspended',
    data: { tier: 'premium' },
  });

  server = await new Promise<Server>((resolve) => {
    const listener = (app as Express).listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 30_000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('curated homepage featured businesses API', () => {
  it('requires an administrator session to change the curated order', async () => {
    const anonymousResponse = await saveFeaturedBusinesses(undefined, ['featured-active-a']);
    expect(anonymousResponse.status).toBe(401);

    const businessCookie = await login('featured-business@test.guigui');
    const businessResponse = await saveFeaturedBusinesses(businessCookie, ['featured-active-a']);
    expect(businessResponse.status).toBe(403);

    const citizenCookie = await login('featured-citizen@test.guigui');
    const citizenResponse = await saveFeaturedBusinesses(citizenCookie, ['featured-active-a']);
    expect(citizenResponse.status).toBe(403);
  });

  it('persists administrator ordering and returns selected businesses in order', async () => {
    const cookie = await login('featured-admin@test.guigui');
    const response = await saveFeaturedBusinesses(cookie, ['featured-active-b', 'featured-active-a']);
    const payload = await response.json() as { businesses?: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.businesses?.map((business) => business.id)).toEqual(['featured-active-b', 'featured-active-a']);
    expect(payload.businesses?.map((business) => business.homepageFeaturedOrder)).toEqual([0, 1]);

    const publicResponse = await getFeaturedBusinesses();
    const publicPayload = await publicResponse.json() as { businesses?: Array<Record<string, unknown>> };
    expect(publicResponse.status).toBe(200);
    expect(publicPayload.businesses?.map((business) => business.id)).toEqual(['featured-active-b', 'featured-active-a']);
    expect(publicPayload.businesses?.every((business) => business.status === 'active')).toBe(true);

    const stored = await businessService.listPostgresBusinesses();
    expect(stored).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'featured-active-a', featured: true, tier: 'premium', description: 'Dados que devem permanecer.', homepageFeaturedOrder: 1 }),
      expect.objectContaining({ id: 'featured-active-b', featured: false, tier: 'basic', homepageFeaturedOrder: 0 }),
    ]));
  });

  it('rejects inactive, unknown, and duplicate selections without changing the saved order', async () => {
    const cookie = await login('featured-admin@test.guigui');
    await saveFeaturedBusinesses(cookie, ['featured-active-a']);

    const inactive = await saveFeaturedBusinesses(cookie, ['featured-active-a', 'featured-pending']);
    expect(inactive.status).toBe(400);
    await expect(inactive.json()).resolves.toMatchObject({ code: 'INELIGIBLE_FEATURED_BUSINESS' });

    const unknown = await saveFeaturedBusinesses(cookie, ['missing-business']);
    expect(unknown.status).toBe(400);
    await expect(unknown.json()).resolves.toMatchObject({ code: 'INELIGIBLE_FEATURED_BUSINESS' });

    const duplicate = await saveFeaturedBusinesses(cookie, ['featured-active-a', 'featured-active-a']);
    expect(duplicate.status).toBe(400);
    await expect(duplicate.json()).resolves.toMatchObject({ code: 'INVALID_FEATURED_BUSINESS_ORDER' });

    const publicResponse = await getFeaturedBusinesses();
    await expect(publicResponse.json()).resolves.toMatchObject({
      businesses: [expect.objectContaining({ id: 'featured-active-a', homepageFeaturedOrder: 0 })],
    });
  });

  it('removes businesses from the curated list when an empty order is saved', async () => {
    const cookie = await login('featured-admin@test.guigui');
    await saveFeaturedBusinesses(cookie, ['featured-active-a']);
    const response = await saveFeaturedBusinesses(cookie, []);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ businesses: [] });
    await expect((await getFeaturedBusinesses()).json()).resolves.toMatchObject({ businesses: [] });
    await expect(businessService.listPostgresBusinesses()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'featured-active-a', homepageFeaturedOrder: null }),
    ]));
  });

  it('returns an explicit error when persistence fails', async () => {
    const cookie = await login('featured-admin@test.guigui');
    const businessFile = path.join(tempDirectory, 'businesses.json');
    const backupFile = path.join(tempDirectory, 'businesses.backup.json');
    fs.renameSync(businessFile, backupFile);
    fs.mkdirSync(businessFile);

    let response: Response;
    try {
      response = await saveFeaturedBusinesses(cookie, ['featured-active-a']);
    } finally {
      fs.rmdirSync(businessFile);
      fs.renameSync(backupFile, businessFile);
    }

    expect(response!.status).toBe(500);
    await expect(response!.json()).resolves.toMatchObject({ code: 'FEATURED_BUSINESS_ORDER_SAVE_FAILED' });
  });
});
