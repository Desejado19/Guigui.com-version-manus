import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Teste de integração opt-in: exige uma base PostgreSQL descartável em
// TEST_DATABASE_URL. Sem a variável, toda a suite fica skipped e o
// `npm run test:unit` continua verde sem base de dados.
//
// Prova, contra PostgreSQL real, que as três leituras concordam:
//   1. `GET /api/tickets/sold` (vista paginada, limite de 500);
//   2. `GET /api/tickets/sold/export` (CSV agregado por comprador);
//   3. agregação SQL directa por comprador e tipo de bilhete.
//
// A identidade fica no repositório JSON (como nos testes de rota): o objecto em
// prova é a agregação que vem da base, não o login. O pool é o verdadeiro, com
// `search_path` isolado para o schema `tickets_sold_api_it`, por isso este
// ficheiro não colide com `public` nem com os outros testes de integração.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const describeIfDb = testDatabaseUrl ? describe : describe.skip;

const SCHEMA = 'tickets_sold_api_it';
const COMPANY = 'co-tickets-sold-api';
const OTHER_COMPANY = 'co-tickets-sold-api-outra';
const BIG_EVENT = 'evt-api-grande';
const SMALL_EVENT = 'evt-api-pequeno';
const OTHER_EVENT = 'evt-api-outra';

const BULK_BUYERS = 520;
const ANA_BIG_GERAL = 100;
const ANA_BIG_VIP = 31;
const ANA_SMALL_GERAL = 12;
const ANA_SMALL_VIP = 3;
const SMALL_SINGLE_BUYERS = 90;
// 520 individuais + 100 Geral + 31 VIP da Ana + 1 pendente + usada + cancelada.
const BIG_TOTAL = BULK_BUYERS + ANA_BIG_GERAL + ANA_BIG_VIP + 1 + 2;
const SMALL_TOTAL = SMALL_SINGLE_BUYERS + ANA_SMALL_GERAL + ANA_SMALL_VIP;
const OTHER_TOTAL = 3;
const TICKET_LIST_LIMIT = 500;

const PRICE_GERAL = 5000;
const PRICE_VIP = 15000;
const PRICE_OTHER = 7000;

const PASSWORD = 'CorrectHorse42';
const BUSINESS_EMAIL = 'empresa-agregacao@test.guigui';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-tickets-aggregation-'));
process.env.GUIGUI_DATA_DIR = tempDir;
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'tickets-aggregation-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'tickets-aggregation-test-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'tickets-aggregation-test-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

vi.mock('../../server/modules/identity-access/infrastructure/postgresIdentityRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/modules/identity-access/infrastructure/postgresIdentityRepository')>();
  const { createJsonIdentityRepository } = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  return { ...actual, createPostgresIdentityRepository: () => createJsonIdentityRepository() };
});

/** Acrescenta o search_path do schema isolado à URL de teste. */
function withIsolatedSchema(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('options', `-c search_path=${SCHEMA}`);
  return parsed.toString();
}

