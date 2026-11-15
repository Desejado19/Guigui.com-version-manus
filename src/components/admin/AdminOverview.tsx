import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  FileText,
  Ticket,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, Panel, PanelHeader, StatCard, Text, type StatTone } from '../../ui';
import { Business, EventItem, Language, SupportRequest } from '../../types';
import { getTranslation } from '../../utils/i18n';

export interface AdminOverviewProps {
  businesses: Business[];
  events?: EventItem[];
  currentLang: Language;
  supportRequests?: SupportRequest[];
  pendingModerationCount?: number;
  onNavigateTab?: (tab: string) => void;
  /** Navegação com submódulo (ex.: empresas filtradas por «Aprovadas»). */
  onNavigateModule?: (tab: string, submodule?: string) => void;
}

/** Resposta de `/api/admin/stats` (agregados reais do PostgreSQL). */
interface AdminStats {
  users?: { total?: number; byMonth?: Array<{ month: string; n: number }>; byStatus?: Record<string, number> };
  companies?: { total?: number; byStatus?: Record<string, number>; byMonth?: Array<{ month: string; n: number }> };
  events?: { total?: number; byStatus?: Record<string, number> };
  orders?: { total?: number; byStatus?: Record<string, number> };
  tickets?: { total?: number; byStatus?: Record<string, number> };
  revenue?: {
    grossXOF?: number;
    commissionXOF?: number;
    byMonth?: Array<{ month: string; revenue: string | number; commission: string | number }>;
    thisMonthXOF?: number;
    commissionThisMonthXOF?: number;
    pendingXOF?: number;
    byMonthStatus?: Array<{ month: string; confirmed: string | number; pending: string | number; commission: string | number }>;
  };
}

type MetricId = 'users' | 'companies' | 'events' | 'tickets' | 'revenue';
type Period = '6' | '12' | 'all';

const METRICS: Array<{ id: MetricId; button: string; heading: string; label: string; targetLabel: string; icon: React.ElementType; tone: StatTone; tab: string; submodule?: string }> = [
  { id: 'users', button: 'Mostrar gráfico de utilizadores', heading: 'Utilizadores', label: 'Utilizadores', targetLabel: 'Gestão de utilizadores', icon: Users, tone: 'info', tab: 'users' },
  { id: 'companies', button: 'Mostrar gráfico de empresas', heading: 'Empresas', label: 'Empresas', targetLabel: 'Empresas e Negócios', icon: Building2, tone: 'success', tab: 'businesses' },
  { id: 'events', button: 'Mostrar gráfico de eventos', heading: 'Eventos', label: 'Eventos', targetLabel: 'Eventos e Bilhetes', icon: CalendarDays, tone: 'accent', tab: 'events' },
  { id: 'tickets', button: 'Mostrar gráfico de bilhetes vendidos', heading: 'Bilhetes vendidos', label: 'Bilhetes vendidos', targetLabel: 'Bilhetes emitidos', icon: Ticket, tone: 'warning', tab: 'events' },
  { id: 'revenue', button: 'Mostrar gráfico de faturação', heading: 'Faturação este mês', label: 'Faturação do mês', targetLabel: 'Financeiro', icon: DollarSign, tone: 'primary', tab: 'financials' },
];

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativos',
  published: 'Publicados',
  pending: 'Pendentes',
  rejected: 'Rejeitadas',
  suspended: 'Suspensas',
  draft: 'Rascunhos',
  ended: 'Terminados',
  cancelled: 'Cancelados',
  valid: 'Válidos',
  used: 'Utilizados',
  expired: 'Expirados',
  refunded: 'Reembolsados',
  paid: 'Pagos',
  user: 'Cidadãos',
  business: 'Empresas',
  admin: 'Administradores',
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCount = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pt-PT') : '—';

