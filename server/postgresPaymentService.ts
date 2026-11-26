import { randomBytes } from 'node:crypto';
import { databasePool, withDbIdentity } from './db';

type PaymentTransaction = {
  id: string;
  provider: string;
  providerRef?: string;
  status: string;
  amountXOF: number;
  payerName?: string;
  payerPhone?: string;
  useCase?: string;
  businessId?: string;
  providerMode?: string;
  confirmedAt?: string;
  createdAt?: string;
  /** Bilhetes emitidos nesta cobrança; permitem resolver os pedidos reais. */
  ticketIds?: string[];
  orderId?: string;
  eventId?: string;
  companyId?: string;
  buyerUserId?: string;
};

interface TicketOrderLink {
  order_id: string;
  event_id: string;
  company_id: string | null;
  buyer_user_id: string | null;
  amount_xof: number;
}

const statusMap: Record<string, string> = {
  confirmed_api: 'paid',
  confirmed_manual: 'authorized',
  pending_provider: 'pending',
  pending_manual_confirmation: 'pending',
  reconciled: 'paid',
};

// Banco (payment_transactions.status) -> vocabulario do frontend (PaymentStatus).
const dbToFrontendStatus: Record<string, string> = {
  paid: 'confirmed_api',
  authorized: 'confirmed_manual',
  pending: 'pending_manual_confirmation',
  refunded: 'refunded',
  partially_refunded: 'refunded',
  failed: 'failed',
  cancelled: 'failed',
  created: 'pending_provider',
};

