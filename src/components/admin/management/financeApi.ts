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

export interface TicketFinanceEvent {
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

export interface EventPayout {
  id: string;
  companyId: string;
  companyName: string;
  eventId: string | null;
  eventTitle: string | null;
  amountXOF: number;
  currency: string;
  method: 'manual_transfer' | 'orange_money' | 'telecel' | 'bank_transfer';
  methodLabel: string;
  reference: string | null;
  proofReference: string | null;
  status: 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled';
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

export interface TicketFinanceOverview {
  scope: 'platform' | 'company';
  companyId: string | null;
  totals: TicketFinanceTotals;
  events: TicketFinanceEvent[];
  companies: Array<{
    companyId: string;
    companyName: string;
    grossXOF: number;
    commissionXOF: number;
    netXOF: number;
    paidOutXOF: number;
    processingXOF: number;
    pendingPayoutXOF: number;
    events: number;
  }>;
  providers: Array<{ provider: string; providerLabel: string; transactions: number; amountXOF: number }>;
  unlinkedTransactions?: Array<{
    id: string;
    provider: string;
    providerLabel: string;
    providerReference: string | null;
    amountXOF: number;
    payerName: string;
    payerPhone: string;
    createdAt: string | null;
    confirmedAt: string | null;
  }>;
  generatedAt: string;
}

export interface FinanceSummary {
  platform: {
    transactionCount: number;
    volumeXOF: number;
    confirmedCount: number;
    confirmedXOF: number;
    pendingCount: number;
    pendingXOF: number;
    sandboxCount: number;
    sandboxXOF: number;
    simulatedCount: number;
    simulatedXOF: number;
    legacyCount: number;
    reconciledCount: number;
    reconciledXOF: number;
    reconciliationCount: number;
    divergenceCount: number;
    refundsProcessedCount: number;
    refundsProcessedXOF: number;
    refundsOpenCount: number;
  };
  company: {
    transactionCount: number;
    paidCount: number;
    revenueXOF: number;
    refundedXOF: number;
  };
  ticketFinance: TicketFinanceOverview;
  scopeAudit: {
    ordersPaidCount: number;
    ordersPaidXOF: number;
    companyPaymentsPaidXOF: number;
    unlinkedOrderAmountXOF: number;
  };
  generatedAt: string;
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

export interface OperationalAlertsResponse {
  generatedAt: string;
  thresholds: { pendingPaymentHours: number };
  totals: { activeAlerts: number; affectedItems: number; amountXOF: number };
  alerts: OperationalAlert[];
}

export interface FinanceTransaction {
  id: string;
  scope: 'platform' | 'business';
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
  reconciliationStatus: string;
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

export interface ReconciliationItem {
  transactionId: string;
  transaction: FinanceTransaction;
  id: string | null;
  statementReference: string | null;
  expectedAmountXOF: number;
  statementAmountXOF: number | null;
  status: string;
  statusLabel: string;
  notes: string | null;
  createdBy: string | null;
  createdByName: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ReconciliationHistoryItem {
  id: string;
  action: string;
  actionLabel: string;
  actorId: string | null;
  actorName: string;
  transactionId: string | null;
  reconciliationId: string | null;
  status: string | null;
  reason: string | null;
  createdAt: string;
}

export interface FinanceOperator {
  provider: string;
  label: string;
  dedicatedPhone: string | null;
  integrationStatus: 'negotiation' | 'sandbox' | 'production' | 'manual';
  apiBaseUrl: string | null;
  webhookPath: string | null;
  apiVersion: string | null;
  supportsAutoPushOtp: boolean;
  notes: string | null;
  updatedAt: string | null;
  transactionCount: number;
  volumeXOF: number;
  pendingCount: number;
  pendingXOF: number;
  confirmedCount: number;
  confirmedXOF: number;
  simulatedCount: number;
}

export interface FinanceOperatorHistory {
  id: string;
  action: string;
  actionLabel: string;
  provider: string | null;
  actorName: string;
  reason: string | null;
  createdAt: string;
}

export interface PendingPayment extends FinanceTransaction {
  actions: Array<{
    id: string;
    action: string;
    reason: string | null;
    proofReference: string | null;
    actorName: string;
    createdAt: string;
  }>;
}

export interface FinanceRefund {
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

export interface FinanceStatements {
  period: { from: string | null; to: string | null };
  provider: string;
  transactions: FinanceTransaction[];
  providers: Array<{
    provider: string;
    label: string;
    count: number;
    volumeXOF: number;
    confirmedXOF: number;
    pendingXOF: number;
  }>;
  totals: { count: number; volumeXOF: number; confirmedXOF: number; pendingXOF: number };
  reconciliation: Array<{ status: string; statusLabel: string; count: number; amountXOF: number }>;
  refunds: Array<{ status: string; statusLabel: string; count: number; amountXOF: number }>;
}

export async function financeFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error((data as { error?: string }).error || 'Não foi possível concluir a operação financeira.') as Error & { code?: string };
    error.code = (data as { code?: string }).code;
    throw error;
  }
  return data as T;
}

export function formatXOF(value: number | null | undefined): string {
  return `${Number(value || 0).toLocaleString('pt-PT')} XOF`;
}

export function formatFinanceAge(hours: number | null | undefined): string {
  const total = Math.max(0, Math.floor(Number(hours) || 0));
  if (total < 1) return 'menos de 1 h';
  if (total < 24) return `${total} h`;
  const days = Math.floor(total / 24);
  const remainder = total % 24;
  return remainder ? `${days} d ${remainder} h` : `${days} d`;
}

export function formatFinanceDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('pt-PT')} ${date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`;
}

export function financeOriginLabel(origin: FinanceTransaction['dataOrigin']): string {
  return {
    live: 'Produção',
    sandbox: 'Sandbox',
    simulated: 'Simulado',
    manual: 'Manual',
    legacy: 'Legado',
  }[origin];
}

export function financeOriginTone(origin: FinanceTransaction['dataOrigin']): string {
  return {
    live: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    sandbox: 'border-sky-200 bg-sky-50 text-sky-800',
    simulated: 'border-violet-200 bg-violet-50 text-violet-800',
    manual: 'border-slate-200 bg-slate-50 text-slate-700',
    legacy: 'border-amber-200 bg-amber-50 text-amber-800',
  }[origin];
}

export function financeStatusTone(status: string): string {
  if (status === 'reconciled' || status === 'processed' || status === 'paid' || status === 'authorized') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }
  if (status === 'divergence' || status === 'rejected' || status === 'failed') {
    return 'border-rose-200 bg-rose-50 text-rose-800';
  }
  if (status === 'in_review') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export function downloadFinanceExport(format: 'csv' | 'excel' | 'pdf', options: {
  filename: string;
  title: string;
  description: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  kpis?: Array<{ label: string; value: string }>;
}) {
  return import('./managementExports').then(({ exportManagementCsv, exportManagementExcel, exportManagementPdf }) => {
    if (format === 'csv') {
      exportManagementCsv(`${options.filename}.csv`, options.headers, options.rows);
    } else if (format === 'excel') {
      exportManagementExcel(`${options.filename}.xlsx`, options.title, options.headers, options.rows);
    } else {
      exportManagementPdf({
        title: options.title,
        description: options.description,
        kpis: options.kpis || [],
        headers: options.headers,
        rows: options.rows,
      });
    }
  });
}
