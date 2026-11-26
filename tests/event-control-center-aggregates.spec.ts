import 'dotenv/config';
import { Pool } from 'pg';
import { expect, test } from './fixtures';
import { loadEventControlCenter, type EventViewer } from '../server/eventControlCenter';

// Os testes desta especificação escrevem pedidos no mesmo evento e o teste de
// /api/admin/stats lê totais globais: correm em série para não se contaminarem.
test.describe.configure({ mode: 'serial' });

/**
 * Indicadores do centro de controlo de eventos.
 *
 * Os totais (vendidos, utilizados, por utilizar, cancelados, receita) e as
 * vendas por tipo/dia são agregados em SQL sobre o evento completo. A lista
 * detalhada continua limitada; estes testes provam que o limite não afecta os
 * números, inclusive num evento com mais de 2.000 bilhetes.
 */

const ADMIN_VIEWER: EventViewer = { role: 'admin', userId: 'audit-user', companyId: null };
const OWN_EVENT = 'evt-1';
const BIG_EVENT = 'evt-audit-aggregate-2500';

async function withDb<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

test('com a lista limitada a 1 bilhete, os indicadores continuam a representar o evento completo', async () => {
  const full = await withDb((pool) => loadEventControlCenter(pool, OWN_EVENT, ADMIN_VIEWER, { ticketLimit: 50000 }));
  const limited = await withDb((pool) => loadEventControlCenter(pool, OWN_EVENT, ADMIN_VIEWER, { ticketLimit: 1 }));
  expect(full).toBeTruthy();
  expect(limited).toBeTruthy();

  // A lista respeita o limite…
  expect(limited!.tickets.length).toBe(1);
  expect(full!.tickets.length).toBeGreaterThan(1);

  // …mas os totais são iguais aos do evento completo.
  expect(limited!.indicators.sold).toBe(full!.indicators.sold);
  expect(limited!.indicators.used).toBe(full!.indicators.used);
  expect(limited!.indicators.unused).toBe(full!.indicators.unused);
  expect(limited!.indicators.cancelled).toBe(full!.indicators.cancelled);
  expect(limited!.indicators.revenueXOF).toBe(full!.indicators.revenueXOF);
  expect(limited!.indicators.capacity).toBe(full!.indicators.capacity);
  expect(limited!.salesByType).toEqual(full!.salesByType);
  expect(limited!.salesByDay).toEqual(full!.salesByDay);
  expect(limited!.truncated).toBe(true);

  // Confronto com a verdade em SQL.
  const truth = await withDb(async (client) => {
    const counts = await client.query(
      `SELECT status, COUNT(*)::int AS n FROM tickets WHERE event_id = $1 GROUP BY status`,
      [OWN_EVENT],
    );
    const revenue = await client.query(
      `SELECT COALESCE(SUM(COALESCE(tt.price_xof,0)),0)::bigint AS total
         FROM tickets t LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
        WHERE t.event_id = $1 AND t.status IN ('valid','used')`,
      [OWN_EVENT],
    );
    return { counts: counts.rows, revenue: Number(revenue.rows[0]?.total ?? 0) };
  });
  const byStatus = new Map(truth.counts.map((row) => [String(row.status), Number(row.n)]));
  expect(limited!.indicators.used).toBe(byStatus.get('used') ?? 0);
  expect(limited!.indicators.unused).toBe(byStatus.get('valid') ?? 0);
  expect(limited!.indicators.cancelled).toBe(byStatus.get('cancelled') ?? 0);
  expect(limited!.indicators.revenueXOF).toBe(truth.revenue);
});

test('pedidos pagos antigos não ficam sem comissão registada', async () => {
  const missing = await withDb((pool) =>
    pool.query(
      `SELECT COUNT(*)::int AS n FROM orders
        WHERE status = 'paid' AND fee_policy IS NULL AND fee_amount_xof = 0 AND gross_amount_xof > 0`,
    ),
  );
  expect(Number(missing.rows[0]?.n ?? 0)).toBe(0);
});

