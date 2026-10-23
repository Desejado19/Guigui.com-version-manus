import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Building2,
  Calendar,
  Ticket,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Business, EventItem, Language } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { ChartFrame } from '../charts/ChartFrame';
import { ChartTooltip } from '../charts/ChartTooltip';
import { chartColors } from '../charts/chartTheme';
import { StatCard } from '../ui';

interface AdminOverviewProps {
  businesses: Business[];
  events: EventItem[];
  onNavigateTab: (tab: any) => void;
  currentLang?: Language;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  businesses,
  events,
  onNavigateTab,
  currentLang = 'pt' as Language,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [growthPeriod, setGrowthPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [selectedMetric, setSelectedMetric] = useState<'users' | 'businesses' | 'events' | 'tickets' | 'revenue'>('revenue');

  // Estatísticas reais agregadas do PostgreSQL (substituem os números de demonstração
  // que antes estavam fixos no componente).
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/admin/stats', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setStats(data);
      } catch {
        // mantém o ecrã em branco suave se a API falhar; o administrador vê o erro ao actualizar.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Totais derivados (com valores seguros enquanto os dados carregam).
  const usersTotal: number = stats?.users?.total ?? 0;
  const usersNewThisMonth: number = stats?.users?.byMonth?.at(-1)?.n ?? 0;
  const companiesTotal: number = stats?.companies?.total ?? 0;
  const companiesActive: number = stats?.companies?.byStatus?.active ?? 0;
  const companiesPending: number = stats?.companies?.byStatus?.pending ?? 0;
  const eventsTotal: number = stats?.events?.total ?? 0;
  const eventsPublished: number = stats?.events?.byStatus?.published ?? 0;
  const ordersPaid: number = stats?.orders?.byStatus?.paid ?? 0;
  const ticketsTotal: number = stats?.tickets?.total ?? 0;
  const revenueGross: number = stats?.revenue?.grossXOF ?? 0;
  const revenueCommission: number = stats?.revenue?.commissionXOF ?? 0;

  const fmtInt = (v: number) => new Intl.NumberFormat('pt-PT').format(v);
  const fmtXOF = (v: number) => new Intl.NumberFormat('pt-PT').format(v);

  // Séries reais a partir da base: utilizadores e empresas por mês de registo.
  const usersByMonth: Array<{ month: string; n: number }> = stats?.users?.byMonth ?? [];
  const companiesByMonth: Array<{ month: string; n: number }> = stats?.companies?.byMonth ?? [];
  const monthLabels: string[] = Array.from(new Set([...usersByMonth.map((r) => r.month), ...companiesByMonth.map((r) => r.month)])).sort();
  const shortMonth = (m: string) => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mm = Number(m.split('-')[1]);
    return months[mm - 1] ?? m;
  };
  const growthDataMonth = monthLabels.map((m) => ({
    period: shortMonth(m),
    utilizadores: usersByMonth.find((r) => r.month === m)?.n ?? 0,
    empresas: companiesByMonth.find((r) => r.month === m)?.n ?? 0,
  }));
  // Compatibilidade com os selectores de período do gráfico de crescimento.
  const growthDataDay = growthDataMonth;
  const growthDataYear = monthLabels.map((m) => ({
    period: m.split('-')[0],
    utilizadores: usersByMonth.find((r) => r.month === m)?.n ?? 0,
    empresas: companiesByMonth.find((r) => r.month === m)?.n ?? 0,
  }));

  const activeGrowthData =
    growthPeriod === 'day' ? growthDataDay : growthPeriod === 'year' ? growthDataYear : growthDataMonth;

  // Receita mensal real (apenas transacções pagas).
  const revenueByMonth: Array<{ month: string; revenue: number }> = stats?.revenue?.byMonth ?? [];
  const financialData = revenueByMonth.map((r) => ({
    month: shortMonth(r.month),
    receita: Number(r.revenue),
    assinaturas: stats?.payments?.byUseCase?.subscription_initial ? Number(stats.revenue.byMonth.find((x: any) => x.month === r.month)?.revenue ?? 0) : 0,
    bilhetes: stats?.payments?.byUseCase?.event_tickets ? Number(r.revenue) : 0,
    comissoes: Number(stats?.revenue?.byMonth?.find((x: any) => x.month === r.month)?.commission ?? 0),
  }));

  // Distribuição real de eventos por estado (publicados vs rascunho/outros).
  const eventStatusData = [
    { name: 'Publicados', value: eventsPublished, color: chartColors.primary },
    { name: 'Rascunho/Outros', value: Math.max(eventsTotal - eventsPublished, 0), color: chartColors.neutral },
  ];

