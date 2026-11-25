import { randomUUID } from 'node:crypto';
import { databasePool } from './db';
import { getTicketFinanceOverview } from './financePayoutService';

export type FinanceScope = 'platform' | 'business';
export type ReconciliationStatus = 'pending' | 'in_review' | 'reconciled' | 'divergence' | 'unconfirmed';

const PLATFORM_PREDICATE = "(t.use_case IS NULL OR t.use_case NOT IN ('event_tickets','event_refund'))";
const BUSINESS_PREDICATE = "t.use_case IN ('event_tickets','event_refund')";

const USE_CASE_LABELS: Record<string, string> = {
  subscription_initial: 'Subscrição inicial de plano',
  subscription_renewal: 'Renovação de subscrição',
  extra_posts: 'Pacote extra de publicações',
  extra_promotions: 'Pacote extra de promoções',
  event_tickets: 'Compra de bilhetes de evento',
  event_refund: 'Reembolso de bilhetes',
  extra_credit_purchase: 'Compra de crédito extra',
  advertising_purchase: 'Compra de publicidade',
  content_service_request: 'Pedido de serviço de conteúdo',
};

const STATUS_LABELS: Record<string, string> = {
  paid: 'Confirmado',
  authorized: 'Confirmado manualmente',
  pending: 'Pendente',
  created: 'Criado',
  refunded: 'Reembolsado',
  partially_refunded: 'Parcialmente reembolsado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

const PROVIDER_LABELS: Record<string, string> = {
  orange_money: 'Orange Money',
  telecel: 'Telecel',
  manual_transfer: 'Transferência manual',
};

const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  pending: 'Pendente',
  in_review: 'Em verificação',
  reconciled: 'Reconciliado',
  divergence: 'Divergência',
  unconfirmed: 'Não confirmado',
};

const REFUND_STATUS_LABELS: Record<string, string> = {
  requested: 'Solicitado',
  authorized: 'Autorizado',
  processed: 'Efetuado',
  rejected: 'Rejeitado',
  failed: 'Falhou',
};

export class FinanceError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FinanceError';
    this.status = status;
    this.code = code;
  }
}

function pool() {
  if (!databasePool) {
    throw new FinanceError(503, 'DATABASE_REQUIRED', 'A base de dados PostgreSQL é necessária para a gestão financeira.');
  }
  return databasePool;
}

function scopePredicate(scope: FinanceScope) {
  return scope === 'business' ? BUSINESS_PREDICATE : PLATFORM_PREDICATE;
}

function asInt(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function moneyFilter(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new FinanceError(400, 'INVALID_AMOUNT', 'O montante deve ser um valor não negativo.');
  }
  return Math.trunc(parsed);
}

function cleanText(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export interface FinanceTransactionRow {
  id: string;
  scope: FinanceScope;
  orderId: string | null;
  provider: string;
  providerLabel: string;
  providerReference: string | null;
  status: string;
  statusLabel: string;
  amountXOF: number;
  payerName: string;
  payerPhone: string;
  useCase: string;
  useCaseLabel: string;
  providerMode: string | null;
  dataOrigin: 'live' | 'sandbox' | 'simulated' | 'manual' | 'legacy';
  isSimulated: boolean;
  isRealConfirmed: boolean;
  reconciliationEligible: boolean;
  reconciliationId: string | null;
  reconciliationStatus: ReconciliationStatus | 'none';
  reconciliationStatusLabel: string;
  refundedAmountXOF: number;
  createdAt: string;
  confirmedAt: string | null;
  updatedAt: string | null;
  eventId: string | null;
  eventTitle: string | null;
  companyId: string | null;
  companyName: string | null;
}

function mapTransaction(row: any): FinanceTransactionRow {
  const scope: FinanceScope = row.use_case === 'event_tickets' || row.use_case === 'event_refund' ? 'business' : 'platform';
  const providerMode = row.provider_mode || null;
  const dataOrigin: FinanceTransactionRow['dataOrigin'] =
    providerMode === 'live' ? 'live'
      : providerMode === 'sandbox' ? 'sandbox'
        : providerMode === 'simulated' ? 'simulated'
          : row.provider === 'manual_transfer' ? 'manual'
            : 'legacy';
  const reconciliationStatus = (row.reconciliation_status || 'none') as ReconciliationStatus | 'none';
  const reconciliationEligible = scope === 'platform'
    && (row.status === 'authorized' || (row.status === 'paid' && providerMode === 'live'));
  return {
    id: String(row.id),
    scope,
    orderId: row.order_id ? String(row.order_id) : null,
    provider: String(row.provider || ''),
    providerLabel: PROVIDER_LABELS[String(row.provider)] || String(row.provider || '—'),
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    status: String(row.status || ''),
    statusLabel: STATUS_LABELS[String(row.status)] || String(row.status || '—'),
    amountXOF: asInt(row.gross_amount_xof),
    payerName: String(row.payer_name || '—'),
    payerPhone: String(row.payer_phone || '—'),
    useCase: String(row.use_case || ''),
    useCaseLabel: USE_CASE_LABELS[String(row.use_case)] || String(row.use_case || 'Transação'),
    providerMode,
    dataOrigin,
    isSimulated: dataOrigin === 'sandbox' || dataOrigin === 'simulated',
    isRealConfirmed: scope === 'platform'
      && (row.status === 'authorized' || (row.status === 'paid' && providerMode === 'live')),
    reconciliationEligible,
    reconciliationId: row.reconciliation_id ? String(row.reconciliation_id) : null,
    reconciliationStatus,
    reconciliationStatusLabel: reconciliationStatus === 'none' ? 'Não reconciliado' : RECONCILIATION_STATUS_LABELS[reconciliationStatus],
    refundedAmountXOF: asInt(row.refunded_amount_xof),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    eventId: row.event_id ? String(row.event_id) : null,
    eventTitle: row.event_title ? String(row.event_title) : null,
    companyId: row.company_id ? String(row.company_id) : null,
    companyName: row.company_name ? String(row.company_name) : null,
  };
}

const TRANSACTION_SELECT = `
  SELECT t.id, t.order_id, t.provider, t.provider_reference, t.status, t.gross_amount_xof,
         t.payer_name, t.payer_phone, t.use_case, t.provider_mode, t.confirmed_at, t.created_at, t.updated_at,
         COALESCE(t.event_id, o.event_id) AS event_id,
         e.title AS event_title,
         COALESCE(t.company_id, e.company_id) AS company_id,
         c.name AS company_name,
         r.id AS reconciliation_id, r.status AS reconciliation_status,
         COALESCE((SELECT SUM(rf.amount_xof) FROM refunds rf
                    WHERE rf.transaction_id = t.id AND rf.status = 'processed'), 0) AS refunded_amount_xof
    FROM payment_transactions t
    LEFT JOIN orders o ON o.id = t.order_id
    LEFT JOIN events e ON e.id = COALESCE(t.event_id, o.event_id)
    LEFT JOIN companies c ON c.id = COALESCE(t.company_id, e.company_id)
    LEFT JOIN payment_reconciliations r ON r.transaction_id = t.id
`;

export async function listFinanceTransactions(scope: FinanceScope, limit = 2000): Promise<FinanceTransactionRow[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 2000, 1), 5000);
  const result = await pool().query(
    `${TRANSACTION_SELECT}
      WHERE ${scopePredicate(scope)}
      ORDER BY t.created_at DESC
      LIMIT ${safeLimit}`,
  );
  return result.rows.map(mapTransaction);
}