test('/api/admin/stats usa a comissão dos pedidos pagos, a mesma fonte do centro de controlo', async ({ request }) => {
  const truth = await withDb(async (pool) => {
    const global = await pool.query(
      `SELECT COALESCE(SUM(gross_amount_xof),0)::bigint AS gross,
              COALESCE(SUM(fee_amount_xof),0)::bigint AS fee,
              COALESCE(SUM(net_amount_xof),0)::bigint AS net
         FROM orders WHERE status = 'paid'`,
    );
    const event = await pool.query(
      `SELECT COALESCE(SUM(fee_amount_xof),0)::bigint AS fee
         FROM orders WHERE status = 'paid' AND event_id = $1`,
      [OWN_EVENT],
    );
    return {
      gross: Number(global.rows[0]?.gross ?? 0),
      fee: Number(global.rows[0]?.fee ?? 0),
      net: Number(global.rows[0]?.net ?? 0),
      eventFee: Number(event.rows[0]?.fee ?? 0),
    };
  });
  expect(truth.fee).toBeGreaterThan(0);

  const login = await request.post('/api/auth/login', {
    data: { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' },
  });
  expect(login.ok(), await login.text()).toBeTruthy();

  const response = await request.get('/api/admin/stats');
  expect(response.ok(), await response.text()).toBeTruthy();
  const { revenue } = await response.json();
  expect(revenue.source).toBe('orders.fee_amount_xof');
  expect(revenue.grossXOF).toBe(truth.gross);
  expect(revenue.commissionXOF).toBe(truth.fee);
  expect(revenue.netXOF).toBe(truth.net);

  const event = await withDb((pool) => loadEventControlCenter(pool, OWN_EVENT, ADMIN_VIEWER));
  expect(event!.finance.commissionXOF).toBe(truth.eventFee);
  expect(event!.finance.companyShareXOF).toBe(
    event!.finance.grossXOF - event!.finance.commissionXOF,
  );
});

test('evento, empresa e plataforma usam a mesma comissão e o mesmo líquido', async ({ request }) => {
  const companyId = 'biz-1';
  const eventIds = await withDb(async (pool) => {
    const result = await pool.query(
      `SELECT DISTINCT e.id FROM orders o JOIN events e ON e.id = o.event_id
        WHERE e.company_id = $1 AND o.status = 'paid' ORDER BY e.id`,
      [companyId],
    );
    return result.rows.map((row) => String(row.id));
  });
  expect(eventIds.length).toBeGreaterThan(0);

  const events = [];
  for (const eventId of eventIds) {
    const data = await withDb((pool) => loadEventControlCenter(pool, eventId, ADMIN_VIEWER, { ticketLimit: 50000 }));
    expect(data).toBeTruthy();
    expect(data!.finance.grossXOF).toBe(data!.finance.commissionXOF + data!.finance.companyShareXOF);
    events.push(data!);
  }
  const companyView = events.reduce(
    (acc, event) => ({
      gross: acc.gross + event.finance.grossXOF,
      fee: acc.fee + event.finance.commissionXOF,
      net: acc.net + event.finance.companyShareXOF,
    }),
    { gross: 0, fee: 0, net: 0 },
  );

  const truth = await withDb(async (pool) => {
    const company = await pool.query(
      `SELECT COALESCE(SUM(o.gross_amount_xof),0)::bigint AS gross,
              COALESCE(SUM(o.fee_amount_xof),0)::bigint AS fee,
              COALESCE(SUM(o.net_amount_xof),0)::bigint AS net
         FROM orders o JOIN events e ON e.id = o.event_id
        WHERE e.company_id = $1 AND o.status = 'paid'`,
      [companyId],
    );
    const platform = await pool.query(
      `SELECT COALESCE(SUM(gross_amount_xof),0)::bigint AS gross,
              COALESCE(SUM(fee_amount_xof),0)::bigint AS fee,
              COALESCE(SUM(net_amount_xof),0)::bigint AS net
         FROM orders WHERE status = 'paid'`,
    );
    const toNumbers = (row: Record<string, unknown>) => ({
      gross: Number(row.gross ?? 0),
      fee: Number(row.fee ?? 0),
      net: Number(row.net ?? 0),
    });
    return { company: toNumbers(company.rows[0]), platform: toNumbers(platform.rows[0]) };
  });

  // Os ecrãs de evento da empresa somam exatamente o mesmo que o financeiro da empresa.
  expect(companyView).toEqual(truth.company);

  const login = await request.post('/api/auth/login', {
    data: { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' },
  });
  expect(login.ok(), await login.text()).toBeTruthy();

  const statsResponse = await request.get('/api/admin/stats');
  expect(statsResponse.ok(), await statsResponse.text()).toBeTruthy();
  const stats = await statsResponse.json();
  expect(stats.revenue.commissionXOF).toBe(truth.platform.fee);
  expect(stats.revenue.netXOF).toBe(truth.platform.net);
  expect(stats.revenue.grossXOF).toBe(truth.platform.gross);

  const overviewResponse = await request.get('/api/admin/commercial/overview');
  expect(overviewResponse.ok(), await overviewResponse.text()).toBeTruthy();
  const overview = await overviewResponse.json();
  expect(overview.ticketFees.generatedRevenueXOF).toBe(stats.revenue.commissionXOF);
  expect(overview.ticketFees.netTicketVolumeXOF).toBe(stats.revenue.netXOF);
  expect(overview.ticketFees.grossTicketVolumeXOF).toBe(stats.revenue.grossXOF);
  expect(overview.ticketFees.ticketCount).toBe(stats.orders.byStatus.paid);
});

test('evento com 2.500 bilhetes: indicadores somam o evento inteiro e a lista fica truncada em 2.000', async () => {
  const created = await withDb(async (client) => {
    await client.query(`DELETE FROM ticket_refunds WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = $1)`, [BIG_EVENT]);
    await client.query(`DELETE FROM tickets WHERE event_id = $1`, [BIG_EVENT]);
    await client.query(`DELETE FROM orders WHERE event_id = $1`, [BIG_EVENT]);
    await client.query(`DELETE FROM ticket_types WHERE event_id = $1`, [BIG_EVENT]);
    await client.query(`DELETE FROM events WHERE id = $1`, [BIG_EVENT]);

    await client.query(
      `INSERT INTO events (id, company_id, title, status, starts_at, ends_at)
       VALUES ($1, 'biz-1', 'Evento de auditoria (2.500 bilhetes)', 'published', NOW(), NOW() + interval '2 days')`,
      [BIG_EVENT],
    );
    await client.query(
      `INSERT INTO ticket_types (id, event_id, name, price_xof, quantity) VALUES
         ('tt-audit-a', $1, 'Geral', 10, 2000),
         ('tt-audit-b', $1, 'VIP', 20, 500)`,
      [BIG_EVENT],
    );
    await client.query(
      `INSERT INTO orders (id, event_id, status, gross_amount_xof, fee_amount_xof, net_amount_xof)
       VALUES ('ord-audit-a', $1, 'paid', 40000, 4000, 36000),
              ('ord-audit-b', $1, 'paid', 10000, 1000, 9000)`,
      [BIG_EVENT],
    );
    // Comprador A: 2.000 bilhetes; comprador B: 500. No total, 600 usados,
    // 1.800 válidos e 100 cancelados, alternando dois tipos de bilhete.
    await client.query(
      `INSERT INTO tickets (id, order_id, event_id, ticket_type_id, buyer_name, buyer_phone, qr_token, ticket_code, signature, status, created_at)
       SELECT 'aud-' || g,
              CASE WHEN g <= 2000 THEN 'ord-audit-a' ELSE 'ord-audit-b' END,
              $1,
              CASE WHEN g % 5 = 0 THEN 'tt-audit-b' ELSE 'tt-audit-a' END,
              CASE WHEN g <= 2000 THEN 'Comprador A' ELSE 'Comprador B' END,
              CASE WHEN g <= 2000 THEN '+245000000001' ELSE '+245000000002' END,
              'qr-audit-' || g,
              'cod-audit-' || g,
              'sig-audit',
              CASE WHEN g <= 600 THEN 'used' WHEN g <= 1900 THEN 'valid' WHEN g <= 2000 THEN 'cancelled' ELSE 'valid' END,
              NOW() - (g || ' minutes')::interval
         FROM generate_series(1, 2500) AS g`,
      [BIG_EVENT],
    );
    // 250 reembolsos pedidos; a lista detalhada só devolve 200.
    await client.query(
      `INSERT INTO ticket_refunds (id, ticket_id, order_id, company_id, amount_xof, reason, status, created_at)
       SELECT 'ref-audit-' || g,
              'aud-' || g,
              CASE WHEN g <= 2000 THEN 'ord-audit-a' ELSE 'ord-audit-b' END,
              'biz-1',
              10,
              'Auditoria',
              'requested',
              NOW() - (g || ' minutes')::interval
         FROM generate_series(1, 250) AS g`,
    );
  }).then(() => true);

  expect(created).toBe(true);

  try {
    const data = await withDb((pool) => loadEventControlCenter(pool, BIG_EVENT, ADMIN_VIEWER));
    expect(data).toBeTruthy();

    expect(data!.indicators.sold).toBe(2400);
    expect(data!.indicators.used).toBe(600);
    expect(data!.indicators.unused).toBe(1800);
    expect(data!.indicators.cancelled).toBe(100);
    expect(data!.indicators.available).toBe(100);
    // 1.920 bilhetes Geral × 10 XOF + 480 VIP × 20 XOF = 28.800 XOF.
    expect(data!.indicators.revenueXOF).toBe(28800);
    expect(data!.salesByType.reduce((sum, row) => sum + row.tickets, 0)).toBe(2400);
    expect(data!.salesByType.reduce((sum, row) => sum + row.revenueXOF, 0)).toBe(28800);

    // A lista detalhada continua limitada e sinalizada.
    expect(data!.truncated).toBe(true);
    expect(data!.tickets.length).toBe(2000);
    expect(data!.ticketTypes.find((type) => type.id === 'tt-audit-a')?.sold).toBe(1920);
    expect(data!.ticketTypes.find((type) => type.id === 'tt-audit-b')?.sold).toBe(480);

    // Totais por comprador somados em SQL sobre o evento completo: o comprador
    // B só tem bilhetes fora da lista detalhada, mas continua no agregado.
    expect(data!.buyers).toHaveLength(2);
    const buyerA = data!.buyers.find((buyer) => buyer.name === 'Comprador A');
    const buyerB = data!.buyers.find((buyer) => buyer.name === 'Comprador B');
    expect(buyerA).toMatchObject({
      quantity: 2000,
      totalXOF: 22800,
      validatedCount: 600,
      orderStatus: 'paid',
      ticketStatus: 'cancelled/used/valid',
    });
    expect(buyerB).toMatchObject({
      quantity: 500,
      totalXOF: 6000,
      validatedCount: 0,
      orderStatus: 'paid',
      ticketStatus: 'valid',
    });
    expect(buyerA!.ticketTypes).toBe('Geral x1600 + VIP x400');
    expect(buyerB!.ticketTypes).toBe('Geral x400 + VIP x100');
    expect(buyerA!.totalXOF + buyerB!.totalXOF).toBe(data!.indicators.revenueXOF);

    // O total de reembolsos pedidos também vem de SQL sobre o evento completo;
    // a lista visível fica limitada a 200 linhas e não pode reduzir o total.
    expect(data!.finance.refundsRequestedXOF).toBe(2500);
    expect(data!.refunds).toHaveLength(200);
  } finally {
    await withDb(async (client) => {
      await client.query(`DELETE FROM ticket_refunds WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = $1)`, [BIG_EVENT]);
      await client.query(`DELETE FROM tickets WHERE event_id = $1`, [BIG_EVENT]);
      await client.query(`DELETE FROM orders WHERE event_id = $1`, [BIG_EVENT]);
      await client.query(`DELETE FROM ticket_types WHERE event_id = $1`, [BIG_EVENT]);
      await client.query(`DELETE FROM events WHERE id = $1`, [BIG_EVENT]);
    });
  }
});
