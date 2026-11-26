import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import type {
  Business,
  BusinessPost,
  BusinessTeamAuditEntry,
  EventItem,
  Language,
  MarketingCampaign,
  PaymentStatus,
  PaymentTransaction,
  PurchaseOrder,
  UserProfile,
} from '../../types';
import { SubmoduleNavbar } from '../navigation/SubmoduleNavbar';
import { AdminPagination } from '../admin/AdminPagination';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { usePostEngagementContext } from '../PostEngagementProvider';
import { downloadCSV, downloadExcel, downloadPDFReport } from '../../utils/exportHelpers';
import { recordExportHistory, type ExportHistoryFormat } from '../../utils/exportHistory';
import { formatCurrencyXOF, getTranslation } from '../../utils/i18n';

const CONFIRMED_PAYMENT_STATUSES = new Set<PaymentStatus>(['confirmed_api', 'confirmed_manual', 'reconciled']);
const PENDING_PAYMENT_STATUSES = new Set<PaymentStatus>(['pending_provider', 'pending_manual_confirmation']);

/**
 * Relatórios de desempenho da empresa.
 *
 * Todos os indicadores são calculados a partir de dados reais já carregados
 * pelo painel (pedidos, eventos, publicações, campanhas, auditoria da equipa) e
 * das APIs autenticadas de bilhetes vendidos e transacções da empresa. Cada
 * bloco identifica a origem do indicador e o período aplicado.
 */

type ReportCategory = 'comercial' | 'financeiro' | 'clientes' | 'eventos' | 'marketing' | 'operacoes' | 'equipa';
type PeriodPreset = '7d' | '30d' | '90d' | 'year' | 'all' | 'custom';

interface SoldTicketRow {
  id: string;
  ticketCode: string;
  status: string;
  priceXOF: number;
  buyerName: string | null;
  holderName: string | null;
  purchasedAt: string | null;
  eventId: string;
  eventTitle: string | null;
  refundStatus: string | null;
}

interface ClientReportsHubProps {
  business: Business;
  currentUser: UserProfile;
  currentLang?: Language;
  purchaseOrders: PurchaseOrder[];
  events?: EventItem[];
  posts?: BusinessPost[];
  marketingCampaigns?: MarketingCampaign[];
  teamAudit?: BusinessTeamAuditEntry[];
  /** Exportação de dados integrada no módulo Relatórios (sem módulo autónomo). */
  exportContent?: React.ReactNode;
}

interface Indicator {
  key: string;
  label: string;
  value: string;
  numeric: number;
  hint: string;
  previous?: number;
  money?: boolean;
}

const CATEGORY_TABS: ReportCategory[] = ['comercial', 'financeiro', 'clientes', 'eventos', 'marketing', 'operacoes', 'equipa'];

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  comercial: 'Comercial',
  financeiro: 'Financeiro',
  clientes: 'Clientes',
  eventos: 'Eventos e bilhetes',
  marketing: 'Marketing',
  operacoes: 'Operações',
  equipa: 'Equipa',
};

const CATEGORY_SOURCES: Record<ReportCategory, string> = {
  comercial: 'Encomendas registadas no painel (/api/purchase-orders) e transacções confirmadas.',
  financeiro: 'Transacções de pagamento da empresa (/api/payments/transactions).',
  clientes: 'Compradores das encomendas e bilhetes desta empresa.',
  eventos: 'Eventos da empresa e bilhetes emitidos (/api/tickets/sold).',
  marketing: 'Campanhas da empresa e interacções reais das publicações.',
  operacoes: 'Estados das encomendas e levantamentos registados.',
  equipa: 'Registo de auditoria das acções dos membros da equipa.',
};

function formatDate(value: string | null | undefined, lang: Language): string {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleDateString(lang === 'pt' ? 'pt-PT' : lang, { day: '2-digit', month: 'short', year: 'numeric' });
}

function periodBounds(preset: PeriodPreset, from: string, to: string): { start: number; end: number; label: string } {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const days = (count: number) => endOfToday - count * 24 * 60 * 60 * 1000;
  switch (preset) {
    case '7d':
      return { start: days(6), end: endOfToday, label: 'Últimos 7 dias' };
    case '30d':
      return { start: days(29), end: endOfToday, label: 'Últimos 30 dias' };
    case '90d':
      return { start: days(89), end: endOfToday, label: 'Últimos 90 dias' };
    case 'year':
      return { start: new Date(now.getFullYear(), 0, 1).getTime(), end: endOfToday, label: `Ano ${now.getFullYear()}` };
    case 'custom': {
      const start = from ? new Date(`${from}T00:00:00`).getTime() : days(29);
      const end = to ? new Date(`${to}T23:59:59`).getTime() : endOfToday;
      return { start: Number.isFinite(start) ? start : days(29), end: Number.isFinite(end) ? end : endOfToday, label: `${from || '—'} → ${to || 'hoje'}` };
    }
    default:
      return { start: 0, end: endOfToday, label: 'Todo o histórico' };
  }
}