export async function getFinanceTransaction(id: string): Promise<FinanceTransactionRow | null> {
  const result = await pool().query(`${TRANSACTION_SELECT} WHERE t.id = $1`, [id]);
  return result.rows[0] ? mapTransaction(result.rows[0]) : null;
}

export async function getFinanceSummary() {
  const db = pool();
  const platform = await db.query(`
    WITH platform AS (
      SELECT * FROM payment_transactions t WHERE ${PLATFORM_PREDICATE}
    )
    SELECT COUNT(*)::int AS transaction_count,
           COALESCE(SUM(gross_amount_xof), 0)::bigint AS volume_xof,
           COUNT(*) FILTER (WHERE status = 'authorized' OR (status = 'paid' AND provider_mode = 'live'))::int AS confirmed_count,
           COALESCE(SUM(gross_amount_xof) FILTER (WHERE status = 'authorized' OR (status = 'paid' AND provider_mode = 'live')), 0)::bigint AS confirmed_xof,
           COUNT(*) FILTER (WHERE status IN ('pending','created'))::int AS pending_count,
           COALESCE(SUM(gross_amount_xof) FILTER (WHERE status IN ('pending','created')), 0)::bigint AS pending_xof,
           COUNT(*) FILTER (WHERE provider_mode = 'sandbox')::int AS sandbox_count,
           COALESCE(SUM(gross_amount_xof) FILTER (WHERE provider_mode = 'sandbox'), 0)::bigint AS sandbox_xof,
           COUNT(*) FILTER (WHERE provider_mode = 'simulated')::int AS simulated_count,
           COALESCE(SUM(gross_amount_xof) FILTER (WHERE provider_mode = 'simulated'), 0)::bigint AS simulated_xof,
           COUNT(*) FILTER (WHERE provider_mode IS NULL AND status IN ('pending','paid'))::int AS legacy_count
      FROM platform
  `);
  const reconciled = await db.query(`
    SELECT COUNT(*) FILTER (WHERE r.status = 'reconciled')::int AS reconciled_count,
           COALESCE(SUM(r.statement_amount_xof) FILTER (WHERE r.status = 'reconciled'), 0)::bigint AS reconciled_xof,
           COUNT(*)::int AS reconciliation_count,
           COUNT(*) FILTER (WHERE r.status = 'divergence')::int AS divergence_count
      FROM payment_reconciliations r
      JOIN payment_transactions t ON t.id = r.transaction_id
     WHERE ${PLATFORM_PREDICATE}
  `);
  const refunds = await db.query(`
    SELECT COUNT(*) FILTER (WHERE rf.status = 'processed')::int AS processed_count,
           COALESCE(SUM(rf.amount_xof) FILTER (WHERE rf.status = 'processed'), 0)::bigint AS processed_xof,
           COUNT(*) FILTER (WHERE rf.status IN ('requested','authorized'))::int AS open_count
      FROM refunds rf
      JOIN payment_transactions t ON t.id = rf.transaction_id
     WHERE ${PLATFORM_PREDICATE}
  `);
  const company = await db.query(`
    SELECT COUNT(*) FILTER (WHERE t.status = 'paid')::int AS paid_count,
           COALESCE(SUM(t.gross_amount_xof) FILTER (WHERE t.status = 'paid'), 0)::bigint AS revenue_xof,
           COALESCE(SUM(t.gross_amount_xof) FILTER (WHERE t.status = 'refunded'), 0)::bigint AS refunded_xof,
           COUNT(*)::int AS transaction_count
      FROM payment_transactions t
     WHERE ${BUSINESS_PREDICATE}
  `);
  const orders = await db.query(`
    SELECT COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
           COALESCE(SUM(gross_amount_xof) FILTER (WHERE status = 'paid'), 0)::bigint AS paid_xof
      FROM orders
  `);
  const p = platform.rows[0] || {};
  const r = reconciled.rows[0] || {};
  const f = refunds.rows[0] || {};
  const c = company.rows[0] || {};
  const o = orders.rows[0] || {};
  const ticketFinance = await getTicketFinanceOverview();
  return {
    platform: {
      transactionCount: asInt(p.transaction_count),
      volumeXOF: asInt(p.volume_xof),
      confirmedCount: asInt(p.confirmed_count),
      confirmedXOF: asInt(p.confirmed_xof),
      pendingCount: asInt(p.pending_count),
      pendingXOF: asInt(p.pending_xof),
      sandboxCount: asInt(p.sandbox_count),
      sandboxXOF: asInt(p.sandbox_xof),
      simulatedCount: asInt(p.simulated_count),
      simulatedXOF: asInt(p.simulated_xof),
      legacyCount: asInt(p.legacy_count),
      reconciledCount: asInt(r.reconciled_count),
      reconciledXOF: asInt(r.reconciled_xof),
      reconciliationCount: asInt(r.reconciliation_count),
      divergenceCount: asInt(r.divergence_count),
      refundsProcessedCount: asInt(f.processed_count),
      refundsProcessedXOF: asInt(f.processed_xof),
      refundsOpenCount: asInt(f.open_count),
    },
    company: {
      // Contrato legado: pagamentos de bilhetes registados. A contabilidade
      // por pedidos pagos está em `ticketFinance.totals` e não é duplicada aqui.
      transactionCount: asInt(c.transaction_count),
      paidCount: asInt(c.paid_count),
      revenueXOF: asInt(c.revenue_xof),
      refundedXOF: asInt(c.refunded_xof),
    },
    scopeAudit: {
      ordersPaidCount: asInt(o.paid_count),
      ordersPaidXOF: asInt(o.paid_xof),
      companyPaymentsPaidXOF: asInt(c.revenue_xof),
      unlinkedOrderAmountXOF: Math.max(asInt(o.paid_xof) - asInt(c.revenue_xof), 0),
    },
    ticketFinance,
    generatedAt: new Date().toISOString(),
  };
}

