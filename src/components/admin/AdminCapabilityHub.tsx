import React, { useMemo, useState } from 'react';
import { Language } from '../../types';
import { getTranslation } from '../../utils/i18n';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Gauge,
  HardDrive,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';

export type AdminCapabilityTab =
  | 'overview'
  | 'businesses'
  | 'moderation'
  | 'pricing'
  | 'categories'
  | 'roles'
  | 'admin_staff'
  | 'audit_logs'
  | 'events'
  | 'financials'
  | 'architecture'
  | 'reports'
  | 'notifications'
  | 'support';

type CapabilityItem = {
  id: string;
  label: string;
  description: string;
  tab?: AdminCapabilityTab;
  status: 'integrated' | 'prepared';
};

type CapabilityGroup = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  items: CapabilityItem[];
};

type CapabilityRecord = {
  label: string;
  status?: string;
};

interface AdminCapabilityHubProps {
  onNavigateTab: (tab: AdminCapabilityTab) => void;
  currentLang?: Language;
  dataSummary?: {
    businesses: number;
    activeBusinesses: number;
    events: number;
    moderationItems: number;
    paymentTransactions: number;
    auditLogs: number;
    supportRequests: number;
  };
  dataPreview?: {
    businesses: CapabilityRecord[];
    events: CapabilityRecord[];
    auditLogs: CapabilityRecord[];
    moderation: CapabilityRecord[];
    payments: CapabilityRecord[];
    support: CapabilityRecord[];
  };
}