const schemaSql = `
  DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
  CREATE SCHEMA ${SCHEMA};

  -- O servidor aplica rate limiting por pedido: a tabela tem de existir para a
  -- rota não ficar à espera de um INSERT que falha.
  CREATE TABLE rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL CHECK (request_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE request_metrics (
    metric_date DATE NOT NULL,
    route TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    total_duration_ms BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (metric_date, route)
  );

  -- Com um pool real, as sessões passam a viver na base (o repositório de
  -- sessões só usa o ficheiro JSON quando não há ligação).
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    revoked_at TIMESTAMPTZ
  );

  CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );

  CREATE TABLE events (
    id TEXT PRIMARY KEY,
    company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'published'
  );

  CREATE TABLE ticket_types (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_xof INTEGER NOT NULL CHECK (price_xof > 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    UNIQUE (event_id, name)
  );

  CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    gross_amount_xof INTEGER NOT NULL DEFAULT 0 CHECK (gross_amount_xof >= 0)
  );

  CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    ticket_type_id TEXT REFERENCES ticket_types(id) ON DELETE SET NULL,
    qr_token TEXT NOT NULL UNIQUE,
    ticket_code TEXT NOT NULL UNIQUE,
    signature TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'valid'
      CHECK (status IN ('pending', 'valid', 'used', 'cancelled', 'expired')),
    buyer_name TEXT,
    buyer_phone TEXT,
    holder_name TEXT,
    holder_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE ticket_refunds (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'requested',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  INSERT INTO companies (id, name) VALUES
    ('${COMPANY}', 'Empresa Agregação'),
    ('${OTHER_COMPANY}', 'Empresa Alheia');

  INSERT INTO events (id, company_id, title) VALUES
    ('${BIG_EVENT}', '${COMPANY}', 'Festival Grande'),
    ('${SMALL_EVENT}', '${COMPANY}', 'Festa Pequena'),
    ('${OTHER_EVENT}', '${OTHER_COMPANY}', 'Evento Alheio');

  INSERT INTO ticket_types (id, event_id, name, price_xof, quantity) VALUES
    ('tt-grande-geral', '${BIG_EVENT}', 'Geral', ${PRICE_GERAL}, 5000),
    ('tt-grande-vip', '${BIG_EVENT}', 'VIP', ${PRICE_VIP}, 500),
    ('tt-pequeno-geral', '${SMALL_EVENT}', 'Geral', ${PRICE_GERAL}, 500),
    ('tt-pequeno-vip', '${SMALL_EVENT}', 'VIP', ${PRICE_VIP}, 100),
    ('tt-outra', '${OTHER_EVENT}', 'Entrada', ${PRICE_OTHER}, 50);

  INSERT INTO orders (id, event_id, status, gross_amount_xof) VALUES
    ('order-grande', '${BIG_EVENT}', 'paid', 0),
    ('order-pequeno', '${SMALL_EVENT}', 'paid', 0),
    ('order-outra', '${OTHER_EVENT}', 'paid', 0);

  -- Evento grande: 520 compradores distintos, um bilhete Geral válido cada.
  -- created_at antigo e único garante uma fatia de 500 determinística.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  SELECT 'bulk-' || g,
         'order-grande',
         '${BIG_EVENT}',
         'tt-grande-geral',
         'qr-bulk-' || g,
         'code-bulk-' || g,
         'sig-bulk-' || g,
         'valid',
         'Comprador ' || LPAD(g::text, 3, '0'),
         '+245955' || LPAD(g::text, 6, '0'),
         NOW() - ((1000 + g) || ' minutes')::interval
  FROM generate_series(1, ${BULK_BUYERS}) AS g;

  -- Ana Silva: os 131 bilhetes mais recentes do evento grande, em dois tipos,
  -- por isso cai inteira dentro da vista paginada.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  SELECT 'ana-geral-' || g,
         'order-grande',
         '${BIG_EVENT}',
         'tt-grande-geral',
         'qr-ana-geral-' || g,
         'code-ana-geral-' || g,
         'sig-ana-geral-' || g,
         'valid',
         'Ana Silva',
         '+245955000001',
         NOW() - (g || ' seconds')::interval
  FROM generate_series(1, ${ANA_BIG_GERAL}) AS g;

  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  SELECT 'ana-vip-' || g,
         'order-grande',
         '${BIG_EVENT}',
         'tt-grande-vip',
         'qr-ana-vip-' || g,
         'code-ana-vip-' || g,
         'sig-ana-vip-' || g,
         'valid',
         'Ana Silva',
         '+245955000001',
         NOW() - (${ANA_BIG_GERAL} + g || ' seconds')::interval
  FROM generate_series(1, ${ANA_BIG_VIP}) AS g;

  -- Bruno: reserva pendente, sem valor pago.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  VALUES ('bruno-1', 'order-grande', '${BIG_EVENT}', 'tt-grande-vip', 'qr-bruno-1', 'code-bruno-1', 'sig-bruno-1', 'pending', 'Bruno Gomes', '', NOW() - interval '20 hours');

  -- Carla: um bilhete usado (conta como pago) e um cancelado (não conta).
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  VALUES ('carla-used', 'order-grande', '${BIG_EVENT}', 'tt-grande-geral', 'qr-carla-used', 'code-carla-used', 'sig-carla-used', 'used', 'Carla Mendes', '+245955000009', NOW() - interval '21 hours'),
         ('carla-cancelled', 'order-grande', '${BIG_EVENT}', 'tt-grande-geral', 'qr-carla-cancelled', 'code-carla-cancelled', 'sig-carla-cancelled', 'cancelled', 'Carla Mendes', '+245955000009', NOW() - interval '22 hours');

  -- Evento pequeno (cabe inteiro na vista paginada): 90 compradores + Ana.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  SELECT 'pequeno-' || g,
         'order-pequeno',
         '${SMALL_EVENT}',
         'tt-pequeno-geral',
         'qr-pequeno-' || g,
         'code-pequeno-' || g,
         'sig-pequeno-' || g,
         'valid',
         'Pequeno Comprador ' || LPAD(g::text, 3, '0'),
         '+245956' || LPAD(g::text, 6, '0'),
         NOW() - ((2000 + g) || ' minutes')::interval
  FROM generate_series(1, ${SMALL_SINGLE_BUYERS}) AS g;

  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  SELECT 'ana-pequeno-geral-' || g,
         'order-pequeno',
         '${SMALL_EVENT}',
         'tt-pequeno-geral',
         'qr-ana-pequeno-geral-' || g,
         'code-ana-pequeno-geral-' || g,
         'sig-ana-pequeno-geral-' || g,
         'valid',
         'Ana Silva',
         '+245955000001',
         NOW() - (g || ' seconds')::interval
  FROM generate_series(1, ${ANA_SMALL_GERAL}) AS g;

  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  SELECT 'ana-pequeno-vip-' || g,
         'order-pequeno',
         '${SMALL_EVENT}',
         'tt-pequeno-vip',
         'qr-ana-pequeno-vip-' || g,
         'code-ana-pequeno-vip-' || g,
         'sig-ana-pequeno-vip-' || g,
         'valid',
         'Ana Silva',
         '+245955000001',
         NOW() - (${ANA_SMALL_GERAL} + g || ' seconds')::interval
  FROM generate_series(1, ${ANA_SMALL_VIP}) AS g;

  -- Bilhetes de outra empresa: nunca podem entrar na vista nem na exportação.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone, created_at)
  SELECT 'outra-' || g,
         'order-outra',
         '${OTHER_EVENT}',
         'tt-outra',
         'qr-outra-' || g,
         'code-outra-' || g,
         'sig-outra-' || g,
         'valid',
         'Comprador Alheio ' || g,
         '+2459559999' || g,
         NOW() - (g || ' minutes')::interval
  FROM generate_series(1, ${OTHER_TOTAL}) AS g;
`;

