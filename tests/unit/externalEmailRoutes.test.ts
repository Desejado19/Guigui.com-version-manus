import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { consumeDistributedRateLimit, dispatchSpy, sendState } = vi.hoisted(() => ({
  consumeDistributedRateLimit: vi.fn(
    async (_key: string, _windowMs: number, _maxRequests: number) => true as boolean | null,
  ),
  dispatchSpy: vi.fn(),
  sendState: { notConfigured: false },
}));

vi.mock('../../server/rateLimitService', () => ({ consumeDistributedRateLimit }));

// A composição real lê o ambiente e cria um transporte. Aqui injecta-se uma
// composição controlável: a falha de configuração acontece na própria
// composição (como em produção), e não dentro do dispatcher.
vi.mock('../../server/email/configured', async () => {
  const { EmailConfigurationError } = await import('../../server/email/types');
  return {
    createConfiguredEmailDispatcher: () => {
      if (sendState.notConfigured) {
        throw new EmailConfigurationError(
          'Nenhum fornecedor de email real está configurado.',
          [],
        );
      }
      return {
        dispatcher: { dispatch: dispatchSpy },
        config: { appUrl: 'http://localhost:3000' },
      };
    },
  };
});

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-external-email-routes-'));
process.env.GUIGUI_DATA_DIR = tempDirectory;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'external-email-route-session-secret';
process.env.TICKET_SIGNING_SECRET = 'external-email-route-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'external-email-route-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

const SENDER_EMAIL = 'cidadao@test.guigui';
const MEMBER_EMAIL = 'membro@test.guigui';
const LIMITED_ADMIN_EMAIL = 'colaborador.admin@test.guigui';
const FULL_ADMIN_EMAIL = 'colaborador.email@test.guigui';
const BUSINESS_TEAM_EMAIL = 'colaborador.empresa@test.guigui';
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