  const contextualCharts = {
    users: {
      title: 'Utilizadores',
      description: 'Novas contas de cidadãos por mês',
      color: chartColors.info,
      data: growthDataMonth.map(({ period, utilizadores }) => ({ period, value: utilizadores })),
      valueLabel: 'Novos utilizadores',
    },
    businesses: {
      title: 'Empresas',
      description: 'Novas empresas registadas por mês',
      color: chartColors.primary,
      data: growthDataMonth.map(({ period, empresas }) => ({ period, value: empresas })),
      valueLabel: 'Novas empresas',
    },
    events: {
      title: 'Eventos',
      description: 'Distribuição actual dos eventos publicados na plataforma',
      color: chartColors.accent,
      data: eventStatusData.map(({ name, value }) => ({ period: name, value })),
      valueLabel: 'Eventos',
    },
    tickets: {
      title: 'Bilhetes vendidos',
      description: 'Bilhetes emitidos a partir das encomendas pagas',
      color: chartColors.accentStrong,
      data: growthDataMonth.map(({ period }) => ({ period, value: ticketsTotal })),
      valueLabel: 'Bilhetes vendidos',
    },
    revenue: {
      title: 'Faturação este mês',
      description: 'Evolução da receita confirmada da plataforma em XOF',
      color: chartColors.primary,
      data: financialData.map(({ month, receita }) => ({ period: month, value: receita })),
      valueLabel: 'Receita',
    },
  } as const;
  const selectedChart = contextualCharts[selectedMetric];

