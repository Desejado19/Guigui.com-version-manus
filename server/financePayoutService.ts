import { randomUUID } from 'node:crypto';
import { databasePool } from './db';

/**
 * Repasses e leitura financeira das empresas organizadoras.
 *
 * A fonte dos valores é sempre `orders` (pedidos pagos): `gross_amount_xof`,
 * `fee_amount_xof` (Guigui.com) e `net_amount_xof` (empresa). Os repasses são
 * operações registadas pelo Super Admin e nunca são deduzidos de receita
 * histórica; o saldo é calculado a partir do líquido menos os repasses
 * pendentes, em processamento e confirmados.
 */

export type PayoutStatus = 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled';
export type PayoutMethod = 'manual_transfer' | 'orange_money' | 'telecel' | 'bank_transfer';

const ACTIVE_PAYOUT_STATUSES: PayoutStatus[] = ['pending', 'processing', 'confirmed'];

const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: 'Pendente',
  processing: 'Em processamento',
  confirmed: 'Confirmado',
  failed: 'Falhado',
  cancelled: 'Cancelado',
};

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  manual_transfer: 'Transferência manual',
  orange_money: 'Orange Money',
  telecel: 'Telecel',
  bank_transfer: 'Transferência bancária',
};

export class PayoutError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PayoutError';
    this.status = status;
    this.code = code;
  }
}

function pool() {
  if (!databasePool) {
    throw new PayoutError(503, 'DATABASE_REQUIRED', 'A base de dados PostgreSQL é necessária para gerir repasses.');
  }
  return databasePool;
}

const num = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

const text = (value: unknown, max = 500): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const iso = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export interface TicketFinanceTotals {
  grossXOF: number;
  commissionXOF: number;
  netXOF: number;
  paidOutXOF: number;
  processingXOF: number;
  pendingPayoutXOF: number;
  paidOrders: number;
  pendingOrders: number;
  pendingOrdersXOF: number;
  failedOrders: number;
  failedOrdersXOF: number;
  refundedOrders: number;
  refundedOrdersXOF: number;
  unlinkedTransactionsCount: number;
  unlinkedTransactionsXOF: number;
  eventsWithRevenue: number;
  companiesWithRevenue: number;
}

export interface TicketFinanceEventRow {
  eventId: string;
  eventTitle: string;
  companyId: string | null;
  companyName: string | null;
  grossXOF: number;
  commissionXOF: number;
  netXOF: number;
  paidOutXOF: number;
  processingXOF: number;
  pendingPayoutXOF: number;
  paidOrders: number;
}

export interface TicketFinanceCompanyRow {
  companyId: string;
  companyName: string;
  grossXOF: number;
  commissionXOF: number;
  netXOF: number;
  paidOutXOF: number;
  processingXOF: number;
  pendingPayoutXOF: number;
  events: number;
}

export interface TicketFinanceProviderRow {
  provider: string;
  providerLabel: string;
  transactions: number;
  amountXOF: number;
}

export interface PayoutRow {
  id: string;
  companyId: string;
  companyName: string;
  eventId: string | null;
  eventTitle: string | null;
  amountXOF: number;
  currency: string;
  method: PayoutMethod;
  methodLabel: string;
  reference: string | null;
  proofReference: string | null;
  status: PayoutStatus;
  statusLabel: string;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  confirmedBy: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  telecel: 'Telecel',
  manual_transfer: 'Transferência manual',
};

