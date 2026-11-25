import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { expect, request as playwrightRequest, test } from './fixtures';

const BASE_URL = `http://localhost:${process.env.PW_PORT?.trim() || '3000'}`;
const DEMO = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };

test.describe.configure({ mode: 'serial' });

async function withDb<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

function accountBucket(scope: string, account: string): string {
  const digest = createHash('sha256').update(`${scope}\0${account.trim().toLowerCase()}`).digest('hex');
  return `account:${scope}:${digest}`;
}

/** Contexto cru, sem o adaptador da fixture: controla Origin/token à mão. */
async function rawClient() {
  const context = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const response = await context.get('/api/csrf');
  expect(response.ok()).toBeTruthy();
  const { csrfToken } = await response.json();
  expect(csrfToken).toMatch(/^[a-f0-9]{64}$/);
  return { context, token: String(csrfToken) };
}

const sameOrigin = { Origin: BASE_URL, Referer: `${BASE_URL}/` };

test('S4: pedidos que alteram estado exigem Origin/Referer e token de duplo envio', async () => {
  const { context, token } = await rawClient();
  try {
    const login = (headers: Record<string, string>) => context.post('/api/auth/login', {
      data: { email: 'csrf-check@example.test', password: 'password-invalida' },
      headers,
    });

    const missingOrigin = await login({ 'X-CSRF-Token': token });
    expect(missingOrigin.status()).toBe(403);
    expect((await missingOrigin.json()).code).toBe('CSRF_ORIGIN_MISSING');

    const foreignOrigin = await login({ ...sameOrigin, Origin: 'https://evil.example', 'X-CSRF-Token': token });
    expect(foreignOrigin.status()).toBe(403);
    expect((await foreignOrigin.json()).code).toBe('CSRF_ORIGIN_DENIED');

    const foreignReferer = await login({ Referer: 'https://evil.example/page', 'X-CSRF-Token': token });
    expect(foreignReferer.status()).toBe(403);
    expect((await foreignReferer.json()).code).toBe('CSRF_ORIGIN_DENIED');

    const missingToken = await login(sameOrigin);
    expect(missingToken.status()).toBe(403);
    expect((await missingToken.json()).code).toBe('CSRF_TOKEN_MISSING');

    const badToken = await login({ ...sameOrigin, 'X-CSRF-Token': 'a'.repeat(64) });
    expect(badToken.status()).toBe(403);
    expect((await badToken.json()).code).toBe('CSRF_TOKEN_INVALID');

    const valid = await login({ ...sameOrigin, 'X-CSRF-Token': token });
    expect(valid.status()).toBe(401);

    const safeRead = await context.get('/api/health');
    expect(safeRead.status()).toBe(200);
  } finally {
    await context.dispose();
  }
});

test('S4: webhook de pagamentos continua autenticado por assinatura, não por CSRF', async () => {
  const { context } = await rawClient();
  try {
    const response = await context.post('/api/payments/webhook/orange_money', {
      data: { transactionId: 'nao-existe', state: 'confirmed' },
    });
    // A rota continua autenticada pela assinatura/payload do fornecedor; o
    // importante é não ser travada pelo middleware CSRF (403).
    expect(response.status()).not.toBe(403);
    expect((await response.json()).code).not.toMatch(/^CSRF_/);
  } finally {
    await context.dispose();
  }
});

test('S5: trust proxy usa o IP do cliente em X-Forwarded-For', async ({ request }) => {
  const forwardedFor = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
  const login = await request.post('/api/auth/login', {
    data: DEMO,
    headers: { 'X-Forwarded-For': forwardedFor },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  const { user } = await login.json();
  const stored = await withDb((pool) => pool.query(
    'SELECT ip_address FROM sessions WHERE user_id=$1 AND ip_address=$2 LIMIT 1',
    [user.id, forwardedFor],
  ));
  expect(stored.rowCount, `sessão devia guardar req.ip=${forwardedFor}`).toBeGreaterThan(0);
});

test('S5: login bloqueia por conta após dez tentativas falhadas', async ({ request }) => {
  const email = `login-rate-${Date.now()}@example.test`;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const response = await request.post('/api/auth/login', {
      data: { email, password: 'password-errada' },
    });
    expect(response.status(), `tentativa ${attempt}`).toBe(401);
  }
  const blocked = await request.post('/api/auth/login', {
    data: { email, password: 'password-errada' },
  });
  expect(blocked.status()).toBe(429);
  expect((await blocked.json()).code).toBe('LOGIN_RATE_LIMITED');

  const bucket = await withDb((pool) => pool.query(
    'SELECT request_count FROM rate_limit_buckets WHERE bucket_key=$1',
    [accountBucket('login', email)],
  ));
  expect(bucket.rowCount).toBe(1);
  // O pedido bloqueado também é contado, para a janela não reiniciar.
  expect(Number(bucket.rows[0].request_count)).toBe(11);
});

test('S5: lookup de bilhetes bloqueia por telefone após cinco tentativas', async ({ request }) => {
  const phone = `9${String(Date.now()).slice(-8)}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request.post('/api/tickets/lookup', {
      data: { phone, code: 'PIN99' },
    });
    expect([404, 200], `tentativa ${attempt}`).toContain(response.status());
  }
  const blocked = await request.post('/api/tickets/lookup', {
    data: { phone, code: 'PIN99' },
  });
  expect(blocked.status()).toBe(429);
  expect((await blocked.json()).code).toBe('LOOKUP_RATE_LIMITED');

  const bucket = await withDb((pool) => pool.query(
    'SELECT request_count FROM rate_limit_buckets WHERE bucket_key=$1',
    [accountBucket('ticket-lookup', phone)],
  ));
  expect(bucket.rowCount).toBe(1);
  expect(Number(bucket.rows[0].request_count)).toBe(6);
});

test('S5: pedidos de reset limitam por conta e por token', async ({ request }) => {
  const email = `reset-rate-${Date.now()}@example.test`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request.post('/api/auth/request-password-reset', { data: { email } });
    expect(response.status(), `pedido ${attempt}`).toBe(200);
  }
  const blockedRequest = await request.post('/api/auth/request-password-reset', { data: { email } });
  expect(blockedRequest.status()).toBe(429);
  expect((await blockedRequest.json()).code).toBe('PASSWORD_RESET_RATE_LIMITED');

  const token = `token-invalido-${Date.now()}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await request.post('/api/auth/reset-password', {
      data: { token, newPassword: 'NovaPalavra@2026' },
    });
    expect(response.status(), `reset ${attempt}`).toBe(400);
  }
  const blockedReset = await request.post('/api/auth/reset-password', {
    data: { token, newPassword: 'NovaPalavra@2026' },
  });
  expect(blockedReset.status()).toBe(429);
  expect((await blockedReset.json()).code).toBe('PASSWORD_RESET_RATE_LIMITED');

  const buckets = await withDb((pool) => pool.query(
    'SELECT bucket_key FROM rate_limit_buckets WHERE bucket_key = ANY($1)',
    [[
      accountBucket('password-reset', email),
      accountBucket('password-reset-token', createHash('sha256').update(token).digest('hex')),
    ]],
  ));
  expect(buckets.rowCount).toBe(2);
});
