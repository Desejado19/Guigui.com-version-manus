import {
  BarChart3,
  Building2,
  Calendar,
  CreditCard,
  Download,
  FileText,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  ShieldCheck,
  Star,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Registo dos módulos do Painel da Empresa (como `adminModules` na Admin).
 *
 * Fonte única da navegação lateral: grupos, módulos, descrição + ícone e a
 * ligação a um `tab` executável no `BusinessDashboard`. Cada submódulo
 * só é declarado quando há conteúdo real — sem tabs decorativas.
 */
export interface BusinessSubmodule {
  id: string;
  label: string;
}

export interface BusinessModuleDefinition {
  id: string;
  tab: string;
  label: string;
  help: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
  submodules: BusinessSubmodule[];
}

export const BUSINESS_MODULE_GROUPS: Array<{ id: string; label: string; moduleIds: string[] }> = [
  { id: 'principal', label: 'Principal', moduleIds: ['overview'] },
  {
    id: 'gestao',
    label: 'Gestão da empresa',
    moduleIds: ['my_business', 'content', 'events', 'reviews', 'marketing'],
  },
  {
    id: 'vendas',
    label: 'Vendas e finanças',
    moduleIds: ['tickets', 'order_history', 'payouts', 'clients', 'billing'],
  },
  { id: 'administracao', label: 'Administração', moduleIds: ['team'] },
  {
    id: 'assistencia',
    label: 'Assistência e segurança',
    moduleIds: ['support', 'reports', 'security', 'export', 'settings'],
  },
];

export const BUSINESS_MODULES: BusinessModuleDefinition[] = [
  {
    id: 'overview',
    tab: 'overview',
    label: 'Visão Geral',
    help: 'Resumo do negócio',
    description: 'Vendas, receita, eventos, pedidos pendentes e desempenho comercial da empresa.',
    icon: LayoutDashboard,
    group: 'principal',
    submodules: [{ id: 'resumo', label: 'Resumo' }],
  },
  {
    id: 'my_business',
    tab: 'my_business',
    label: 'Minha Empresa',
    help: 'Perfil e contactos',
    description: 'Identidade, contactos, localização, horários e estado de verificação da empresa.',
    icon: Building2,
    group: 'gestao',
    submodules: [{ id: 'perfil', label: 'Perfil' }],
  },
  {
    id: 'content',
    tab: 'content',
    label: 'Conteúdo',
    help: 'Publicações e agendamentos',
    description: 'Publicações da empresa, conteúdos agendados, em moderação e rejeitados.',
    icon: FileText,
    group: 'gestao',
    submodules: [
      { id: 'content_publicados', label: 'Publicações' },
      { id: 'content_agendados', label: 'Agendados' },
      { id: 'content_moderacao', label: 'Em moderação' },
      { id: 'content_rejeitados', label: 'Rejeitados' },
    ],
  },
  {
    id: 'events',
    tab: 'events',
    label: 'Eventos',
    help: 'Agenda e bilhetes',
    description: 'Eventos da empresa, lotação, bilhetes e estado de publicação.',
    icon: Calendar,
    group: 'gestao',
    submodules: [{ id: 'todos', label: 'Todos' }],
  },
  {
    id: 'reviews',
    tab: 'reviews',
    label: 'Avaliações',
    help: 'Feedback de clientes',
    description: 'Classificações recebidas e respostas da empresa.',
    icon: Star,
    group: 'gestao',
    submodules: [
      { id: 'reviews_todas', label: 'Todas' },
      { id: 'reviews_sem_resposta', label: 'Não respondidas' },
      { id: 'reviews_respondidas', label: 'Respondidas' },
    ],
  },
  {
    id: 'marketing',
    tab: 'marketing',
    label: 'Marketing',
    help: 'Campanhas e promoções',
    description: 'Campanhas, promoções, público-alvo e calendário de publicação.',
    icon: Megaphone,
    group: 'gestao',
    submodules: [
      { id: 'campanhas', label: 'Campanhas' },
      { id: 'promocoes', label: 'Promoções' },
      { id: 'publico', label: 'Público-alvo' },
      { id: 'calendario', label: 'Calendário' },
    ],
  },
  {
    id: 'tickets',
    tab: 'tickets',
    label: 'Bilhetes',
    help: 'Vendas e validação',
    description: 'Bilhetes emitidos, vendidos, utilizados e cancelados, com validação por código.',
    icon: Ticket,
    group: 'vendas',
    submodules: [
      { id: 'tickets_todos', label: 'Todos' },
      { id: 'tickets_disponiveis', label: 'Disponíveis' },
      { id: 'tickets_vendidos', label: 'Vendidos' },
      { id: 'tickets_cancelados', label: 'Cancelados' },
    ],
  },
  {
    id: 'order_history',
    tab: 'order_history',
    label: 'Histórico de pedidos',
    help: 'Encomendas recebidas',
    description: 'Pedidos recebidos, estado de pagamento e detalhe de cada encomenda.',
    icon: History,
    group: 'vendas',
    submodules: [
      { id: 'order_todos', label: 'Todos' },
      { id: 'order_pendentes', label: 'Pendentes' },
      { id: 'order_confirmados', label: 'Confirmados' },
      { id: 'order_cancelados', label: 'Cancelados' },
    ],
  },
  {
    id: 'payouts',
    tab: 'payouts',
    label: 'Levantamentos',
    help: 'Saldo e transferências',
    description: 'Saldo disponível a partir das vendas confirmadas e pedidos de levantamento.',
    icon: Wallet,
    group: 'vendas',
    submodules: [
      { id: 'payouts_saldo', label: 'Saldo disponível' },
      { id: 'payouts_solicitacoes', label: 'Solicitações' },
      { id: 'payouts_historico', label: 'Histórico' },
    ],
  },
  {
    id: 'clients',
    tab: 'clients',
    label: 'Clientes',
    help: 'Base de clientes',
    description: 'Clientes com compras registadas, número de pedidos e última atividade.',
    icon: Users,
    group: 'vendas',
    submodules: [
      { id: 'todos', label: 'Todos' },
      { id: 'recorrentes', label: 'Recorrentes' },
    ],
  },
  {
    id: 'billing',
    tab: 'billing',
    label: 'Faturação',
    help: 'Plano e documentos',
    description: 'Subscrição da empresa, limites do plano e documentos de cobrança.',
    icon: CreditCard,
    group: 'vendas',
    submodules: [{ id: 'plano', label: 'Plano' }],
  },
  {
    id: 'team',
    tab: 'team',
    label: 'Equipa e permissões',
    help: 'Membros e acessos',
    description: 'Membros da equipa, funções atribuídas e permissões por módulo.',
    icon: Users,
    group: 'administracao',
    submodules: [{ id: 'membros', label: 'Membros' }],
  },
  {
    id: 'support',
    tab: 'support',
    label: 'Suporte',
    help: 'Pedidos e respostas',
    description: 'Pedidos de suporte abertos pela empresa e respostas da administração.',
    icon: LifeBuoy,
    group: 'assistencia',
    submodules: [
      { id: 'todos', label: 'Todos' },
      { id: 'abertos', label: 'Abertos' },
      { id: 'analise', label: 'Em análise' },
      { id: 'resolvidos', label: 'Resolvidos' },
    ],
  },
  {
    id: 'reports',
    tab: 'reports',
    label: 'Relatórios',
    help: 'Indicadores e desempenho',
    description: 'Indicadores comerciais, financeiros, de clientes, eventos, marketing, operações e equipa.',
    icon: BarChart3,
    group: 'assistencia',
    submodules: [
      { id: 'comercial', label: 'Comercial' },
      { id: 'financeiro', label: 'Financeiro' },
      { id: 'clientes', label: 'Clientes' },
      { id: 'eventos', label: 'Eventos e bilhetes' },
      { id: 'marketing', label: 'Marketing' },
      { id: 'operacoes', label: 'Operações' },
      { id: 'equipa', label: 'Equipa' },
    ],
  },
  {
    id: 'security',
    tab: 'security',
    label: 'Segurança',
    help: 'Palavra-passe e sessões',
    description: 'Palavra-passe, sessões ativas, histórico de acessos e alertas da conta empresarial.',
    icon: ShieldCheck,
    group: 'assistencia',
    submodules: [
      { id: 'protecao', label: 'Proteção da conta' },
      { id: 'sessoes', label: 'Sessões' },
      { id: 'historico', label: 'Histórico' },
      { id: 'alertas', label: 'Alertas' },
    ],
  },
  {
    id: 'settings',
    tab: 'settings',
    label: 'Configurações da conta',
    help: 'Preferências e conta',
    description: 'Preferências de notificação e dados de contacto da conta.',
    icon: KeyRound,
    group: 'assistencia',
    submodules: [{ id: 'conta', label: 'Conta' }],
  },
  {
    id: 'export',
    tab: 'export',
    label: 'Exportação',
    help: 'Exportar dados',
    description: 'Exportação de vendas, clientes, bilhetes e relatórios em CSV, Excel e PDF.',
    icon: Download,
    group: 'assistencia',
    submodules: [{ id: 'dados', label: 'Dados' }],
  },
];

export function findBusinessModule(id: string): BusinessModuleDefinition | undefined {
  return BUSINESS_MODULES.find((module) => module.id === id || module.tab === id);
}

export const BUSINESS_MODULE_KPI_ICON = LayoutDashboard;