function mapPayout(row: any): PayoutRow {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    companyName: String(row.company_name || ''),
    eventId: row.event_id ? String(row.event_id) : null,
    eventTitle: row.event_title ? String(row.event_title) : null,
    amountXOF: num(row.amount_xof),
    currency: String(row.currency || 'XOF'),
    method: row.method as PayoutMethod,
    methodLabel: PAYOUT_METHOD_LABELS[row.method as PayoutMethod] || String(row.method || ''),
    reference: row.reference ? String(row.reference) : null,
    proofReference: row.proof_reference ? String(row.proof_reference) : null,
    status: row.status as PayoutStatus,
    statusLabel: PAYOUT_STATUS_LABELS[row.status as PayoutStatus] || String(row.status || ''),
    notes: row.notes ? String(row.notes) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdByName: row.created_by_name ? String(row.created_by_name) : null,
    confirmedBy: row.confirmed_by ? String(row.confirmed_by) : null,
    confirmedByName: row.confirmed_by_name ? String(row.confirmed_by_name) : null,
    confirmedAt: iso(row.confirmed_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const PAYOUT_SELECT = `
  SELECT p.*, c.name AS company_name, e.title AS event_title,
         cu.name AS created_by_name, fu.name AS confirmed_by_name
    FROM event_payouts p
    JOIN companies c ON c.id = p.company_id
    LEFT JOIN events e ON e.id = p.event_id
    LEFT JOIN users cu ON cu.id = p.created_by
    LEFT JOIN users fu ON fu.id = p.confirmed_by
`;

export async function listPayouts(options: {
  companyId?: string;
  eventId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<PayoutRow[]> {
  const where: string[] = [];
  const values: unknown[] = [];
  if (options.companyId) {
    values.push(options.companyId);
    where.push(`p.company_id = $${values.length}`);
  }
  if (options.eventId) {
    values.push(options.eventId);
    where.push(`p.event_id = $${values.length}`);
  }
  if (options.status && options.status !== 'all') {
    values.push(options.status);
    where.push(`p.status = $${values.length}`);
  }
  const limit = Math.min(Math.max(Math.trunc(Number(options.limit) || 1000), 1), 5000);
  const result = await pool().query(
    `${PAYOUT_SELECT}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY p.created_at DESC
     LIMIT ${limit}`,
    values,
  );
  return result.rows.map(mapPayout);
}

export async function getPayout(id: string): Promise<PayoutRow | null> {
  const result = await pool().query(`${PAYOUT_SELECT} WHERE p.id = $1`, [id]);
  return result.rows[0] ? mapPayout(result.rows[0]) : null;
}

export async function createPayout(input: Record<string, unknown>, actorId: string): Promise<PayoutRow> {
  const companyId = text(input.companyId, 255);
  const eventId = text(input.eventId, 255);
  const amountXOF = num(input.amountXOF);
  const method = text(input.method, 40) as PayoutMethod;
  const reference = text(input.reference, 160) || null;
  const proofReference = text(input.proofReference, 255) || null;
  const notes = text(input.notes, 1000) || null;
  if (!companyId || !eventId) {
    throw new PayoutError(400, 'PAYOUT_EVENT_REQUIRED', 'Indique a empresa e o evento de origem do repasse.');
  }
  if (amountXOF <= 0) {
    throw new PayoutError(400, 'INVALID_PAYOUT_AMOUNT', 'O valor do repasse deve ser positivo.');
  }
  if (!['manual_transfer', 'orange_money', 'telecel', 'bank_transfer'].includes(method)) {
    throw new PayoutError(400, 'INVALID_PAYOUT_METHOD', 'Método de repasse inválido.');
  }
  const id = `PAYOUT-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    // Bloqueia o evento: dois pedidos simultâneos não podem reservar o mesmo
    // saldo duas vezes.
    const event = await client.query(
      `SELECT id, company_id, title FROM events
        WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [eventId, companyId],
    );
    if (event.rowCount !== 1) {
      throw new PayoutError(404, 'PAYOUT_EVENT_NOT_FOUND', 'O evento não pertence à empresa indicada.');
    }
    const balance = await client.query(
      `SELECT COALESCE((SELECT SUM(o.net_amount_xof) FROM orders o WHERE o.event_id=$1 AND o.status='paid'), 0)::bigint AS net_xof,
              COALESCE((SELECT SUM(p.amount_xof) FROM event_payouts p WHERE p.event_id=$1 AND p.status = ANY($2::text[])), 0)::bigint AS reserved_xof`,
      [eventId, ACTIVE_PAYOUT_STATUSES],
    );
    const available = Math.max(0, num(balance.rows[0]?.net_xof) - num(balance.rows[0]?.reserved_xof));
    if (amountXOF > available) {
      throw new PayoutError(
        409,
        'PAYOUT_EXCEEDS_AVAILABLE',
        `O valor excede o saldo disponível do evento (${available.toLocaleString('pt-PT')} XOF).`,
      );
    }
    const result = await client.query(
      `INSERT INTO event_payouts
         (id, company_id, event_id, amount_xof, method, reference, proof_reference, status, notes, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$9)
       RETURNING id`,
      [id, companyId, eventId, amountXOF, method, reference, proofReference, notes, actorId || null],
    );
    if (result.rowCount !== 1) throw new PayoutError(500, 'PAYOUT_CREATE_FAILED', 'Não foi possível registar o repasse.');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  const created = await getPayout(id);
  if (!created) throw new PayoutError(500, 'PAYOUT_CREATE_FAILED', 'O repasse criado não pôde ser lido.');
  return created;
}

const TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ['processing', 'confirmed', 'cancelled', 'failed'],
  processing: ['confirmed', 'failed', 'cancelled'],
  confirmed: [],
  failed: [],
  cancelled: [],
};

export async function updatePayoutStatus(
  id: string,
  input: Record<string, unknown>,
  actorId: string,
): Promise<PayoutRow> {
  const nextStatus = text(input.status, 30) as PayoutStatus;
  if (!['pending', 'processing', 'confirmed', 'failed', 'cancelled'].includes(nextStatus)) {
    throw new PayoutError(400, 'INVALID_PAYOUT_STATUS', 'Estado de repasse inválido.');
  }
  const current = await getPayout(id);
  if (!current) throw new PayoutError(404, 'PAYOUT_NOT_FOUND', 'O repasse não existe.');
  if (!TRANSITIONS[current.status].includes(nextStatus)) {
    throw new PayoutError(
      409,
      'INVALID_PAYOUT_TRANSITION',
      `Não é possível passar um repasse de ${PAYOUT_STATUS_LABELS[current.status]} para ${PAYOUT_STATUS_LABELS[nextStatus]}.`,
    );
  }
  const reference = text(input.reference, 160) || current.reference;
  if (nextStatus === 'confirmed' && (!reference || reference.trim().length < 3)) {
    throw new PayoutError(
      400,
      'PAYOUT_REFERENCE_REQUIRED',
      'Confirme o repasse apenas com a referência real da transferência ou do comprovativo.',
    );
  }
  const proofReference = text(input.proofReference, 255) || current.proofReference;
  const notes = text(input.notes, 1000) || current.notes;
  await pool().query(
    `UPDATE event_payouts
        SET status = $2,
            reference = COALESCE($3, reference),
            proof_reference = COALESCE($4, proof_reference),
            notes = COALESCE($5, notes),
            updated_by = $6,
            confirmed_by = CASE WHEN $2 = 'confirmed' THEN $6 ELSE confirmed_by END,
            confirmed_at = CASE WHEN $2 = 'confirmed' THEN NOW() ELSE confirmed_at END,
            updated_at = NOW()
      WHERE id = $1`,
    [id, nextStatus, reference, proofReference, notes, actorId || null],
  );
  const updated = await getPayout(id);
  if (!updated) throw new PayoutError(500, 'PAYOUT_UPDATE_FAILED', 'O repasse atualizado não pôde ser lido.');
  return updated;
}

const EMPTY_TOTALS = (): TicketFinanceTotals => ({
  grossXOF: 0,
  commissionXOF: 0,
  netXOF: 0,
  paidOutXOF: 0,
  processingXOF: 0,
  pendingPayoutXOF: 0,
  paidOrders: 0,
  pendingOrders: 0,
  pendingOrdersXOF: 0,
  failedOrders: 0,
  failedOrdersXOF: 0,
  refundedOrders: 0,
  refundedOrdersXOF: 0,
  unlinkedTransactionsCount: 0,
  unlinkedTransactionsXOF: 0,
  eventsWithRevenue: 0,
  companiesWithRevenue: 0,
});

/**
 * Visão financeira dos bilhetes. Sem `companyId` é a central do Super Admin;
 * com `companyId` devolve apenas os eventos e valores dessa empresa.
 */
export async function getTicketFinanceOverview(companyId?: string) {
  const db = pool();
  const scope = companyId ? 'AND e.company_id = $1' : '';
  const scopePayout = companyId ? 'WHERE p.company_id = $1' : '';
  const params = companyId ? [companyId] : [];

  const [eventsResult, totalsResult, payoutsResult, providersResult, unlinkedResult, unlinkedRowsResult] = await Promise.all([
    db.query(
      `WITH order_totals AS (
         SELECT event_id,
                COALESCE(SUM(gross_amount_xof), 0)::bigint AS gross_xof,
                COALESCE(SUM(fee_amount_xof), 0)::bigint AS commission_xof,
                COALESCE(SUM(net_amount_xof), 0)::bigint AS net_xof,
                COUNT(*)::int AS paid_orders
           FROM orders WHERE status = 'paid' GROUP BY event_id
       ),
       payout_totals AS (
         SELECT event_id,
                COALESCE(SUM(amount_xof) FILTER (WHERE status = 'confirmed'), 0)::bigint AS paid_out_xof,
                COALESCE(SUM(amount_xof) FILTER (WHERE status = 'processing'), 0)::bigint AS processing_xof
           FROM event_payouts GROUP BY event_id
       )
       SELECT e.id AS event_id, e.title AS event_title, e.company_id, c.name AS company_name,
              COALESCE(o.gross_xof, 0) AS gross_xof,
              COALESCE(o.commission_xof, 0) AS commission_xof,
              COALESCE(o.net_xof, 0) AS net_xof,
              COALESCE(o.paid_orders, 0) AS paid_orders,
              COALESCE(p.paid_out_xof, 0) AS paid_out_xof,
              COALESCE(p.processing_xof, 0) AS processing_xof
         FROM events e
         LEFT JOIN companies c ON c.id = e.company_id
         LEFT JOIN order_totals o ON o.event_id = e.id
         LEFT JOIN payout_totals p ON p.event_id = e.id
        WHERE 1=1 ${scope}
          AND (COALESCE(o.gross_xof, 0) > 0 OR p.event_id IS NOT NULL)
        ORDER BY COALESCE(o.gross_xof, 0) DESC, e.title ASC`,
      params,
    ),
    db.query(
      `SELECT COALESCE(SUM(o.gross_amount_xof) FILTER (WHERE o.status = 'paid'), 0)::bigint AS gross_xof,
              COALESCE(SUM(o.fee_amount_xof) FILTER (WHERE o.status = 'paid'), 0)::bigint AS commission_xof,
              COALESCE(SUM(o.net_amount_xof) FILTER (WHERE o.status = 'paid'), 0)::bigint AS net_xof,
              COUNT(o.id) FILTER (WHERE o.status = 'paid')::int AS paid_orders,
              COUNT(o.id) FILTER (WHERE o.status IN ('created','pending'))::int AS pending_orders,
              COALESCE(SUM(o.gross_amount_xof) FILTER (WHERE o.status IN ('created','pending')), 0)::bigint AS pending_orders_xof,
              COUNT(o.id) FILTER (WHERE o.status = 'failed')::int AS failed_orders,
              COALESCE(SUM(o.gross_amount_xof) FILTER (WHERE o.status = 'failed'), 0)::bigint AS failed_orders_xof,
              COUNT(o.id) FILTER (WHERE o.status = 'refunded')::int AS refunded_orders,
              COALESCE(SUM(o.gross_amount_xof) FILTER (WHERE o.status = 'refunded'), 0)::bigint AS refunded_orders_xof,
              COUNT(DISTINCT e.id) FILTER (WHERE o.status = 'paid')::int AS events_with_revenue,
              COUNT(DISTINCT e.company_id) FILTER (WHERE o.status = 'paid')::int AS companies_with_revenue
         FROM events e
         LEFT JOIN orders o ON o.event_id = e.id
        WHERE 1=1 ${scope}`,
      params,
    ),
    db.query(
      `SELECT COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'confirmed'), 0)::bigint AS paid_out_xof,
              COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'processing'), 0)::bigint AS processing_xof,
              COALESCE(SUM(p.amount_xof) FILTER (WHERE p.status = 'pending'), 0)::bigint AS pending_xof
         FROM event_payouts p ${scopePayout}`,
      params,
    ),
    db.query(
      `SELECT t.provider, COUNT(*)::int AS transactions,
              COALESCE(SUM(t.gross_amount_xof), 0)::bigint AS amount_xof
         FROM payment_transactions t
         LEFT JOIN orders o ON o.id = t.order_id
         LEFT JOIN events e ON e.id = COALESCE(t.event_id, o.event_id)
        WHERE t.use_case = 'event_tickets' AND t.status IN ('paid','authorized')
          ${companyId ? 'AND e.company_id = $1' : ''}
        GROUP BY t.provider
        ORDER BY COUNT(*) DESC`,
      params,
    ),
    db.query(
      `SELECT COUNT(*)::int AS count,
              COALESCE(SUM(t.gross_amount_xof), 0)::bigint AS amount_xof
         FROM payment_transactions t
        WHERE t.use_case = 'event_tickets' AND t.status IN ('paid','authorized')
          AND t.order_id IS NULL
          ${companyId ? 'AND t.company_id = $1' : ''}`,
      params,
    ),
    db.query(
      `SELECT t.id, t.provider, t.provider_reference, t.gross_amount_xof, t.payer_name,
              t.payer_phone, t.created_at, t.confirmed_at
         FROM payment_transactions t
        WHERE t.use_case = 'event_tickets' AND t.status IN ('paid','authorized')
          AND t.order_id IS NULL
          ${companyId ? 'AND t.company_id = $1' : ''}
        ORDER BY t.created_at DESC
        LIMIT 50`,
      params,
    ),
  ]);

  const events: TicketFinanceEventRow[] = eventsResult.rows.map((row: any) => {
    const net = num(row.net_xof);
    const paidOut = num(row.paid_out_xof);
    const processing = num(row.processing_xof);
    return {
      eventId: String(row.event_id),
      eventTitle: String(row.event_title),
      companyId: row.company_id ? String(row.company_id) : null,
      companyName: row.company_name ? String(row.company_name) : null,
      grossXOF: num(row.gross_xof),
      commissionXOF: num(row.commission_xof),
      netXOF: net,
      paidOutXOF: paidOut,
      processingXOF: processing,
      pendingPayoutXOF: Math.max(0, net - paidOut - processing),
      paidOrders: num(row.paid_orders),
    };
  });

  const byCompanyMap = new Map<string, TicketFinanceCompanyRow>();
  for (const event of events) {
    if (!event.companyId) continue;
    const key = event.companyId;
    const existing = byCompanyMap.get(key) || {
      companyId: key,
      companyName: event.companyName || '',
      grossXOF: 0,
      commissionXOF: 0,
      netXOF: 0,
      paidOutXOF: 0,
      processingXOF: 0,
      pendingPayoutXOF: 0,
      events: 0,
    };
    existing.grossXOF += event.grossXOF;
    existing.commissionXOF += event.commissionXOF;
    existing.netXOF += event.netXOF;
    existing.paidOutXOF += event.paidOutXOF;
    existing.processingXOF += event.processingXOF;
    existing.pendingPayoutXOF += event.pendingPayoutXOF;
    existing.events += 1;
    byCompanyMap.set(key, existing);
  }

  const totalsRow = totalsResult.rows[0] || {};
  const payoutsRow = payoutsResult.rows[0] || {};
  const unlinkedRow = unlinkedResult.rows[0] || {};
  const totals = {
    ...EMPTY_TOTALS(),
    grossXOF: num(totalsRow.gross_xof),
    commissionXOF: num(totalsRow.commission_xof),
    netXOF: num(totalsRow.net_xof),
    paidOrders: num(totalsRow.paid_orders),
    pendingOrders: num(totalsRow.pending_orders),
    pendingOrdersXOF: num(totalsRow.pending_orders_xof),
    failedOrders: num(totalsRow.failed_orders),
    failedOrdersXOF: num(totalsRow.failed_orders_xof),
    refundedOrders: num(totalsRow.refunded_orders),
    refundedOrdersXOF: num(totalsRow.refunded_orders_xof),
    paidOutXOF: num(payoutsRow.paid_out_xof),
    processingXOF: num(payoutsRow.processing_xof),
    pendingPayoutXOF: Math.max(
      0,
      num(totalsRow.net_xof) - num(payoutsRow.paid_out_xof) - num(payoutsRow.processing_xof),
    ),
    unlinkedTransactionsCount: num(unlinkedRow.count),
    unlinkedTransactionsXOF: num(unlinkedRow.amount_xof),
    eventsWithRevenue: num(totalsRow.events_with_revenue),
    companiesWithRevenue: num(totalsRow.companies_with_revenue),
  };

  const providers: TicketFinanceProviderRow[] = providersResult.rows.map((row: any) => ({
    provider: String(row.provider),
    providerLabel: PROVIDER_LABELS[String(row.provider)] || String(row.provider),
    transactions: num(row.transactions),
    amountXOF: num(row.amount_xof),
  }));

  return {
    scope: companyId ? 'company' : 'platform',
    companyId: companyId || null,
    totals,
    events,
    companies: Array.from(byCompanyMap.values()).sort((a, b) => b.netXOF - a.netXOF),
    providers,
    unlinkedTransactions: unlinkedRowsResult.rows.map((row: any) => ({
      id: String(row.id),
      provider: String(row.provider),
      providerLabel: PROVIDER_LABELS[String(row.provider)] || String(row.provider),
      providerReference: row.provider_reference ? String(row.provider_reference) : null,
      amountXOF: num(row.gross_amount_xof),
      payerName: row.payer_name ? String(row.payer_name) : '',
      payerPhone: row.payer_phone ? String(row.payer_phone) : '',
      createdAt: iso(row.created_at),
      confirmedAt: iso(row.confirmed_at),
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function getCompanyFinance(companyId: string) {
  if (!companyId) {
    throw new PayoutError(403, 'BUSINESS_ACCOUNT_REQUIRED', 'A conta não está associada a uma empresa.');
  }
  const [overview, payouts] = await Promise.all([
    getTicketFinanceOverview(companyId),
    listPayouts({ companyId }),
  ]);
  return { ...overview, payouts };
}
