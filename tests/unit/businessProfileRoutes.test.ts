import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-business-profile-routes-'));
process.env.GUIGUI_DATA_DIR = tempDirectory;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'business-profile-routes-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'business-profile-routes-test-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'business-profile-routes-test-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

const password = 'CorrectHorse42';
let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
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

async function patchProfile(
  businessId: string,
  cookie: string | undefined,
  body: Record<string, unknown>,
) {
  return fetch(`${baseUrl}/api/businesses/${businessId}/profile`, {
    method: 'PATCH',
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
  businessService = await import('../../server/postgresBusinessService');

  auth.createUser({
    name: 'Empresa Um',
    email: 'perfil-empresa-um@test.guigui',
    password,
    role: 'business',
    phone: '+245955000001',
    neighborhood: 'Bissau',
    businessId: 'profile-biz-1',
    businessName: 'Empresa Um',
  });
  auth.createUser({
    name: 'Empresa Dois',
    email: 'perfil-empresa-dois@test.guigui',
    password,
    role: 'business',
    phone: '+245955000002',
    neighborhood: 'Bissau',
    businessId: 'profile-biz-2',
    businessName: 'Empresa Dois',
  });
  auth.createUser({
    name: 'Admin',
    email: 'perfil-admin@test.guigui',
    password,
    role: 'admin',
    phone: '+245955000003',
    neighborhood: 'Bissau',
  });
  auth.createUser({
    name: 'Cidadão',
    email: 'perfil-cidadao@test.guigui',
    password,
    role: 'user',
    phone: '+245955000004',
    neighborhood: 'Bissau',
  });

  await businessService.persistPostgresBusiness({
    id: 'profile-biz-1',
    name: 'Empresa Um',
    categoryId: 'services',
    status: 'active',
    ownerUserId: auth.findUserByEmail('perfil-empresa-um@test.guigui')?.id,
    data: {
      categoryId: 'services',
      subcategoryId: 'tailoring',
      description: 'Costura e reparação de roupas para toda a comunidade local.',
      phone: '+245955000001',
      neighborhood: 'Bissau Velho',
      verified: true,
      featured: true,
      tier: 'premium',
      homepageFeaturedOrder: 3,
      ownerName: 'Proprietário Original',
    },
  });
  await businessService.persistPostgresBusiness({
    id: 'profile-biz-2',
    name: 'Empresa Dois',
    categoryId: 'services',
    status: 'active',
    ownerUserId: auth.findUserByEmail('perfil-empresa-dois@test.guigui')?.id,
    data: {
      categoryId: 'services',
      subcategoryId: 'repair',
      description: 'Reparação profissional de equipamentos domésticos.',
      phone: '+245955000002',
      neighborhood: 'Bandim',
    },
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

describe('PATCH /api/businesses/:id/profile', () => {
  it('requires an authenticated business or administrator session', async () => {
    const response = await patchProfile('profile-biz-1', undefined, { name: 'Nome Atualizado' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  });

  it('denies citizens from editing a business profile', async () => {
    const cookie = await login('perfil-cidadao@test.guigui');
    const response = await patchProfile('profile-biz-1', cookie, { name: 'Nome Não Autorizado' });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('denies a business account from editing another business', async () => {
    const cookie = await login('perfil-empresa-um@test.guigui');
    const response = await patchProfile('profile-biz-2', cookie, { name: 'Nome Invadido' });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_SCOPE_REQUIRED' });
  });

  it('updates a valid owner profile while preserving server-owned fields', async () => {
    const cookie = await login('perfil-empresa-um@test.guigui');
    const response = await patchProfile('profile-biz-1', cookie, {
      name: 'Atelier Atualizado',
      description: 'Costura e reparação de roupas com atendimento personalizado.',
      publicEmail: 'contato@atelier.test',
    });
    const payload = await response.json() as { business?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(payload.business).toMatchObject({
      id: 'profile-biz-1',
      name: 'Atelier Atualizado',
      description: 'Costura e reparação de roupas com atendimento personalizado.',
      publicEmail: 'contato@atelier.test',
      status: 'active',
      ownerName: 'Proprietário Original',
      verified: true,
      featured: true,
      tier: 'premium',
      homepageFeaturedOrder: 3,
    });
  });

  it('allows administrators to update a business profile', async () => {
    const cookie = await login('perfil-admin@test.guigui');
    const response = await patchProfile('profile-biz-2', cookie, { neighborhood: 'Santa Luzia' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      business: { id: 'profile-biz-2', neighborhood: 'Santa Luzia' },
    });
  });

  it('rejects invalid profile field values without writing them', async () => {
    const cookie = await login('perfil-empresa-um@test.guigui');
    const response = await patchProfile('profile-biz-1', cookie, { description: 'Curta descrição.' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_BUSINESS_PROFILE' });
    await expect(businessService.listPostgresBusinesses()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'profile-biz-1', description: 'Costura e reparação de roupas com atendimento personalizado.' }),
    ]));
  });

  it('rejects attempts to change ownership or administrative fields', async () => {
    const cookie = await login('perfil-empresa-um@test.guigui');
    const response = await patchProfile('profile-biz-1', cookie, {
      name: 'Nome Não Guardado',
      ownerUserId: 'attacker',
      status: 'suspended',
      verified: false,
      tier: 'free',
      homepageFeaturedOrder: 99,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'PROTECTED_BUSINESS_FIELD' });
    await expect(businessService.listPostgresBusinesses()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'profile-biz-1', name: 'Atelier Atualizado', status: 'active', homepageFeaturedOrder: 3 }),
    ]));
  });

  it('does not allow the legacy business write route to bypass profile protections', async () => {
    const cookie = await login('perfil-empresa-um@test.guigui');
    const response = await fetch(`${baseUrl}/api/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        id: 'profile-biz-1',
        name: 'Nome via rota antiga',
        ownerUserId: 'attacker',
        status: 'suspended',
        verified: false,
        tier: 'free',
        homepageFeaturedOrder: 99,
      }),
    });

    expect(response.status).toBe(200);
    await expect(businessService.listPostgresBusinesses()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'profile-biz-1',
        name: 'Nome via rota antiga',
        ownerUserId: auth.findUserByEmail('perfil-empresa-um@test.guigui')?.id,
        status: 'active',
        verified: true,
        tier: 'premium',
        homepageFeaturedOrder: 3,
      }),
    ]));
  });

  it('returns an explicit error when profile persistence fails', async () => {
    const cookie = await login('perfil-empresa-um@test.guigui');
    const storePath = path.join(tempDirectory, 'businesses.json');
    const storedContents = fs.readFileSync(storePath);
    fs.rmSync(storePath);
    fs.mkdirSync(storePath);

    try {
      const response = await patchProfile('profile-biz-1', cookie, { neighborhood: 'Cuntum' });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toMatchObject({ code: 'BUSINESS_PROFILE_UPDATE_FAILED' });
    } finally {
      fs.rmSync(storePath, { recursive: true, force: true });
      fs.writeFileSync(storePath, storedContents);
    }
  });
});