const formatXOF = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('pt-PT')} XOF` : '—';

const monthLabel = (month: string) => {
  const parsed = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString('pt-PT', { month: 'short', year: '2-digit' });
};

const tail = <T,>(items: T[], period: Period) => (period === 'all' ? items : items.slice(-Number(period)));

const statusSeries = (byStatus: Record<string, number> | undefined) =>
  Object.entries(byStatus ?? {})
    .filter(([, value]) => toNumber(value) > 0)
    .map(([key, value]) => ({ key, label: STATUS_LABELS[key] ?? key, value: toNumber(value) }));

/** Gráfico de área em SVG puro: responsivo, sem dependências e legível em leitores de ecrã. */
const AreaChart: React.FC<{ points: Array<{ label: string; value: number }>; color: string; ariaLabel: string }> = ({ points, color, ariaLabel }) => {
  if (points.length === 0) return null;
  const max = Math.max(...points.map((point) => point.value), 1);
  const width = 320;
  const height = 120;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => ({
    x: points.length > 1 ? index * step : width / 2,
    y: height - (point.value / max) * (height - 12),
  }));
  const line = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(1)},${coord.y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-32 w-full" preserveAspectRatio="none">
        <path d={area} fill={color} opacity={0.16} />
        <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {coords.map((coord, index) => (
          <circle key={`${points[index].label}-${index}`} cx={coord.x} cy={coord.y} r={2.5} fill={color} />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        <span>{points[0].label}</span>
        {points.length > 1 && <span>{points[points.length - 1].label}</span>}
      </div>
    </div>
  );
};

/** Gráfico de barras em SVG puro para distribuições por estado. */
const StatusBars: React.FC<{ items: Array<{ key: string; label: string; value: number }>; color: string; ariaLabel: string }> = ({ items, color, ariaLabel }) => {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-2" role="img" aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-[11px] font-bold text-[var(--color-text-muted)]">{item.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-subtle)]">
            <span className="block h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: color }} />
          </span>
          <span className="w-12 shrink-0 text-right text-[11px] font-black tabular-nums text-[var(--color-text-strong)]">{formatCount(item.value)}</span>
        </div>
      ))}
    </div>
  );
};

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  businesses,
  events = [],
  currentLang,
  supportRequests = [],
  pendingModerationCount = 0,
  onNavigateTab,
  onNavigateModule,
}) => {
  // `getTranslation` devolve a própria chave quando não existe tradução, por isso
  // o fallback tem de ser aplicado aqui e não com `??` no ponto de uso.
  const t = (key: string, fallback: string) => {
    const value = getTranslation(currentLang, key);
    return value === key ? fallback : value;
  };

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [activeMetricId, setActiveMetricId] = useState<MetricId>('revenue');
  const [period, setPeriod] = useState<Period>('12');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!response.ok) {
          if (!cancelled) setStatsUnavailable(true);
          return;
        }
        const payload = await response.json();
        // Em ambientes sem base de dados o endpoint responde uma lista vazia.
        if (Array.isArray(payload) || !payload || typeof payload !== 'object') {
          if (!cancelled) setStatsUnavailable(true);
          return;
        }
        if (!cancelled) setStats(payload as AdminStats);
      } catch {
        if (!cancelled) setStatsUnavailable(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeBusinesses = useMemo(
    () => businesses.filter((business) => business.status === 'active').length,
    [businesses],
  );

  const pendingSupport = useMemo(
    () => supportRequests.filter((request) => request.status !== 'resolved').length,
    [supportRequests],
  );

  const fallbackTicketsSold = useMemo(
    () => events.reduce((acc, event) => acc + (event.totalTicketsSold ?? 0), 0),
    [events],
  );

  const kpis = useMemo(() => {
    const revenue = stats?.revenue;
    // «Faturação do mês» usa o mês corrente e, quando este ainda não tem
    // receita registada, o último mês com receita confirmada — sempre com o mês
    // identificado no cartão, para nunca apresentar um total descontextualizado.
    const monthly = revenue?.byMonthStatus ?? [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentRow = monthly.find((row) => row.month === currentMonth);
    const referenceRow = currentRow && toNumber(currentRow.confirmed) > 0
      ? currentRow
      : [...monthly].reverse().find((row) => toNumber(row.confirmed) > 0);
    return {
      users: stats?.users?.total,
      companies: stats?.companies?.total ?? (businesses.length || undefined),
      activeCompanies: stats?.companies?.byStatus?.active ?? activeBusinesses,
      events: stats?.events?.total ?? (events.length || undefined),
      publishedEvents: stats?.events?.byStatus?.published ?? stats?.events?.byStatus?.active ?? (events.filter((event) => event.status === 'active').length || undefined),
      ticketsSold: stats?.tickets?.total ?? fallbackTicketsSold,
      paidOrders: stats?.orders?.byStatus?.paid,
      revenueMonth: referenceRow ? toNumber(referenceRow.confirmed) : revenue?.thisMonthXOF,
      revenueMonthLabel: referenceRow ? monthLabel(referenceRow.month) : undefined,
      commissionMonth: referenceRow ? toNumber(referenceRow.commission) : revenue?.commissionThisMonthXOF,
    };
  }, [stats, businesses.length, activeBusinesses, events, fallbackTicketsSold]);

  const monthlyCounts = (key: 'users' | 'companies') => {
    const source = stats?.[key]?.byMonth ?? [];
    return tail(source, period).map((row) => ({ label: monthLabel(row.month), value: toNumber(row.n) }));
  };

  const revenueSeries = useMemo(() => {
    const source = stats?.revenue?.byMonthStatus
      ?? (stats?.revenue?.byMonth ?? []).map((row) => ({ ...row, confirmed: row.revenue, pending: 0 }));
    return tail(source, period).map((row) => ({
      label: monthLabel(row.month),
      confirmed: toNumber(row.confirmed),
      pending: toNumber(row.pending),
    }));
  }, [stats, period]);

  const pendingRevenue = useMemo(
    () => revenueSeries.reduce((acc, row) => acc + row.pending, 0),
    [revenueSeries],
  );

  const confirmedRevenue = useMemo(
    () => revenueSeries.reduce((acc, row) => acc + row.confirmed, 0),
    [revenueSeries],
  );

  const activeMetric = METRICS.find((metric) => metric.id === activeMetricId) ?? METRICS[4];

  const openModule = (metric: (typeof METRICS)[number]) => {
    if (onNavigateModule) onNavigateModule(metric.tab, metric.submodule);
    else onNavigateTab?.(metric.tab);
  };

  const metricCard = (metric: (typeof METRICS)[number], value: string, isActive: boolean, note?: string) => (
    <StatCard
      key={metric.id}
      label={metric.label}
      value={value}
      icon={metric.icon}
      tone={metric.tone}
      active={isActive}
      onClick={() => setActiveMetricId(metric.id)}
      aria-label={metric.button}
      hint={<>{note ? `${note} · ` : ''}{isActive ? 'Em destaque no gráfico' : 'Ver gráfico'}</>}
      action={{ label: `Abrir ${metric.targetLabel}`, onClick: () => openModule(metric) }}
    />
  );

  return (
    <Panel>
      <PanelHeader
        eyebrow="Painel administrativo"
        title="Visão geral"
        description={t('admin.overview.description', 'Resumo executivo da plataforma Guigui.com')}
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <section aria-label="Indicadores principais">
        <h2 className="sr-only">Indicadores principais</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {metricCard(METRICS[0], formatCount(kpis.users), activeMetricId === 'users')}
          {metricCard(METRICS[1], formatCount(kpis.companies), activeMetricId === 'companies')}
          {metricCard(METRICS[2], formatCount(kpis.events), activeMetricId === 'events')}
          {metricCard(METRICS[3], formatCount(kpis.ticketsSold), activeMetricId === 'tickets')}
          {metricCard(METRICS[4], formatXOF(kpis.revenueMonth), activeMetricId === 'revenue', kpis.revenueMonthLabel)}
        </div>
        {statsUnavailable && (
          <Text tone="muted" size="xs" className="mt-2">
            {t('admin.overview.statsUnavailable', 'Estatísticas do servidor indisponíveis; os valores mostrados usam os dados carregados no painel.')}
          </Text>
        )}
      </section>

      <section className="mt-5" aria-label="Métrica em destaque">
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardDescription className="text-[9px] font-black uppercase tracking-[0.18em]">Métrica em destaque</CardDescription>
              <CardTitle className="mt-1 text-base font-black text-[var(--color-text-strong)]">{activeMetric.heading}</CardTitle>
              <CardDescription>
                {activeMetric.id === 'revenue'
                  ? `${formatXOF(confirmedRevenue)} confirmados · ${formatXOF(pendingRevenue)} pendentes no período selecionado`
                  : activeMetric.id === 'events' || activeMetric.id === 'tickets'
                    ? 'Distribuição por estado, com dados reais da plataforma'
                    : 'Evolução mensal com dados reais da plataforma'}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeMetric.id !== 'events' && activeMetric.id !== 'tickets' && (
                <div className="flex items-center gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-0.5" role="group" aria-label="Período do gráfico">
                  {(['6', '12', 'all'] as Period[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={period === option}
                      onClick={() => setPeriod(option)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black transition ${period === option ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-strong)] shadow-[var(--shadow-xs)]' : 'text-[var(--color-text-muted)]'}`}
                    >
                      {option === 'all' ? 'Tudo' : `${option} meses`}
                    </button>
                  ))}
                </div>
              )}
              <Button type="button" size="sm" variant="secondary" onClick={() => openModule(activeMetric)}>
                {t('admin.overview.openModule', 'Abrir módulo')} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activeMetric.id === 'users' && (
              monthlyCounts('users').length > 0
                ? <AreaChart points={monthlyCounts('users')} color="var(--color-blue-600)" ariaLabel={`Evolução de utilizadores (${period === 'all' ? 'todo o histórico' : `${period} meses`})`} />
                : <EmptyState title="Sem dados de utilizadores" description="Ainda não há registos suficientes para apresentar a evolução." />
            )}
            {activeMetric.id === 'companies' && (
              monthlyCounts('companies').length > 0
                ? <AreaChart points={monthlyCounts('companies')} color="var(--color-green-600)" ariaLabel={`Evolução de empresas (${period === 'all' ? 'todo o histórico' : `${period} meses`})`} />
                : <EmptyState title="Sem dados de empresas" description="Ainda não há registos suficientes para apresentar a evolução." />
            )}
            {activeMetric.id === 'events' && (
              statusSeries(stats?.events?.byStatus).length > 0
                ? <StatusBars items={statusSeries(stats?.events?.byStatus)} color="var(--color-violet-600)" ariaLabel="Eventos por estado" />
                : <EmptyState title="Sem eventos registados" description="Os eventos aparecem aqui assim que forem criados." />
            )}
            {activeMetric.id === 'tickets' && (
              statusSeries(stats?.tickets?.byStatus).length > 0
                ? <StatusBars items={statusSeries(stats?.tickets?.byStatus)} color="var(--color-amber-500)" ariaLabel="Bilhetes por estado" />
                : <EmptyState title="Sem bilhetes emitidos" description="A bilheteira aparece aqui depois da primeira venda." />
            )}
            {activeMetric.id === 'revenue' && (
              revenueSeries.length > 0 ? (
                <div className="space-y-3">
                  <AreaChart
                    points={revenueSeries.map((row) => ({ label: row.label, value: row.confirmed }))}
                    color="var(--color-green-600)"
                    ariaLabel="Faturação mensal confirmada em XOF"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-[var(--color-text-muted)]">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-green-600)]" aria-hidden="true" />Confirmado</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--color-amber-500)]" aria-hidden="true" />Pendente: {formatXOF(pendingRevenue)}</span>
                    <span>Receita total confirmada: {formatXOF(confirmedRevenue)}</span>
                  </div>
                </div>
              ) : (
                <EmptyState title="Sem faturação registada" description="As transações confirmadas aparecem aqui por mês." />
              )
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-5">
        <h2 className="sr-only">Estados recentes</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--color-red-600)]" />
                Moderação pendente
              </CardTitle>
              <CardDescription>
                {pendingModerationCount > 0
                  ? `${pendingModerationCount} conteúdo(s) aguardam revisão`
                  : 'Sem conteúdo pendente no momento'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Text tone="muted" size="sm" truncate>
                {pendingModerationCount > 0
                  ? t('admin.overview.moderationPendingHelp', 'Verifique os conteúdos marcados antes de publicar.')
                  : t('admin.overview.moderationOkHelp', 'Não há conteúdos aguardando análise neste momento.')}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-text-muted)]" />
                Semanas ativas
              </CardTitle>
              <CardDescription>Empresas ativas nos últimos 7 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <Text tone="muted" size="sm">
                {activeBusinesses > 0
                  ? `${activeBusinesses} empresas publicaram ou interagiram recentemente.`
                  : 'Sem movimento recente nas empresas.'}
              </Text>
            </CardContent>
          </Card>
        </div>
      </section>

      {pendingSupport > 0 && (
        <section className="mt-5">
          <h2 className="sr-only">Suporte aberto</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-green-600)]" />
                Suporte aberto
              </CardTitle>
              <CardDescription>{pendingSupport} pedido(s) aguardam resposta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {supportRequests
                .filter((request) => request.status !== 'resolved')
                .slice(0, 3)
                .map((request) => (
                  <div key={request.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm">
                    <Text tone="strong" truncate>{request.subject}</Text>
                    <Text tone="muted" size="xs" className="mt-1 flex gap-2">
                      {request.status === 'open' ? 'Aberto' : 'Em progresso'}
                      <ArrowRight className="h-3 w-3 shrink-0" />
                      {request.businessId
                        ? (businesses.find((business) => business.id === request.businessId)?.name ?? 'Empresa')
                        : 'Utilizador'}
                    </Text>
                  </div>
                ))}
            </CardContent>
          </Card>
        </section>
      )}
    </Panel>
  );
};