const capabilityGroups: CapabilityGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Indicadores executivos, actividade e visão geral da plataforma.',
    icon: Activity,
    tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    items: [
      { id: 'dashboard-home', label: 'Dashboard', description: 'KPIs, crescimento, finanças e actividade recente.', tab: 'overview', status: 'integrated' },
    ],
  },
  {
    id: 'users',
    label: 'Utilizadores',
    description: 'Supervisão de cidadãos, empresas, administradores e estados de conta.',
    icon: Users,
    tone: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    items: [
      { id: 'users-citizens', label: 'Cidadãos', description: 'Crescimento, perfis e actividade de cidadãos.', tab: 'reports', status: 'prepared' },
      { id: 'users-businesses', label: 'Empresas', description: 'Contas empresariais e relação com o cadastro.', tab: 'businesses', status: 'integrated' },
      { id: 'users-admins', label: 'Administradores', description: 'Equipa, permissões, 2FA e revogação de acesso.', tab: 'admin_staff', status: 'integrated' },
      { id: 'users-suspended', label: 'Contas suspensas', description: 'Estado de conta e acções de contenção.', tab: 'businesses', status: 'prepared' },
    ],
  },
  {
    id: 'businesses',
    label: 'Empresas',
    description: 'Cadastro, validação, estados e classificação dos negócios.',
    icon: Building2,
    tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    items: [
      { id: 'businesses-all', label: 'Todas', description: 'Lista principal de empresas registadas.', tab: 'businesses', status: 'integrated' },
      { id: 'businesses-pending', label: 'Pendentes', description: 'Empresas que aguardam validação documental.', tab: 'businesses', status: 'integrated' },
      { id: 'businesses-verified', label: 'Verificadas', description: 'Empresas activas e verificadas.', tab: 'businesses', status: 'integrated' },
      { id: 'businesses-suspended', label: 'Suspensas', description: 'Negócios temporariamente impedidos de operar.', tab: 'businesses', status: 'prepared' },
      { id: 'businesses-categories', label: 'Categorias', description: 'Estrutura de sectores e categorias do directório.', tab: 'categories', status: 'integrated' },
    ],
  },
  {
    id: 'content',
    label: 'Conteúdo',
    description: 'Publicações, eventos, promoções, destaques e categorias.',
    icon: FileText,
    tone: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    items: [
      { id: 'content-posts', label: 'Publicações', description: 'Fila e decisões sobre publicações do feed.', tab: 'moderation', status: 'integrated' },
      { id: 'content-events', label: 'Eventos', description: 'Agenda cultural, aprovação e bilhética.', tab: 'events', status: 'integrated' },
      { id: 'content-promotions', label: 'Promoções', description: 'Ofertas, campanhas e validação de conteúdo promocional.', tab: 'moderation', status: 'prepared' },
      { id: 'content-highlights', label: 'Destaques', description: 'Selecção de conteúdos em destaque na plataforma.', tab: 'moderation', status: 'prepared' },
      { id: 'content-categories', label: 'Categorias', description: 'Categorias e grupos de actividade.', tab: 'categories', status: 'integrated' },
    ],
  },
  {
    id: 'moderation',
    label: 'Moderação',
    description: 'Controlo de qualidade, denúncias e conteúdo removido.',
    icon: ShieldCheck,
    tone: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    items: [
      { id: 'moderation-pending', label: 'Pendentes', description: 'Itens que aguardam decisão humana.', tab: 'moderation', status: 'integrated' },
      { id: 'moderation-reports', label: 'Denúncias', description: 'Sinalizações enviadas pela comunidade.', tab: 'moderation', status: 'prepared' },
      { id: 'moderation-reviews', label: 'Avaliações', description: 'Revisão de avaliações e respostas empresariais.', tab: 'moderation', status: 'prepared' },
      { id: 'moderation-spam', label: 'Spam', description: 'Detecção e tratamento de padrões abusivos.', tab: 'moderation', status: 'prepared' },
      { id: 'moderation-removed', label: 'Conteúdo removido', description: 'Histórico de remoções e motivos.', tab: 'audit_logs', status: 'prepared' },
    ],
  },
  {
    id: 'tickets',
    label: 'Bilhetes',
    description: 'Supervisão de eventos; a venda, validação QR e reembolso operacional pertencem à empresa organizadora.',
    icon: Ticket,
    tone: 'text-fuchsia-500 bg-fuchsia-500/10 border-fuchsia-500/20',
    items: [
      { id: 'tickets-events', label: 'Eventos', description: 'Eventos culturais e lotação.', tab: 'events', status: 'integrated' },
      { id: 'tickets-tickets', label: 'Bilhetes', description: 'Consulta operacional disponível apenas no painel da empresa.', tab: 'events', status: 'prepared' },
      { id: 'tickets-sales', label: 'Vendas', description: 'Vendas de bilhética geridas pela empresa organizadora.', tab: 'events', status: 'prepared' },
      { id: 'tickets-refunds', label: 'Reembolsos', description: 'Reembolsos operacionais geridos pela empresa organizadora.', tab: 'events', status: 'prepared' },
    ],
  },
  {
    id: 'finance',
    label: 'Financeiro',
    description: 'Pagamentos, receitas, comissões e reembolsos.',
    icon: Wallet,
    tone: 'text-green-500 bg-green-500/10 border-green-500/20',
    items: [
      { id: 'finance-payments', label: 'Pagamentos', description: 'Transacções Mobile Money e estados.', tab: 'financials', status: 'integrated' },
      { id: 'finance-revenue', label: 'Receitas', description: 'Receita consolidada e desempenho financeiro.', tab: 'financials', status: 'integrated' },
      { id: 'finance-commissions', label: 'Comissões', description: 'Comissões da plataforma e bilhética.', tab: 'financials', status: 'integrated' },
      { id: 'finance-refunds', label: 'Reembolsos', description: 'Análise de reembolsos e anomalias.', tab: 'financials', status: 'integrated' },
    ],
  },
  {
    id: 'subscriptions',
    label: 'Subscrições',
    description: 'Planos, empresas, pagamentos e promoções de adesão.',
    icon: CreditCard,
    tone: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    items: [
      { id: 'subscriptions-plans', label: 'Planos', description: 'Matriz de preços e benefícios por plano.', tab: 'pricing', status: 'integrated' },
      { id: 'subscriptions-businesses', label: 'Empresas', description: 'Empresas e plano actualmente associado.', tab: 'businesses', status: 'integrated' },
      { id: 'subscriptions-payments', label: 'Pagamentos', description: 'Renovações e transacções de subscrição.', tab: 'financials', status: 'integrated' },
      { id: 'subscriptions-promotions', label: 'Promoções', description: 'Descontos e campanhas de subscrição.', tab: 'pricing', status: 'prepared' },
    ],
  },
  {
    id: 'advertising',
    label: 'Publicidade',
    description: 'Campanhas, anúncios e estatísticas de divulgação.',
    icon: Megaphone,
    tone: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    items: [
      { id: 'advertising-campaigns', label: 'Campanhas', description: 'Planeamento de campanhas comerciais.', tab: 'reports', status: 'prepared' },
      { id: 'advertising-ads', label: 'Anúncios', description: 'Gestão de criativos e placements.', tab: 'reports', status: 'prepared' },
      { id: 'advertising-stats', label: 'Estatísticas', description: 'Impressões, cliques e conversões.', tab: 'reports', status: 'prepared' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notificações',
    description: 'Avisos segmentados, canais e preferências obrigatórias.',
    icon: Bell,
    tone: 'text-pink-500 bg-pink-500/10 border-pink-500/20',
    items: [
      { id: 'notifications-center', label: 'Centro de notificações', description: 'Emissão administrativa e preferências por papel.', tab: 'notifications', status: 'integrated' },
    ],
  },
  {
    id: 'support',
    label: 'Suporte',
    description: 'Pedidos de ajuda, respostas e acompanhamento de casos.',
    icon: MessageSquare,
    tone: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    items: [
      { id: 'support-center', label: 'Central de suporte', description: 'Fila de pedidos e respostas a utilizadores.', tab: 'support', status: 'integrated' },
    ],
  },
  {
    id: 'reports',
    label: 'Relatórios',
    description: 'Exportação e leitura executiva de utilizadores, empresas e plataforma.',
    icon: BarChart3,
    tone: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
    items: [
      { id: 'reports-users', label: 'Utilizadores', description: 'Crescimento e actividade de cidadãos.', tab: 'reports', status: 'integrated' },
      { id: 'reports-businesses', label: 'Empresas', description: 'Cadastro, planos e estados.', tab: 'reports', status: 'integrated' },
      { id: 'reports-events', label: 'Eventos', description: 'Agenda e estado de publicação; a bilhética detalhada fica com a empresa.', tab: 'reports', status: 'integrated' },
      { id: 'reports-finance', label: 'Financeiro', description: 'Receita, pagamentos e comissões.', tab: 'reports', status: 'integrated' },
      { id: 'reports-platform', label: 'Plataforma', description: 'Crescimento, actividade e auditoria.', tab: 'reports', status: 'integrated' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Inteligência',
    description: 'IA, fraude, spam e anomalias operacionais.',
    icon: Sparkles,
    tone: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    items: [
      { id: 'intelligence-ai', label: 'IA', description: 'Moderação assistida e classificação automática.', tab: 'moderation', status: 'integrated' },
      { id: 'intelligence-fraud', label: 'Fraude', description: 'Sinais de fraude em pagamentos e contas.', tab: 'financials', status: 'prepared' },
      { id: 'intelligence-spam', label: 'Spam', description: 'Padrões de abuso e conteúdo repetitivo.', tab: 'moderation', status: 'prepared' },
      { id: 'intelligence-anomalies', label: 'Anomalias', description: 'Indicadores fora do padrão esperado.', tab: 'architecture', status: 'prepared' },
    ],
  },
  {
    id: 'security',
    label: 'Segurança',
    description: 'Logs, sessões, 2FA, API keys e auditoria.',
    icon: ShieldCheck,
    tone: 'text-red-500 bg-red-500/10 border-red-500/20',
    items: [
      { id: 'security-logs', label: 'Logs', description: 'Registo cronológico de operações administrativas.', tab: 'audit_logs', status: 'integrated' },
      { id: 'security-sessions', label: 'Sessões', description: 'Sessões activas e revogação de acesso.', tab: 'architecture', status: 'prepared' },
      { id: 'security-2fa', label: '2FA', description: 'Políticas de autenticação forte para a equipa.', tab: 'admin_staff', status: 'integrated' },
      { id: 'security-api', label: 'API Keys', description: 'Credenciais técnicas e integrações externas.', tab: 'architecture', status: 'prepared' },
      { id: 'security-audit', label: 'Auditoria', description: 'Rastreabilidade, integridade e conformidade.', tab: 'audit_logs', status: 'integrated' },
    ],
  },
  {
    id: 'settings',
    label: 'Configurações',
    description: 'Definições transversais da plataforma e do sistema.',
    icon: Settings,
    tone: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
    items: [
      { id: 'settings-platform', label: 'Plataforma', description: 'Configurações gerais do portal.', tab: 'architecture', status: 'prepared' },
      { id: 'settings-users', label: 'Utilizadores', description: 'Políticas de contas e permissões.', tab: 'roles', status: 'integrated' },
      { id: 'settings-businesses', label: 'Empresas', description: 'Regras de cadastro e verificação.', tab: 'businesses', status: 'integrated' },
      { id: 'settings-payments', label: 'Pagamentos', description: 'Operadores, métodos e regras financeiras.', tab: 'financials', status: 'integrated' },
      { id: 'settings-notifications', label: 'Notificações', description: 'Categorias, canais e obrigatoriedade.', tab: 'notifications', status: 'integrated' },
      { id: 'settings-integrations', label: 'Integrações', description: 'SMS, APIs e serviços conectados.', tab: 'architecture', status: 'prepared' },
      { id: 'settings-system', label: 'Sistema', description: 'Estado técnico, PWA e continuidade.', tab: 'architecture', status: 'integrated' },
    ],
  },
  {
    id: 'backup',
    label: 'Backup',
    description: 'Backups, restauração e exportação de segurança.',
    icon: HardDrive,
    tone: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    items: [
      { id: 'backup-list', label: 'Backups', description: 'Execução e verificação de cópias.', tab: 'architecture', status: 'integrated' },
      { id: 'backup-restore', label: 'Restauração', description: 'Plano de recuperação e validação.', tab: 'architecture', status: 'prepared' },
      { id: 'backup-export', label: 'Exportação', description: 'Exportação administrativa de dados e relatórios.', tab: 'reports', status: 'integrated' },
    ],
  },
];

export const AdminCapabilityHub: React.FC<AdminCapabilityHubProps> = ({ onNavigateTab, currentLang = 'pt' as Language, dataSummary, dataPreview }) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [selectedId, setSelectedId] = useState('dashboard-home');
  const selected = useMemo(
    () => capabilityGroups.flatMap((group) => group.items).find((item) => item.id === selectedId) || capabilityGroups[0].items[0],
    [selectedId],
  );
  const selectedData = useMemo(() => {
    if (!dataSummary) return null;
    if (selected.id.startsWith('users-') || selected.id.startsWith('businesses-') || selected.id.startsWith('subscriptions-') || selected.id.startsWith('settings-businesses')) {
      return { label: 'Registos empresariais disponíveis', count: dataSummary.businesses, records: dataPreview?.businesses };
    }
    if (selected.id.startsWith('content-') || selected.id.startsWith('tickets-') || selected.id === 'reports-events') {
      return { label: 'Eventos disponíveis', count: dataSummary.events, records: dataPreview?.events };
    }
    if (selected.id.startsWith('moderation-') || selected.id.startsWith('intelligence-spam')) {
      return { label: 'Itens de moderação disponíveis', count: dataSummary.moderationItems, records: dataPreview?.moderation };
    }
    if (selected.id.startsWith('finance-') || selected.id.startsWith('subscriptions-payments')) {
      return { label: 'Transações disponíveis', count: dataSummary.paymentTransactions, records: dataPreview?.payments };
    }
    if (selected.id.startsWith('security-') || selected.id.startsWith('reports-platform')) {
      return { label: 'Registos de auditoria disponíveis', count: dataSummary.auditLogs, records: dataPreview?.auditLogs };
    }
    if (selected.id.startsWith('support-')) {
      return { label: 'Pedidos de suporte disponíveis', count: dataSummary.supportRequests, records: dataPreview?.support };
    }
    return null;
  }, [dataSummary, selected.id]);
  const integratedCount = capabilityGroups.flatMap((group) => group.items).filter((item) => item.status === 'integrated').length;
  const totalCount = capabilityGroups.flatMap((group) => group.items).length;

  const selectCapability = (item: CapabilityItem) => {
    setSelectedId(item.id);
  };

  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950 text-white shadow-2xl overflow-hidden">
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-950 via-emerald-950/50 to-slate-950 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Administração Guigui.com
            </div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-tight">{t('admin.capabilitiesMap')}</h2>
            <p className="mt-2 max-w-3xl text-xs sm:text-sm leading-relaxed text-slate-300">
              {t('admin.capabilitiesIntro')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 min-w-[210px]">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300">{t('admin.groups')}</div>
              <div className="mt-1 text-2xl font-black">{capabilityGroups.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{t('admin.capabilities')}</div>
              <div className="mt-1 text-2xl font-black">{integratedCount}<span className="text-sm text-slate-500">/{totalCount}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 sm:p-5">
          {capabilityGroups.map((group) => {
            const Icon = group.icon;
            const groupIntegrated = group.items.filter((item) => item.status === 'integrated').length;
            return (
              <div key={group.id} className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 hover:border-slate-700 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${group.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-black">{group.label}</h3>
                      <span className="text-[9px] font-bold text-slate-500">{groupIntegrated}/{group.items.length} integradas</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{group.description}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {group.items.map((item) => {
                    const isSelected = item.id === selectedId;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => selectCapability(item)}
                        className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${isSelected ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-transparent hover:border-slate-700 hover:bg-slate-800/80'}`}
                      >
                        {item.status === 'integrated' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <MoreHorizontal className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-200">{item.label}</span>
                        <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-emerald-300' : 'text-slate-600'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <aside className="border-t xl:border-t-0 xl:border-l border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-emerald-300">
            <Gauge className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.14em]">{t('admin.selectedCapability')}</span>
          </div>
          <h3 className="mt-3 text-xl font-black">{selected.label}</h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{selected.description}</p>
          <div className={`mt-5 rounded-2xl border p-3 ${selected.status === 'integrated' ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-amber-500/25 bg-amber-500/10'}`}>
            <div className="flex items-center gap-2 text-xs font-black">
              {selected.status === 'integrated' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <MoreHorizontal className="h-4 w-4 text-amber-400" />}
              {selected.status === 'integrated' ? t('admin.integratedPreview') : t('admin.preparedArea')}
            </div>
          {selectedData && (
             <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/60 p-3">
               <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Dados atuais do sistema</div>
               <div className="mt-1 flex items-baseline justify-between gap-3">
                 <span className="text-[10px] text-slate-300">{selectedData.label}</span>
                 <span className="text-lg font-black text-white">{selectedData.count}</span>
               </div>
               {selectedData.records && selectedData.records.length > 0 && (
                 <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
                   {selectedData.records.map((record) => (
                     <div key={`${record.label}-${record.status || 'record'}`} className="flex items-center justify-between gap-2 text-[10px]">
                       <span className="truncate text-slate-300">{record.label}</span>
                       {record.status && <span className="shrink-0 text-slate-500">{record.status}</span>}
                     </div>
                   ))}
                 </div>
               )}
             </div>
          )}
          {dataSummary && (
             <div className="mt-3 grid grid-cols-2 gap-2">
               {[
                 [t('admin.businesses'), dataSummary.businesses],
                 [t('admin.activeBusinesses'), dataSummary.activeBusinesses],
                 [t('admin.events'), dataSummary.events],
                 [t('admin.audit'), dataSummary.auditLogs],
               ].map(([label, count]) => (
                 <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/40 px-2.5 py-2">
                   <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</div>
                   <div className="mt-0.5 text-base font-black text-slate-100">{count}</div>
                 </div>
               ))}
             </div>
          )}
            <p className="mt-2 text-[10px] leading-relaxed text-slate-300">
              {selected.status === 'integrated'
                ? t('admin.integratedHint')
                : t('admin.preparedHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => selected.tab && onNavigateTab(selected.tab)}
            disabled={!selected.tab}
            className="mt-5 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('admin.openModule')} <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mt-6 border-t border-slate-800 pt-4 text-[10px] leading-relaxed text-slate-500">
            <div className="flex items-center gap-2 text-slate-300 font-bold"><Search className="h-3.5 w-3.5" /> Navegação sem becos sem saída</div>
            <p className="mt-1">Os separadores existentes continuam disponíveis abaixo do mapa; áreas ainda preparadas estão identificadas em vez de fingirem dados que ainda não existem.</p>
          </div>
        </aside>
      </div>
    </section>
  );
};
