import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  MapPin,
  Search,
  Settings,
  Ticket,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { formatCurrencyXOF } from '../../utils/i18n';
import { AdminPagination } from '../admin/AdminPagination';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { Button, Card, EmptyState } from '../ui';

/**
 * Centro de controlo individual do evento.
 *
 * Um único componente partilhado pela empresa organizadora e pelo Super Admin.
 * Os dados vêm de `GET /api/events/:id/control-center`, que aplica o âmbito da
 * empresa no servidor; a interface nunca decide quem pode ver o quê.
 */

export type EventControlTab =
  | 'overview'
  | 'tickets'
  | 'buyers'
  | 'validation'
  | 'finance'
  | 'reports'
  | 'history'
  | 'settings';

interface ApiTicket {
  id: string;
  ticketCode: string;
  status: string;
  buyerName: string;
  buyerPhone: string;
  holderName: string;
  holderPhone: string;
  ticketTypeName: string;
  priceXOF: number;
  orderId: string;
  orderStatus: string;
  purchasedAt: string | null;
  validatedAt: string | null;
  refundStatus: string | null;
}

interface ApiBuyer {
  orderId: string;
  name: string;
  phone: string;
  quantity: number;
  ticketTypes: string;
  totalXOF: number;
  orderStatus: string;
  ticketStatus: string;
  validatedCount: number;
  purchasedAt: string | null;
}

interface EventControlData {
  event: {
    id: string;
    title: string;
    status: string;
    companyName: string;
    date: string;
    time: string;
    location: string;
    neighborhood: string;
    category: string;
    description: string;
    organizerName: string;
    scannerDoorCode: string;
    createdAt: string | null;
    updatedAt: string | null;
  };
  ticketTypes: Array<{ id: string; name: string; priceXOF: number; quantity: number; sold: number; available: number }>;
  tickets: ApiTicket[];
  buyers: ApiBuyer[];
  validations: Array<{ id: string; result: string; reason: string; ticketCode: string; operator: string; createdAt: string | null }>;
  refunds: Array<{ id: string; ticketCode: string; amountXOF: number; status: string; reason: string; createdAt: string | null; processedAt: string | null }>;
  payouts: Array<{
    id: string;
    amountXOF: number;
    method: string;
    methodLabel: string;
    reference: string | null;
    proofReference: string | null;
    status: string;
    statusLabel: string;
    notes: string | null;
    createdByName: string | null;
    confirmedAt: string | null;
    createdAt: string | null;
  }>;
  transactions: Array<{
    id: string;
    provider: string;
    providerReference: string | null;
    status: string;
    amountXOF: number;
    payerName: string;
    buyerUserId: string | null;
    createdAt: string | null;
    confirmedAt: string | null;
    ticketCodes: string[];
  }>;
  history: Array<{ action: string; result: string; resourceId: string; reason: string; actor: string; createdAt: string | null }>;
  finance: {
    grossXOF: number;
    commissionXOF: number;
    commissionRate: number;
    companyShareXOF: number;
    paidOutXOF: number;
    processingPayoutXOF: number;
    pendingPayoutXOF: number;
    pendingXOF: number;
    refundedXOF: number;
    paidOrders: number;
    pendingOrders: number;
    refundedOrders: number;
    confirmedPayments: number;
    refundsRequestedXOF: number;
    state: string;
  };
  indicators: {
    capacity: number;
    sold: number;
    available: number;
    used: number;
    unused: number;
    cancelled: number;
    revenueXOF: number;
    checkInsRate: number;
  };
  salesByDay: Array<{ day: string; tickets: number; revenueXOF: number }>;
  salesByType: Array<{ name: string; tickets: number; revenueXOF: number }>;
  recentPurchases: Array<{ ticketCode: string; buyer: string; type: string; priceXOF: number; purchasedAt: string | null }>;
  recentValidations: Array<{ ticketCode: string; createdAt: string | null }>;
  truncated: boolean;
  generatedAt: string;
}

const TABS: Array<{ key: EventControlTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { key: 'tickets', label: 'Bilhetes e Vendas', icon: Ticket },
  { key: 'buyers', label: 'Compradores', icon: Users },
  { key: 'validation', label: 'Validação', icon: CheckCircle2 },
  { key: 'finance', label: 'Financeiro', icon: Wallet },
  { key: 'reports', label: 'Relatórios', icon: FileText },
  { key: 'history', label: 'Histórico', icon: History },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

const EXPORT_OPTIONS = [
  { key: 'summary', label: 'Resumo' },
  { key: 'event', label: 'Evento' },
  { key: 'tickets', label: 'Bilhetes' },
  { key: 'sales', label: 'Vendas' },
  { key: 'buyers', label: 'Compradores' },
  { key: 'finance', label: 'Financeiro' },
  { key: 'commissions', label: 'Comissões' },
  { key: 'validations', label: 'Validações' },
  { key: 'refunds', label: 'Reembolsos' },
  { key: 'payouts', label: 'Repasses' },
  { key: 'history', label: 'Histórico' },
];

const TICKET_STATUS_LABELS: Record<string, string> = {
  valid: 'Por usar',
  used: 'Utilizado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  pending: 'Pendente',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  created: 'Criado',
  failed: 'Falhado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  active: 'Ativo',
  published: 'Publicado',
  draft: 'Rascunho',
  pending: 'Em aprovação',
  cancelled: 'Cancelado',
  rejected: 'Rejeitado',
  ended: 'Encerrado',
};

const FINANCE_STATE_LABELS: Record<string, string> = {
  no_sales: 'Sem vendas',
  pending_only: 'Apenas pendentes',
  confirmed: 'Confirmado',
  partially_refunded: 'Com reembolsos',
};

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-PT');
};