type AggregationRow = { buyer: string; type: string; quantity: number; totalXOF: number };

const aggKey = (buyer: string, type: string) => `${buyer}\u0000${type}`;

function addAggregation(bucket: Map<string, AggregationRow>, buyer: string, type: string, quantity: number, totalXOF: number) {
  const key = aggKey(buyer, type);
  const current = bucket.get(key) || { buyer, type, quantity: 0, totalXOF: 0 };
  current.quantity += quantity;
  current.totalXOF += totalXOF;
  bucket.set(key, current);
  return bucket;
}

function sortedAggregation(bucket: Map<string, AggregationRow>): AggregationRow[] {
  return Array.from(bucket.values()).sort(
    (left, right) => left.buyer.localeCompare(right.buyer, 'pt') || left.type.localeCompare(right.type, 'pt'),
  );
}

/** O CSV agrega o total por comprador, não por tipo: comparam-se as quantidades. */
function quantitiesByBuyerAndType(bucket: Map<string, AggregationRow>) {
  return sortedAggregation(bucket).map(({ buyer, type, quantity }) => ({ buyer, type, quantity }));
}

function parseCsvRows(body: string): string[][] {
  return body
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .filter(Boolean)
    .map((line) => line.slice(1, -1).split('";"'));
}

/** "Geral x100 + VIP x31" -> { Geral: 100, VIP: 31 } */
function parseTypeCell(cell: string): Record<string, number> {
  const types: Record<string, number> = {};
  for (const part of cell.split(' + ')) {
    const match = part.match(/^(.*) x(\d+)$/);
    if (!match) throw new Error(`Tipos de bilhete inesperados: ${cell}`);
    types[match[1]] = Number(match[2]);
  }
  return types;
}

let server: Server;
let baseUrl: string;
let pool: Pool;
let auth: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
let previousDatabaseUrl: string | undefined;

async function login(): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: BUSINESS_EMAIL, password: PASSWORD }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  expect(response.status, payload.error).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

type SoldTicket = {
  id: string;
  status: string;
  priceXOF: number;
  buyerName: string | null;
  buyerPhone: string | null;
  ticketTypeName: string | null;
  eventId: string;
};

type SoldTicketsResponse = {
  tickets: SoldTicket[];
  totals: { total: number; valid: number; used: number; cancelled: number; pending: number; refunded: number; revenueXOF: number };
  limit: number;
  truncated: boolean;
};