export interface ReconciliationItem {
  transactionId: string;
  transaction: FinanceTransactionRow;
  id: string | null;
  statementReference: string | null;
  expectedAmountXOF: number;
  statementAmountXOF: number | null;
  status: ReconciliationStatus | 'none';
  statusLabel: string;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function mapReconciliationRow(row: any): ReconciliationItem {
  return {
    transactionId: String(row.transaction_id),
    transaction: mapTransaction(row),
    id: row.reconciliation_id ? String(row.reconciliation_id) : null,
    statementReference: row.statement_reference ? String(row.statement_reference) : null,
    expectedAmountXOF: asInt(row.expected_amount_xof ?? row.gross_amount_xof),
    statementAmountXOF: row.statement_amount_xof == null ? null : asInt(row.statement_amount_xof),
    status: (row.reconciliation_status_record || 'none') as ReconciliationStatus | 'none',
    statusLabel: row.reconciliation_status_record ? RECONCILIATION_STATUS_LABELS[row.reconciliation_status_record as ReconciliationStatus] : 'Pendente',
    notes: row.reconciliation_notes ? String(row.reconciliation_notes) : null,
    createdBy: row.reconciliation_created_by ? String(row.reconciliation_created_by) : null,
    createdByName: row.reconciliation_created_by_name ? String(row.reconciliation_created_by_name) : null,
    updatedBy: row.reconciliation_updated_by ? String(row.reconciliation_updated_by) : null,
    updatedByName: row.reconciliation_updated_by_name ? String(row.reconciliation_updated_by_name) : null,
    createdAt: row.reconciliation_created_at ? new Date(row.reconciliation_created_at).toISOString() : null,
    updatedAt: row.reconciliation_updated_at ? new Date(row.reconciliation_updated_at).toISOString() : null,
  };
}

export async function listReconciliations() {
  const db = pool();
  const result = await db.query(`
    SELECT t.id, t.id AS transaction_id, t.order_id, t.provider, t.provider_reference, t.status, t.gross_amount_xof,
           t.payer_name, t.payer_phone, t.use_case, t.provider_mode, t.confirmed_at, t.created_at, t.updated_at,
           o.event_id, e.title AS event_title, e.company_id, c.name AS company_name,
           r.id AS reconciliation_id, r.status AS reconciliation_status,
           r.statement_reference, r.expected_amount_xof, r.statement_amount_xof,
           r.status AS reconciliation_status_record, r.notes AS reconciliation_notes,
           r.created_by AS reconciliation_created_by, r.updated_by AS reconciliation_updated_by,
           r.created_at AS reconciliation_created_at, r.updated_at AS reconciliation_updated_at,
           cu.name AS reconciliation_created_by_name, uu.name AS reconciliation_updated_by_name,
           COALESCE((SELECT SUM(rf.amount_xof) FROM refunds rf
                      WHERE rf.transaction_id = t.id AND rf.status = 'processed'), 0) AS refunded_amount_xof
      FROM payment_transactions t
      LEFT JOIN orders o ON o.id = t.order_id
      LEFT JOIN events e ON e.id = o.event_id
      LEFT JOIN companies c ON c.id = e.company_id
      LEFT JOIN payment_reconciliations r ON r.transaction_id = t.id
      LEFT JOIN users cu ON cu.id = r.created_by
      LEFT JOIN users uu ON uu.id = r.updated_by
     WHERE ${PLATFORM_PREDICATE}
     ORDER BY t.created_at DESC
  `);
  const historyResult = await db.query(`
    SELECT a.id, a.action, a.resource_id, a.actor_user_id, a.after_data, a.reason, a.created_at,
           u.name AS actor_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE a.resource = 'payment_reconciliation'
     ORDER BY a.created_at DESC
     LIMIT 200
  `);
  return {
    items: result.rows.map(mapReconciliationRow),
    history: historyResult.rows.map((row: any) => {
      const after = (row.after_data && typeof row.after_data === 'object' ? row.after_data : {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        action: String(row.action),
        actionLabel: String(row.action || '').replace(/_/g, ' '),
        actorId: row.actor_user_id ? String(row.actor_user_id) : null,
        actorName: String(after.actorName || row.actor_name || 'Sistema'),
        transactionId: after.transactionId ? String(after.transactionId) : null,
        reconciliationId: row.resource_id ? String(row.resource_id) : null,
        status: after.status ? String(after.status) : null,
        reason: row.reason ? String(row.reason) : null,
        createdAt: new Date(row.created_at).toISOString(),
      };
    }),
  };
}

async function rawTransaction(id: string) {
  const result = await pool().query(
    `SELECT t.*, ${`CASE WHEN t.use_case IN ('event_tickets','event_refund') THEN 'business' ELSE 'platform' END`} AS finance_scope
       FROM payment_transactions t WHERE t.id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

function assertFinanceScope(tx: any) {
  if (!tx) throw new FinanceError(404, 'TRANSACTION_NOT_FOUND', 'A transação não existe.');
  if (tx.finance_scope !== 'platform') {
    throw new FinanceError(400, 'BUSINESS_FINANCE_SCOPE', 'Compras e reembolsos de bilhetes pertencem ao financeiro da empresa organizadora.');
  }
}

function isReconciliationEligible(tx: any): boolean {
  if (!tx) return false;
  if (tx.status === 'authorized') return true;
  return tx.status === 'paid' && tx.provider_mode === 'live';
}

function normalizeStatementReference(value: unknown): string {
  const reference = cleanText(value, 120);
  if (reference.length < 3) throw new FinanceError(400, 'STATEMENT_REFERENCE_REQUIRED', 'Indique a referência do extrato.');
  return reference;
}

function normalizeReconciliationStatus(value: unknown, fallback: ReconciliationStatus = 'pending'): ReconciliationStatus {
  const status = cleanText(value, 30) as ReconciliationStatus;
  if (!status) return fallback;
  if (!['pending', 'in_review', 'reconciled', 'divergence', 'unconfirmed'].includes(status)) {
    throw new FinanceError(400, 'INVALID_RECONCILIATION_STATUS', 'Estado de reconciliação inválido.');
  }
  return status;
}

export async function createReconciliation(input: Record<string, unknown>, actorId: string) {
  const db = pool();
  const transactionId = cleanText(input.transactionId, 120);
  if (!transactionId) throw new FinanceError(400, 'TRANSACTION_REQUIRED', 'Indique a transação a reconciliar.');
  const tx = await rawTransaction(transactionId);
  assertFinanceScope(tx);
  if (!isReconciliationEligible(tx)) {
    throw new FinanceError(409, 'PAYMENT_NOT_RECONCILABLE', 'Só pagamentos reais confirmados podem ser reconciliados. Sandbox, simulações e registos legados ficam excluídos.');
  }
  const existing = await db.query('SELECT id FROM payment_reconciliations WHERE transaction_id = $1', [transactionId]);
  if (existing.rows[0]) {
    throw new FinanceError(409, 'RECONCILIATION_ALREADY_EXISTS', 'Esta transação já possui uma reconciliação registada.');
  }
  const statementReference = normalizeStatementReference(input.statementReference);
  const expectedAmountXOF = asInt(tx.gross_amount_xof);
  const statementAmountXOF = moneyFilter(input.statementAmountXOF);
  const status = normalizeReconciliationStatus(input.status);
  if (status === 'reconciled' && statementAmountXOF !== expectedAmountXOF) {
    throw new FinanceError(400, 'AMOUNT_MISMATCH', 'O valor do extrato deve coincidir com o valor esperado para reconciliar.');
  }
  const id = `REC-${Date.now()}-${randomUUID().slice(0, 8)}`;
  try {
    await db.query(
      `INSERT INTO payment_reconciliations
        (id, transaction_id, statement_reference, expected_amount_xof, statement_amount_xof, status, notes, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [id, transactionId, statementReference, expectedAmountXOF, statementAmountXOF, status, cleanText(input.notes, 1000) || null, actorId || null],
    );
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new FinanceError(409, 'RECONCILIATION_ALREADY_EXISTS', 'Esta transação já possui uma reconciliação registada.');
    }
    throw error;
  }
  return getReconciliation(id);
}

async function getReconciliation(id: string) {
  const result = await pool().query(
    `SELECT r.*, t.gross_amount_xof, t.status AS transaction_status, cu.name AS created_by_name, uu.name AS updated_by_name
       FROM payment_reconciliations r
       JOIN payment_transactions t ON t.id = r.transaction_id
       LEFT JOIN users cu ON cu.id = r.created_by
       LEFT JOIN users uu ON uu.id = r.updated_by
      WHERE r.id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id),
    statementReference: String(row.statement_reference),
    expectedAmountXOF: asInt(row.expected_amount_xof),
    statementAmountXOF: asInt(row.statement_amount_xof),
    status: row.status as ReconciliationStatus,
    statusLabel: RECONCILIATION_STATUS_LABELS[row.status as ReconciliationStatus],
    notes: row.notes ? String(row.notes) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    createdByName: row.created_by_name ? String(row.created_by_name) : null,
    updatedBy: row.updated_by ? String(row.updated_by) : null,
    updatedByName: row.updated_by_name ? String(row.updated_by_name) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function updateReconciliation(id: string, input: Record<string, unknown>, actorId: string) {
  const db = pool();
  const existingResult = await db.query(
    `SELECT r.*, t.gross_amount_xof, t.status AS transaction_status, t.provider_mode, t.use_case
       FROM payment_reconciliations r
       JOIN payment_transactions t ON t.id = r.transaction_id
      WHERE r.id = $1`,
    [id],
  );
  const existing = existingResult.rows[0];
  if (!existing) throw new FinanceError(404, 'RECONCILIATION_NOT_FOUND', 'A reconciliação não existe.');
  if (existing.status === 'reconciled') {
    throw new FinanceError(409, 'PAYMENT_ALREADY_RECONCILED', 'Este pagamento já foi reconciliado e não pode ser reconciliado novamente.');
  }
  if (existing.use_case === 'event_tickets' || existing.use_case === 'event_refund') {
    throw new FinanceError(400, 'BUSINESS_FINANCE_SCOPE', 'A reconciliação de bilhetes pertence à empresa organizadora.');
  }
  const status = normalizeReconciliationStatus(input.status, existing.status as ReconciliationStatus);
  const statementReference = input.statementReference === undefined
    ? String(existing.statement_reference)
    : normalizeStatementReference(input.statementReference);
  const statementAmountXOF = input.statementAmountXOF === undefined
    ? asInt(existing.statement_amount_xof)
    : moneyFilter(input.statementAmountXOF);
  const expectedAmountXOF = asInt(existing.expected_amount_xof);
  if (status === 'reconciled') {
    if (!isReconciliationEligible({ status: existing.transaction_status, provider_mode: existing.provider_mode })) {
      throw new FinanceError(409, 'PAYMENT_NOT_RECONCILABLE', 'Só pagamentos reais confirmados podem ser reconciliados.');
    }
    if (statementAmountXOF !== expectedAmountXOF) {
      throw new FinanceError(400, 'AMOUNT_MISMATCH', 'O valor do extrato deve coincidir com o valor esperado para reconciliar.');
    }
  }
  const notes = input.notes === undefined ? existing.notes : cleanText(input.notes, 1000) || null;
  await db.query(
    `UPDATE payment_reconciliations
        SET statement_reference = $2, statement_amount_xof = $3, status = $4, notes = $5,
            updated_by = $6, updated_at = NOW()
      WHERE id = $1`,
    [id, statementReference, statementAmountXOF, status, notes, actorId || null],
  );
  return getReconciliation(id);
}

export async function getOperatorOverview() {
  const db = pool();
  const aggregates = await db.query(`
    SELECT t.provider,
           COUNT(*)::int AS transaction_count,
           COALESCE(SUM(t.gross_amount_xof), 0)::bigint AS volume_xof,
           COUNT(*) FILTER (WHERE t.status IN ('pending','created'))::int AS pending_count,
           COALESCE(SUM(t.gross_amount_xof) FILTER (WHERE t.status IN ('pending','created')), 0)::bigint AS pending_xof,
           COUNT(*) FILTER (WHERE t.status = 'authorized' OR (t.status = 'paid' AND t.provider_mode = 'live'))::int AS confirmed_count,
           COALESCE(SUM(t.gross_amount_xof) FILTER (WHERE t.status = 'authorized' OR (t.status = 'paid' AND t.provider_mode = 'live')), 0)::bigint AS confirmed_xof,
           COUNT(*) FILTER (WHERE t.provider_mode IN ('sandbox','simulated'))::int AS simulated_count
      FROM payment_transactions t
     WHERE ${PLATFORM_PREDICATE}
     GROUP BY t.provider
  `);
  const configs = await db.query('SELECT * FROM payment_operator_configs ORDER BY provider');
  const aggregateMap = new Map(aggregates.rows.map((row: any) => [String(row.provider), row]));
  const configMap = new Map(configs.rows.map((row: any) => [String(row.provider), row]));
  const providers = ['orange_money', 'telecel', 'manual_transfer'].map((provider) => {
    const agg: any = aggregateMap.get(provider) || {};
    const config: any = configMap.get(provider) || {};
    return {
      provider,
      label: PROVIDER_LABELS[provider] || provider,
      dedicatedPhone: config.dedicated_phone ? String(config.dedicated_phone) : null,
      integrationStatus: config.integration_status || (provider === 'manual_transfer' ? 'manual' : 'negotiation'),
      apiBaseUrl: config.api_base_url ? String(config.api_base_url) : null,
      webhookPath: config.webhook_path ? String(config.webhook_path) : null,
      apiVersion: config.api_version ? String(config.api_version) : null,
      supportsAutoPushOtp: Boolean(config.supports_auto_push_otp),
      notes: config.notes ? String(config.notes) : null,
      updatedAt: config.updated_at ? new Date(config.updated_at).toISOString() : null,
      transactionCount: asInt(agg.transaction_count),
      volumeXOF: asInt(agg.volume_xof),
      pendingCount: asInt(agg.pending_count),
      pendingXOF: asInt(agg.pending_xof),
      confirmedCount: asInt(agg.confirmed_count),
      confirmedXOF: asInt(agg.confirmed_xof),
      simulatedCount: asInt(agg.simulated_count),
    };
  });
  const history = await db.query(`
    SELECT a.id, a.action, a.resource_id, a.actor_user_id, a.after_data, a.reason, a.created_at, u.name AS actor_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.actor_user_id
     WHERE a.resource = 'payment_operator'
     ORDER BY a.created_at DESC
     LIMIT 100
  `);
  return {
    providers,
    history: history.rows.map((row: any) => {
      const after = (row.after_data && typeof row.after_data === 'object' ? row.after_data : {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        action: String(row.action),
        actionLabel: String(row.action || '').replace(/_/g, ' '),
        provider: row.resource_id ? String(row.resource_id) : null,
        actorName: String(after.actorName || row.actor_name || 'Sistema'),
        reason: row.reason ? String(row.reason) : null,
        createdAt: new Date(row.created_at).toISOString(),
      };
    }),
  };
}

function assertHttpUrl(value: string, field: string): string | null {
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new FinanceError(400, 'INVALID_OPERATOR_URL', `${field} deve ser um URL válido.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new FinanceError(400, 'INVALID_OPERATOR_URL', `${field} deve usar http/https e não pode conter credenciais.`);
  }
  return parsed.toString();
}

export async function updateOperatorConfig(provider: string, input: Record<string, unknown>, actorId: string) {
  if (!['orange_money', 'telecel', 'manual_transfer'].includes(provider)) {
    throw new FinanceError(404, 'OPERATOR_NOT_FOUND', 'Operadora não reconhecida.');
  }
  const db = pool();
  const existingResult = await db.query('SELECT * FROM payment_operator_configs WHERE provider = $1', [provider]);
  const existing: any = existingResult.rows[0] || {};
  const integrationStatus = input.integrationStatus === undefined
    ? String(existing.integration_status || (provider === 'manual_transfer' ? 'manual' : 'negotiation'))
    : cleanText(input.integrationStatus, 20);
  if (!['negotiation', 'sandbox', 'production', 'manual'].includes(integrationStatus)) {
    throw new FinanceError(400, 'INVALID_INTEGRATION_STATUS', 'Estado de integração inválido.');
  }
  const dedicatedPhone = input.dedicatedPhone === undefined
    ? existing.dedicated_phone || null
    : cleanText(input.dedicatedPhone, 40) || null;
  if (dedicatedPhone && !/^\+?[0-9][0-9\s()\-]{6,29}$/.test(dedicatedPhone)) {
    throw new FinanceError(400, 'INVALID_OPERATOR_PHONE', 'O número dedicado não é válido.');
  }
  const apiBaseUrl = input.apiBaseUrl === undefined
    ? existing.api_base_url || null
    : assertHttpUrl(cleanText(input.apiBaseUrl, 500), 'O URL da API');
  const webhookPath = input.webhookPath === undefined
    ? existing.webhook_path || null
    : cleanText(input.webhookPath, 200) || null;
  if (webhookPath && !webhookPath.startsWith('/')) {
    throw new FinanceError(400, 'INVALID_WEBHOOK_PATH', 'O caminho do webhook deve começar por /.');
  }
  const apiVersion = input.apiVersion === undefined ? existing.api_version || null : cleanText(input.apiVersion, 40) || null;
  const supportsAutoPushOtp = input.supportsAutoPushOtp === undefined
    ? Boolean(existing.supports_auto_push_otp)
    : input.supportsAutoPushOtp === true;
  const notes = input.notes === undefined ? existing.notes || null : cleanText(input.notes, 1000) || null;
  await db.query(
    `INSERT INTO payment_operator_configs
       (provider, dedicated_phone, integration_status, api_base_url, webhook_path, api_version, supports_auto_push_otp, notes, updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (provider) DO UPDATE SET
       dedicated_phone = EXCLUDED.dedicated_phone,
       integration_status = EXCLUDED.integration_status,
       api_base_url = EXCLUDED.api_base_url,
       webhook_path = EXCLUDED.webhook_path,
       api_version = EXCLUDED.api_version,
       supports_auto_push_otp = EXCLUDED.supports_auto_push_otp,
       notes = EXCLUDED.notes,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [provider, dedicatedPhone, integrationStatus, apiBaseUrl, webhookPath, apiVersion, supportsAutoPushOtp, notes, actorId || null],
  );
  const overview = await getOperatorOverview();
  return {
    provider: overview.providers.find((item) => item.provider === provider),
    before: {
      dedicatedPhone: existing.dedicated_phone || null,
      integrationStatus: existing.integration_status || null,
      apiBaseUrl: existing.api_base_url || null,
      webhookPath: existing.webhook_path || null,
      apiVersion: existing.api_version || null,
      supportsAutoPushOtp: Boolean(existing.supports_auto_push_otp),
      notes: existing.notes || null,
    },
    after: { dedicatedPhone, integrationStatus, apiBaseUrl, webhookPath, apiVersion, supportsAutoPushOtp, notes },
  };
}

export async function listPendingPayments() {
  const transactions = await listFinanceTransactions('platform', 5000);
  const pending = transactions.filter((transaction) => transaction.status === 'pending' || transaction.status === 'created');
  const actions = await pool().query(`
    SELECT a.*, u.name AS actor_name
      FROM payment_manual_actions a
      LEFT JOIN users u ON u.id = a.actor_user_id
     ORDER BY a.created_at DESC
     LIMIT 500
  `);
  const actionsMap = new Map<string, any[]>();
  for (const row of actions.rows) {
    const list = actionsMap.get(String(row.transaction_id)) || [];
    list.push({
      id: String(row.id),
      action: String(row.action),
      reason: row.reason ? String(row.reason) : null,
      proofReference: row.proof_reference ? String(row.proof_reference) : null,
      actorName: row.actor_name ? String(row.actor_name) : 'Sistema',
      createdAt: new Date(row.created_at).toISOString(),
    });
    actionsMap.set(String(row.transaction_id), list);
  }
  return pending.map((transaction) => ({ ...transaction, actions: actionsMap.get(transaction.id) || [] }));
}

export interface OperationalAlertItem {
  id: string;
  transactionId: string;
  payerName: string;
  providerLabel: string;
  amountXOF: number;
  ageHours: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  statementReference: string | null;
  expectedAmountXOF: number | null;
  statementAmountXOF: number | null;
  divergenceXOF: number | null;
}

export interface OperationalAlert {
  id: 'reconciliation_divergence' | 'pending_payment_overdue';
  target: 'reconciliation' | 'pending';
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  count: number;
  amountXOF: number;
  thresholdHours: number | null;
  items: OperationalAlertItem[];
}

const PENDING_PAYMENT_ALERT_HOURS = 48;

function mapOperationalAlertItem(row: any, kind: OperationalAlert['id']): OperationalAlertItem {
  const isDivergence = kind === 'reconciliation_divergence';
  const status = String(isDivergence ? row.reconciliation_status : row.status || '');
  const statusLabel = isDivergence
    ? RECONCILIATION_STATUS_LABELS[status as ReconciliationStatus] || status
    : STATUS_LABELS[status] || status;
  return {
    id: String(isDivergence ? row.reconciliation_id : row.transaction_id),
    transactionId: String(row.transaction_id),
    payerName: String(row.payer_name || '—'),
    providerLabel: PROVIDER_LABELS[String(row.provider)] || String(row.provider || '—'),
    amountXOF: asInt(row.gross_amount_xof),
    ageHours: Math.max(0, asInt(row.age_hours)),
    status,
    statusLabel,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    statementReference: row.statement_reference ? String(row.statement_reference) : null,
    expectedAmountXOF: row.expected_amount_xof == null ? null : asInt(row.expected_amount_xof),
    statementAmountXOF: row.statement_amount_xof == null ? null : asInt(row.statement_amount_xof),
    divergenceXOF: row.divergence_xof == null ? null : Math.abs(asInt(row.divergence_xof)),
  };
}

/**
 * Alertas operacionais calculados em tempo real, sem criar um segundo sistema
 * de notificações: divergências de reconciliação e pagamentos que continuam
 * pendentes depois de 48 horas.
 */
export async function listOperationalAlerts() {
  const db = pool();
  const divergences = await db.query(
    `SELECT r.id AS reconciliation_id, t.id AS transaction_id, t.payer_name, t.provider, t.status,
            t.gross_amount_xof, t.created_at,
            r.statement_reference, r.expected_amount_xof, r.statement_amount_xof,
            r.status AS reconciliation_status,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - r.updated_at)) / 3600))::int AS age_hours,
            ABS(r.statement_amount_xof - r.expected_amount_xof)::bigint AS divergence_xof,
            COUNT(*) OVER()::int AS total_count,
            COALESCE(SUM(t.gross_amount_xof) OVER(), 0)::bigint AS total_amount_xof
       FROM payment_reconciliations r
       JOIN payment_transactions t ON t.id = r.transaction_id
      WHERE r.status IN ('divergence','unconfirmed')
        AND ${PLATFORM_PREDICATE}
      ORDER BY r.updated_at ASC
      LIMIT 100`,
  );
  const pending = await db.query(
    `SELECT t.id AS transaction_id, t.payer_name, t.provider, t.status,
            t.gross_amount_xof, t.created_at,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 3600))::int AS age_hours,
            COUNT(*) OVER()::int AS total_count,
            COALESCE(SUM(t.gross_amount_xof) OVER(), 0)::bigint AS total_amount_xof
       FROM payment_transactions t
      WHERE t.status IN ('pending','created')
        AND t.created_at <= NOW() - INTERVAL '${PENDING_PAYMENT_ALERT_HOURS} hours'
        AND ${PLATFORM_PREDICATE}
      ORDER BY t.created_at ASC
      LIMIT 100`,
  );
  const divergenceCount = asInt(divergences.rows[0]?.total_count);
  const pendingCount = asInt(pending.rows[0]?.total_count);
  const alerts: OperationalAlert[] = [
    {
      id: 'reconciliation_divergence',
      target: 'reconciliation',
      severity: 'critical',
      title: 'Divergências de reconciliação',
      description: 'Reconciliações marcadas como divergência ou não confirmadas exigem análise e decisão de um responsável.',
      count: divergenceCount,
      amountXOF: asInt(divergences.rows[0]?.total_amount_xof),
      thresholdHours: null,
      items: divergences.rows.map((row: any) => mapOperationalAlertItem(row, 'reconciliation_divergence')),
    },
    {
      id: 'pending_payment_overdue',
      target: 'pending',
      severity: 'warning',
      title: 'Pagamentos pendentes há mais de 48 horas',
      description: `Pagamentos ainda por confirmar depois de ${PENDING_PAYMENT_ALERT_HOURS} horas. A fila deve ser regularizada com comprovativo validado ou rejeição justificada.`,
      count: pendingCount,
      amountXOF: asInt(pending.rows[0]?.total_amount_xof),
      thresholdHours: PENDING_PAYMENT_ALERT_HOURS,
      items: pending.rows.map((row: any) => mapOperationalAlertItem(row, 'pending_payment_overdue')),
    },
  ];
  const activeAlerts = alerts.filter((alert) => alert.count > 0);
  return {
    generatedAt: new Date().toISOString(),
    thresholds: { pendingPaymentHours: PENDING_PAYMENT_ALERT_HOURS },
    totals: {
      activeAlerts: activeAlerts.length,
      affectedItems: activeAlerts.reduce((sum, alert) => sum + alert.count, 0),
      amountXOF: activeAlerts.reduce((sum, alert) => sum + alert.amountXOF, 0),
    },
    alerts,
  };
}

export async function recordPendingAction(
  transactionId: string,
  action: 'confirm' | 'reject' | 'request_proof',
  input: Record<string, unknown>,
  actorId: string,
) {
  const db = pool();
  const tx = await rawTransaction(transactionId);
  assertFinanceScope(tx);
  if (!['pending', 'created'].includes(String(tx.status))) {
    throw new FinanceError(409, 'PAYMENT_NOT_PENDING', 'Este pagamento já foi processado e não pode ser alterado nesta fila.');
  }
  if (['sandbox', 'simulated'].includes(String(tx.provider_mode || ''))) {
    throw new FinanceError(409, 'SIMULATED_PAYMENT_NOT_CONFIRMABLE', 'Pagamentos de sandbox ou simulados não podem ser convertidos em pagamentos reais.');
  }
  const reason = cleanText(input.reason, 1000);
  const proofReference = cleanText(input.proofReference, 200);
  if (action === 'confirm' && proofReference.length < 3) {
    throw new FinanceError(400, 'PROOF_REFERENCE_REQUIRED', 'Indique a referência do comprovativo validado.');
  }
  if (action === 'reject' && reason.length < 3) {
    throw new FinanceError(400, 'REJECTION_REASON_REQUIRED', 'Indique o motivo da rejeição.');
  }
  if (action === 'request_proof' && reason.length < 3) {
    throw new FinanceError(400, 'PROOF_REQUEST_REASON_REQUIRED', 'Indique o que deve ser solicitado ao cliente.');
  }
  if (action === 'confirm') {
    await db.query(
      `UPDATE payment_transactions SET status = 'authorized', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [transactionId],
    );
  } else if (action === 'reject') {
    await db.query(`UPDATE payment_transactions SET status = 'failed', updated_at = NOW() WHERE id = $1`, [transactionId]);
  }
  await db.query(
    `INSERT INTO payment_manual_actions (id, transaction_id, action, reason, proof_reference, actor_user_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [`PMA-${Date.now()}-${randomUUID().slice(0, 8)}`, transactionId, action, reason || null, proofReference || null, actorId || null],
  );
  return getFinanceTransaction(transactionId);
}

export interface RefundRow {
  id: string;
  transactionId: string;
  amountXOF: number;
  reason: string;
  status: string;
  statusLabel: string;
  kind: string;
  originalReference: string | null;
  providerReference: string | null;
  rejectionReason: string | null;
  requestedBy: string | null;
  requestedByName: string | null;
  authorizedBy: string | null;
  authorizedByName: string | null;
  processedBy: string | null;
  processedByName: string | null;
  authorizedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  transactionProvider: string;
  transactionProviderLabel: string;
  transactionAmountXOF: number;
  payerName: string;
  useCase: string;
  useCaseLabel: string;
}

function mapRefund(row: any): RefundRow {
  return {
    id: String(row.id),
    transactionId: String(row.transaction_id),
    amountXOF: asInt(row.amount_xof),
    reason: String(row.reason || ''),
    status: String(row.status || ''),
    statusLabel: REFUND_STATUS_LABELS[String(row.status)] || String(row.status || '—'),
    kind: String(row.kind || 'refund'),
    originalReference: row.original_reference ? String(row.original_reference) : null,
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    requestedByName: row.requested_by_name ? String(row.requested_by_name) : null,
    authorizedBy: row.authorized_by ? String(row.authorized_by) : null,
    authorizedByName: row.authorized_by_name ? String(row.authorized_by_name) : null,
    processedBy: row.processed_by ? String(row.processed_by) : null,
    processedByName: row.processed_by_name ? String(row.processed_by_name) : null,
    authorizedAt: row.authorized_at ? new Date(row.authorized_at).toISOString() : null,
    processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    transactionProvider: String(row.transaction_provider || ''),
    transactionProviderLabel: PROVIDER_LABELS[String(row.transaction_provider)] || String(row.transaction_provider || '—'),
    transactionAmountXOF: asInt(row.transaction_amount_xof),
    payerName: String(row.payer_name || '—'),
    useCase: String(row.use_case || ''),
    useCaseLabel: USE_CASE_LABELS[String(row.use_case)] || String(row.use_case || '—'),
  };
}

const REFUND_SELECT = `
  SELECT rf.*, t.provider AS transaction_provider, t.gross_amount_xof AS transaction_amount_xof,
         t.payer_name, t.use_case,
         req.name AS requested_by_name, auth.name AS authorized_by_name, proc.name AS processed_by_name
    FROM refunds rf
    JOIN payment_transactions t ON t.id = rf.transaction_id
    LEFT JOIN users req ON req.id = rf.requested_by
    LEFT JOIN users auth ON auth.id = rf.authorized_by
    LEFT JOIN users proc ON proc.id = rf.processed_by
`;

export async function listRefunds(): Promise<RefundRow[]> {
  const result = await pool().query(`
    ${REFUND_SELECT}
    WHERE ${PLATFORM_PREDICATE}
    ORDER BY rf.created_at DESC
  `);
  return result.rows.map(mapRefund);
}

async function getRefund(id: string): Promise<RefundRow | null> {
  const result = await pool().query(`${REFUND_SELECT} WHERE rf.id = $1`, [id]);
  return result.rows[0] ? mapRefund(result.rows[0]) : null;
}

export async function createRefund(input: Record<string, unknown>, actorId: string) {
  const db = pool();
  const transactionId = cleanText(input.transactionId, 120);
  if (!transactionId) throw new FinanceError(400, 'TRANSACTION_REQUIRED', 'Indique a transação original.');
  const tx = await rawTransaction(transactionId);
  assertFinanceScope(tx);
  if (!['paid', 'authorized'].includes(String(tx.status))) {
    throw new FinanceError(409, 'PAYMENT_NOT_REFUNDABLE', 'Só pagamentos confirmados podem originar reembolso ou estorno.');
  }
  if (['sandbox', 'simulated'].includes(String(tx.provider_mode || ''))) {
    throw new FinanceError(409, 'SIMULATED_PAYMENT_NOT_REFUNDABLE', 'Pagamentos de sandbox ou simulados não geram reembolsos reais.');
  }
  const amountXOF = moneyFilter(input.amountXOF);
  if (amountXOF <= 0) throw new FinanceError(400, 'INVALID_AMOUNT', 'O montante do reembolso deve ser superior a zero.');
  const reserved = await db.query(
    `SELECT COALESCE(SUM(amount_xof), 0)::bigint AS total FROM refunds
      WHERE transaction_id = $1 AND status IN ('requested','authorized','processed')`,
    [transactionId],
  );
  const alreadyReserved = asInt(reserved.rows[0]?.total);
  if (amountXOF + alreadyReserved > asInt(tx.gross_amount_xof)) {
    throw new FinanceError(409, 'REFUND_EXCEEDS_TRANSACTION', 'O total de reembolsos excede o valor da transação original.');
  }
  const reason = cleanText(input.reason, 1000);
  if (reason.length < 5) throw new FinanceError(400, 'REFUND_REASON_REQUIRED', 'Indique o motivo do reembolso com pelo menos 5 caracteres.');
  const kind = cleanText(input.kind, 20) || 'refund';
  if (!['refund', 'reversal'].includes(kind)) throw new FinanceError(400, 'INVALID_REFUND_KIND', 'O tipo deve ser reembolso ou estorno.');
  const id = `REF-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await db.query(
    `INSERT INTO refunds
       (id, transaction_id, amount_xof, reason, status, kind, original_reference, provider_reference, requested_by)
     VALUES ($1,$2,$3,$4,'requested',$5,$6,$7,$8)`,
    [id, transactionId, amountXOF, reason, kind, tx.provider_reference || null, tx.provider_reference || null, actorId || null],
  );
  return getRefund(id);
}