function inRange(value: string | null | undefined, start: number, end: number): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  return time >= start && time <= end;
}

function delta(current: number, previous: number): number | undefined {
  if (!Number.isFinite(previous) || previous === 0) return undefined;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export const ClientReportsHub: React.FC<ClientReportsHubProps> = ({
  business,
  currentUser,
  currentLang = 'pt' as Language,
  purchaseOrders,
  events = [],
  posts = [],
  marketingCampaigns = [],
  teamAudit = [],
  exportContent,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const engagement = usePostEngagementContext();
  const [category, setCategory] = useState<ReportCategory>('comercial');
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const periodLabel = (value: PeriodPreset) => ({
    '7d': t('business.UltimosDias'),
    '30d': t('business.UltimosDias2'),
    '90d': t('business.UltimosDias90'),
    year: t('business.AnoCorrente'),
    all: t('business.TodoHistorico'),
    custom: t('business.IntervaloPersonalizado'),
  } satisfies Record<PeriodPreset, string>)[value];
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [compare, setCompare] = useState(false);
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<ExportHistoryFormat>('csv');
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  /**
   * Estado dos bilhetes vindos de `/api/tickets/sold`. A API limita a resposta
   * aos 500 registos mais recentes e pode falhar; em qualquer dos casos os
   * relatórios que dependem dela (Clientes, Eventos) ficam incompletos e não
   * podem ser exportados como se estivessem completos.
   */
  const [ticketsIssue, setTicketsIssue] = useState<{ kind: 'truncated' | 'error'; limit: number } | null>(null);

  const [tickets, setTickets] = useState<SoldTicketRow[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadServerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ticketsResponse, transactionsResponse] = await Promise.all([
        fetch('/api/tickets/sold', { credentials: 'include', cache: 'no-store' }),
        fetch(`/api/payments/transactions?businessId=${encodeURIComponent(business.id)}`, { credentials: 'include', cache: 'no-store' }),
      ]);
      if (ticketsResponse.status === 401 || transactionsResponse.status === 401) {
        setTickets([]);
        setTicketsIssue({ kind: 'error', limit: 500 });
        setError('A sessão expirou. Inicie sessão novamente.');
        return;
      }
      if (ticketsResponse.ok) {
        const payload = await ticketsResponse.json() as { tickets?: SoldTicketRow[]; truncated?: boolean; limit?: number };
        setTickets(payload.tickets || []);
        setTicketsIssue(payload.truncated
          ? { kind: 'truncated', limit: typeof payload.limit === 'number' && payload.limit > 0 ? payload.limit : 500 }
          : null);
      } else {
        setTickets([]);
        setTicketsIssue({ kind: 'error', limit: 500 });
      }
      if (transactionsResponse.ok) {
        const payload = await transactionsResponse.json() as PaymentTransaction[];
        setTransactions(Array.isArray(payload) ? payload.filter((item) => !item.businessId || item.businessId === business.id) : []);
      } else {
        setTransactions([]);
      }
      setLastUpdated(new Date().toISOString());
    } catch {
      setTickets([]);
      setTicketsIssue({ kind: 'error', limit: 500 });
      setError('Não foi possível actualizar os dados do servidor.');
    } finally {
      setLoading(false);
    }
  }, [business.id]);

  useEffect(() => {
    void loadServerData();
  }, [loadServerData]);

  const bounds = useMemo(() => periodBounds(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const previousBounds = useMemo(() => {
    const span = Math.max(bounds.end - bounds.start, 24 * 60 * 60 * 1000);
    return { start: bounds.start - span, end: bounds.start - 1 };
  }, [bounds]);

  const businessOrders = useMemo(
    () => purchaseOrders.filter((order) => order.businessId === business.id),
    [purchaseOrders, business.id],
  );
  const businessEvents = useMemo(
    () => events.filter((event) => event.businessId === business.id || event.organizerName === business.name),
    [events, business.id, business.name],
  );

  const pickOrders = (start: number, end: number) => businessOrders.filter((order) => inRange(order.purchasedAt, start, end));
  const pickTickets = (start: number, end: number) => tickets.filter((ticket) => inRange(ticket.purchasedAt, start, end));
  const pickTransactions = (start: number, end: number) => transactions.filter((item) => inRange(item.createdAt, start, end));
  const pickAudit = (start: number, end: number) => teamAudit.filter((entry) => inRange(entry.createdAt, start, end));

  const currentOrders = useMemo(() => pickOrders(bounds.start, bounds.end), [bounds, businessOrders]);
  const previousOrders = useMemo(() => pickOrders(previousBounds.start, previousBounds.end), [previousBounds, businessOrders]);
  const currentTickets = useMemo(() => pickTickets(bounds.start, bounds.end), [bounds, tickets]);
  const previousTickets = useMemo(() => pickTickets(previousBounds.start, previousBounds.end), [previousBounds, tickets]);
  const currentTransactions = useMemo(() => pickTransactions(bounds.start, bounds.end), [bounds, transactions]);
  const previousTransactions = useMemo(() => pickTransactions(previousBounds.start, previousBounds.end), [previousBounds, transactions]);
  const currentAudit = useMemo(() => pickAudit(bounds.start, bounds.end), [bounds, teamAudit]);

  const commercial = useMemo(() => {
    const ordersWithError = 0;
    const build = (orders: PurchaseOrder[]) => {
      const completed = orders.filter((order) => order.status === 'valid' || order.status === 'redeemed');
      const pending = orders.filter((order) => order.status === 'pending');
      const cancelled = orders.filter((order) => order.status === 'cancelled');
      const revenue = completed.reduce((sum, order) => sum + order.totalPriceXOF, 0);
      return { total: orders.length, completed: completed.length, pending: pending.length, cancelled: cancelled.length, revenue, orders, ordersWithError };
    };
    const now = build(currentOrders);
    const before = build(previousOrders);
    return { now, before };
  }, [currentOrders, previousOrders]);

  const financial = useMemo(() => {
    const summarize = (items: PaymentTransaction[]) => {
      const confirmed = items.filter((item) => CONFIRMED_PAYMENT_STATUSES.has(item.status));
      const pending = items.filter((item) => PENDING_PAYMENT_STATUSES.has(item.status));
      const failed = items.filter((item) => item.status === 'failed');
      return {
        confirmed: confirmed.length,
        pending: pending.length,
        failed: failed.length,
        revenue: confirmed.reduce((sum, item) => sum + item.amountXOF, 0),
        pendingValue: pending.reduce((sum, item) => sum + item.amountXOF, 0),
        items,
      };
    };
    return { now: summarize(currentTransactions), before: summarize(previousTransactions) };
  }, [currentTransactions, previousTransactions]);

  const customers = useMemo(() => {
    const keyOf = (name: string, phone?: string) => `${name || '—'}|${phone || ''}`;
    const map = new Map<string, { name: string; phone: string; orders: number; tickets: number; revenue: number; lastActivity: string | null }>();
    currentOrders.forEach((order) => {
      const key = keyOf(order.customerName, order.customerPhone);
      const entry = map.get(key) || { name: order.customerName || '—', phone: order.customerPhone || '—', orders: 0, tickets: 0, revenue: 0, lastActivity: null };
      entry.orders += 1;
      entry.revenue += order.totalPriceXOF;
      if (!entry.lastActivity || Date.parse(order.purchasedAt) > Date.parse(entry.lastActivity)) entry.lastActivity = order.purchasedAt;
      map.set(key, entry);
    });
    currentTickets.forEach((ticket) => {
      const key = keyOf(ticket.buyerName || ticket.holderName || '—', undefined);
      const entry = map.get(key) || { name: ticket.buyerName || ticket.holderName || '—', phone: '—', orders: 0, tickets: 0, revenue: 0, lastActivity: null };
      entry.tickets += 1;
      if (!entry.lastActivity || (ticket.purchasedAt && Date.parse(ticket.purchasedAt) > Date.parse(entry.lastActivity))) entry.lastActivity = ticket.purchasedAt;
      map.set(key, entry);
    });
    const all = Array.from(map.values()).sort((left, right) => right.revenue - left.revenue);
    const previousNames = new Set(previousOrders.map((order) => keyOf(order.customerName, order.customerPhone)));
    const returning = all.filter((entry) => entry.orders + entry.tickets > 1);
    const newCustomers = all.filter((entry) => !previousNames.has(keyOf(entry.name, entry.phone === '—' ? undefined : entry.phone)));
    return { all, returning, newCustomers };
  }, [currentOrders, currentTickets, previousOrders]);

  const ticketReport = useMemo(() => {
    const summarize = (items: SoldTicketRow[]) => {
      const used = items.filter((ticket) => ticket.status === 'used');
      const valid = items.filter((ticket) => ticket.status === 'valid');
      const cancelled = items.filter((ticket) => ticket.status === 'cancelled');
      const revenue = [...used, ...valid].reduce((sum, ticket) => sum + ticket.priceXOF, 0);
      return { total: items.length, used: used.length, valid: valid.length, cancelled: cancelled.length, revenue, items };
    };
    const now = summarize(currentTickets);
    const before = summarize(previousTickets);
    const revenueByEvent = new Map<string, { eventId: string; title: string; tickets: number; revenue: number; used: number }>();
    currentTickets.forEach((ticket) => {
      const entry = revenueByEvent.get(ticket.eventId) || { eventId: ticket.eventId, title: ticket.eventTitle || ticket.eventId, tickets: 0, revenue: 0, used: 0 };
      entry.tickets += 1;
      if (ticket.status === 'valid' || ticket.status === 'used') entry.revenue += ticket.priceXOF;
      if (ticket.status === 'used') entry.used += 1;
      revenueByEvent.set(ticket.eventId, entry);
    });
    const eventsInRange = businessEvents.filter((event) => {
      const time = Date.parse(`${event.date}T${event.time || '00:00'}`);
      return Number.isFinite(time) ? time >= bounds.start && time <= bounds.end : false;
    });
    return {
      now,
      before,
      byEvent: Array.from(revenueByEvent.values()).sort((left, right) => right.revenue - left.revenue),
      published: businessEvents.filter((event) => event.status === 'active').length,
      realised: businessEvents.filter((event) => event.status === 'ended').length,
      scheduledInRange: eventsInRange.length,
    };
  }, [currentTickets, previousTickets, businessEvents, bounds]);

  const marketing = useMemo(() => {
    const campaigns = marketingCampaigns.filter((campaign) => {
      const time = Date.parse(campaign.startsAt || campaign.createdAt || '');
      if (preset === 'all' || !Number.isFinite(time)) return preset === 'all' ? true : false;
      return time >= bounds.start && time <= bounds.end;
    });
    const businessPosts = posts.filter((post) => post.businessId === business.id);
    const postsInRange = businessPosts.filter((post) => inRange(post.createdAt, bounds.start, bounds.end));
    let likes = 0;
    let shares = 0;
    let comments = 0;
    businessPosts.forEach((post) => {
      const item = engagement?.engagements[post.id];
      if (!item) return;
      likes += item.likes;
      shares += item.shares;
      comments += item.comments.length;
    });
    return {
      campaigns,
      activeCampaigns: campaigns.filter((campaign) => campaign.status === 'active').length,
      posts: businessPosts.length,
      postsInRange: postsInRange.length,
      likes,
      shares,
      comments,
      interactions: likes + shares + comments,
    };
  }, [marketingCampaigns, posts, business.id, engagement, bounds, preset]);

  const operations = useMemo(() => {
    const summarize = (orders: PurchaseOrder[]) => ({
      preparing: orders.filter((order) => order.status === 'pending').length,
      ready: orders.filter((order) => order.status === 'valid').length,
      delivered: orders.filter((order) => order.status === 'redeemed').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
      items: orders,
    });
    return { now: summarize(currentOrders), before: summarize(previousOrders) };
  }, [currentOrders, previousOrders]);

  const team = useMemo(() => {
    const previous = pickAudit(previousBounds.start, previousBounds.end);
    const byMember = new Map<string, { member: string; actions: number; last: string | null }>();
    currentAudit.forEach((entry) => {
      const record = byMember.get(entry.memberName) || { member: entry.memberName, actions: 0, last: null };
      record.actions += 1;
      if (!record.last || Date.parse(entry.createdAt) > Date.parse(record.last)) record.last = entry.createdAt;
      byMember.set(entry.memberName, record);
    });
    return { entries: currentAudit, previousCount: previous.length, byMember: Array.from(byMember.values()).sort((left, right) => right.actions - left.actions) };
  }, [currentAudit, previousBounds, teamAudit]);

  const indicatorSets: Record<ReportCategory, Indicator[]> = useMemo(() => ({
    comercial: [
      { key: 'commercial-revenue', label: 'Total de vendas', value: formatCurrencyXOF(commercial.now.revenue, currentLang), numeric: commercial.now.revenue, hint: 'Encomendas concluídas no período', previous: commercial.before.revenue, money: true },
      { key: 'commercial-orders', label: 'Pedidos', value: String(commercial.now.total), numeric: commercial.now.total, hint: 'Todas as encomendas registadas', previous: commercial.before.total },
      { key: 'commercial-completed', label: 'Pedidos concluídos', value: String(commercial.now.completed), numeric: commercial.now.completed, hint: 'Estado validado ou levantado', previous: commercial.before.completed },
      { key: 'commercial-pending', label: 'Pedidos pendentes', value: String(commercial.now.pending), numeric: commercial.now.pending, hint: 'Aguardam pagamento ou preparação', previous: commercial.before.pending },
      { key: 'commercial-average', label: 'Valor médio por pedido', value: formatCurrencyXOF(commercial.now.completed ? Math.round(commercial.now.revenue / commercial.now.completed) : 0, currentLang), numeric: commercial.now.completed ? Math.round(commercial.now.revenue / commercial.now.completed) : 0, hint: 'Receita ÷ pedidos concluídos', previous: commercial.before.completed ? Math.round(commercial.before.revenue / commercial.before.completed) : 0, money: true },
    ],
    financeiro: [
      { key: 'financial-revenue', label: 'Receitas confirmadas', value: formatCurrencyXOF(financial.now.revenue, currentLang), numeric: financial.now.revenue, hint: 'Transacções com estado concluído', previous: financial.before.revenue, money: true },
      { key: 'financial-confirmed', label: 'Pagamentos confirmados', value: String(financial.now.confirmed), numeric: financial.now.confirmed, hint: 'Transacções concluídas', previous: financial.before.confirmed },
      { key: 'financial-pending', label: 'Pagamentos pendentes', value: String(financial.now.pending), numeric: financial.now.pending, hint: 'Transacções em processamento', previous: financial.before.pending },
      { key: 'financial-pending-value', label: 'Valor pendente', value: formatCurrencyXOF(financial.now.pendingValue, currentLang), numeric: financial.now.pendingValue, hint: 'Soma das transacções pendentes', previous: financial.before.pendingValue, money: true },
    ],
    clientes: [
      { key: 'customers-total', label: 'Clientes no período', value: String(customers.all.length), numeric: customers.all.length, hint: 'Compradores distintos com compras no período' },
      { key: 'customers-new', label: 'Novos clientes', value: String(customers.newCustomers.length), numeric: customers.newCustomers.length, hint: 'Sem compras no período anterior' },
      { key: 'customers-returning', label: 'Clientes recorrentes', value: String(customers.returning.length), numeric: customers.returning.length, hint: 'Mais de uma compra no período' },
      { key: 'customers-frequency', label: 'Compras por cliente', value: customers.all.length ? (customers.all.reduce((sum, item) => sum + item.orders + item.tickets, 0) / customers.all.length).toFixed(1) : '0', numeric: customers.all.length, hint: 'Encomendas e bilhetes por cliente' },
    ],
    eventos: [
      { key: 'events-published', label: 'Eventos publicados', value: String(ticketReport.published), numeric: ticketReport.published, hint: 'Eventos activos da empresa' },
      { key: 'events-realised', label: 'Eventos realizados', value: String(ticketReport.realised), numeric: ticketReport.realised, hint: 'Eventos com estado terminado' },
      { key: 'tickets-sold', label: 'Bilhetes vendidos', value: String(ticketReport.now.total), numeric: ticketReport.now.total, hint: 'Bilhetes emitidos no período', previous: ticketReport.before.total },
      { key: 'tickets-used', label: 'Bilhetes utilizados', value: String(ticketReport.now.used), numeric: ticketReport.now.used, hint: 'Entradas validadas no período', previous: ticketReport.before.used },
      { key: 'tickets-unused', label: 'Bilhetes não utilizados', value: String(ticketReport.now.valid), numeric: ticketReport.now.valid, hint: 'Válidos mas ainda não validados', previous: ticketReport.before.valid },
      { key: 'tickets-revenue', label: 'Receita de bilhetes', value: formatCurrencyXOF(ticketReport.now.revenue, currentLang), numeric: ticketReport.now.revenue, hint: 'Bilhetes válidos e utilizados', previous: ticketReport.before.revenue, money: true },
    ],
    marketing: [
      { key: 'marketing-campaigns', label: 'Campanhas no período', value: String(marketing.campaigns.length), numeric: marketing.campaigns.length, hint: 'Campanhas com início no período' },
      { key: 'marketing-active', label: 'Campanhas activas', value: String(marketing.activeCampaigns), numeric: marketing.activeCampaigns, hint: 'Estado activo' },
      { key: 'marketing-posts', label: 'Publicações', value: String(marketing.posts), numeric: marketing.posts, hint: `${marketing.postsInRange} publicadas no período` },
      { key: 'marketing-interactions', label: 'Interacções', value: String(marketing.interactions), numeric: marketing.interactions, hint: 'Curtidas, comentários e partilhas reais' },
    ],
    operacoes: [
      { key: 'ops-preparing', label: 'Em preparação', value: String(operations.now.preparing), numeric: operations.now.preparing, hint: 'Pedidos pendentes', previous: operations.before.preparing },
      { key: 'ops-ready', label: 'Prontos para levantamento', value: String(operations.now.ready), numeric: operations.now.ready, hint: 'Pedidos validados', previous: operations.before.ready },
      { key: 'ops-delivered', label: 'Entregues', value: String(operations.now.delivered), numeric: operations.now.delivered, hint: 'Pedidos levantados', previous: operations.before.delivered },
      { key: 'ops-cancelled', label: 'Cancelados', value: String(operations.now.cancelled), numeric: operations.now.cancelled, hint: 'Pedidos cancelados', previous: operations.before.cancelled },
    ],
    equipa: [
      { key: 'team-actions', label: 'Operações registadas', value: String(team.entries.length), numeric: team.entries.length, hint: 'Registos de auditoria no período', previous: team.previousCount },
      { key: 'team-members', label: 'Membros activos', value: String(team.byMember.length), numeric: team.byMember.length, hint: 'Membros com operações no período' },
      { key: 'team-top', label: 'Membro mais activo', value: team.byMember[0]?.member || '—', numeric: team.byMember[0]?.actions || 0, hint: 'Maior número de operações' },
    ],
  }), [commercial, financial, customers, ticketReport, marketing, operations, team, currentLang]);

  const indicators = indicatorSets[category];

  interface ReportRow { id: string; cells: Array<string | number> }
  const table: { title: string; headers: string[]; rows: ReportRow[] } = useMemo(() => {
    switch (category) {
      case 'comercial':
      case 'operacoes':
        return {
          title: 'Encomendas do período',
          headers: ['Código', 'Cliente', 'Tipo', 'Estado', 'Total (XOF)', 'Data'],
          rows: (category === 'comercial' ? commercial.now.orders : operations.now.items).map((order) => ({
            id: order.id,
            cells: [order.orderCode, order.customerName, order.itemType, order.status, order.totalPriceXOF, formatDate(order.purchasedAt, currentLang)],
          })),
        };
      case 'financeiro':
        return {
          title: 'Transacções do período',
          headers: ['Referência', 'Descrição', 'Estado', 'Valor (XOF)', 'Data'],
          rows: financial.now.items.map((item) => ({
            id: item.id,
            cells: [item.providerRef || item.id, item.useCaseLabel, item.status, item.amountXOF, formatDate(item.createdAt, currentLang)],
          })),
        };
      case 'clientes':
        return {
          title: 'Clientes com compras no período',
          headers: ['Cliente', 'Telefone', 'Encomendas', 'Bilhetes', 'Receita (XOF)', 'Última actividade'],
          rows: customers.all.map((customer) => ({
            id: `${customer.name}-${customer.phone}`,
            cells: [customer.name, customer.phone, customer.orders, customer.tickets, customer.revenue, formatDate(customer.lastActivity, currentLang)],
          })),
        };
      case 'eventos':
        return {
          title: 'Receita por evento no período',
          headers: ['Evento', 'Bilhetes', 'Utilizados', 'Receita (XOF)'],
          rows: ticketReport.byEvent.map((event) => ({
            id: event.eventId,
            cells: [event.title, event.tickets, event.used, event.revenue],
          })),
        };
      case 'marketing':
        return {
          title: 'Campanhas no período',
          headers: ['Campanha', 'Plataforma', 'Estado', 'Início', 'Fim'],
          rows: marketing.campaigns.map((campaign) => ({
            id: campaign.id,
            cells: [campaign.name, campaign.channels.join(', ') || '—', campaign.status, formatDate(campaign.startsAt, currentLang), formatDate(campaign.endsAt, currentLang)],
          })),
        };
      default:
        return {
          title: 'Actividade da equipa no período',
          headers: ['Membro', 'Operações', 'Última operação'],
          rows: team.byMember.map((member) => ({
            id: member.member,
            cells: [member.member, member.actions, formatDate(member.last, currentLang)],
          })),
        };
    }
  }, [category, commercial, operations, financial, customers, ticketReport, marketing, team, currentLang]);

  /** Categorias cujos números dependem dos bilhetes de `/api/tickets/sold`. */
  const ticketsDependent = category === 'clientes' || category === 'eventos';
  const exportBlocked = ticketsDependent && ticketsIssue !== null;
  const ticketsIssueMessage = ticketsIssue
    ? ticketsIssue.kind === 'truncated'
      ? `A API de bilhetes devolve apenas os ${ticketsIssue.limit} registos mais recentes. Existem bilhetes fora desta vista: os totais de Clientes e Eventos estão incompletos e a exportação destas categorias está bloqueada.`
      : 'Não foi possível carregar os bilhetes vendidos. Os totais de Clientes e Eventos estão incompletos e a exportação destas categorias está bloqueada até os dados voltarem a carregar.'
    : null;

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return table.rows;
    return table.rows.filter((row) => row.cells.some((cell) => String(cell).toLowerCase().includes(needle)));
  }, [table.rows, query]);

  const pagination = usePaginatedList(filteredRows, {
    initialPageSize: 20,
    pageSizeOptions: [20, 50],
    persist: false,
    resetKey: `${category}|${preset}|${customFrom}|${customTo}|${query}`,
  });

  const exportReport = () => {
    setExportError(null);
    if (exportBlocked) {
      setExportError(ticketsIssue?.kind === 'truncated'
        ? `Exportação bloqueada: a lista de bilhetes está limitada aos ${ticketsIssue.limit} registos mais recentes. Um ficheiro agora ficaria incompleto.`
        : 'Exportação bloqueada: não foi possível obter os bilhetes vendidos. Um ficheiro agora ficaria incompleto.');
      return;
    }
    const slug = `${business.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${category}_${new Date().toISOString().slice(0, 10)}`;
    const rows = filteredRows.map((row) => row.cells);
    const title = `Relatório ${CATEGORY_LABELS[category]} — ${business.name}`;
    const summary = `${bounds.label} · origem: ${CATEGORY_SOURCES[category]}`;
    if (format === 'pdf') {
      downloadPDFReport(title, summary, indicators.map((indicator) => ({ label: indicator.label, value: indicator.value })), table.headers, rows);
    } else if (format === 'xlsx') {
      downloadExcel(`${slug}.xlsx`, CATEGORY_LABELS[category], table.headers, rows);
    } else {
      downloadCSV(`${slug}.csv`, table.headers, rows);
    }
    recordExportHistory(business.id, {
      fileName: `${slug}.${format}`,
      category: `Relatórios · ${CATEGORY_LABELS[category]}`,
      format,
      records: rows.length,
      actor: currentUser.name || currentUser.email,
      status: 'completed',
      detail: `${t('business.periodoRelatorio')}: ${periodLabel(preset)}`,
    });
    setExportNotice(`${rows.length} registo(s) exportados em ${format.toUpperCase()}.`);
    window.setTimeout(() => setExportNotice(null), 6000);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <BarChart3 className="h-3.5 w-3.5" /> Relatórios
            </div>
            <h2 className="mt-2 text-lg font-black text-[var(--color-text-strong)] dark:text-white">Desempenho de {business.name}</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--color-text-muted)] dark:text-slate-300">
              Indicadores calculados a partir dos dados reais da empresa. Cada categoria identifica a origem dos números e o período aplicado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--color-border-subtle)] bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {periodLabel(preset)}
            </span>
            <button type="button" onClick={() => void loadServerData()} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-1.5 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Período
            <select aria-label="Período" value={preset} onChange={(event) => setPreset(event.target.value as PeriodPreset)} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 py-2 text-xs font-black text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              <option value="7d">{t('business.UltimosDias')}</option>
              <option value="30d">{t('business.UltimosDias2')}</option>
              <option value="90d">{t('business.UltimosDias90')}</option>
              <option value="year">{t('business.AnoCorrente')}</option>
              <option value="all">{t('business.TodoHistorico')}</option>
              <option value="custom">{t('business.IntervaloPersonalizado')}</option>
            </select>
          </label>
          {preset === 'custom' && (
            <>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">De
                <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Até
                <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-border-default)] bg-white px-2.5 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </label>
            </>
          )}
          <label className="flex items-end gap-2 pb-1 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={compare} onChange={(event) => setCompare(event.target.checked)} className="h-4 w-4 rounded border-[var(--color-border-default)]" />
            Comparar com período anterior
          </label>
        </div>
        {lastUpdated && <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-500">Dados actualizados em {new Date(lastUpdated).toLocaleTimeString(currentLang === 'pt' ? 'pt-PT' : currentLang)}.</p>}
        {error && <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
        {ticketsIssueMessage && (
          <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{ticketsIssueMessage}</span>
          </p>
        )}
      </section>

      <SubmoduleNavbar
        currentTab={category}
        onTabChange={(tab) => setCategory(tab as ReportCategory)}
        tabs={CATEGORY_TABS as unknown as string[]}
        tabLabels={CATEGORY_LABELS}
        wrap
        ariaLabel="Categorias de relatórios"
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {indicators.map((indicator) => {
          const change = compare && indicator.previous !== undefined ? delta(indicator.numeric, indicator.previous) : undefined;
          return (
            <section key={indicator.key} className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">{indicator.label}</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{indicator.value}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">{indicator.hint}</span>
                {change !== undefined && (
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black ${change >= 0 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200'}`}>
                    {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(change)}%
                  </span>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {loading && <p className="text-xs font-bold text-slate-500 dark:text-slate-400">A carregar dados do servidor…</p>}

      <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{table.title}</h3>
            <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Origem: {CATEGORY_SOURCES[category]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar na tabela" className="min-h-9 w-48 rounded-xl border border-[var(--color-border-default)] bg-white pl-7 pr-2 text-[11px] font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
            </label>
            <select value={format} onChange={(event) => setFormat(event.target.value as ExportHistoryFormat)} aria-label="Formato de exportação" className="min-h-9 rounded-xl border border-[var(--color-border-default)] bg-white px-2 text-[11px] font-black text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="pdf">PDF</option>
            </select>
            <button type="button" onClick={exportReport} disabled={filteredRows.length === 0} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">
              <Download className="h-3.5 w-3.5" /> Exportar relatório
            </button>
            {exportContent && (
              <button type="button" onClick={() => setExportOpen((open) => !open)} aria-expanded={exportOpen} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border-default)] px-3 py-1.5 text-[10px] font-black text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <FileSpreadsheet className="h-3.5 w-3.5" /> {exportOpen ? 'Ocultar exportação de dados' : 'Exportação de dados'}
              </button>
            )}
          </div>
        </div>

        {exportNotice && <p role="status" className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{exportNotice}</p>}
        {exportError && <p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{exportError}</p>}
        {exportBlocked && !exportError && (
          <p className="mt-2 text-[10px] font-bold text-amber-800 dark:text-amber-300">A exportação desta categoria está bloqueada enquanto os bilhetes estiverem incompletos.</p>
        )}

        {filteredRows.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-[var(--color-border-default)] bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-900">
            <FileText className="mx-auto h-6 w-6 text-slate-500" />
            <p className="mt-2 text-xs font-black text-slate-700 dark:text-slate-200">Sem registos para os filtros actuais</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Alargue o período ou limpe a pesquisa para ver os dados desta categoria.</p>
          </div>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-[11px]">
                <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>{table.headers.map((header) => <th key={header} className="p-2 whitespace-nowrap">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {pagination.pageItems.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 dark:border-slate-700">
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${index}`} className={`p-2 ${index === 0 ? 'font-black text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                          {typeof cell === 'number' && table.headers[index]?.includes('(XOF)') ? cell.toLocaleString('pt-PT') : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination
              className="mt-3"
              currentLang={currentLang}
              currentPage={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          </>
        )}
      </section>

      {category === 'equipa' && team.entries.length > 0 && (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3.5 shadow-[var(--shadow-xs)] dark:border-slate-700 dark:bg-slate-800">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white"><Calendar className="h-4 w-4 text-emerald-600" /> Últimos registos</h3>
          <ul className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            {team.entries.slice(0, 8).map((entry) => (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 py-1 first:border-t-0 dark:border-slate-700">
                <span className="font-bold text-slate-800 dark:text-slate-100">{entry.memberName} · {entry.action}</span>
                <span>{formatDate(entry.createdAt, currentLang)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {category === 'marketing' && (
        <p className="text-[10px] text-slate-500 dark:text-slate-500">
          As interacções vêm do estado partilhado das publicações ({marketing.likes} curtidas, {marketing.comments} comentários, {marketing.shares} partilhas). O alcance não é apresentado por não existir medição de impressões no sistema.
        </p>
      )}
      {category === 'financeiro' && financial.now.pending > 0 && (
        <p className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> {financial.now.pending} transacção(ões) pendente(s) — valores não contam como receita confirmada.</p>
      )}
      {category === 'comercial' && (
        <p className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-500"><TrendingUp className="h-3.5 w-3.5" /> {t('business.periodoRelatorio')}: {periodLabel(preset)}</p>
      )}

      {exportContent && exportOpen && (
        <section className="space-y-2 border-t border-[var(--color-border-subtle)] pt-4 dark:border-slate-700" aria-label="Exportação de dados da empresa">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Exportação de dados</h3>
          <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            Escolha os conjuntos de dados, o período e o formato. Esta área faz parte de Relatórios e respeita os mesmos dados da empresa.
          </p>
          {exportContent}
        </section>
      )}
    </div>
  );
};

export default ClientReportsHub;
