import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-business-registration-'));
process.env.GUIGUI_DATA_DIR = tempDirectory;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'business-registration-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'business-registration-test-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'business-registration-test-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/authService');
let businessService: typeof import('../../server/postgresBusinessService');

async function register(body: Record<string, unknown>) {
  return fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBusinessRegistration(email: string): Record<string, unknown> {
  return {
    name: 'Pessoa Empresária',
    email,
    password: 'CorrectHorse42',
    role: 'business',
    businessName: 'Atelier Nô Pintcha',
    categoryId: 'services',
    subcategoryId: 'tailoring',
    description: 'Costura e reparação de roupas.',
    businessPhone: '+245 955 123 456',
    businessNeighborhood: 'Bissau Velho',
  };
}

beforeAll(async () => {
  const { default: app } = await import('../../server');
  auth = await import('../../server/authService');
  businessService = await import('../../server/postgresBusinessService');

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

describe('business registration', () => {
  it('rejects incomplete profile data before creating an account or business', async () => {
    const email = `incomplete-${Date.now()}@test.guigui`;
    const response = await register({
      name: 'Pessoa Empresária',
      email,
      password: 'CorrectHorse42',
      role: 'business',
      businessId: 'client-business-id',
    });

    expect(response.status).toBe(400);
    expect(auth.findUserByEmail(email)).toBeUndefined();
    await expect(businessService.listPostgresBusinesses()).resolves.toEqual([]);
  });

  it('persists the submitted public profile without copying account email into it', async () => {
    const email = `complete-${Date.now()}@test.guigui`;
    const response = await register({
      ...validBusinessRegistration(email),
      publicEmail: 'contato@atelier.test',
    });

    expect(response.status).toBe(201);
    const payload = await response.json() as {
      business?: Record<string, unknown>;
      user?: { businessId?: string };
    };
    expect(payload.business).toMatchObject({
      id: payload.user?.businessId,
      name: 'Atelier Nô Pintcha',
      categoryId: 'services',
      subcategoryId: 'tailoring',
      description: 'Costura e reparação de roupas.',
      phone: '+245 955 123 456',
      neighborhood: 'Bissau Velho',
      publicEmail: 'contato@atelier.test',
    });
    expect(payload.business).not.toHaveProperty('email');
    expect(payload.business).not.toHaveProperty('ownerEmail');

    const businesses = await businessService.listPostgresBusinesses();
    expect(businesses).toEqual([
      expect.objectContaining({
        id: payload.user?.businessId,
        publicEmail: 'contato@atelier.test',
        phone: '+245 955 123 456',
      }),
    ]);
    expect(JSON.stringify(businesses)).not.toContain(email);
  });

  it('removes the pending business when account storage fails', async () => {
    const email = `rollback-${Date.now()}@test.guigui`;
    const before = await businessService.listPostgresBusinesses();
    const authFilePath = path.join(tempDirectory, 'auth.json');
    fs.rmSync(authFilePath, { force: true });
    fs.mkdirSync(authFilePath);

    const response = await register(validBusinessRegistration(email));

    expect(response.status).toBe(500);
    expect(auth.findUserByEmail(email)).toBeUndefined();
    await expect(businessService.listPostgresBusinesses()).resolves.toEqual(before);
    fs.rmSync(authFilePath, { recursive: true, force: true });
  });
});