async function rawRefund(id: string) {
  const result = await pool().query(
    `SELECT rf.*, t.status AS transaction_status, t.gross_amount_xof, t.use_case
       FROM refunds rf JOIN payment_transactions t ON t.id = rf.transaction_id
      WHERE rf.id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

function assertPlatformRefund(refund: any) {
  if (!refund) throw new FinanceError(404, 'REFUND_NOT_FOUND', 'O reembolso não existe.');
  if (refund.use_case === 'event_tickets' || refund.use_case === 'event_refund') {
    throw new FinanceError(400, 'BUSINESS_FINANCE_SCOPE', 'Reembolsos de bilhetes pertencem ao financeiro da empresa organizadora.');
  }
}

export async function authorizeRefund(id: string, input: Record<string, unknown>, actorId: string) {
  const db = pool();
  const refund = await rawRefund(id);
  assertPlatformRefund(refund);
  if (refund.status !== 'requested') {
    throw new FinanceError(409, 'REFUND_NOT_REQUESTED', 'Só pedidos de reembolso pendentes podem ser autorizados.');
  }
  await db.query(
    `UPDATE refunds SET status = 'authorized', authorized_by = $2, authorized_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id, actorId || null],
  );
  return getRefund(id);
}

export async function processRefund(id: string, input: Record<string, unknown>, actorId: string) {
  const db = pool();
  const refund = await rawRefund(id);
  assertPlatformRefund(refund);
  if (refund.status !== 'authorized') {
    throw new FinanceError(409, 'REFUND_NOT_AUTHORIZED', 'O reembolso tem de ser autorizado antes de ser efetuado.');
  }
  const providerReference = cleanText(input.providerReference, 200);
  if (providerReference.length < 3) {
    throw new FinanceError(400, 'REFUND_PROVIDER_REFERENCE_REQUIRED', 'Indique a referência da operação devolvida pela operadora.');
  }
  await db.query(
    `UPDATE refunds SET status = 'processed', processed_by = $2, processed_at = NOW(),
       provider_reference = $3, updated_at = NOW()
     WHERE id = $1`,
    [id, actorId || null, providerReference],
  );
  const processed = await db.query(
    `SELECT COALESCE(SUM(amount_xof), 0)::bigint AS total FROM refunds
      WHERE transaction_id = $1 AND status = 'processed'`,
    [refund.transaction_id],
  );
  if (asInt(processed.rows[0]?.total) >= asInt(refund.gross_amount_xof)) {
    await db.query(`UPDATE payment_transactions SET status = 'refunded', updated_at = NOW() WHERE id = $1`, [refund.transaction_id]);
  }
  return getRefund(id);
}

