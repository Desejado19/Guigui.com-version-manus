import { randomBytes } from 'node:crypto';
import { databasePool, withDbIdentity } from './db';

type PaymentTransaction = {
  id: string;
  provider: string;
  providerRef?: string;
  status: string;
  amountXOF: number;
  payerName?: string;
  payerPhone?: string;  useCase?: string;
  businessId?: string;
  providerMode?: string;
  confirmedAt?: string;
  createdAt?: string;
};

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

export async function persistPostgresPayment(transaction: PaymentTransaction, idempotencyKey?: string): Promise<void> {
  if (!databasePool) return;
  await databasePool.query(
    `INSERT INTO payment_transactions
      (id,provider,provider_reference,status,gross_amount_xof,net_amount_xof,payer_name,payer_phone,use_case,business_id,provider_mode,confirmed_at,created_at,updated_at,idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13)
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, provider_reference=EXCLUDED.provider_reference,
       payer_name=EXCLUDED.payer_name, payer_phone=EXCLUDED.payer_phone, business_id=EXCLUDED.business_id,
       confirmed_at=EXCLUDED.confirmed_at, updated_at=NOW()`,
    [transaction.id, transaction.provider, transaction.providerRef || null, statusMap[transaction.status] || 'pending', transaction.amountXOF, transaction.payerName || null, transaction.payerPhone || null, transaction.useCase || null, transaction.businessId || null, transaction.providerMode || null, transaction.confirmedAt || null, transaction.createdAt || new Date().toISOString(), idempotencyKey || null],
  );
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