// use_case -> etiqueta legivel para a Secao 10 (Financas).
const useCaseLabel: Record<string, string> = {
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

export interface FrontendPaymentTransaction {
  id: string;
  useCase: string;
  useCaseLabel: string;
  payerName: string;
  payerPhone: string;
  amountXOF: number;
  provider: string;
  providerRef?: string;
  status: string;
  isApiIntegrationReady: boolean;
  providerMode?: 'manual' | 'simulated' | 'sandbox' | 'live';
  createdAt: string;
  confirmedAt?: string;
}

// Le todas as transaccoes reais do banco e mapeia para o shape do frontend.
// Read-only: nao toca no fluxo de reconciliacao (que opera sobre o array em memoria).
export async function listPostgresPayments(limit = 500): Promise<FrontendPaymentTransaction[]> {
  if (!databasePool) return [];
  const result = await databasePool.query(
    `SELECT id, provider, provider_reference, status, gross_amount_xof, payer_name, payer_phone, use_case, provider_mode, confirmed_at, created_at
       FROM payment_transactions
      ORDER BY created_at DESC
      LIMIT $1`,
    [limit],
  );
  return result.rows.map((row: any) => ({
    id: row.id,
    useCase: row.use_case || 'event_tickets',
    useCaseLabel: useCaseLabel[row.use_case] || row.use_case || 'Transacção',
    payerName: row.payer_name || '—',
    payerPhone: row.payer_phone || '—',
    amountXOF: Number(row.gross_amount_xof || 0),
    provider: row.provider,
    providerRef: row.provider_reference || undefined,
    status: dbToFrontendStatus[row.status] || 'pending_manual_confirmation',
    isApiIntegrationReady: row.provider_mode === 'live',
    providerMode: row.provider_mode || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
  }));
}

/**
 * Resolve os pedidos reais de uma cobrança de bilhetes. Cada bilhete tem o seu
 * próprio pedido; a ligação é feita pelos bilhetes emitidos, nunca por valores
 * ou por identificadores fornecidos pelo cliente.
 */
async function resolveTicketOrders(
  client: { query: (sql: string, values?: unknown[]) => Promise<{ rows: TicketOrderLink[] }> },
  transaction: PaymentTransaction,
): Promise<TicketOrderLink[]> {
  const ticketIds = Array.isArray(transaction.ticketIds) ? transaction.ticketIds.filter(Boolean) : [];
  if (ticketIds.length > 0) {
    const linked = await client.query(
      `SELECT DISTINCT o.id AS order_id, o.event_id, e.company_id, o.buyer_user_id, o.gross_amount_xof AS amount_xof
         FROM tickets t
         JOIN orders o ON o.id = t.order_id
         LEFT JOIN events e ON e.id = o.event_id
        WHERE t.id = ANY($1::text[])`,
      [ticketIds],
    );
    return linked.rows;
  }
  if (transaction.orderId) {
    const linked = await client.query(
      `SELECT o.id AS order_id, o.event_id, e.company_id, o.buyer_user_id, o.gross_amount_xof AS amount_xof
         FROM orders o LEFT JOIN events e ON e.id = o.event_id
        WHERE o.id = $1`,
      [transaction.orderId],
    );
    return linked.rows;
  }
  return [];
}

export async function persistPostgresPayment(transaction: PaymentTransaction, idempotencyKey?: string): Promise<void> {
  if (!databasePool) return;
  const dbStatus = statusMap[transaction.status] || 'pending';
  const isTicketPayment = transaction.useCase === 'event_tickets';
  const isConfirmed = dbStatus === 'paid' || dbStatus === 'authorized';
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const orders = isTicketPayment ? await resolveTicketOrders(client, transaction) : [];
    // Uma cobrança confirmada de bilhetes só é registada depois de os pedidos e
    // bilhetes existirem; a segunda gravação da compra traz essa ligação.
    if (isTicketPayment && isConfirmed && orders.length === 0) {
      await client.query('ROLLBACK');
      return;
    }
    const primary = orders[0];
    const eventId = primary?.event_id || transaction.eventId || null;
    const companyId = primary?.company_id || transaction.companyId || transaction.businessId || null;
    const buyerUserId = primary?.buyer_user_id || transaction.buyerUserId || null;
    await client.query(
      `INSERT INTO payment_transactions
        (id,provider,provider_reference,status,gross_amount_xof,net_amount_xof,payer_name,payer_phone,use_case,business_id,provider_mode,confirmed_at,created_at,updated_at,idempotency_key,order_id,event_id,company_id,buyer_user_id)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, provider_reference=EXCLUDED.provider_reference,
         payer_name=EXCLUDED.payer_name, payer_phone=EXCLUDED.payer_phone, business_id=EXCLUDED.business_id,
         order_id=COALESCE(EXCLUDED.order_id, payment_transactions.order_id),
         event_id=COALESCE(EXCLUDED.event_id, payment_transactions.event_id),
         company_id=COALESCE(EXCLUDED.company_id, payment_transactions.company_id),
         buyer_user_id=COALESCE(EXCLUDED.buyer_user_id, payment_transactions.buyer_user_id),
         confirmed_at=EXCLUDED.confirmed_at, updated_at=NOW()`,
      [transaction.id, transaction.provider, transaction.providerRef || null, dbStatus, transaction.amountXOF, transaction.payerName || null, transaction.payerPhone || null, transaction.useCase || null, companyId, transaction.providerMode || null, transaction.confirmedAt || null, transaction.createdAt || new Date().toISOString(), idempotencyKey || null, primary?.order_id || null, eventId, companyId, buyerUserId],
    );
    for (const order of orders) {
      await client.query(
        `INSERT INTO payment_transaction_orders (transaction_id, order_id, amount_xof)
         VALUES ($1,$2,$3) ON CONFLICT (transaction_id, order_id) DO NOTHING`,
        [transaction.id, order.order_id, Number(order.amount_xof) || 0],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function recordPostgresPaymentEvent(provider: string, transactionId: string, payload: unknown, signatureValid: boolean, eventReference?: string): Promise<void> {
  if (!databasePool) return;
  // Ingestão de sistema (webhook sem sessão): escrita de sistema, no padrão
  // da auditoria (fase 1); o upsert exige visibilidade da linha em conflito.
  await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
    databasePool!.query(
      `INSERT INTO payment_events (id,transaction_id,provider,event_reference,signature_valid,payload)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (provider,event_reference) DO NOTHING`,
      [`payment-event-${randomBytes(12).toString('hex')}`, transactionId, provider, eventReference || `${transactionId}-${Date.now()}`, signatureValid, JSON.stringify(payload)],
    ),
  );
}