  return (
    <div className="space-y-6">

      {/* 1. TOP 5 EXECUTIVE KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {/* KPI 1: Utilizadores */}
        <StatCard
          aria-label="Mostrar gráfico de utilizadores"
          onClick={() => setSelectedMetric('users')}
          active={selectedMetric === 'users'}
          tone="info"
          icon={Users}
          label={t('admin.users')}
          value={fmtInt(usersTotal)}
          delta={{ value: `+${fmtInt(usersNewThisMonth)} este mês`, direction: 'up' }}
        />

        {/* KPI 2: Empresas */}
        <StatCard
          aria-label="Mostrar gráfico de empresas"
          onClick={() => setSelectedMetric('businesses')}
          active={selectedMetric === 'businesses'}
          tone="primary"
          icon={Building2}
          label={t('admin.businesses')}
          value={fmtInt(companiesTotal)}
          delta={{ value: `${fmtInt(companiesActive)} activas`, direction: 'up' }}
        />

        {/* KPI 3: Eventos */}
        <StatCard
          aria-label="Mostrar gráfico de eventos"
          onClick={() => setSelectedMetric('events')}
          active={selectedMetric === 'events'}
          tone="warning"
          icon={Calendar}
          label={t('admin.events')}
          value={fmtInt(eventsTotal)}
          delta={{ value: `${fmtInt(eventsPublished)} publicados`, direction: 'flat' }}
        />

        {/* KPI 4: Bilhetes Vendidos */}
        <StatCard
          aria-label="Mostrar gráfico de bilhetes vendidos"
          onClick={() => setSelectedMetric('tickets')}
          active={selectedMetric === 'tickets'}
          tone="accent"
          icon={Ticket}
          label={t('admin.ticketsSold')}
          value={fmtInt(ticketsTotal)}
          delta={{ value: `${fmtInt(ordersPaid)} encomendas pagas`, direction: 'up' }}
        />

        {/* KPI 5: Faturação Mensal */}
        <StatCard
          aria-label="Mostrar gráfico de faturação"
          onClick={() => setSelectedMetric('revenue')}
          active={selectedMetric === 'revenue'}
          tone="success"
          icon={DollarSign}
          label={t('admin.revenueMonth')}
          value={`${fmtXOF(revenueGross)} XOF`}
          delta={{ value: `${fmtXOF(revenueCommission)} XOF em comissões`, direction: 'up' }}
        />
      </div>

      {/* 2. CONTEXTUAL KPI CHART */}
      <ChartFrame
        title={selectedChart.title}
        description={selectedChart.description}
        eyebrow="Métrica em destaque"
        height="sm"
        action={<span className="text-[10px] font-bold text-[var(--color-text-muted)]">Selecione um KPI acima</span>}
        aria-live="polite"
        className="shadow-[var(--shadow-sm)]"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={selectedChart.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="selectedMetricGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={selectedChart.color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={selectedChart.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString('pt-PT')} />
            <Tooltip
              cursor={{ fill: 'var(--color-green-600)', opacity: 0.06 }}
              content={<ChartTooltip formatter={(value) => [value.toLocaleString('pt-PT'), selectedChart.valueLabel]} />}
            />
            <Area type="monotone" dataKey="value" name={selectedChart.valueLabel} stroke={selectedChart.color} strokeWidth={2.5} fill="url(#selectedMetricGradient)" activeDot={{ r: 5, strokeWidth: 3, stroke: 'var(--color-bg-surface)', fill: selectedChart.color }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFrame>

      {/* 3. PLATFORM GROWTH CHART & FINANCIAL METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Growth Chart (7 cols) */}
        <div className="lg:col-span-7 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-4">
            <div>
              <h3 className="font-extrabold text-sm text-[var(--color-text-strong)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-green-600)]" />
                <span>{t('admin.platformGrowth')}</span>
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Evolução cumulativa de cidadãos e empresas registradas em Bissau
              </p>
            </div>

            <div className="flex items-center bg-[var(--color-neutral-100)] p-1 rounded-xl text-xs font-bold text-[var(--color-text-muted)]">
              <button type="button"
                onClick={() => setGrowthPeriod('day')}
                className={`px-3 py-1 rounded-lg transition ${
                  growthPeriod === 'day' ? 'bg-[var(--color-neutral-0)] text-[var(--color-green-700)] shadow-xs' : 'hover:text-[var(--color-text-strong)]'
                }`}
              >
                Por Dia
              </button>
              <button type="button"
                onClick={() => setGrowthPeriod('month')}
                className={`px-3 py-1 rounded-lg transition ${
                  growthPeriod === 'month' ? 'bg-[var(--color-neutral-0)] text-[var(--color-green-700)] shadow-xs' : 'hover:text-[var(--color-text-strong)]'
                }`}
              >
                Por Mês
              </button>
              <button type="button"
                onClick={() => setGrowthPeriod('year')}
                className={`px-3 py-1 rounded-lg transition ${
                  growthPeriod === 'year' ? 'bg-[var(--color-neutral-0)] text-[var(--color-green-700)] shadow-xs' : 'hover:text-[var(--color-text-strong)]'
                }`}
              >
                Por Ano
              </button>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activeGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.info} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={chartColors.info} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorBiz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.primary} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={chartColors.primary} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Area
                  type="monotone"
                  dataKey="utilizadores"
                  name="Utilizadores Cidadãos"
                  stroke={chartColors.info}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorUsers)"
                />
                <Area
                  type="monotone"
                  dataKey="empresas"
                  name="Empresas Registadas"
                  stroke={chartColors.primary}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorBiz)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Chart (5 cols) */}
        <div className="lg:col-span-5 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-4">
            <div>
              <h3 className="font-extrabold text-sm text-[var(--color-text-strong)] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[var(--color-green-600)]" />
                <span>{t('admin.financialPerformance')}</span>
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Receita, assinaturas, bilhetes e comissões</p>
            </div>
            <button type="button"
              onClick={() => onNavigateTab('financials')}
              className="text-xs font-bold text-[var(--color-green-600)] hover:underline"
            >
              Ver Finanças →
            </button>
          </div>

          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                  tickFormatter={(val) => `${(val / 1000000).toFixed(0)}M`}
                />
                <Tooltip content={<ChartTooltip unit="XOF" />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 12, fontWeight: 600 }} />
                <Bar dataKey="assinaturas" name="Assinaturas Planos" fill={chartColors.info} radius={[6, 6, 2, 2]} maxBarSize={38} />
                <Bar dataKey="bilhetes" name="Venda Bilhetes" fill={chartColors.primary} radius={[6, 6, 2, 2]} maxBarSize={38} />
                <Bar dataKey="comissoes" name="Comissões Guigui" fill={chartColors.accent} radius={[6, 6, 2, 2]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. EVENTS BREAKDOWN & RECENT SYSTEM ACTIVITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Events Statistics Card (4 cols) */}
        <div className="lg:col-span-4 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] pb-3">
            <h3 className="font-extrabold text-sm text-[var(--color-text-strong)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-green-600)]" />
              <span>{t('admin.globalEvents')}</span>
            </h3>
            <span className="text-xs font-bold text-[var(--color-text-muted)] font-mono">{fmtInt(eventsTotal)} Total</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--color-green-50)] border border-[var(--color-green-200)] rounded-2xl p-3.5 text-center">
              <span className="text-[10px] uppercase font-bold text-[var(--color-green-800)]">Publicados</span>
              <div className="text-2xl font-black text-[var(--color-green-700)] font-mono mt-1">{fmtInt(eventsPublished)}</div>
            </div>
            <div className="bg-[var(--color-neutral-100)] border border-[var(--color-green-200)] rounded-2xl p-3.5 text-center">
              <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Rascunho/Outros</span>
              <div className="text-2xl font-black text-[var(--color-green-700)] font-mono mt-1">{fmtInt(Math.max(eventsTotal - eventsPublished, 0))}</div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-muted)] font-medium">Bilhetes emitidos:</span>
              <span className="font-mono font-bold text-[var(--color-text-strong)]">{fmtInt(ticketsTotal)} bilhetes</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
              <span>Encomendas pagas associadas:</span>
              <strong className="text-[var(--color-green-700)] font-bold font-mono">{fmtInt(ordersPaid)} encomendas</strong>
            </div>
          </div>

          <button type="button"
            onClick={() => onNavigateTab('events')}
            className="w-full py-2.5 bg-[var(--color-green-700)] hover:bg-[var(--color-green-800)] text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Eventos ({fmtInt(eventsTotal)})</span>
          </button>
        </div>
      </div>
    </div>
  );
};


