import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mergeStoredBusinessProfile } from '../../src/utils/businessProfile';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-business-profile-hydration-'));
process.env.GUIGUI_DATA_DIR = tempDirectory;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'business-profile-hydration-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'business-profile-hydration-test-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'business-profile-hydration-test-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

let server: Server;
let baseUrl: string;
let businessService: typeof import('../../server/postgresBusinessService');

beforeAll(async () => {
  const { default: app } = await import('../../server');
  businessService = await import('../../server/postgresBusinessService');
  await businessService.persistPostgresBusiness({
    id: 'hydration-complete',
    name: 'Atelier Completo',
    categoryId: 'services',
    status: 'active',
    ownerUserId: 'private-owner-id',
    data: {
      subcategoryId: 'tailoring',
      description: 'Costura e reparação de roupas com atendimento personalizado.',
      phone: '+245 955 123 456',
      neighborhood: 'Bissau Velho',
      publicEmail: 'contacto@atelier.test',
      email: 'account@private.test',
      ownerEmail: 'legacy-owner@private.test',
      owner_email: 'legacy-owner-alias@private.test',
    },
  });
  await businessService.persistPostgresBusiness({
    id: 'hydration-legacy',
    name: 'Negócio Antigo',
    categoryId: 'services',
    status: 'active',
    ownerUserId: 'private-owner-id',
    data: {
      email: 'legacy-account@private.test',
      ownerEmail: 'legacy-owner@private.test',
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

describe('public business profile hydration', () => {
  it('returns persisted profile fields without account or legacy owner emails', async () => {
    const response = await fetch(`${baseUrl}/api/businesses`);
    const payload = await response.json() as { businesses: Array<Record<string, unknown>> };
    const complete = payload.businesses.find((business) => business.id === 'hydration-complete');
    const legacy = payload.businesses.find((business) => business.id === 'hydration-legacy');

    expect(response.status).toBe(200);
    expect(complete).toMatchObject({
      name: 'Atelier Completo',
      categoryId: 'services',
      subcategoryId: 'tailoring',
      description: 'Costura e reparação de roupas com atendimento personalizado.',
      phone: '+245 955 123 456',
      neighborhood: 'Bissau Velho',
      publicEmail: 'contacto@atelier.test',
    });
    for (const business of [complete, legacy]) {
      expect(business).not.toHaveProperty('email');
      expect(business).not.toHaveProperty('ownerEmail');
      expect(business).not.toHaveProperty('owner_email');
      expect(business).not.toHaveProperty('ownerUserId');
    }
    expect(legacy).not.toHaveProperty('publicEmail');
  });

  it('returns the same privacy-safe business DTO from the bootstrap endpoint', async () => {
    const response = await fetch(`${baseUrl}/api/sync/bootstrap`);
    const payload = await response.json() as { data: { businesses: Array<Record<string, unknown>> } };
    const complete = payload.data.businesses.find((business) => business.id === 'hydration-complete');

    expect(response.status).toBe(200);
    expect(complete).toMatchObject({
      description: 'Costura e reparação de roupas com atendimento personalizado.',
      publicEmail: 'contacto@atelier.test',
    });
    expect(complete).not.toHaveProperty('email');
    expect(complete).not.toHaveProperty('ownerEmail');
  });

  it('keeps populated local profile values when the stored record contains blank defaults', () => {
    const merged = mergeStoredBusinessProfile(
      {
        id: 'business-1',
        name: 'Nome Local',
        description: 'Uma descrição local preenchida e significativa.',
        phone: '+245 955 000 001',
      },
      {
        id: 'business-1',
        name: '',
        description: '',
        phone: '',
        categoryId: 'services',
      },
    );

    expect(merged).toMatchObject({
      id: 'business-1',
      name: 'Nome Local',
      description: 'Uma descrição local preenchida e significativa.',
      phone: '+245 955 000 001',
      categoryId: 'services',
    });
  });
});