const statusTone = (status: string) => {
  if (status === 'valid' || status === 'paid' || status === 'used' || status === 'active' || status === 'published') {
    return 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]';
  }
  if (status === 'cancelled' || status === 'failed' || status === 'rejected') {
    return 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]';
  }
  return 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]';
};

const download = async (url: string, fallbackName: string) => {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({} as { error?: string }));
    throw new Error(payload.error || `O servidor respondeu com ${response.status}.`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = match?.[1] || fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
};

const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: 'success' | 'warning' | 'danger' | 'neutral';
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'neutral', onClick }) => {
  const tones: Record<string, string> = {
    success: 'text-[var(--tone-success-text)]',
    warning: 'text-[var(--tone-warning-text)]',
    danger: 'text-[var(--tone-danger-text)]',
    neutral: 'text-slate-900 dark:text-white',
  };
  const content = (
    <>
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] font-semibold text-slate-500">{hint}</p> : null}
    </>
  );
  const className =
    'rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 text-left transition dark:border-slate-700 dark:bg-slate-900';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${className} hover:border-[var(--color-green-700)]`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
};

const SalesChart: React.FC<{ data: EventControlData['salesByDay'] }> = ({ data }) => {
  const points = data.slice(-14);
  const max = Math.max(1, ...points.map((point) => point.tickets));
  if (points.length === 0) {
    return <p className="text-[11px] text-slate-500">Ainda não existem vendas para representar.</p>;
  }
  return (
    <div className="flex h-32 items-end gap-1.5" role="img" aria-label="Gráfico de bilhetes vendidos por dia">
      {points.map((point) => (
        <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-[var(--color-green-700)]"
            style={{ height: `${Math.max(6, Math.round((point.tickets / max) * 100))}%` }}
            title={`${point.day}: ${point.tickets} bilhete(s) · ${formatCurrencyXOF(point.revenueXOF, 'pt')}`}
          />
          <span className="w-full truncate text-center text-[8px] font-bold text-slate-500">{point.day.slice(5)}</span>
        </div>
      ))}
    </div>
  );
};

export const EventControlCenter: React.FC<{
  eventId: string;
  eventTitle?: string;
  viewerRole: 'business' | 'admin';
  onClose: () => void;
  initialTab?: EventControlTab;
}> = ({ eventId, eventTitle, viewerRole, onClose, initialTab = 'overview' }) => {
  const [data, setData] = useState<EventControlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<EventControlTab>(initialTab);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [sections, setSections] = useState<string[]>(EXPORT_OPTIONS.map((option) => option.key));

  const [ticketQuery, setTicketQuery] = useState('');
  const [ticketStatus, setTicketStatus] = useState('all');
  const [buyerQuery, setBuyerQuery] = useState('');
  const [buyerStatus, setBuyerStatus] = useState('all');
  const [validationQuery, setValidationQuery] = useState('');
  const [validationResult, setValidationResult] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}/control-center`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `O servidor respondeu com ${response.status}.`);
      setData(payload.data as EventControlData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o evento.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const filteredTickets = useMemo(() => {
    if (!data) return [];
    const needle = ticketQuery.trim().toLowerCase();
    return data.tickets.filter((ticket) => {
      if (ticketStatus !== 'all' && ticket.status !== ticketStatus) return false;
      if (!needle) return true;
      return [ticket.buyerName, ticket.holderName, ticket.buyerPhone, ticket.holderPhone, ticket.ticketCode, ticket.ticketTypeName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, ticketQuery, ticketStatus]);

  const ticketPagination = usePaginatedList(filteredTickets, {
    initialPageSize: 20,
    pageSizeOptions: [20, 50, 100],
    persist: false,
    resetKey: `${ticketQuery}|${ticketStatus}`,
  });

  const filteredBuyers = useMemo(() => {
    if (!data) return [];
    const needle = buyerQuery.trim().toLowerCase();
    return data.buyers.filter((buyer) => {
      if (buyerStatus !== 'all' && buyer.orderStatus !== buyerStatus) return false;
      if (!needle) return true;
      return [buyer.name, buyer.phone, buyer.orderId, buyer.ticketTypes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, buyerQuery, buyerStatus]);

  const buyerPagination = usePaginatedList(filteredBuyers, {
    initialPageSize: 20,
    pageSizeOptions: [20, 50, 100],
    persist: false,
    resetKey: `${buyerQuery}|${buyerStatus}`,
  });

  const filteredValidations = useMemo(() => {
    if (!data) return [];
    const needle = validationQuery.trim().toLowerCase();
    return data.validations.filter((validation) => {
      if (validationResult !== 'all' && validation.result !== validationResult) return false;
      if (!needle) return true;
      return [validation.ticketCode, validation.operator, validation.reason]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [data, validationQuery, validationResult]);

  const validationPagination = usePaginatedList(filteredValidations, {
    initialPageSize: 20,
    pageSizeOptions: [20, 50],
    persist: false,
    resetKey: `${validationQuery}|${validationResult}`,
  });

  const handleExport = async (format: 'pdf' | 'xlsx' | 'csv', overrideSections?: string[]) => {
    const selected = overrideSections ?? sections;
    if (selected.length === 0) {
      setNotice({ tone: 'error', text: 'Selecione pelo menos uma secção para exportar.' });
      return;
    }
    setExporting(format);
    setNotice(null);
    try {
      const query = new URLSearchParams({ format, sections: selected.join(',') });
      // Os filtros visíveis no painel viajam com a exportação.
      if (ticketStatus !== 'all') query.set('ticketStatus', ticketStatus);
      if (buyerStatus !== 'all') query.set('orderStatus', buyerStatus);
      if (validationResult !== 'all') query.set('validationResult', validationResult);
      // Cada pesquisa fica associada à sua lista: mudar de separador não a perde.
      if (ticketQuery.trim()) query.set('ticketQuery', ticketQuery.trim());
      if (buyerQuery.trim()) query.set('buyerQuery', buyerQuery.trim());
      if (validationQuery.trim()) query.set('validationQuery', validationQuery.trim());
      await download(
        `/api/events/${encodeURIComponent(eventId)}/control-center/export?${query.toString()}`,
        `evento-${eventId}.${format}`,
      );
      setNotice({ tone: 'success', text: `Exportação ${format.toUpperCase()} gerada com os dados atuais do evento.` });
    } catch (exportError) {
      setNotice({ tone: 'error', text: exportError instanceof Error ? exportError.message : 'Falha ao exportar.' });
    } finally {
      setExporting(null);
    }
  };

  const alerts = useMemo(() => {
    if (!data) return [] as Array<{ tone: 'warning' | 'danger' | 'info'; text: string }>;
    const items: Array<{ tone: 'warning' | 'danger' | 'info'; text: string }> = [];
    if (data.finance.pendingXOF > 0) {
      items.push({
        tone: 'warning',
        text: `${data.finance.pendingOrders} pedido(s) pendente(s) no valor de ${formatCurrencyXOF(data.finance.pendingXOF, 'pt')} — não contam como receita confirmada.`,
      });
    }
    if (data.finance.refundsRequestedXOF > 0) {
      items.push({ tone: 'danger', text: `${formatCurrencyXOF(data.finance.refundsRequestedXOF, 'pt')} em reembolsos pedidos a aguardar processamento.` });
    }
    if (data.indicators.capacity > 0 && data.indicators.available === 0) {
      items.push({ tone: 'info', text: 'Capacidade esgotada: todos os bilhetes disponíveis foram vendidos.' });
    }
    if (data.indicators.sold > 0 && data.indicators.used === 0 && data.validations.length === 0) {
      items.push({ tone: 'info', text: 'Ainda não existem validações registadas para este evento.' });
    }
    return items;
  }, [data]);

  const title = data?.event.title || eventTitle || 'Centro de controlo do evento';

  return (
    <div
      className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Centro de controlo de ${title}`}
    >
      <div className="my-3 w-full max-w-6xl overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-canvas)] shadow-2xl dark:border-slate-700">
        <header className="border-b border-slate-800 bg-gradient-to-r from-[#0b3b37] to-slate-900 p-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Centro de controlo do evento</p>
              <h2 className="mt-1 truncate text-lg font-black">{title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/75">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{data?.event.date || '—'} {data?.event.time || ''}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{data?.event.location || '—'}</span>
                {data ? (
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${statusTone(data.event.status)}`}>
                    {EVENT_STATUS_LABELS[data.event.status] || data.event.status}
                  </span>
                ) : null}
                <span className="rounded-full border border-emerald-600 bg-emerald-900 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                  {viewerRole === 'admin' ? 'Super Admin' : 'Empresa organizadora'}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => void load()} loading={loading}>
                Atualizar
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-emerald-600 bg-emerald-950 p-2 text-white transition hover:bg-emerald-900"
                aria-label="Fechar centro de controlo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <nav
          aria-label="Submódulos do evento"
          className="flex gap-1 overflow-x-auto border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
        >
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = item.key === tab;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[10.5px] font-black transition ${
                  active
                    ? 'bg-[var(--color-green-900)] text-white'
                    : 'text-slate-600 hover:bg-[var(--color-bg-subtle)] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="max-h-[74vh] overflow-y-auto p-3 sm:p-4">
          {loading && !data ? (
            <p className="flex items-center gap-2 p-4 text-[11px] font-bold text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar dados do evento…
            </p>
          ) : null}

          {error ? (
            <div className="space-y-2 rounded-2xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] p-4 text-[11px] font-bold text-[var(--tone-danger-text)]">
              <p className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> {error}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button>
            </div>
          ) : null}

          {notice ? (
            <p
              role="status"
              className={`mb-3 rounded-xl border px-3 py-2 text-[11px] font-bold ${
                notice.tone === 'error'
                  ? 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'
                  : 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
              }`}
            >
              {notice.text}
            </p>
          ) : null}

          {data && tab === 'overview' ? (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Bilhetes vendidos" value={String(data.indicators.sold)} hint={`${data.indicators.capacity} de capacidade`} onClick={() => setTab('tickets')} />
                <StatCard label="Arrecadação bruta" value={formatCurrencyXOF(data.finance.grossXOF, 'pt')} hint={`${data.finance.paidOrders} pedido(s) pagos`} tone="success" onClick={() => setTab('finance')} />
                <StatCard label="Comissão Guigui.com" value={formatCurrencyXOF(data.finance.commissionXOF, 'pt')} hint={`${data.finance.commissionRate}% aplicado`} onClick={() => setTab('finance')} />
                <StatCard label="Valor da empresa" value={formatCurrencyXOF(data.finance.companyShareXOF, 'pt')} hint="Líquido dos pedidos pagos" tone="success" onClick={() => setTab('finance')} />
                <StatCard label="Pendente de repasse" value={formatCurrencyXOF(data.finance.pendingPayoutXOF, 'pt')} hint="Ainda não transferido" tone={data.finance.pendingPayoutXOF > 0 ? 'warning' : 'success'} onClick={() => setTab('finance')} />
                <StatCard label="Disponíveis" value={String(data.indicators.available)} hint="Bilhetes por vender" onClick={() => setTab('tickets')} />
                <StatCard label="Utilizados" value={String(data.indicators.used)} hint={`${data.indicators.checkInsRate}% de check-in`} onClick={() => setTab('validation')} />
                <StatCard label="Não utilizados" value={String(data.indicators.unused)} hint={`${data.indicators.cancelled} cancelado(s)`} onClick={() => setTab('validation')} />
                <StatCard
                  label="Estado financeiro"
                  value={FINANCE_STATE_LABELS[data.finance.state] || data.finance.state}
                  hint={data.finance.pendingXOF > 0 ? `${formatCurrencyXOF(data.finance.pendingXOF, 'pt')} pendente` : 'Sem valores pendentes'}
                  tone={data.finance.pendingXOF > 0 ? 'warning' : 'success'}
                  onClick={() => setTab('finance')}
                />
              </div>

              {alerts.length > 0 ? (
                <ul className="space-y-1.5" aria-label="Alertas do evento">
                  {alerts.map((alert) => (
                    <li
                      key={alert.text}
                      className={`flex items-start gap-1.5 rounded-xl border px-3 py-2 text-[10.5px] font-bold ${
                        alert.tone === 'danger'
                          ? 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'
                          : alert.tone === 'warning'
                            ? 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]'
                            : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {alert.text}
                    </li>
                  ))}
                </ul>
              ) : null}

              {data.truncated ? (
                <p className="rounded-xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] px-3 py-2 text-[10.5px] font-bold text-[var(--tone-warning-text)]">
                  A lista mostra os 2.000 bilhetes mais recentes. As exportações incluem o evento completo.
                </p>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                  <h3 className="text-[11px] font-black text-slate-900 dark:text-white">Vendas por dia</h3>
                  <div className="mt-3"><SalesChart data={data.salesByDay} /></div>
                </Card>
                <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                  <h3 className="text-[11px] font-black text-slate-900 dark:text-white">Vendas por tipo de bilhete</h3>
                  <ul className="mt-2 divide-y divide-[var(--color-border-subtle)] text-[11px] dark:divide-slate-800">
                    {data.salesByType.map((type) => (
                      <li key={type.name} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="truncate font-bold text-slate-700 dark:text-slate-200">{type.name}</span>
                        <span className="shrink-0 text-slate-600 dark:text-slate-300">{type.tickets} · {formatCurrencyXOF(type.revenueXOF, 'pt')}</span>
                      </li>
                    ))}
                    {data.salesByType.length === 0 ? <li className="py-2 text-slate-500">Sem vendas registadas.</li> : null}
                  </ul>
                </Card>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                  <h3 className="text-[11px] font-black text-slate-900 dark:text-white">Últimas compras</h3>
                  <ul className="mt-2 divide-y divide-[var(--color-border-subtle)] text-[10.5px] dark:divide-slate-800">
                    {data.recentPurchases.map((purchase) => (
                      <li key={`${purchase.ticketCode}-${purchase.purchasedAt}`} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="min-w-0 truncate"><strong>{purchase.buyer}</strong> · {purchase.type}</span>
                        <span className="shrink-0 font-mono text-slate-500">{formatDateTime(purchase.purchasedAt)}</span>
                      </li>
                    ))}
                    {data.recentPurchases.length === 0 ? <li className="py-2 text-slate-500">Sem compras registadas.</li> : null}
                  </ul>
                </Card>
                <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                  <h3 className="text-[11px] font-black text-slate-900 dark:text-white">Últimas validações</h3>
                  <ul className="mt-2 divide-y divide-[var(--color-border-subtle)] text-[10.5px] dark:divide-slate-800">
                    {data.recentValidations.map((validation) => (
                      <li key={`${validation.ticketCode}-${validation.createdAt}`} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="font-mono">{validation.ticketCode}</span>
                        <span className="text-slate-500">{formatDateTime(validation.createdAt)}</span>
                      </li>
                    ))}
                    {data.recentValidations.length === 0 ? <li className="py-2 text-slate-500">Ainda não existem validações na portaria.</li> : null}
                  </ul>
                </Card>
              </div>
            </div>
          ) : null}

          {data && tab === 'tickets' ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Capacidade" value={String(data.indicators.capacity)} />
                <StatCard label="Vendidos" value={String(data.indicators.sold)} tone="success" />
                <StatCard label="Disponíveis" value={String(data.indicators.available)} />
                <StatCard label="Receita" value={formatCurrencyXOF(data.indicators.revenueXOF, 'pt')} tone="success" />
              </div>
              <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase text-slate-500 dark:bg-slate-800">
                    <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Preço</th><th className="px-3 py-2">Capacidade</th><th className="px-3 py-2">Vendidos</th><th className="px-3 py-2">Disponíveis</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] dark:divide-slate-800">
                    {data.ticketTypes.map((type) => (
                      <tr key={type.id}>
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{type.name}</td>
                        <td className="px-3 py-2">{formatCurrencyXOF(type.priceXOF, 'pt')}</td>
                        <td className="px-3 py-2">{type.quantity}</td>
                        <td className="px-3 py-2">{type.sold}</td>
                        <td className="px-3 py-2">{type.available}</td>
                      </tr>
                    ))}
                    {data.ticketTypes.length === 0 ? <tr><td className="p-3 text-slate-500" colSpan={5}>Sem tipos de bilhete registados.</td></tr> : null}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={ticketQuery}
                    onChange={(event) => setTicketQuery(event.target.value)}
                    placeholder="Pesquisar comprador, telefone ou código"
                    aria-label="Pesquisar bilhetes do evento"
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] pl-8 pr-3 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={ticketStatus}
                  onChange={(event) => setTicketStatus(event.target.value)}
                  aria-label="Filtrar bilhetes por estado"
                  className="min-h-10 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2.5 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Todos os estados</option>
                  <option value="valid">Por usar</option>
                  <option value="used">Utilizados</option>
                  <option value="cancelled">Cancelados</option>
                  <option value="expired">Expirados</option>
                </select>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2">Bilhete</th><th className="px-3 py-2">Comprador</th><th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Valor</th><th className="px-3 py-2">Compra</th><th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] dark:divide-slate-800">
                    {ticketPagination.pageItems.map((ticket) => (
                      <tr key={ticket.id}>
                        <td className="px-3 py-2 font-mono text-[10px]">{ticket.ticketCode}</td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{ticket.buyerName || ticket.holderName || '—'}</div>
                          <div className="text-[10px] text-slate-500">{ticket.buyerPhone || ticket.holderPhone || '—'}</div>
                        </td>
                        <td className="px-3 py-2">{ticket.ticketTypeName}</td>
                        <td className="px-3 py-2">{formatCurrencyXOF(ticket.priceXOF, 'pt')}</td>
                        <td className="px-3 py-2 text-[10px]">{formatDateTime(ticket.purchasedAt)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${statusTone(ticket.status)}`}>
                            {TICKET_STATUS_LABELS[ticket.status] || ticket.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredTickets.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-slate-500">Sem bilhetes para os filtros aplicados.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {filteredTickets.length > 0 ? (
                <AdminPagination
                  currentPage={ticketPagination.page}
                  pageSize={ticketPagination.pageSize}
                  totalItems={ticketPagination.totalItems}
                  onPageChange={ticketPagination.setPage}
                  onPageSizeChange={ticketPagination.setPageSize}
                  pageSizeOptions={ticketPagination.pageSizeOptions}
                />
              ) : null}
            </div>
          ) : null}

          {data && tab === 'buyers' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={buyerQuery}
                    onChange={(event) => setBuyerQuery(event.target.value)}
                    placeholder="Pesquisar comprador, telefone ou pedido"
                    aria-label="Pesquisar compradores do evento"
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] pl-8 pr-3 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={buyerStatus}
                  onChange={(event) => setBuyerStatus(event.target.value)}
                  aria-label="Filtrar compradores por estado de pagamento"
                  className="min-h-10 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2.5 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Todos os pagamentos</option>
                  <option value="paid">Pagos</option>
                  <option value="pending">Pendentes</option>
                  <option value="created">Criados</option>
                  <option value="cancelled">Cancelados</option>
                  <option value="refunded">Reembolsados</option>
                  <option value="failed">Falhados</option>
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleExport('csv', ['buyers'])}
                  loading={exporting === 'csv'}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Exportar CSV
                </Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase text-slate-500 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2">Comprador</th><th className="px-3 py-2">Pedido</th><th className="px-3 py-2">Bilhetes</th>
                      <th className="px-3 py-2">Tipos</th><th className="px-3 py-2">Total</th><th className="px-3 py-2">Pagamento</th>
                      <th className="px-3 py-2">Validação</th><th className="px-3 py-2">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] dark:divide-slate-800">
                    {buyerPagination.pageItems.map((buyer) => (
                      <tr key={buyer.orderId}>
                        <td className="px-3 py-2">
                          <div className="font-bold text-slate-800 dark:text-slate-100">{buyer.name}</div>
                          <div className="text-[10px] text-slate-500">{buyer.phone || '—'}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px]">{buyer.orderId}</td>
                        <td className="px-3 py-2">{buyer.quantity}</td>
                        <td className="px-3 py-2 text-[10px]">{buyer.ticketTypes}</td>
                        <td className="px-3 py-2 font-bold">{formatCurrencyXOF(buyer.totalXOF, 'pt')}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${statusTone(buyer.orderStatus)}`}>
                            {ORDER_STATUS_LABELS[buyer.orderStatus] || buyer.orderStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[10px]">{buyer.validatedCount}/{buyer.quantity}</td>
                        <td className="px-3 py-2 text-[10px]">{formatDateTime(buyer.purchasedAt)}</td>
                      </tr>
                    ))}
                    {filteredBuyers.length === 0 ? <tr><td colSpan={8} className="p-4 text-center text-slate-500">Sem compradores para os filtros aplicados.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {filteredBuyers.length > 0 ? (
                <AdminPagination
                  currentPage={buyerPagination.page}
                  pageSize={buyerPagination.pageSize}
                  totalItems={buyerPagination.totalItems}
                  onPageChange={buyerPagination.setPage}
                  onPageSizeChange={buyerPagination.setPageSize}
                  pageSizeOptions={buyerPagination.pageSizeOptions}
                />
              ) : null}
            </div>
          ) : null}

          {data && tab === 'validation' ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <StatCard label="Bilhetes utilizados" value={String(data.indicators.used)} tone="success" hint={`${data.indicators.checkInsRate}% de check-in`} />
                <StatCard label="Por utilizar" value={String(data.indicators.unused)} hint="Prontos para validação na portaria" />
                <StatCard label="Cancelados" value={String(data.indicators.cancelled)} tone={data.indicators.cancelled > 0 ? 'danger' : 'neutral'} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="search"
                    value={validationQuery}
                    onChange={(event) => setValidationQuery(event.target.value)}
                    placeholder="Pesquisar código, operador ou motivo"
                    aria-label="Pesquisar validações do evento"
                    className="min-h-10 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] pl-8 pr-3 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <select
                  value={validationResult}
                  onChange={(event) => setValidationResult(event.target.value)}
                  aria-label="Filtrar validações por resultado"
                  className="min-h-10 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-2.5 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="all">Todos os resultados</option>
                  <option value="accepted">Aceites</option>
                  <option value="rejected">Rejeitadas</option>
                </select>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-[var(--color-bg-subtle)] text-[9px] uppercase text-slate-500 dark:bg-slate-800">
                    <tr><th className="px-3 py-2">Bilhete</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2">Operador</th><th className="px-3 py-2">Data</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)] dark:divide-slate-800">
                    {validationPagination.pageItems.map((validation) => (
                      <tr key={validation.id}>
                        <td className="px-3 py-2 font-mono text-[10px]">{validation.ticketCode}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${statusTone(validation.result === 'accepted' ? 'valid' : 'cancelled')}`}>
                            {validation.result === 'accepted' ? 'Aceite' : 'Rejeitada'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[10px]">{validation.reason || '—'}</td>
                        <td className="px-3 py-2 text-[10px]">{validation.operator || '—'}</td>
                        <td className="px-3 py-2 text-[10px]">{formatDateTime(validation.createdAt)}</td>
                      </tr>
                    ))}
                    {filteredValidations.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-slate-500">Sem validações registadas para este evento.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              {filteredValidations.length > 0 ? (
                <AdminPagination
                  currentPage={validationPagination.page}
                  pageSize={validationPagination.pageSize}
                  totalItems={validationPagination.totalItems}
                  onPageChange={validationPagination.setPage}
                  onPageSizeChange={validationPagination.setPageSize}
                  pageSizeOptions={validationPagination.pageSizeOptions}
                />
              ) : null}
            </div>
          ) : null}

          {data && tab === 'finance' ? (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Receita bruta" value={formatCurrencyXOF(data.finance.grossXOF, 'pt')} hint={`${data.finance.paidOrders} pedido(s) pagos`} tone="success" />
                <StatCard label="Comissão Guigui.com" value={formatCurrencyXOF(data.finance.commissionXOF, 'pt')} hint={`Taxa ${data.finance.commissionRate}%`} />
                <StatCard label="Valor da empresa" value={formatCurrencyXOF(data.finance.companyShareXOF, 'pt')} tone="success" />
                <StatCard label="Já repassado" value={formatCurrencyXOF(data.finance.paidOutXOF, 'pt')} hint="Repasses confirmados" tone="success" />
                <StatCard label="Em processamento" value={formatCurrencyXOF(data.finance.processingPayoutXOF, 'pt')} tone={data.finance.processingPayoutXOF > 0 ? 'warning' : 'neutral'} />
                <StatCard label="Pendente de repasse" value={formatCurrencyXOF(data.finance.pendingPayoutXOF, 'pt')} tone={data.finance.pendingPayoutXOF > 0 ? 'warning' : 'success'} />
                <StatCard label="Pendente" value={formatCurrencyXOF(data.finance.pendingXOF, 'pt')} hint={`${data.finance.pendingOrders} pedido(s)`} tone={data.finance.pendingXOF > 0 ? 'warning' : 'neutral'} />
                <StatCard label="Reembolsado" value={formatCurrencyXOF(data.finance.refundedXOF, 'pt')} hint={`${data.finance.refundedOrders} pedido(s)`} tone={data.finance.refundedXOF > 0 ? 'danger' : 'neutral'} />
                <StatCard label="Reembolsos pedidos" value={formatCurrencyXOF(data.finance.refundsRequestedXOF, 'pt')} hint="A aguardar processamento" />
                <StatCard label="Pagamentos confirmados" value={String(data.finance.confirmedPayments)} hint="Transações pagas" />
                <StatCard label="Estado financeiro" value={FINANCE_STATE_LABELS[data.finance.state] || data.finance.state} />
              </div>

              <p className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 text-[10px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Fonte de verdade: <strong>pedidos pagos</strong> — a comissão vem de <code>orders.fee_amount_xof</code> e o valor da empresa de
                <code>orders.net_amount_xof</code>, os mesmos campos usados no financeiro global e no da empresa. As transações de pagamento
                confirmam a cobrança, mas não substituem estes valores.
              </p>

              <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                <h3 className="text-[11px] font-black text-slate-900 dark:text-white">Histórico de repasses</h3>
                <ul className="mt-2 divide-y divide-[var(--color-border-subtle)] text-[10.5px] dark:divide-slate-800">
                  {data.payouts.map((payout) => (
                    <li key={payout.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0">
                        <strong>{formatCurrencyXOF(payout.amountXOF, 'pt')}</strong> · {payout.methodLabel}
                        <span className="block truncate text-[9.5px] text-slate-500">
                          {payout.reference || 'Sem referência'} · {payout.proofReference || 'Sem comprovativo'}
                        </span>
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${statusTone(payout.status === 'confirmed' ? 'paid' : payout.status === 'failed' || payout.status === 'cancelled' ? 'cancelled' : 'pending')}`}>
                        {payout.statusLabel}
                      </span>
                    </li>
                  ))}
                  {data.payouts.length === 0 ? <li className="py-2 text-slate-500">Ainda não existem repasses registados para este evento.</li> : null}
                </ul>
              </Card>

              <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                <h3 className="text-[11px] font-black text-slate-900 dark:text-white">Pagamentos confirmados</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full text-left text-[10.5px]">
                    <thead className="text-[9px] uppercase text-slate-500">
                      <tr><th className="py-1 pr-2">Transação</th><th className="py-1 pr-2">Provedor</th><th className="py-1 pr-2">Valor</th><th className="py-1 pr-2">Bilhetes</th><th className="py-1 pr-2">Confirmado</th></tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-subtle)] dark:divide-slate-800">
                      {data.transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="py-1.5 pr-2 font-mono text-[9.5px]">{transaction.providerReference || transaction.id}</td>
                          <td className="py-1.5 pr-2">{transaction.provider}</td>
                          <td className="py-1.5 pr-2 font-bold">{formatCurrencyXOF(transaction.amountXOF, 'pt')}</td>
                          <td className="py-1.5 pr-2 text-[9px]">{transaction.ticketCodes.slice(0, 3).join(', ') || '—'}{transaction.ticketCodes.length > 3 ? ` +${transaction.ticketCodes.length - 3}` : ''}</td>
                          <td className="py-1.5 pr-2 text-[9px]">{formatDateTime(transaction.confirmedAt)}</td>
                        </tr>
                      ))}
                      {data.transactions.length === 0 ? <tr><td colSpan={5} className="py-2 text-slate-500">Sem transações ligadas a este evento. Compras anteriores à migração podem não estar associadas.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                <h3 className="text-[11px] font-black text-slate-900 dark:text-white">Reembolsos e estornos</h3>
                <ul className="mt-2 divide-y divide-[var(--color-border-subtle)] text-[10.5px] dark:divide-slate-800">
                  {data.refunds.map((refund) => (
                    <li key={refund.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0"><strong className="font-mono">{refund.ticketCode}</strong> · {refund.reason || 'Sem motivo'}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-bold">{formatCurrencyXOF(refund.amountXOF, 'pt')}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${statusTone(refund.status === 'processed' ? 'paid' : 'pending')}`}>{refund.status}</span>
                      </span>
                    </li>
                  ))}
                  {data.refunds.length === 0 ? <li className="py-2 text-slate-500">Sem reembolsos registados neste evento.</li> : null}
                </ul>
              </Card>

              <p className="text-[10px] leading-relaxed text-slate-500">
                Os valores vêm dos pedidos e das transações do evento. Pedidos pendentes ou falhados não contam como receita confirmada.
              </p>
            </div>
          ) : null}

          {data && tab === 'reports' ? (
            <div className="space-y-3">
              <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                <h3 className="text-[12px] font-black text-slate-900 dark:text-white">Relatório do evento</h3>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
                  Selecione exatamente as secções que pretende descarregar. O ficheiro conterá apenas essas secções.
                </p>
                {sections.length === 0 ? (
                  <p className="mt-2 text-[10px] font-bold text-amber-700 dark:text-amber-300">Selecione pelo menos uma secção para exportar.</p>
                ) : null}
                <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
                  {EXPORT_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] px-2.5 py-2 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={sections.includes(option.key)}
                        onChange={(event) =>
                          setSections((current) =>
                            event.target.checked ? [...current, option.key] : current.filter((key) => key !== option.key),
                          )
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void handleExport('pdf')} loading={exporting === 'pdf'} disabled={sections.length === 0}>
                    <FileText className="mr-1 h-3.5 w-3.5" /> Descarregar PDF
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleExport('xlsx')} loading={exporting === 'xlsx'} disabled={sections.length === 0}>
                    <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Descarregar Excel
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleExport('csv')} loading={exporting === 'csv'} disabled={sections.length === 0}>
                    <Download className="mr-1 h-3.5 w-3.5" /> Descarregar CSV
                  </Button>
                </div>
              </Card>
              <p className="text-[10px] text-slate-500">
                A exportação respeita o âmbito da conta e os filtros ativos nos submódulos de bilhetes, compradores e validações.
                Uma empresa só consegue gerar relatórios dos seus próprios eventos.
              </p>
            </div>
          ) : null}

          {data && tab === 'history' ? (
            <div className="space-y-3">
              {data.history.length === 0 ? (
                <EmptyState
                  title="Sem alterações registadas"
                  description="As alterações ao evento passam a aparecer aqui a partir da próxima gravação."
                  icon={<History className="h-6 w-6" />}
                />
              ) : (
                <ul className="divide-y divide-[var(--color-border-subtle)] rounded-2xl border border-[var(--color-border-subtle)] dark:divide-slate-800 dark:border-slate-700">
                  {data.history.map((entry, index) => (
                    <li key={`${entry.action}-${entry.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
                      <span className="min-w-0">
                        <strong className="text-slate-800 dark:text-slate-100">{entry.action}</strong>
                        {entry.reason ? <span className="text-slate-500"> · {entry.reason}</span> : null}
                        <span className="block text-[10px] text-slate-500">{entry.actor || 'Sistema'}</span>
                      </span>
                      <span className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span className={`rounded-full border px-2 py-0.5 font-black ${statusTone(entry.result === 'success' ? 'valid' : 'cancelled')}`}>{entry.result}</span>
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {data && tab === 'settings' ? (
            <div className="space-y-3">
              <Card className="border-[var(--color-border-subtle)] p-4 dark:border-slate-700">
                <h3 className="text-[12px] font-black text-slate-900 dark:text-white">Configuração do evento</h3>
                <dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
                  {[
                    ['Referência', data.event.id],
                    ['Título', data.event.title],
                    ['Organizador', data.event.organizerName],
                    ['Empresa', data.event.companyName],
                    ['Estado', EVENT_STATUS_LABELS[data.event.status] || data.event.status],
                    ['Data', `${data.event.date || '—'} ${data.event.time || ''}`],
                    ['Local', `${data.event.location || '—'}${data.event.neighborhood ? ` · ${data.event.neighborhood}` : ''}`],
                    ['Categoria', data.event.category || '—'],
                    ['Código de portaria', data.event.scannerDoorCode || '—'],
                    ['Criado em', formatDateTime(data.event.createdAt)],
                    ['Atualizado em', formatDateTime(data.event.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</dt>
                      <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-2.5 text-[10px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-800">
                  A edição de datas, local e bilhetes continua no módulo de eventos. Alterações aí refletem-se imediatamente neste centro de controlo.
                </p>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