async function fetchSoldTickets(cookie: string, eventId: string): Promise<SoldTicketsResponse> {
  const response = await fetch(`${baseUrl}/api/tickets/sold?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  return await response.json() as SoldTicketsResponse;
}

async function fetchExportCsv(cookie: string, eventId: string): Promise<string[][]> {
  const response = await fetch(`${baseUrl}/api/tickets/sold/export?eventId=${encodeURIComponent(eventId)}`, {
    headers: { Cookie: cookie },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/csv');
  return parseCsvRows(await response.text());
}

/** Agregação directa em SQL, opcionalmente limitada a um conjunto de bilhetes. */
async function sqlAggregation(eventId: string, ticketIds?: string[]): Promise<AggregationRow[]> {
  const result = await pool.query(
    `SELECT COALESCE(NULLIF(BTRIM(t.buyer_name), ''), NULLIF(BTRIM(t.holder_name), ''), 'Comprador não identificado') AS buyer,
            COALESCE(tt.name, 'Entrada Geral') AS ticket_type,
            COUNT(*)::int AS quantity,
            SUM(CASE WHEN t.status IN ('valid','used') THEN COALESCE(tt.price_xof, 0) ELSE 0 END)::bigint AS total_xof
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE e.company_id = $1
        AND t.event_id = $2
        AND ($3::text[] IS NULL OR t.id = ANY($3::text[]))
      GROUP BY 1, 2
      ORDER BY 1, 2`,
    [COMPANY, eventId, ticketIds ?? null],
  );
  return result.rows.map((row) => ({
    buyer: String(row.buyer),
    type: String(row.ticket_type),
    quantity: Number(row.quantity),
    totalXOF: Number(row.total_xof),
  }));
}

async function sqlStatusTotals(eventId: string, ticketIds: string[]) {
  const result = await pool.query(
    `SELECT t.status, COUNT(*)::int AS quantity,
            SUM(CASE WHEN t.status IN ('valid','used') THEN COALESCE(tt.price_xof, 0) ELSE 0 END)::bigint AS total_xof
       FROM tickets t
       LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
      WHERE t.id = ANY($1::text[]) AND t.event_id = $2
      GROUP BY t.status`,
    [ticketIds, eventId],
  );
  const totals = { total: 0, valid: 0, used: 0, cancelled: 0, pending: 0, refunded: 0, revenueXOF: 0 };
  for (const row of result.rows) {
    const quantity = Number(row.quantity);
    totals.total += quantity;
    if (row.status === 'valid' || row.status === 'used' || row.status === 'cancelled' || row.status === 'pending') {
      totals[row.status] += quantity;
    }
    totals.revenueXOF += Number(row.total_xof);
  }
  return totals;
}

function aggregationFromSoldTickets(tickets: SoldTicket[]): Map<string, AggregationRow> {
  const bucket = new Map<string, AggregationRow>();
  for (const ticket of tickets) {
    const paid = ticket.status === 'valid' || ticket.status === 'used';
    addAggregation(
      bucket,
      ticket.buyerName || 'Comprador não identificado',
      ticket.ticketTypeName || 'Entrada Geral',
      1,
      paid ? ticket.priceXOF : 0,
    );
  }
  return bucket;
}

function aggregationFromCsv(rows: string[][]): { bucket: Map<string, AggregationRow>; quantities: number; totalXOF: number } {
  const bucket = new Map<string, AggregationRow>();
  let quantities = 0;
  let totalXOF = 0;
  // [Comprador, Telefone, Bilhetes, Tipos, Total, Estado]
  for (const row of rows.slice(1)) {
    const [buyer, , quantityCell, typesCell, totalCell] = row;
    const types = parseTypeCell(typesCell);
    const quantity = Number(quantityCell);
    const total = Number(totalCell);
    expect(Object.values(types).reduce((sum, value) => sum + value, 0)).toBe(quantity);
    for (const [type, typeQuantity] of Object.entries(types)) {
      addAggregation(bucket, buyer, type, typeQuantity, 0);
    }
    quantities += quantity;
    totalXOF += total;
  }
  return { bucket, quantities, totalXOF };
}

describeIfDb('Agregação de bilhetes: /api/tickets/sold, exportação CSV e SQL directo', () => {
  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required for the tickets aggregation integration test.');
    previousDatabaseUrl = process.env.DATABASE_URL;
    // `server/db.ts` lê a ligação no import: aponta-a para o schema isolado
    // antes de carregar o servidor.
    process.env.DATABASE_URL = withIsolatedSchema(testDatabaseUrl);
    vi.resetModules();
    const db = await import('../../server/db');
    pool = db.databasePool!;
    expect(pool, 'TEST_DATABASE_URL must produce a pool').toBeTruthy();
    await pool.query(schemaSql);

    const { default: app } = await import('../../server');
    auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
    const account = auth.createUser({
      name: 'Empresa Agregação', email: BUSINESS_EMAIL, password: PASSWORD, role: 'business',
      phone: '+245955000010', neighborhood: 'Bissau', businessId: COMPANY, businessName: 'Empresa Agregação',
    });
    // A sessão em base de dados faz JOIN com `users`: a conta tem de existir lá.
    expect(account).toBeTruthy();
    await pool.query('INSERT INTO users (id, role) VALUES ($1, $2)', [account!.id, 'business']);

    server = (app as Express).listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 120_000);

  afterAll(async () => {
    if (server) {
      // Sem isto as ligações keep-alive seguradas pelo fetch atrasam o fecho.
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => undefined);
      await pool.end();
    }
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }, 30_000);

  it('evento pequeno: vista paginada, CSV e SQL concordam por comprador e tipo', async () => {
    const cookie = await login();
    const sold = await fetchSoldTickets(cookie, SMALL_EVENT);
    const csv = await fetchExportCsv(cookie, SMALL_EVENT);
    const sql = await sqlAggregation(SMALL_EVENT);

    // Cabe inteiro na vista: sem truncagem.
    expect(sold.limit).toBe(TICKET_LIST_LIMIT);
    expect(sold.truncated).toBe(false);
    expect(sold.tickets).toHaveLength(SMALL_TOTAL);

    const fromEndpoint = aggregationFromSoldTickets(sold.tickets);
    const fromSql = new Map<string, AggregationRow>();
    for (const row of sql) fromSql.set(aggKey(row.buyer, row.type), row);
    const fromCsv = aggregationFromCsv(csv);

    expect(sortedAggregation(fromEndpoint)).toEqual(sortedAggregation(fromSql));
    expect(quantitiesByBuyerAndType(fromCsv.bucket)).toEqual(quantitiesByBuyerAndType(fromSql));

    // Ana Silva tem dois tipos no mesmo evento.
    expect(fromSql.get(aggKey('Ana Silva', 'Geral'))).toMatchObject({ quantity: ANA_SMALL_GERAL, totalXOF: ANA_SMALL_GERAL * PRICE_GERAL });
    expect(fromSql.get(aggKey('Ana Silva', 'VIP'))).toMatchObject({ quantity: ANA_SMALL_VIP, totalXOF: ANA_SMALL_VIP * PRICE_VIP });

    // Linha única da Ana na exportação, com os dois tipos e o total somado.
    expect(csv.find((row) => row[0] === 'Ana Silva')).toEqual([
      'Ana Silva', '+245955000001', String(ANA_SMALL_GERAL + ANA_SMALL_VIP),
      `Geral x${ANA_SMALL_GERAL} + VIP x${ANA_SMALL_VIP}`,
      String(ANA_SMALL_GERAL * PRICE_GERAL + ANA_SMALL_VIP * PRICE_VIP),
      'Pago',
    ]);

    const expectedRevenue = SMALL_SINGLE_BUYERS * PRICE_GERAL + ANA_SMALL_GERAL * PRICE_GERAL + ANA_SMALL_VIP * PRICE_VIP;
    expect(fromCsv.quantities).toBe(SMALL_TOTAL);
    expect(fromCsv.totalXOF).toBe(expectedRevenue);
    expect(sold.totals).toEqual({
      total: SMALL_TOTAL,
      valid: SMALL_TOTAL,
      used: 0,
      cancelled: 0,
      pending: 0,
      refunded: 0,
      revenueXOF: expectedRevenue,
    });
  }, 30_000);

  it('evento grande (> 500): a vista trunca nos 500 e a exportação cobre os 654', async () => {
    const cookie = await login();
    const sold = await fetchSoldTickets(cookie, BIG_EVENT);
    const csv = await fetchExportCsv(cookie, BIG_EVENT);

    expect(sold.limit).toBe(TICKET_LIST_LIMIT);
    expect(sold.truncated).toBe(true);
    expect(sold.tickets).toHaveLength(TICKET_LIST_LIMIT);

    const fromCsv = aggregationFromCsv(csv);
    expect(fromCsv.quantities).toBe(BIG_TOTAL);
    expect(fromCsv.quantities).toBeGreaterThan(TICKET_LIST_LIMIT);
    // O comprador mais antigo só existe na exportação: a vista parou antes dele.
    expect(csv.map((row) => row[0])).toContain('Comprador 520');
    expect(sold.tickets.map((ticket) => ticket.buyerName)).not.toContain('Comprador 520');

    // Ana Silva cai inteira na vista paginada: mesmas quantidades no CSV, e a
    // linha dela já abaixo confirma o total somado dos dois tipos.
    expect(fromCsv.bucket.get(aggKey('Ana Silva', 'Geral'))?.quantity).toBe(ANA_BIG_GERAL);
    expect(fromCsv.bucket.get(aggKey('Ana Silva', 'VIP'))?.quantity).toBe(ANA_BIG_VIP);
    expect(csv.find((row) => row[0] === 'Ana Silva')).toEqual([
      'Ana Silva', '+245955000001', String(ANA_BIG_GERAL + ANA_BIG_VIP),
      `Geral x${ANA_BIG_GERAL} + VIP x${ANA_BIG_VIP}`,
      String(ANA_BIG_GERAL * PRICE_GERAL + ANA_BIG_VIP * PRICE_VIP),
      'Pago',
    ]);

    // A agregação da exportação coincide com o SQL directo sobre todos os bilhetes.
    const sqlAll = await sqlAggregation(BIG_EVENT);
    const fromSqlAll = new Map<string, AggregationRow>();
    for (const row of sqlAll) fromSqlAll.set(aggKey(row.buyer, row.type), row);
    expect(quantitiesByBuyerAndType(fromCsv.bucket)).toEqual(quantitiesByBuyerAndType(fromSqlAll));

    // Cada grupo devolvido pela vista existe, completo, na exportação.
    const fromEndpoint = aggregationFromSoldTickets(sold.tickets);
    for (const [key, row] of fromEndpoint) {
      expect(fromCsv.bucket.get(key)?.quantity, `grupo ${row.buyer} / ${row.type}`).toBe(row.quantity);
    }
  }, 30_000);

  it('a vista paginada é a mesma agregação do SQL limitada aos bilhetes que devolve', async () => {
    const cookie = await login();
    const sold = await fetchSoldTickets(cookie, BIG_EVENT);
    const ids = sold.tickets.map((ticket) => ticket.id);

    const sqlLimited = await sqlAggregation(BIG_EVENT, ids);
    const fromSqlLimited = new Map<string, AggregationRow>();
    for (const row of sqlLimited) fromSqlLimited.set(aggKey(row.buyer, row.type), row);

    expect(sortedAggregation(aggregationFromSoldTickets(sold.tickets))).toEqual(sortedAggregation(fromSqlLimited));
    // Os 500 bilhetes são os mais recentes, tal como o ORDER BY da vista.
    const newest = await pool.query(
      `SELECT t.id FROM tickets t WHERE t.event_id = $1 ORDER BY t.created_at DESC LIMIT $2`,
      [BIG_EVENT, TICKET_LIST_LIMIT],
    );
    expect(ids).toEqual(newest.rows.map((row) => String(row.id)));
    expect(sold.totals).toEqual(await sqlStatusTotals(BIG_EVENT, ids));
  }, 30_000);

  it('nunca agrega bilhetes de outra empresa', async () => {
    const cookie = await login();
    const sold = await fetchSoldTickets(cookie, OTHER_EVENT);
    const csv = await fetchExportCsv(cookie, OTHER_EVENT);
    const sql = await sqlAggregation(OTHER_EVENT);

    expect(sold.tickets).toEqual([]);
    expect(sold.totals.total).toBe(0);
    expect(sold.truncated).toBe(false);
    expect(csv).toHaveLength(1); // apenas o cabeçalho
    expect(sql).toEqual([]);

    // O SQL directo sem escopo da empresa mostra os três bilhetes alheios.
    const otherCompany = await pool.query(
      `SELECT COUNT(*)::int AS n FROM tickets t JOIN events e ON e.id = t.event_id WHERE e.company_id = $1`,
      [OTHER_COMPANY],
    );
    expect(otherCompany.rows[0].n).toBe(OTHER_TOTAL);
  }, 30_000);
});
