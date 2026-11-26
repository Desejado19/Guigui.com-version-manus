import 'dotenv/config';
import { Pool } from 'pg';
import { expect, test, type Page } from './fixtures';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees } from '../src/data/monetizationCatalog';

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };
const BUSINESS = { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' };
const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };

const EVENT_ID = 'evt-finance-traceability';
const OTHER_EVENT_ID = 'evt-finance-other-company';
const TYPE_ID = 'tt-finance-traceability';
const OTHER_TYPE_ID = 'tt-finance-other';
const COMPANY_ID = 'biz-1';
const OTHER_COMPANY_ID = 'biz-finance-other';

test.describe.configure({ mode: 'serial' });

async function withDb<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function signIn(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function expectedBuyerTotal(priceXOF: number, quantity: number): Promise<number> {
  return withDb(async (pool) => {
    const result = await pool.query("SELECT * FROM ticket_fee_settings WHERE id='default' AND is_active=TRUE");
    const policy = result.rows[0];
    const catalog = {
      ...DEFAULT_MONETIZATION_CATALOG,
      ticketFeePolicy: {
        ...DEFAULT_MONETIZATION_CATALOG.ticketFeePolicy,
        ...(policy ? {
          commissionPercentage: Number(policy.commission_percentage),
          fixedFee: Number(policy.fixed_fee_xof),
          currency: String(policy.currency || 'XOF'),
          feePayer: String(policy.fee_payer || 'organizer') as typeof DEFAULT_MONETIZATION_CATALOG.ticketFeePolicy.feePayer,
          billingModel: String(policy.billing_model || 'percentage_plus_fixed') as typeof DEFAULT_MONETIZATION_CATALOG.ticketFeePolicy.billingModel,
        } : {}),
      },
    };
    return calculateTicketFees(catalog, priceXOF, quantity).buyerTotal;
  });
}

async function createEvent(pool: Pool, input: {
  id: string;
  companyId: string;
  typeId: string;
  title: string;
  priceXOF: number;
}) {
  await pool.query(
    `INSERT INTO companies (id,name,status) VALUES ($1,$2,'active')
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, status='active'`,
    [input.companyId, input.companyId === COMPANY_ID ? 'Nexus.GW' : 'Empresa Financeira Alheia'],
  );
  await pool.query(
    `INSERT INTO events (id, company_id, title, status, starts_at, ends_at, data)
     VALUES ($1,$2,$3,'published', NOW() + interval '2 days', NOW() + interval '3 days', $4::jsonb)
     ON CONFLICT (id) DO UPDATE SET company_id=EXCLUDED.company_id, title=EXCLUDED.title,
       status=EXCLUDED.status, starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, data=EXCLUDED.data`,
    [input.id, input.companyId, input.title, JSON.stringify({
      date: '2026-12-20',
      time: '19:00',
      location: 'Bissau',
      salesOpen: true,
      ticketTypes: [{
        id: input.typeId,
        name: 'Geral',
        priceXOF: input.priceXOF,
        availableQuantity: 200,
        soldQuantity: 0,
        salesOpen: true,
      }],
    })],
  );
  await pool.query(
    `INSERT INTO ticket_types (id,event_id,name,price_xof,quantity)
     VALUES ($1,$2,'Geral',$3,200)
     ON CONFLICT (id) DO UPDATE SET event_id=EXCLUDED.event_id, name=EXCLUDED.name,
       price_xof=EXCLUDED.price_xof, quantity=EXCLUDED.quantity`,
    [input.typeId, input.id, input.priceXOF],
  );
}

async function cleanup() {
  await withDb(async (pool) => {
    for (const eventId of [EVENT_ID, OTHER_EVENT_ID]) {
      await pool.query('DELETE FROM event_payouts WHERE event_id=$1', [eventId]);
      await pool.query(
        `DELETE FROM payment_transactions WHERE id IN (
           SELECT transaction_id FROM payment_transaction_orders pto
            JOIN orders o ON o.id=pto.order_id WHERE o.event_id=$1
         ) OR event_id=$1`,
        [eventId],
      );
      await pool.query('DELETE FROM tickets WHERE event_id=$1', [eventId]);
      await pool.query('DELETE FROM orders WHERE event_id=$1', [eventId]);
      await pool.query('DELETE FROM ticket_types WHERE event_id=$1', [eventId]);
      await pool.query('DELETE FROM events WHERE id=$1', [eventId]);
    }
    // Transações pendentes de bilhetes não têm pedido associado; são criadas
    // pelo teste de pagamento pendente e identificadas pelo telefone exclusivo.
    await pool.query(
      "DELETE FROM payment_transactions WHERE use_case='event_tickets' AND payer_phone='+245 955 11 59'",
    );
    await pool.query('DELETE FROM companies WHERE id=$1', [OTHER_COMPANY_ID]);
  });
}

test.beforeAll(async () => {
  await cleanup();
  await withDb(async (pool) => {
    await createEvent(pool, {
      id: EVENT_ID,
      companyId: COMPANY_ID,
      typeId: TYPE_ID,
      title: 'Evento de rastreabilidade financeira',
      priceXOF: 5000,
    });
    await createEvent(pool, {
      id: OTHER_EVENT_ID,
      companyId: OTHER_COMPANY_ID,
      typeId: OTHER_TYPE_ID,
      title: 'Evento de outra empresa',
      priceXOF: 7000,
    });
  });
});

test.afterAll(async () => {
  await cleanup();
});

test('compra confirmada liga transação, pedidos, bilhetes, evento e empresa', async ({ page }) => {
  await signIn(page, CITIZEN);
  const buyerTotal = await expectedBuyerTotal(5000, 2);
  const response = await page.request.post('/api/tickets/purchase', {
    data: {
      eventId: EVENT_ID,
      eventTitle: 'Evento de rastreabilidade financeira',
      ticketTypeId: TYPE_ID,
      ticketTypeName: 'Geral',
      quantity: 2,
      priceXOF: 5000,
      pricePerTicketXOF: 5000,
      chargedAmountXOF: buyerTotal,
      paymentMethod: 'orange_money',
      policyAccepted: true,
      policyVersion: '1.0',
      policyAcceptedAt: new Date().toISOString(),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  expect(body.success).toBe(true);
  expect(body.transaction.status).toBe('confirmed_api');
  expect(body.tickets).toHaveLength(2);

  const trace = await withDb(async (pool) => {
    const transaction = (await pool.query(
      `SELECT t.id, t.status, t.order_id, t.event_id, t.company_id,
              (SELECT count(*)::int FROM payment_transaction_orders p WHERE p.transaction_id=t.id) AS linked_orders
         FROM payment_transactions t WHERE t.id=$1`,
      [body.transaction.id],
    )).rows[0];
    const orders = (await pool.query(
      `SELECT o.id, o.status, o.gross_amount_xof, o.fee_amount_xof, o.net_amount_xof, o.event_id,
              e.company_id, count(tk.id)::int AS tickets
         FROM payment_transaction_orders pto
         JOIN orders o ON o.id=pto.order_id
         JOIN events e ON e.id=o.event_id
         LEFT JOIN tickets tk ON tk.order_id=o.id
        WHERE pto.transaction_id=$1
        GROUP BY o.id, e.company_id
        ORDER BY o.id`,
      [body.transaction.id],
    )).rows;
    const tickets = (await pool.query(
      `SELECT id, order_id, event_id, status FROM tickets WHERE event_id=$1 ORDER BY id`,
      [EVENT_ID],
    )).rows;
    return { transaction, orders, tickets };
  });

  expect(trace.transaction.status).toBe('paid');
  expect(trace.transaction.event_id).toBe(EVENT_ID);
  expect(trace.transaction.company_id).toBe(COMPANY_ID);
  expect(trace.transaction.linked_orders).toBe(2);
  expect(trace.orders).toHaveLength(2);
  expect(trace.tickets).toHaveLength(2);
  for (const order of trace.orders) {
    expect(order.status).toBe('paid');
    expect(order.event_id).toBe(EVENT_ID);
    expect(order.company_id).toBe(COMPANY_ID);
    expect(order.tickets).toBe(1);
    expect(Number(order.gross_amount_xof)).toBe(5000);
    expect(Number(order.fee_amount_xof)).toBeGreaterThan(0);
    expect(Number(order.net_amount_xof)).toBe(Number(order.gross_amount_xof) - Number(order.fee_amount_xof));
    expect(trace.tickets.some((ticket: { order_id: string }) => ticket.order_id === order.id)).toBe(true);
  }
  for (const ticket of trace.tickets) {
    expect(ticket.status).toBe('valid');
  }
});

test('central, evento e empresa apresentam os mesmos valores reais', async ({ page }) => {
  await signIn(page, ADMIN);
  const [summaryResponse, eventResponse] = await Promise.all([
    page.request.get('/api/admin/finance/summary'),
    page.request.get(`/api/events/${EVENT_ID}/control-center`),
  ]);
  expect(summaryResponse.ok(), await summaryResponse.text()).toBeTruthy();
  expect(eventResponse.ok(), await eventResponse.text()).toBeTruthy();
  const summary = await summaryResponse.json();
  const event = (await eventResponse.json()).data;
  const eventCentral = summary.ticketFinance.events.find((row: { eventId: string }) => row.eventId === EVENT_ID);

  expect(eventCentral).toBeTruthy();
  expect(eventCentral.grossXOF).toBe(event.finance.grossXOF);
  expect(eventCentral.commissionXOF).toBe(event.finance.commissionXOF);
  expect(eventCentral.netXOF).toBe(event.finance.companyShareXOF);
  expect(event.finance.pendingPayoutXOF).toBe(event.finance.companyShareXOF);
  expect(event.transactions.length).toBeGreaterThan(0);
  expect(event.transactions[0].ticketCodes.length).toBeGreaterThan(0);

  const detail = await page.request.get(`/api/admin/finance/transactions/${encodeURIComponent(event.transactions[0].id)}`);
  expect(detail.ok(), await detail.text()).toBeTruthy();
  const detailBody = await detail.json();
  expect(detailBody.transaction.eventId).toBe(EVENT_ID);
  expect(detailBody.orders.length).toBeGreaterThan(0);
  expect(detailBody.orders[0].event_title).toBe('Evento de rastreabilidade financeira');
  expect(detailBody.orders[0].company_id).toBe(COMPANY_ID);
});

test('empresa vê apenas os seus valores e não acede à administração', async ({ page }) => {
  await signIn(page, BUSINESS);
  const finance = await page.request.get('/api/business/finance');
  expect(finance.ok(), await finance.text()).toBeTruthy();
  const body = await finance.json();
  expect(body.scope).toBe('company');
  expect(body.companyId).toBe(COMPANY_ID);
  expect(body.events.every((event: { companyId: string }) => event.companyId === COMPANY_ID)).toBe(true);
  expect(body.events.some((event: { eventId: string }) => event.eventId === EVENT_ID)).toBe(true);
  expect(body.events.some((event: { eventId: string }) => event.eventId === OTHER_EVENT_ID)).toBe(false);

  const foreignEvent = await page.request.get(`/api/events/${OTHER_EVENT_ID}/control-center`);
  expect(foreignEvent.status()).toBe(403);
  const adminFinance = await page.request.get('/api/admin/finance/payouts');
  expect(adminFinance.status()).toBe(403);
});

test('repasses exigem referência, respeitam o saldo e nunca apagam o estado confirmado', async ({ page }) => {
  await signIn(page, ADMIN);
  const event = (await (await page.request.get(`/api/events/${EVENT_ID}/control-center`)).json()).data;
  const available = event.finance.pendingPayoutXOF;
  expect(available).toBeGreaterThan(100);

  const overdraw = await page.request.post('/api/admin/finance/payouts', {
    data: { companyId: COMPANY_ID, eventId: EVENT_ID, amountXOF: available + 1, method: 'manual_transfer' },
  });
  expect(overdraw.status()).toBe(409);
  expect((await overdraw.json()).code).toBe('PAYOUT_EXCEEDS_AVAILABLE');

  const created = await page.request.post('/api/admin/finance/payouts', {
    data: {
      companyId: COMPANY_ID,
      eventId: EVENT_ID,
      amountXOF: 100,
      method: 'manual_transfer',
      proofReference: 'comprovativo-teste',
      notes: 'Teste automatizado; nenhuma transferência real',
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const payout = await created.json();
  expect(payout.status).toBe('pending');

  const withoutReference = await page.request.patch(`/api/admin/finance/payouts/${payout.id}`, {
    data: { status: 'confirmed' },
  });
  expect(withoutReference.status()).toBe(400);
  expect((await withoutReference.json()).code).toBe('PAYOUT_REFERENCE_REQUIRED');

  const processing = await page.request.patch(`/api/admin/finance/payouts/${payout.id}`, { data: { status: 'processing' } });
  expect(processing.ok(), await processing.text()).toBeTruthy();
  expect((await processing.json()).status).toBe('processing');

  const confirmed = await page.request.patch(`/api/admin/finance/payouts/${payout.id}`, {
    data: { status: 'confirmed', reference: 'TESTE-FIN-001', proofReference: 'comprovativo-teste' },
  });
  expect(confirmed.ok(), await confirmed.text()).toBeTruthy();
  expect((await confirmed.json()).status).toBe('confirmed');
  expect((await confirmed.json()).confirmedAt).toBeTruthy();

  const terminal = await page.request.patch(`/api/admin/finance/payouts/${payout.id}`, { data: { status: 'cancelled' } });
  expect(terminal.status()).toBe(409);
  expect((await terminal.json()).code).toBe('INVALID_PAYOUT_TRANSITION');

  const eventAfter = (await (await page.request.get(`/api/events/${EVENT_ID}/control-center`)).json()).data;
  expect(eventAfter.finance.paidOutXOF).toBe(100);
  expect(eventAfter.finance.pendingPayoutXOF).toBe(available - 100);
  expect(eventAfter.payouts[0].reference).toBe('TESTE-FIN-001');

  await signIn(page, BUSINESS);
  const company = await (await page.request.get('/api/business/finance')).json();
  expect(company.totals.paidOutXOF).toBeGreaterThanOrEqual(100);
  expect(company.payouts.some((item: { id: string }) => item.id === payout.id)).toBe(true);
});

test('relatórios do evento incluem financeiro, transações e repasses em PDF, Excel e CSV', async ({ page }) => {
  await signIn(page, ADMIN);
  const base = `/api/events/${EVENT_ID}/control-center/export?format=csv&sections=summary,finance,payouts,commissions`;
  const csv = await page.request.get(base);
  expect(csv.ok(), await csv.text()).toBeTruthy();
  const csvText = (await csv.body()).toString('utf8');
  expect(csvText).toContain('Resumo');
  expect(csvText).toContain('Pagamentos confirmados do evento');
  expect(csvText).toContain('Repasses');
  expect(csvText).toContain('TESTE-FIN-001');

  const xlsx = await page.request.get(
    `/api/events/${EVENT_ID}/control-center/export?format=xlsx&sections=finance,payouts`,
  );
  expect(xlsx.ok(), await xlsx.text()).toBeTruthy();
  expect((await xlsx.body()).subarray(0, 2).toString('utf8')).toBe('PK');

  const pdf = await page.request.get(
    `/api/events/${EVENT_ID}/control-center/export?format=pdf&sections=summary,finance,payouts`,
  );
  expect(pdf.ok(), await pdf.text()).toBeTruthy();
  expect((await pdf.body()).subarray(0, 5).toString('utf8')).toBe('%PDF-');
});

test('pagamento pendente não conta como receita e não emite bilhete', async ({ page }) => {
  await signIn(page, CITIZEN);
  const buyerTotal = await expectedBuyerTotal(5000, 1);
  const before = await withDb(async (pool) => ({
    tickets: (await pool.query('SELECT count(*)::int AS n FROM tickets WHERE event_id=$1', [EVENT_ID])).rows[0].n,
    orders: (await pool.query('SELECT count(*)::int AS n FROM orders WHERE event_id=$1', [EVENT_ID])).rows[0].n,
  }));
  const response = await page.request.post('/api/payments/create', {
    data: {
      useCase: 'event_tickets',
      eventId: EVENT_ID,
      ticketTypeId: TYPE_ID,
      ticketTypeName: 'Geral',
      eventTitle: 'Evento de rastreabilidade financeira',
      quantity: 1,
      pricePerTicketXOF: 5000,
      amountXOF: buyerTotal,
      provider: 'orange_money',
      payerName: 'Cidadão Teste',
      payerPhone: '+245 955 11 59',
    },
  });
  expect(response.status()).toBe(202);
  const pending = await response.json();
  expect(pending.ticket).toBeUndefined();
  expect(pending.transaction.status).toBe('pending_provider');

  const after = await withDb(async (pool) => ({
    tickets: (await pool.query('SELECT count(*)::int AS n FROM tickets WHERE event_id=$1', [EVENT_ID])).rows[0].n,
    orders: (await pool.query('SELECT count(*)::int AS n FROM orders WHERE event_id=$1', [EVENT_ID])).rows[0].n,
  }));
  expect(after.tickets).toBe(before.tickets);
  expect(after.orders).toBe(before.orders);

  await signIn(page, ADMIN);
  const summary = await (await page.request.get('/api/admin/finance/summary')).json();
  const event = summary.ticketFinance.events.find((row: { eventId: string }) => row.eventId === EVENT_ID);
  expect(event.paidOrders).toBe(2);
});

test('integridade: base de dados rejeita pagamento confirmado sem evento', async () => {
  const blocked = await withDb(async (pool) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO payment_transactions (id, provider, status, gross_amount_xof, use_case)
         VALUES ('TXN-FIN-TRIGGER-TEST', 'orange_money', 'paid', 100, 'event_tickets')`,
      );
      return false;
    } catch (error) {
      return (error as { code?: string }).code === '23514';
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  expect(blocked).toBe(true);
});

test('painel do Super Admin e da empresa expõem a central e os repasses', async ({ page }) => {
  const admin = await signIn(page, ADMIN);
  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', 'pt');
  }, admin.user);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Visão Geral/i }).first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"][aria-labelledby="welcome-tour-title"]').forEach((node) => node.remove());
  });
  await page.locator('aside').getByRole('button', { name: /^Financeiro/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Financeiro', exact: true }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'Central financeira de bilhetes' })).toBeVisible();
  await expect(page.getByText('Pendente de repasse').first()).toBeVisible();
  await page.getByRole('button', { name: /Repasses às empresas/ }).click();
  await expect(page.getByRole('heading', { name: 'Repasses às empresas' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: /Registar repasse/ })).toBeVisible();

  await page.context().clearCookies();
  const business = await signIn(page, BUSINESS);
  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', 'pt');
  }, business.user);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Visão Geral/i }).first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => {
    document.querySelectorAll('[role="dialog"][aria-labelledby="welcome-tour-title"]').forEach((node) => node.remove());
  });
  await page.locator('aside').getByRole('button', { name: /^Eventos/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Financeiro dos seus eventos' })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Pendente de repasse').first()).toBeVisible();
});

test('webhooks simulados e transações de bilhetes não podem ser reconciliados como plataforma', async ({ page }) => {
  await signIn(page, ADMIN);
  const webhook = await page.request.post('/api/payments/webhook/orange_money', {
    data: { providerRef: 'OM-SIM-INEXISTENTE', status: 'paid', amountXOF: 100 },
  });
  expect(webhook.status()).toBe(409);
  expect((await webhook.json()).code).toBe('PAYMENT_PROVIDER_NOT_ACTIVE');

  const event = (await (await page.request.get(`/api/events/${EVENT_ID}/control-center`)).json()).data;
  const reconciliation = await page.request.post('/api/admin/finance/reconciliations', {
    data: { transactionId: event.transactions[0].id, statementReference: 'TESTE-FIN-001', statementAmountXOF: event.transactions[0].amountXOF },
  });
  expect(reconciliation.status()).toBe(400);
  expect((await reconciliation.json()).code).toBe('BUSINESS_FINANCE_SCOPE');
});
