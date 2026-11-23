import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Prova, ao nível da rota real, que:
 *  - o envio usa o provider configurado (mockado: nenhuma chamada a Brevo/SMTP);
 *  - a resposta é 202 (aceite, não "entregue");
 *  - a entrega fica registada em `email_deliveries` (INSERT + UPDATE finais)
 *    com o destinatário, assunto, provider e utilizador associado;
 *  - um destinatário que já tem conta devolve 409 sem enviar nem registar.
 *
 * O repositório é o de produção (`createPostgresEmailDeliveryRepository`); só o
 * `Pool` é substituído por um executor em memória que regista o SQL e as linhas,
 * para o teste ser determinístico e não tocar numa base real.
 */

const fake = vi.hoisted(() => {
  type StoredRow = Record<string, unknown>;
  const deliveries = new Map<string, StoredRow>();
  const dedupeIndex = new Map<string, string>();
  const events: Array<{ deliveryId: string; status: string; detail: string | null }> = [];
  const sqlCalls: Array<{ sql: string; params?: unknown[] }> = [];
  const providerCalls: Array<Record<string, unknown>> = [];

  function insertRow(params: unknown[]): StoredRow {
    return {
      id: params[0],
      kind: params[1],
      locale: params[2],
      recipientEmail: params[3],
      recipientName: params[4] ?? null,
      subject: params[5],
      status: params[6],
      provider: params[7],
      mode: params[8],
      providerMessageId: null,
      dedupeKey: params[9] ?? null,
      attempts: Number(params[10] ?? 0),
      lastErrorCode: params[11] ?? null,
      lastErrorMessage: params[12] ?? null,
      relatedUserId: params[13] ?? null,
      metadata: params[14] ? JSON.parse(String(params[14])) : {},
      createdAt: params[15],
      updatedAt: params[15],
      acceptedAt: null,
      deliveredAt: null,
      finalizedAt: null,
    };
  }

  async function query(sql: string, params: unknown[] = []) {
    sqlCalls.push({ sql, params });
    const statement = sql.trim();

    if (statement === 'BEGIN' || statement === 'COMMIT' || statement === 'ROLLBACK') {
      return { rows: [], rowCount: null };
    }

    if (/^INSERT INTO email_deliveries/i.test(statement)) {
      const dedupeKey = params[9] ? String(params[9]) : null;
      if (dedupeKey && dedupeIndex.has(dedupeKey)) {
        return { rows: [], rowCount: 0 };
      }
      const row = insertRow(params);
      deliveries.set(String(row.id), row);
      if (dedupeKey) dedupeIndex.set(dedupeKey, String(row.id));
      return { rows: [row], rowCount: 1 };
    }

    if (/^INSERT INTO email_delivery_events/i.test(statement)) {
      events.push({
        deliveryId: String(params[0]),
        status: String(params[1]),
        detail: params[2] === undefined ? null : String(params[2]),
      });
      return { rows: [], rowCount: 1 };
    }

    if (/^UPDATE email_deliveries/i.test(statement)) {
      const id = String(params[0]);
      const row = deliveries.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      const status = String(params[1]);
      const at = String(params[6]);
      const accepted = ['accepted', 'delivered', 'bounced', 'complained'].includes(status);
      const updated: StoredRow = {
        ...row,
        status,
        attempts: Number(params[2]),
        providerMessageId: params[3] ?? row.providerMessageId,
        lastErrorCode: params[4] ?? null,
        lastErrorMessage: params[5] ?? null,
        updatedAt: at,
        finalizedAt: at,
        acceptedAt: accepted ? (row.acceptedAt ?? params[7] ?? at) : row.acceptedAt,
        deliveredAt: status === 'delivered' ? (row.deliveredAt ?? at) : row.deliveredAt,
      };
      deliveries.set(id, updated);
      return { rows: [updated], rowCount: 1 };
    }

    if (/^SELECT[\s\S]*FROM email_deliveries WHERE dedupe_key = \$1/i.test(statement)) {
      const id = dedupeIndex.get(String(params[0]));
      const row = id ? deliveries.get(id) : undefined;
      return row ? { rows: [row], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (/^SELECT[\s\S]*FROM email_deliveries WHERE id = \$1/i.test(statement)) {
      const row = deliveries.get(String(params[0]));
      return row ? { rows: [row], rowCount: 1 } : { rows: [], rowCount: 0 };
    }

    if (/^SELECT[\s\S]*FROM email_deliveries/i.test(statement)) {
      return { rows: Array.from(deliveries.values()), rowCount: deliveries.size };
    }

    throw new Error(`SQL inesperado no teste: ${statement}`);
  }

  const client = { query, release: () => undefined };
  const pool = {
    connect: async () => client,
    query,
  };

  async function providerSend(message: Record<string, unknown>) {
    providerCalls.push(message);
    return { providerMessageId: '<mock@guigui>', acceptedAt: new Date() };
  }

  function reset() {
    deliveries.clear();
    dedupeIndex.clear();
    events.length = 0;
    sqlCalls.length = 0;
    providerCalls.length = 0;
  }

  return { deliveries, events, sqlCalls, providerCalls, pool, providerSend, reset };
});

vi.mock('../../server/rateLimitService', () => ({
  consumeDistributedRateLimit: async () => true,
}));

// Único ponto substituído: o adapter do fornecedor. Nenhum pedido sai para a
// Brevo ou para um servidor SMTP.
vi.mock('../../server/email/providers', () => ({
  createEmailProvider: () => ({
    name: 'brevo',
    mode: 'live',
    send: fake.providerSend,
  }),
}));

// Repositório de produção, com o Pool substituído pelo executor em memória.
vi.mock('../../server/email/deliveryRepository', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../../server/email/deliveryRepository');
  return {
    ...actual,
    createEmailDeliveryRepository: () =>
      actual.createPostgresEmailDeliveryRepository(fake.pool as never),
  };
});

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-external-email-delivery-'));
process.env.GUIGUI_DATA_DIR = tempDirectory;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'external-email-delivery-session-secret';
process.env.TICKET_SIGNING_SECRET = 'external-email-delivery-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'external-email-delivery-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';
process.env.EMAIL_PROVIDER = 'brevo';
process.env.BREVO_API_KEY = 'xkeysib-chave-somente-para-teste';
process.env.EMAIL_FROM = 'Guigui.com <no-reply@guigui.com>';
process.env.APP_URL = 'http://localhost:3000';
process.env.EMAIL_MAX_ATTEMPTS = '1';

const SENDER_EMAIL = 'cidadao.delivery@guigui.com';
const MEMBER_EMAIL = 'membro.delivery@guigui.com';
const PASSWORD = 'CorrectHorse42';

let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

function emailBody(overrides: Record<string, unknown> = {}) {
  return {
    to: 'parceiro@fora.example',
    subject: 'Proposta de parceria',
    message: 'Olá,\n\nGostaria de falar sobre a parceria.',
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

async function login(email: string): Promise<string> {
  const response = await postJson('/api/auth/login', { email, password: PASSWORD });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

beforeAll(async () => {
  const { default: app } = await import('../../server');
  auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  auth.createUser({
    name: 'Cidadão Entrega',
    email: SENDER_EMAIL,
    password: PASSWORD,
    role: 'user',
    phone: '+245955000201',
    neighborhood: 'Bissau',
  });
  auth.createUser({
    name: 'Membro Plataforma',
    email: MEMBER_EMAIL,
    password: PASSWORD,
    role: 'user',
    phone: '+245955000202',
    neighborhood: 'Bissau',
  });
  server = await new Promise<Server>((resolve) => {
    const listener = (app as Express).listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 30_000);

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

beforeEach(() => {
  fake.reset();
});

describe('POST /api/emails/external — envio e registo da entrega', () => {
  it('responde 202 e regista a entrega em email_deliveries com provider mockado', async () => {
    const cookie = await login(SENDER_EMAIL);

    const response = await postJson(
      '/api/emails/external',
      emailBody({ requestId: 'req-delivery-1' }),
      cookie,
    );

    // 202 = aceite para envio; nunca promete entrega.
    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload).toEqual({ state: 'accepted', reference: expect.any(String) });

    // O provider foi chamado uma única vez, sem rede real.
    expect(fake.providerCalls).toHaveLength(1);
    const message = fake.providerCalls[0];
    expect(message).toMatchObject({
      to: { email: 'parceiro@fora.example' },
      subject: 'Proposta de parceria',
      replyTo: { email: SENDER_EMAIL },
    });
    expect(message.from).toMatchObject({ email: 'no-reply@guigui.com' });

    // Uma linha em email_deliveries, finalizada como aceite.
    expect(fake.deliveries.size).toBe(1);
    const row = Array.from(fake.deliveries.values())[0];
    expect(row).toMatchObject({
      id: payload.reference,
      kind: 'external_message',
      locale: 'pt',
      recipientEmail: 'parceiro@fora.example',
      subject: 'Proposta de parceria',
      status: 'accepted',
      provider: 'brevo',
      mode: 'live',
      providerMessageId: '<mock@guigui>',
      attempts: 1,
      dedupeKey: expect.stringMatching(/^external:.+:req-delivery-1$/),
      relatedUserId: expect.any(String),
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    expect(row.acceptedAt).toBeTruthy();
    expect(row.finalizedAt).toBeTruthy();

    // SQL verdadeiro do repositório de produção, sobre a tabela pedida.
    expect(fake.sqlCalls.some((call) => /^INSERT INTO email_deliveries/i.test(call.sql))).toBe(true);
    expect(fake.sqlCalls.some((call) => /^UPDATE email_deliveries/i.test(call.sql))).toBe(true);
    expect(fake.sqlCalls.some((call) => /^INSERT INTO email_delivery_events/i.test(call.sql))).toBe(
      true,
    );

    // Eventos: criada (queued) e aceite (accepted).
    expect(fake.events.map((event) => event.status)).toEqual(['queued', 'accepted']);
    expect(fake.events.every((event) => event.deliveryId === row.id)).toBe(true);
  });

  it('devolve 409 para destinatário com conta, sem enviar nem registar', async () => {
    const cookie = await login(SENDER_EMAIL);

    const response = await postJson('/api/emails/external', emailBody({ to: MEMBER_EMAIL }), cookie);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'RECIPIENT_IS_PLATFORM_MEMBER',
    });

    expect(fake.providerCalls).toHaveLength(0);
    expect(fake.deliveries.size).toBe(0);
    expect(fake.events).toHaveLength(0);
    expect(fake.sqlCalls.some((call) => /email_deliveries/i.test(call.sql))).toBe(false);
  });
});
