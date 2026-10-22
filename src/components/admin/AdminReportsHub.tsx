import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  Building2,
  Users,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Business, EventItem, Language, PaymentTransaction } from '../../types';
import { downloadCSV, downloadExcel, downloadPDFReport, triggerPrintReport } from '../../utils/exportHelpers';
import { getTranslation } from '../../utils/i18n';
import { ChartFrame } from '../charts/ChartFrame';
import { ChartTooltip } from '../charts/ChartTooltip';
import { chartSeriesColors } from '../charts/chartTheme';

export type ReportType =
  | 'financial'
  | 'businesses'
  | 'users'
  | 'events'
  | 'payments'
  | 'subscriptions'
  | 'growth'
  | 'activity';

interface AdminReportsHubProps {
  businesses: Business[];
  events: EventItem[];
  paymentTransactions?: PaymentTransaction[];
  currentLang: Language;
}

export const AdminReportsHub: React.FC<AdminReportsHubProps> = ({
  businesses,
  events,
  paymentTransactions = [],
  currentLang,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [reportType, setReportType] = useState<ReportType>('financial');
  const [dateFrom, setDateFrom] = useState('2026-08-01');
  const [dateTo, setDateTo] = useState('2026-08-31');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('all');

  const selectedBusiness = scopeFilter.startsWith('business:')
    ? businesses.find((business) => business.id === scopeFilter.replace('business:', ''))
    : undefined;
  const selectedEvent = scopeFilter.startsWith('event:')
    ? events.find((event) => event.id === scopeFilter.replace('event:', ''))
    : undefined;
  const scopeLabel = selectedBusiness?.name || selectedEvent?.title || 'Toda a plataforma';
  const dateFromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const dateToMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  const categoryAliases: Record<string, string> = {
    restauracao: 'restauracao',
    hotelaria: 'hotelaria_saude_educacao',
    corporativo: 'corporativo_financeiro',
    ongs: 'ongs_artesãos',
  };
  const matchesCategory = (businessId?: string) => {
    if (categoryFilter === 'all') return true;
    const business = businesses.find((candidate) => candidate.id === businessId);
    return business?.groupGroupId === categoryAliases[categoryFilter];
  };
  const matchesDate = (value?: string) => {
    if (!value) return true;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) && timestamp >= dateFromMs && timestamp <= dateToMs;
  };
  const scopedPaymentTransactions = paymentTransactions.filter((transaction) => {
    if (selectedBusiness && transaction.businessId !== selectedBusiness.id) return false;
    if (selectedEvent && transaction.businessId !== selectedEvent.businessId) return false;
    if (!matchesCategory(transaction.businessId)) return false;
    return matchesDate(transaction.createdAt);
  });

  const scopedEvents = events.filter((event) => {
    if (selectedBusiness && event.businessId !== selectedBusiness.id) return false;
    if (selectedEvent && event.id !== selectedEvent.id) return false;
    if (!matchesCategory(event.businessId)) return false;
    return matchesDate(event.date);
  });

  // Report configurations metadata
  const REPORT_OPTIONS: { id: ReportType; title: string; desc: string; icon: any }[] = [
    {
      id: 'financial',
      title: t('admin.reportFinancial'),
      desc: 'Subscrições, extras, reconciliação e receitas da plataforma; sem compras ou dados de bilhetes.',
      icon: DollarSign,
    },
    {
      id: 'businesses',
      title: t('admin.reportBusinesses'),
      desc: 'Cadastro de estabelecimentos, status ativos, planos e bairros de Bissau.',
      icon: Building2,
    },
    {
      id: 'users',
      title: t('admin.reportUsers'),
      desc: 'Crescimento de cidadãos, engajamento, perfis e permissões ativas.',
      icon: Users,
    },
    {
      id: 'events',
      title: t('admin.reportEvents'),
      desc: 'Eventos culturais em Bissau, lotação de recintos e datas realizadas.',
      icon: Calendar,
    },

    {
      id: 'payments',
      title: t('admin.reportPayments'),
      desc: 'Transações Mobile Money, reconciliação de operadores e talões manuais.',
      icon: CreditCard,
    },
    {
      id: 'subscriptions',
      title: t('admin.reportSubscriptions'),
      desc: 'Distribuição dos planos Básico, Profissional, Premium e Enterprise.',
      icon: Layers,
    },
    {
      id: 'growth',
      title: t('admin.reportGrowth'),
      desc: 'Taxa de expansão da rede Guigui.com mês a mês e metas anuais.',
      icon: TrendingUp,
    },
    {
      id: 'activity',
      title: t('admin.reportActivity'),
      desc: 'Visualizações, leads para WhatsApp, chamadas de voz e rotas no mapa.',
      icon: Activity,
    },
  ];

  // Dynamic Data Generator based on Report Type & Filters
  const getReportData = () => {
    switch (reportType) {
      case 'financial': {
        const totalRevenue = scopedPaymentTransactions.reduce((total, transaction) => total + transaction.amountXOF, 0);
        const subscriptionRevenue = scopedPaymentTransactions
          .filter((transaction) => transaction.useCase.startsWith('subscription'))
          .reduce((total, transaction) => total + transaction.amountXOF, 0);
        const extraRevenue = scopedPaymentTransactions
          .filter((transaction) => transaction.useCase === 'extra_posts' || transaction.useCase === 'extra_promotions')
          .reduce((total, transaction) => total + transaction.amountXOF, 0);
        const reconciledRevenue = scopedPaymentTransactions
          .filter((transaction) => transaction.status === 'reconciled')
          .reduce((total, transaction) => total + transaction.amountXOF, 0);
        return {
          title: 'Relatório Financeiro Consolidado',
          summary: `Resumo financeiro oficial do Guigui.com para o período de ${dateFrom} a ${dateTo}. O âmbito ${scopeLabel} contém ${scopedPaymentTransactions.length} transações de plataforma. A bilhética operacional é gerida pelas empresas.`,
          kpis: [
            { label: 'Receita de Plataforma', value: `${totalRevenue.toLocaleString()} XOF`, change: 'Dados reais', trend: 'up' },
            { label: 'Assinaturas Planos', value: `${subscriptionRevenue.toLocaleString()} XOF`, change: 'Dados reais', trend: 'up' },
            { label: 'Extras Empresariais', value: `${extraRevenue.toLocaleString()} XOF`, change: 'Dados reais', trend: 'up' },
            { label: 'Reconciliado', value: `${reconciledRevenue.toLocaleString()} XOF`, change: 'Filtro activo', trend: 'neutral' },
          ],
          chartData: [
            { name: 'Assinaturas', valor: subscriptionRevenue },
            { name: 'Extras', valor: extraRevenue },
            { name: 'Reconciliado', valor: reconciledRevenue },
          ],
          chartBars: [{ dataKey: 'valor', name: 'Receita de Plataforma', color: '#10B981' }],
          headers: ['Módulo / Origem', 'Valor no âmbito (XOF)', 'Transações', 'Estado', 'Escopo'],
          rows: [
            ['Planos de Empresas (SaaS)', subscriptionRevenue.toLocaleString(), `${scopedPaymentTransactions.filter((transaction) => transaction.useCase.startsWith('subscription')).length}`, 'Filtrado', scopeLabel],
            ['Publicações & Promoções Extras', extraRevenue.toLocaleString(), `${scopedPaymentTransactions.filter((transaction) => transaction.useCase === 'extra_posts' || transaction.useCase === 'extra_promotions').length}`, 'Filtrado', scopeLabel],
            ['Total de Plataforma', totalRevenue.toLocaleString(), `${scopedPaymentTransactions.length}`, 'Consolidado', scopeLabel],
          ],
          comparison: 'Cálculo baseado exclusivamente em transações de plataforma do âmbito selecionado; bilhetes e compradores não são incluídos.',
        };
      }

      case 'businesses': {
        const scopedBusinesses = (selectedBusiness ? [selectedBusiness] : businesses).filter((business) => matchesCategory(business.id));
        const businessGroups = Array.from(new Set(scopedBusinesses.map((business) => business.groupGroupId)));
        const businessChartData = businessGroups.map((groupId) => ({
          name: groupId,
          ativas: scopedBusinesses.filter((business) => business.groupGroupId === groupId && business.status === 'active').length,
          pendentes: scopedBusinesses.filter((business) => business.groupGroupId === groupId && business.status !== 'active').length,
        }));
        return {
          title: 'Relatório de Empresas & Cadastros',
          summary: `Panorama de ${selectedBusiness ? '1' : businesses.length} empresa(s) no âmbito ${scopeLabel} até ${dateTo}.`,
          kpis: [
            { label: 'Total de Empresas', value: `${selectedBusiness ? 1 : businesses.length}`, change: 'Dados reais', trend: 'up' },
            { label: 'Empresas Activas', value: `${(selectedBusiness ? [selectedBusiness] : businesses).filter((business) => business.status === 'active').length}`, change: 'Dados reais', trend: 'up' },
            { label: 'Em Análise / Novas', value: `${(selectedBusiness ? [selectedBusiness] : businesses).filter((business) => business.status === 'pending').length}`, change: 'Dados reais', trend: 'neutral' },
            { label: 'Suspensas', value: `${(selectedBusiness ? [selectedBusiness] : businesses).filter((business) => business.status === 'suspended').length}`, change: 'Dados reais', trend: 'neutral' },
          ],
          chartData: businessChartData,
          chartBars: [
            { dataKey: 'ativas', name: 'Empresas Ativas', color: '#10B981' },
            { dataKey: 'pendentes', name: 'Em Análise / Pendentes', color: '#F59E0B' },
          ],
          headers: ['Categoria Económica', 'Total Registadas', 'Ativas', 'Com Selo Azul', 'Taxa de Conversão'],
          rows: (selectedBusiness ? [selectedBusiness] : businesses).map((business) => [
            business.name,
            business.status,
            business.tier,
            business.neighborhood,
            business.verified ? 'Verificada' : 'Por verificar',
          ]),
          comparison: 'Linhas, gráfico e KPIs recalculados a partir do cadastro empresarial atual e do filtro selecionado.',
        };
      }

      case 'users':
        return {
          title: 'Relatório de Utilizadores & Cidadãos',
          summary: `Estatísticas demográficas e engajamento da comunidade de 25.430 utilizadores no Guigui.com em Bissau e na Diáspora.`,
          kpis: [
            { label: 'Utilizadores Ativos', value: '25.430', change: '+14.8%', trend: 'up' },
            { label: 'Cidadãos (Consumidores)', value: '21.610', change: '85.0%', trend: 'up' },
            { label: 'Contas Empresariais', value: '3.820', change: '15.0%', trend: 'up' },
            { label: 'Administradores & Staff', value: '14', change: '100% ativos', trend: 'neutral' },
          ],
          chartData: [
            { name: 'Semana 1', novos: 840, ativos: 18900 },
            { name: 'Semana 2', novos: 920, ativos: 20400 },
            { name: 'Semana 3', novos: 1100, ativos: 22800 },
            { name: 'Semana 4', novos: 1350, ativos: 25430 },
          ],
          chartBars: [
            { dataKey: 'novos', name: 'Novos Cadastros', color: '#2563EB' },
            { dataKey: 'ativos', name: 'Utilizadores Ativos', color: '#10B981' },
          ],
          headers: ['Perfil de Utilizador', 'Quantidade', 'Acessos / Semana', 'Ações Sociais', 'Status'],
          rows: [
            ['Cidadão em Bissau', '18.420', '48.900 sessões', '14.200 reações', 'Ativo'],
            ['Cidadão na Diáspora (PT/FR/SN)', '3.190', '9.400 sessões', '3.800 reações', 'Ativo (GDPR)'],
            ['Gestores de Empresas', '3.820', '18.200 sessões', '8.400 posts/promoções', 'Ativo'],
            ['Operadores de Portaria', '45', '1.200 validações', '18.540 scans', 'Ativo'],
          ],
          comparison: 'Taxa de retenção semanal de 78.4% com tempo médio diário de permanência de 6m 40s.',
        };

      case 'events': {
        const activeEvents = scopedEvents.filter((event) => event.status === 'active').length;
        const pendingEvents = scopedEvents.filter((event) => event.status === 'draft').length;
        const linkedBusinesses = new Set(scopedEvents.map((event) => event.businessId).filter(Boolean)).size;
        return {
          title: 'Relatório de Eventos & Agenda Cultural',
          summary: `Supervisão de ${scopedEvents.length} eventos no âmbito ${scopeLabel}. Compras, compradores, QR, vendas e reembolsos continuam disponíveis apenas no painel da empresa organizadora.`,
          kpis: [
            { label: 'Total de Eventos', value: `${scopedEvents.length}`, change: 'Dados reais', trend: 'up' },
            { label: 'Eventos Activos', value: `${activeEvents}`, change: 'Dados reais', trend: 'up' },
            { label: 'Em Rascunho', value: `${pendingEvents}`, change: 'Dados reais', trend: 'neutral' },
            { label: 'Empresas Ligadas', value: `${linkedBusinesses}`, change: 'Visão de governação', trend: 'neutral' },
          ],
          chartData: scopedEvents.map((event) => ({
            name: event.title,
            eventos: 1,
            activos: event.status === 'active' ? 1 : 0,
          })),
          chartBars: [
            { dataKey: 'eventos', name: 'Eventos no âmbito', color: '#F59E0B' },
            { dataKey: 'activos', name: 'Eventos activos', color: '#10B981' },
          ],
          headers: ['Evento', 'Estado', 'Organizador', 'Empresa ligada', 'Âmbito'],
          rows: scopedEvents.map((event) => [
            event.title,
            event.status,
            event.organizerName,
            event.businessId ? 'Empresa registada' : 'Organização externa',
            scopeLabel,
          ]),
          comparison: 'A agenda, o gráfico e as linhas respeitam o âmbito selecionado; nenhuma métrica de compra, comprador ou validação é exposta ao Super Admin.',
        };
      }

      default:
        return {
          title: `Relatório de ${REPORT_OPTIONS.find((r) => r.id === reportType)?.title || 'Estatísticas'}`,
          summary: `Dados consolidados de performance da plataforma Guigui.com referentes a ${reportType} no período selecionado.`,
          kpis: [
            { label: 'Indicador Principal', value: '98.4%', change: '+5.2%', trend: 'up' },
            { label: 'Volume Total', value: '18.540 itens', change: '+12.0%', trend: 'up' },
            { label: 'Taxa de Sucesso', value: '99.8%', change: 'Sem Erros', trend: 'up' },
            { label: 'Tempo Médio Resposta', value: '0.4s', change: 'Ótimo', trend: 'up' },
          ],
          chartData: [
            { name: 'Semana 1', valor: 4200 },
            { name: 'Semana 2', valor: 4800 },
            { name: 'Semana 3', valor: 5100 },
            { name: 'Semana 4', valor: 5400 },
          ],
          chartBars: [{ dataKey: 'valor', name: 'Volume Processado', color: '#2563EB' }],
          headers: ['Métrica / Indicador', 'Valor Registado', 'Meta Mensal', 'Desempenho', 'Estado'],
          rows: [
            ['Processamento em Tempo Real', '100%', '99.5%', 'Excelente', 'Concluído'],
            ['Disponibilidade do Sistema', '99.98%', '99.90%', 'Acima do SLA', 'Normal'],
            ['Tempo de Resposta Médio', '240ms', '< 500ms', 'Muito Rápido', 'Estável'],
          ],
          comparison: 'Todos os indicadores operam acima dos limites de serviço estipulados.',
        };
    }
  };

  const report = getReportData();
  const reportRowsWithScope = selectedBusiness || selectedEvent
    ? [[`Âmbito selecionado: ${scopeLabel}`, 'Filtro aplicado', selectedBusiness?.id || selectedEvent?.id || 'N/A', 'Ativo', 'Escopo'], ...report.rows]
    : report.rows;

  // Export Action Handlers
  const handleExportCSV = () => {
    downloadCSV(
      `Guigui_Relatorio_${reportType}_${dateFrom}_${dateTo}`,
      report.headers,
      reportRowsWithScope
    );
  };

  const handleExportExcel = () => {
    downloadExcel(
      `Guigui_Relatorio_${reportType}_${dateFrom}_${dateTo}`,
      report.title,
      report.headers,
      reportRowsWithScope
    );
  };

  const handleExportPDF = () => {
    downloadPDFReport(
      report.title,
      report.summary,
      report.kpis,
      report.headers,
      reportRowsWithScope
    );
  };

  const handlePrint = () => {
    handleExportPDF();
  };

  return (
    <div className="space-y-6">
      {/* 1. SELETOR DE RELATÓRIO E FILTROS */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-bold mb-2 border border-blue-200">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t('admin.reportsCenter')}</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[var(--color-text-strong)]">
              {t('admin.reportsGenerator')}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Gere relatórios completos, audite os números da rede e exporte em múltiplos formatos com 1-clique.
            </p>
          </div>

          {/* 4 ACTION BUTTONS (TOP BAR) */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button"
              onClick={handleExportPDF}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>PDF / Imprimir</span>
            </button>

            <button type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" />
              <span>↓ Baixar Excel</span>
            </button>

            <button type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>↓ Baixar CSV</span>
            </button>

            <button type="button"
              onClick={handlePrint}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>🖨️ Imprimir</span>
            </button>
          </div>
        </div>

        {/* 9 REPORT TYPES GRID */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2.5">
            1. Selecione o Tipo de Relatório:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            {REPORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = reportType === opt.id;
              return (
                <button type="button"
                  key={opt.id}
                  onClick={() => setReportType(opt.id)}
                  className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-black truncate ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                      {opt.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PERIOD & CATEGORY SELECTORS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Data Inicial:</span>
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Data Final:</span>
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{t('allCategories')}:</span>
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('allCategories')}</option>
              <option value="restauracao">Restauração, Cafés e Bares</option>
              <option value="hotelaria">Hotelaria, Clínicas e Educação</option>
              <option value="corporativo">Bancos, Seguradoras e Telecoms</option>
              <option value="ongs">ONGs e Cooperativas Culturais</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Empresa / entidade:</span>
            </label>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Toda a plataforma</option>
              {businesses.map((business) => <option key={business.id} value={`business:${business.id}`}>Empresa: {business.name}</option>)}
              {events.map((event) => <option key={event.id} value={`event:${event.id}`}>Evento: {event.title}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 2. REPORT GENERATED PREVIEW CONTAINER */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
        {/* REPORT HEADER & RESUMO */}
        <div className="border-b border-slate-100 pb-5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-black text-slate-900">{report.title}</h3>
            <span className="text-xs font-bold font-mono px-3 py-1 bg-slate-100 text-slate-700 rounded-full">
              Período: {dateFrom} até {dateTo}
            </span>
          </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
            {report.summary} Âmbito atual: <strong>{scopeLabel}</strong>.
          </p>
        </div>

        {/* KPIS SUMMARY */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
            Totais e Métricas-Chave
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {report.kpis.map((kpi, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase">{kpi.label}</span>
                <div className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1">
                  {kpi.value}
                </div>
                <div className="text-[11px] font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{kpi.change}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ANALYTICAL CHART */}
        {report.chartData && (
          <ChartFrame
            title="Gráfico Comparativo do Período"
            description="Compare as séries do relatório e passe o cursor sobre os dados para consultar os valores."
            eyebrow="Análise"
            height="md"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.chartData as any[]} margin={{ top: 12, right: 12, left: -12, bottom: 4 }} barCategoryGap="24%">
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--color-border-default)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'var(--color-green-600)', opacity: 0.06 }} content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 12, fontWeight: 600 }} />
                {report.chartBars.map((bar, i) => (
                  <Bar key={i} dataKey={bar.dataKey} name={bar.name} fill={chartSeriesColors[i % chartSeriesColors.length]} radius={[6, 6, 2, 2]} maxBarSize={34} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        )}

        {/* DETAILED DATA TABLE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Tabela Detalhada de Dados
            </h4>
            <span className="text-[11px] text-slate-400 font-semibold">{reportRowsWithScope.length} registos no âmbito</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  {report.headers.map((h, i) => (
                    <th key={i} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportRowsWithScope.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50 transition font-medium text-slate-800">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-4 py-3">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* COMPARISON WITH PREVIOUS PERIOD */}
        <div className="bg-blue-50/60 border border-blue-200 p-4 rounded-2xl flex items-start gap-3 text-xs">
          <TrendingUp className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-black text-blue-950 uppercase tracking-wider text-[11px] block">
              Comparação com Período Anterior
            </span>
            <p className="text-blue-900 mt-0.5 leading-relaxed font-medium">
              {report.comparison}
            </p>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-medium">
            Relatório gerado em tempo real pelo motor de auditoria de dados do Guigui.com.
          </span>

          <div className="flex items-center gap-2">
            <button type="button"
              onClick={handleExportPDF}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF / Imprimir</span>
            </button>
            <button type="button"
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Baixar Excel</span>
            </button>
            <button type="button"
              onClick={handleExportCSV}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Baixar CSV</span>
            </button>
            <button type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center gap-1.5 border border-slate-300"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
