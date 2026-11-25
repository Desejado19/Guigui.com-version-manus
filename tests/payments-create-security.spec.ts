import 'dotenv/config';
import { Pool } from 'pg';
import { expect, test } from './fixtures';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees } from '../src/data/monetizationCatalog';

const EVENT_ID = 'evt-audit-payment-security';
const TICKET_TYPE_ID = 'tt-audit-payment-security';
const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };
const BUSINESS = { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' };

test.describe.configure({ mode: 'serial' });

async function withDb<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function expectedBuyerTotal(): Promise<number> {
  return withDb(async (pool) => {
    const result = await pool.query('SELECT * FROM ticket_fee_settings WHERE id=$1 AND is_active=TRUE', ['default']);
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
    return calculateTicketFees(catalog, 5000, 1).buyerTotal;
  });
}

test.beforeAll(async () => {
  await withDb(async (pool) => {
    await pool.query('DELETE FROM tickets WHERE event_id=$1', [EVENT_ID]);
    await pool.query('DELETE FROM orders WHERE event_id=$1', [EVENT_ID]);
    await pool.query('DELETE FROM ticket_types WHERE event_id=$1', [EVENT_ID]);
    await pool.query('DELETE FROM events WHERE id=$1', [EVENT_ID]);
    await pool.query(
      `INSERT INTO events (id, company_id, title, status, starts_at, ends_at, data)
       VALUES ($1, 'biz-1', 'Evento de segurança de pagamentos', 'published', NOW() + interval '1 day', NOW() + interval '2 days', $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET company_id=EXCLUDED.company_id, title=EXCLUDED.title, status=EXCLUDED.status, starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, data=EXCLUDED.data`,
      [EVENT_ID, JSON.stringify({
        date: '2026-12-01',
        time: '18:00',
        salesOpen: true,
        ticketTypes: [{
          id: TICKET_TYPE_ID,
          name: 'Geral',
          priceXOF: 5000,
          availableQuantity: 100,
          soldQuantity: 0,
          salesOpen: true,
        }],
      })],
    );
    await pool.query(
      `INSERT INTO ticket_types (id, event_id, name, price_xof, quantity)
       VALUES ($1, $2, 'Geral', 5000, 100)
       ON CONFLICT (id) DO UPDATE SET event_id=EXCLUDED.event_id, name=EXCLUDED.name, price_xof=EXCLUDED.price_xof, quantity=EXCLUDED.quantity`,
      [TICKET_TYPE_ID, EVENT_ID],
    );
  });
});

test.afterAll(async () => {
  await withDb(async (pool) => {
    await pool.query('DELETE FROM tickets WHERE event_id=$1', [EVENT_ID]);
    await pool.query('DELETE FROM orders WHERE event_id=$1', [EVENT_ID]);
    await pool.query('DELETE FROM ticket_types WHERE event_id=$1', [EVENT_ID]);
    await pool.query('DELETE FROM events WHERE id=$1', [EVENT_ID]);
  });
});

test('/api/payments/create exige sessão, mesmo antes de validar o corpo', async ({ request }) => {
  const response = await request.post('/api/payments/create', {
    data: { useCase: 'event_tickets', amountXOF: 1, provider: 'orange_money' },
  });
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
});

test('recusa businessId de outra empresa', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { data: BUSINESS });
  expect(login.ok()).toBeTruthy();

  const foreign = await page.request.post('/api/payments/create', {
    data: {
      useCase: 'extra_posts',
      productCode: 'POST_EXTRA',
      quantity: 1,
      businessId: 'biz-2',
      businessName: 'Empresa alheia',
      payerName: 'Empresa Teste',
      payerPhone: '+245 955 11 50',
      amountXOF: 5000,
      provider: 'orange_money',
    },
  });
  expect(foreign.status()).toBe(403);
  expect(await foreign.json()).toMatchObject({ code: 'BUSINESS_ACCESS_DENIED' });
});