async function login(email: string, password: string): Promise<string> {
  const response = await postJson('/api/auth/login', { email, password });
  expect(response.status).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

beforeAll(async () => {
  const { default: app } = await import('../../server');
  auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  auth.createUser({
    name: 'Cidadão',
    email: SENDER_EMAIL,
    password: PASSWORD,
    role: 'user',
    phone: '+245955000101',
    neighborhood: 'Bissau',
  });
  auth.createUser({
    name: 'Membro',
    email: MEMBER_EMAIL,
    password: PASSWORD,
    role: 'user',
    phone: '+245955000102',
    neighborhood: 'Bissau',
  });
  // Colaborador administrativo com acesso granular, mas sem o módulo de email
  // externo: é o caso que a rota tem de recusar no backend.
  auth.createUser({
    name: 'Colaborador Suporte',
    email: LIMITED_ADMIN_EMAIL,
    password: PASSWORD,
    role: 'admin',
    phone: '+245955000103',
    neighborhood: 'Bissau',
    adminAccess: { support: ['view'] },
  });
  auth.createUser({
    name: 'Colaborador Email',
    email: FULL_ADMIN_EMAIL,
    password: PASSWORD,
    role: 'admin',
    phone: '+245955000104',
    neighborhood: 'Bissau',
    adminAccess: { external_email: ['view', 'create'] },
  });
  // Colaborador empresarial com permissões limitadas: não pode ser travado
  // pelo módulo administrativo, porque o canal externo também é dele.
  auth.createUser({
    name: 'Equipa Empresa',
    email: BUSINESS_TEAM_EMAIL,
    password: PASSWORD,
    role: 'business',
    phone: '+245955000105',
    neighborhood: 'Bissau',
    businessId: 'biz-route-test',
    businessName: 'Empresa Route Teste',
    teamRole: 'support',
    teamAccess: { overview: ['view'] },
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
  consumeDistributedRateLimit.mockResolvedValue(true);
  sendState.notConfigured = false;
  dispatchSpy.mockReset();
  dispatchSpy.mockImplementation(async () => ({
    deliveryId: 'del-route-1',
    state: 'accepted',
    attempts: 1,
    providerMessageId: '<msg@guigui>',
    errorCode: null,
    errorMessage: null,
    deduplicated: false,
  }));
});

describe('POST /api/emails/external', () => {
  it('exige sessão autenticada', async () => {
    const response = await postJson('/api/emails/external', emailBody());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('recusa destinatários que têm conta na plataforma', async () => {
    const cookie = await login(SENDER_EMAIL, PASSWORD);

    const response = await postJson('/api/emails/external', emailBody({ to: MEMBER_EMAIL }), cookie);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'RECIPIENT_IS_PLATFORM_MEMBER',
    });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('devolve 429 quando o limite por conta é atingido', async () => {
    const cookie = await login(SENDER_EMAIL, PASSWORD);
    // Só o balde desta rota está esgotado; o limitador global continua a deixar
    // passar o pedido para que o 429 seja o da rota, com o código próprio.
    consumeDistributedRateLimit.mockImplementation(
      async (key: string) => !key.startsWith('email:external:'),
    );

    const response = await postJson('/api/emails/external', emailBody(), cookie);

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ code: 'EXTERNAL_EMAIL_RATE_LIMITED' });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('devolve 503 quando o envio de email não está configurado', async () => {
    const cookie = await login(SENDER_EMAIL, PASSWORD);
    // A composição falhada não fica memorizada, por isso este caso pode correr
    // antes do primeiro envio bem-sucedido no mesmo processo.
    sendState.notConfigured = true;

    const response = await postJson('/api/emails/external', emailBody(), cookie);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: 'EMAIL_NOT_CONFIGURED' });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('nega 403 a colaborador administrativo sem o módulo external_email', async () => {
    const cookie = await login(LIMITED_ADMIN_EMAIL, PASSWORD);

    const response = await postJson('/api/emails/external', emailBody(), cookie);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'MODULE_FORBIDDEN',
      module: 'external_email',
    });
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it('aceita a mensagem com 202 sem prometer entrega', async () => {
    const cookie = await login(SENDER_EMAIL, PASSWORD);

    const response = await postJson(
      '/api/emails/external',
      emailBody({ requestId: 'req-route-1' }),
      cookie,
    );

    expect(response.status).toBe(202);
    const payload = await response.json();
    expect(payload).toEqual({ state: 'accepted', reference: 'del-route-1' });
    expect(payload).not.toHaveProperty('delivered');
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy.mock.calls[0][0]).toMatchObject({
      kind: 'external_message',
      to: { email: 'parceiro@fora.example' },
      subject: 'Proposta de parceria',
      replyTo: { email: SENDER_EMAIL },
      relatedUserId: expect.any(String),
      dedupeKey: expect.stringContaining('external:'),
    });
  });

  it('deixa passar o colaborador administrativo com o módulo concedido', async () => {
    const cookie = await login(FULL_ADMIN_EMAIL, PASSWORD);

    const response = await postJson('/api/emails/external', emailBody(), cookie);

    expect(response.status).toBe(202);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('não bloqueia colaboradores empresariais com permissões limitadas', async () => {
    const cookie = await login(BUSINESS_TEAM_EMAIL, PASSWORD);

    const response = await postJson('/api/emails/external', emailBody(), cookie);

    expect(response.status).toBe(202);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });

  it('devolve 502 quando o fornecedor configura mas rejeita a mensagem', async () => {
    const cookie = await login(SENDER_EMAIL, PASSWORD);
    // A composição já está memorizada pelos testes anteriores: aqui o que
    // falha é a entrega, não a configuração.
    dispatchSpy.mockResolvedValueOnce({
      deliveryId: 'del-route-2',
      state: 'failed',
      attempts: 1,
      providerMessageId: null,
      errorCode: 'provider_rejected',
      errorMessage: 'Recusado pelo fornecedor.',
      deduplicated: false,
    });

    const response = await postJson('/api/emails/external', emailBody(), cookie);

    expect(response.status).toBe(502);
    expect(response.status).not.toBe(202);
    await expect(response.json()).resolves.toEqual({
      error: 'O fornecedor de email não aceitou a mensagem.',
      code: 'EXTERNAL_EMAIL_FAILED',
      state: 'failed',
    });
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });
});