export async function rejectRefund(id: string, input: Record<string, unknown>, actorId: string) {
  const db = pool();
  const refund = await rawRefund(id);
  assertPlatformRefund(refund);
  if (!['requested', 'authorized'].includes(String(refund.status))) {
    throw new FinanceError(409, 'REFUND_NOT_REJECTABLE', 'Este reembolso já foi processado.');
  }
  const reason = cleanText(input.reason, 1000);
  if (reason.length < 3) throw new FinanceError(400, 'REJECTION_REASON_REQUIRED', 'Indique o motivo da rejeição.');
  await db.query(`UPDATE refunds SET status = 'rejected', rejection_reason = $2, updated_at = NOW() WHERE id = $1`, [id, reason]);
  return getRefund(id);
}

function normalizeIsoDate(value: unknown): string | null {
  const text = cleanText(value, 10);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new FinanceError(400, 'INVALID_DATE', 'A data deve estar no formato AAAA-MM-DD.');
  return text;
}

export async function getFinanceStatements(query: Record<string, unknown>) {
  const from = normalizeIsoDate(query.from);
  const to = normalizeIsoDate(query.to);
  const provider = cleanText(query.provider, 40);
  if (provider && !['orange_money', 'telecel', 'manual_transfer'].includes(provider)) {
    throw new FinanceError(400, 'INVALID_PROVIDER', 'Operadora inválida.');
  }
  const conditions = [PLATFORM_PREDICATE];
  const params: unknown[] = [];
  if (from) { params.push(from); conditions.push(`t.created_at::date >= $${params.length}::date`); }
  if (to) { params.push(to); conditions.push(`t.created_at::date <= $${params.length}::date`); }
  if (provider) { params.push(provider); conditions.push(`t.provider = $${params.length}`); }
  const db = pool();
  const result = await db.query(`${TRANSACTION_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY t.created_at DESC`, params);
  const transactions = result.rows.map(mapTransaction);
  const byProvider = new Map<string, { provider: string; label: string; count: number; volumeXOF: number; confirmedXOF: number; pendingXOF: number }>();
  for (const transaction of transactions) {
    const item = byProvider.get(transaction.provider) || {
      provider: transaction.provider,
      label: transaction.providerLabel,
      count: 0,
      volumeXOF: 0,
      confirmedXOF: 0,
      pendingXOF: 0,
    };
    item.count += 1;
    item.volumeXOF += transaction.amountXOF;
    if (transaction.isRealConfirmed) item.confirmedXOF += transaction.amountXOF;
    if (transaction.status === 'pending' || transaction.status === 'created') item.pendingXOF += transaction.amountXOF;
    byProvider.set(transaction.provider, item);
  }
  const reconciliation = await db.query(
    `SELECT r.status, COUNT(*)::int AS count, COALESCE(SUM(r.statement_amount_xof), 0)::bigint AS amount
       FROM payment_reconciliations r
       JOIN payment_transactions t ON t.id = r.transaction_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY r.status`,
    params,
  );
  const refunds = await db.query(
    `SELECT rf.status, COUNT(*)::int AS count, COALESCE(SUM(rf.amount_xof), 0)::bigint AS amount
       FROM refunds rf
       JOIN payment_transactions t ON t.id = rf.transaction_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY rf.status`,
    params,
  );
  return {
    period: { from, to },
    provider: provider || 'all',
    transactions,
    providers: [...byProvider.values()],
    totals: {
      count: transactions.length,
      volumeXOF: transactions.reduce((sum, item) => sum + item.amountXOF, 0),
      confirmedXOF: transactions.reduce((sum, item) => sum + (item.isRealConfirmed ? item.amountXOF : 0), 0),
      pendingXOF: transactions.reduce((sum, item) => sum + (item.status === 'pending' || item.status === 'created' ? item.amountXOF : 0), 0),
    },
    reconciliation: reconciliation.rows.map((row: any) => ({
      status: row.status,
      statusLabel: RECONCILIATION_STATUS_LABELS[row.status as ReconciliationStatus] || row.status,
      count: asInt(row.count),
      amountXOF: asInt(row.amount),
    })),
    refunds: refunds.rows.map((row: any) => ({
      status: row.status,
      statusLabel: REFUND_STATUS_LABELS[row.status] || row.status,
      count: asInt(row.count),
      amountXOF: asInt(row.amount),
    })),
  };
}