test('recusa preço adulterado de bilhete e não cria bilhete nem pagamento', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { data: CITIZEN });
  expect(login.ok()).toBeTruthy();
  const expected = await expectedBuyerTotal();
  const before = await withDb(async (pool) => (await pool.query('SELECT COUNT(*)::int AS n FROM tickets WHERE event_id=$1', [EVENT_ID])).rows[0].n);

  const unknownOffer = await page.request.post('/api/payments/create', {
    data: {
      useCase: 'event_tickets',
      eventId: 'evt-inexistente',
      ticketTypeId: TICKET_TYPE_ID,
      quantity: 1,
      amountXOF: expected,
      provider: 'orange_money',
      payerName: 'Cidadão Teste',
      payerPhone: '+245 955 11 51',
    },
  });
  expect(unknownOffer.status()).toBe(404);
  expect(await unknownOffer.json()).toMatchObject({ code: 'TICKET_OFFER_NOT_FOUND' });

  const response = await page.request.post('/api/payments/create', {
    data: {
      useCase: 'event_tickets',
      eventId: EVENT_ID,
      ticketTypeId: TICKET_TYPE_ID,
      quantity: 1,
      pricePerTicketXOF: 5000,
      amountXOF: Math.max(1, expected - 1),
      provider: 'orange_money',
      payerName: 'Cidadão Teste',
      payerPhone: '+245 955 11 51',
    },
  });
  expect(response.status()).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'TICKET_TOTAL_MISMATCH', expectedAmountXOF: expected });

  const after = await withDb(async (pool) => (await pool.query('SELECT COUNT(*)::int AS n FROM tickets WHERE event_id=$1', [EVENT_ID])).rows[0].n);
  expect(after).toBe(before);
});

test('modo simulado deixa bilhete e assinatura pendentes, sem os activar', async ({ page }) => {
  const citizenLogin = await page.request.post('/api/auth/login', { data: CITIZEN });
  expect(citizenLogin.ok()).toBeTruthy();
  const expected = await expectedBuyerTotal();
  const before = await withDb(async (pool) => (await pool.query('SELECT COUNT(*)::int AS n FROM tickets WHERE event_id=$1', [EVENT_ID])).rows[0].n);

  const ticketPayment = await page.request.post('/api/payments/create', {
    data: {
      useCase: 'event_tickets',
      eventId: EVENT_ID,
      ticketTypeId: TICKET_TYPE_ID,
      ticketTypeName: 'Geral',
      eventTitle: 'Evento de segurança de pagamentos',
      quantity: 1,
      pricePerTicketXOF: 5000,
      amountXOF: expected,
      provider: 'orange_money',
      payerName: 'Cidadão Teste',
      payerPhone: '+245 955 11 52',
    },
  });
  expect(ticketPayment.status()).toBe(202);
  const ticketBody = await ticketPayment.json();
  expect(ticketBody).toMatchObject({
    success: false,
    simulated: true,
    paymentPending: true,
    transaction: { status: 'pending_provider', providerMode: 'simulated' },
  });
  expect(ticketBody.ticket).toBeUndefined();
  expect(ticketBody.transaction.confirmedAt).toBeUndefined();

  const after = await withDb(async (pool) => (await pool.query('SELECT COUNT(*)::int AS n FROM tickets WHERE event_id=$1', [EVENT_ID])).rows[0].n);
  expect(after).toBe(before);

  const businessLogin = await page.request.post('/api/auth/login', { data: BUSINESS });
  expect(businessLogin.ok()).toBeTruthy();
  const subscriptionPayment = await page.request.post('/api/payments/create', {
    data: {
      useCase: 'subscription_initial',
      useCaseLabel: 'Subscrição de teste',
      payerName: 'Empresa Teste',
      payerPhone: '+245 955 11 53',
      amountXOF: 1000,
      provider: 'orange_money',
    },
  });
  expect(subscriptionPayment.status()).toBe(200);
  const subscriptionBody = await subscriptionPayment.json();
  expect(subscriptionBody).toMatchObject({
    success: true,
    simulated: true,
    paymentPending: true,
    transaction: { status: 'pending_provider', providerMode: 'simulated' },
  });
  expect(subscriptionBody.transaction.confirmedAt).toBeUndefined();
  expect(subscriptionBody.transaction.subscriptionStartedAt).toBeUndefined();
});
