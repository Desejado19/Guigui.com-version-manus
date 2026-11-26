import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Teste de integração opt-in: exige uma base PostgreSQL descartável em
// TEST_DATABASE_URL. Sem a variável, toda a suite fica skipped e o
// `npm run test:unit` continua verde sem base de dados.
//
// O teste do endpoint (`ticketsSoldExport.test.ts`) substitui
// `exportPostgresTicketsByBuyer` por uma fixture: prova o CSV, a autenticação e
// a autorização, mas não a query. Aqui corre a query verdadeira contra
// PostgreSQL, com 654 bilhetes (> 500) e confirma que nada é truncado.
//
// Isolamento: todas as tabelas vivem num schema próprio (`tickets_export_it`),
// aplicado via `options=-c search_path=...` na ligação. Assim o teste não
// colide com as tabelas `public` usadas por outro ficheiro de integração que
// possa correr em paralelo na mesma base.
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const describeIfDb = testDatabaseUrl ? describe : describe.skip;

const SCHEMA = 'tickets_export_it';
const COMPANY = 'co-tickets-export';
const OTHER_COMPANY = 'co-tickets-export-outra';
const EVENT = 'evt-tickets-export-bulk';
const OTHER_EVENT = 'evt-tickets-export-outra';

const BULK_BUYERS = 520;
const ANA_GERAL = 100;
const ANA_VIP = 31;
const OTHER_COMPANY_TICKETS = 3;
// 520 individuais + 100 Geral + 31 VIP + 1 pendente + 2 da Carla.
const TOTAL_COMPANY_TICKETS = BULK_BUYERS + ANA_GERAL + ANA_VIP + 1 + 2;

/** Acrescenta o search_path do schema isolado à URL de teste. */
function withIsolatedSchema(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('options', `-c search_path=${SCHEMA}`);
  return parsed.toString();
}

const schemaSql = `
  DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;
  CREATE SCHEMA ${SCHEMA};

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

  INSERT INTO companies (id, name) VALUES
    ('${COMPANY}', 'Empresa Exportação'),
    ('${OTHER_COMPANY}', 'Empresa Alheia');

  INSERT INTO events (id, company_id, title) VALUES
    ('${EVENT}', '${COMPANY}', 'Festival Grande'),
    ('${OTHER_EVENT}', '${OTHER_COMPANY}', 'Evento Alheio');

  INSERT INTO ticket_types (id, event_id, name, price_xof, quantity) VALUES
    ('tt-geral', '${EVENT}', 'Geral', 5000, 1000),
    ('tt-vip', '${EVENT}', 'VIP', 15000, 200),
    ('tt-outra', '${OTHER_EVENT}', 'Entrada', 7000, 50);

  INSERT INTO orders (id, event_id, status, gross_amount_xof) VALUES
    ('order-bulk', '${EVENT}', 'paid', 0),
    ('order-outra', '${OTHER_EVENT}', 'paid', 0);

  -- 520 compradores distintos com um bilhete Geral válido cada.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone)
  SELECT 'bulk-' || g,
         'order-bulk',
         '${EVENT}',
         'tt-geral',
         'qr-bulk-' || g,
         'code-bulk-' || g,
         'sig-bulk-' || g,
         'valid',
         'Comprador ' || LPAD(g::text, 3, '0'),
         '+245955' || LPAD(g::text, 6, '0')
  FROM generate_series(1, ${BULK_BUYERS}) AS g;

  -- Ana Silva: dois tipos de bilhete no mesmo evento.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone)
  SELECT 'ana-geral-' || g,
         'order-bulk',
         '${EVENT}',
         'tt-geral',
         'qr-ana-geral-' || g,
         'code-ana-geral-' || g,
         'sig-ana-geral-' || g,
         'valid',
         'Ana Silva',
         '+245955000001'
  FROM generate_series(1, ${ANA_GERAL}) AS g;

  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone)
  SELECT 'ana-vip-' || g,
         'order-bulk',
         '${EVENT}',
         'tt-vip',
         'qr-ana-vip-' || g,
         'code-ana-vip-' || g,
         'sig-ana-vip-' || g,
         'valid',
         'Ana Silva',
         '+245955000001'
  FROM generate_series(1, ${ANA_VIP}) AS g;

  -- Bruno: reserva pendente, sem valor pago.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone)
  VALUES ('bruno-1', 'order-bulk', '${EVENT}', 'tt-vip', 'qr-bruno-1', 'code-bruno-1', 'sig-bruno-1', 'pending', 'Bruno Gomes', '');

  -- Carla: um bilhete usado (conta como pago) e um cancelado (não conta).
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone)
  VALUES ('carla-used', 'order-bulk', '${EVENT}', 'tt-geral', 'qr-carla-used', 'code-carla-used', 'sig-carla-used', 'used', 'Carla Mendes', '+245955000009'),
         ('carla-cancelled', 'order-bulk', '${EVENT}', 'tt-geral', 'qr-carla-cancelled', 'code-carla-cancelled', 'sig-carla-cancelled', 'cancelled', 'Carla Mendes', '+245955000009');

  -- Bilhetes de outra empresa: nunca podem aparecer na exportação.
  INSERT INTO tickets (id, order_id, event_id, ticket_type_id, qr_token, ticket_code, signature, status, buyer_name, buyer_phone)
  SELECT 'outra-' || g,
         'order-outra',
         '${OTHER_EVENT}',
         'tt-outra',
         'qr-outra-' || g,
         'code-outra-' || g,
         'sig-outra-' || g,
         'valid',
         'Comprador Alheio ' || g,
         '+2459559999' || g
  FROM generate_series(1, ${OTHER_COMPANY_TICKETS}) AS g;
`;

describeIfDb('Exportação de bilhetes — agregação SQL real (> 500 bilhetes)', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let pool: Pool;
  let exportPostgresTicketsByBuyer: typeof import('../../server/postgresTicketLifecycleService')['exportPostgresTicketsByBuyer'];
  let rows: Awaited<ReturnType<typeof exportPostgresTicketsByBuyer>>;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required for the tickets export integration test.');
    // `server/db.ts` lê a ligação no import: aponta-a para o schema isolado
    // antes de carregar o módulo e a query.
    process.env.DATABASE_URL = withIsolatedSchema(testDatabaseUrl);
    vi.resetModules();
    const db = await import('../../server/db');
    pool = db.databasePool!;
    expect(pool, 'TEST_DATABASE_URL must produce a pool').toBeTruthy();

    await pool.query(schemaSql);
    exportPostgresTicketsByBuyer = (await import('../../server/postgresTicketLifecycleService'))
      .exportPostgresTicketsByBuyer;
    // Uma única leitura para todas as asserções; as consultas seguintes só
    // verificam o âmbito e o filtro.
    rows = await exportPostgresTicketsByBuyer(COMPANY);
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => undefined);
      await pool.end();
    }
    // Nunca deixar a URL do schema de teste no ambiente do worker.
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  it('exporta os 654 bilhetes da empresa sem truncar nos 500', async () => {
    const stored = await pool.query(
      `SELECT COUNT(*)::int AS n FROM tickets t JOIN events e ON e.id = t.event_id WHERE e.company_id = $1`,
      [COMPANY],
    );
    expect(stored.rows[0].n).toBe(TOTAL_COMPANY_TICKETS);

    // A prova de que a query não tem LIMIT: a soma das quantidades agregadas
    // iguala o número de bilhetes que existe na tabela.
    expect(rows.length).toBeGreaterThan(500);
    expect(rows.reduce((total, row) => total + row.quantity, 0)).toBe(TOTAL_COMPANY_TICKETS);
    expect(rows.length).toBe(BULK_BUYERS + 2 + 1 + 1);
    expect(rows.map((row) => row.buyerName)).toContain('Comprador 520');
    expect(rows.filter((row) => row.buyerName.startsWith('Comprador '))).toHaveLength(BULK_BUYERS);
  });

  it('agrega por comprador e tipo de bilhete com quantidades e totais reais', () => {
    const ana = rows.filter((row) => row.buyerName === 'Ana Silva');
    expect(ana.map((row) => ({ type: row.ticketTypeName, quantity: row.quantity, total: row.totalXOF }))).toEqual([
      { type: 'Geral', quantity: ANA_GERAL, total: ANA_GERAL * 5000 },
      { type: 'VIP', quantity: ANA_VIP, total: ANA_VIP * 15000 },
    ]);
    expect(ana.every((row) => row.paid && !row.pending && !row.cancelled)).toBe(true);
    expect(ana.every((row) => row.eventId === EVENT && row.eventTitle === 'Festival Grande')).toBe(true);
    expect(ana[0].buyerPhone).toBe('+245955000001');

    // 965 000 XOF somados a partir de 100 x 5 000 + 31 x 15 000.
    expect(ana.reduce((total, row) => total + row.totalXOF, 0)).toBe(965_000);

    expect(rows.find((row) => row.buyerName === 'Bruno Gomes')).toMatchObject({
      buyerPhone: '',
      ticketTypeName: 'VIP',
      quantity: 1,
      totalXOF: 0,
      paid: false,
      pending: true,
      cancelled: false,
    });

    // 'used' conta como pago; 'cancelled' entra na quantidade mas não no total.
    expect(rows.find((row) => row.buyerName === 'Carla Mendes')).toMatchObject({
      ticketTypeName: 'Geral',
      quantity: 2,
      totalXOF: 5000,
      paid: true,
      pending: false,
      cancelled: true,
    });
  });

  it('respeita o filtro de evento e o âmbito da empresa', async () => {
    const filtered = await exportPostgresTicketsByBuyer(COMPANY, EVENT);
    expect(filtered).toHaveLength(rows.length);
    expect(filtered.reduce((total, row) => total + row.quantity, 0)).toBe(TOTAL_COMPANY_TICKETS);

    // Evento de outra empresa com a empresa da sessão: nada.
    await expect(exportPostgresTicketsByBuyer(COMPANY, OTHER_EVENT)).resolves.toEqual([]);

    // A empresa alheia só vê os seus próprios bilhetes (três compradores).
    const other = await exportPostgresTicketsByBuyer(OTHER_COMPANY);
    expect(other).toHaveLength(OTHER_COMPANY_TICKETS);
    expect(other.every((row) => row.eventId === OTHER_EVENT && row.eventTitle === 'Evento Alheio')).toBe(true);
    expect(other.every((row) => row.ticketTypeName === 'Entrada' && row.quantity === 1 && row.paid)).toBe(true);
    expect(other.map((row) => row.buyerName)).toEqual([
      'Comprador Alheio 1',
      'Comprador Alheio 2',
      'Comprador Alheio 3',
    ]);
    expect(other.reduce((total, row) => total + row.totalXOF, 0)).toBe(OTHER_COMPANY_TICKETS * 7000);
  });
});
