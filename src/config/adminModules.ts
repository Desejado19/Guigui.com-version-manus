import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  History,
  MessageSquare,
  Server,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Ticket,
  UserCheck,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Registo dos módulos do Painel de Administração.
 *
 * Cada módulo abre uma página própria: cabeçalho (título + descrição),
 * indicadores, navegação horizontal por submódulos e o conteúdo da secção.
 * O `id` coincide com a tab histórica do AdminDashboard para que nenhuma
 * funcionalidade existente seja perdida na reorganização.
 *
 * A ordem do array é a ordem apresentada no menu lateral e segue a hierarquia
 * do painel: Dashboard → Gestão → Financeiro → Controlo → Suporte →
 * Administração → Segurança.
 *
 * Só entram aqui submódulos com conteúdo real implementado — não há separadores
 * decorativos nem vistas de demonstração.
 */

export type AdminModuleId =
  | 'overview'
  | 'businesses'
  | 'events'
  | 'users'
  | 'financials'
  | 'pricing'
  | 'moderation'
  | 'reports'
  | 'support'
  | 'notifications'
  | 'roles'
  | 'admin_staff'
  | 'categories'
  | 'architecture'
  | 'audit_logs'
  | 'quality_audit';

export interface AdminSubmodule {
  id: string;
  label: string;
  description?: string;
}

export interface AdminModuleDefinition {
  id: AdminModuleId;
  label: string;
  /** Descrição curta mostrada na sidebar. */
  help: string;
  /** Descrição completa mostrada no cabeçalho da página. */
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Grupo da sidebar. */
  group: string;
  submodules: AdminSubmodule[];
}

export const ADMIN_MODULES: AdminModuleDefinition[] = [
  {
    id: 'overview',
    label: 'Visão Geral',
    help: 'Resumo executivo e KPIs',
    description:
      'Centro de controlo da plataforma: desempenho, atividade recente e tudo o que exige decisão.',
    icon: Activity,
    group: 'Dashboard',
    submodules: [
      { id: 'overview', label: 'Resumo', description: 'Resumo executivo da plataforma.' },
      { id: 'indicators', label: 'Indicadores', description: 'Métricas de desempenho por área.' },
      { id: 'activity', label: 'Atividade recente', description: 'Últimas operações registadas.' },
      { id: 'alerts', label: 'Alertas e pendências', description: 'Itens que aguardam decisão administrativa.' },
    ],
  },
  {
    id: 'businesses',
    label: 'Empresas e Negócios',
    help: 'Candidaturas e desempenho',
    description:
      'Candidaturas, empresas ativas, planos e desempenho comercial de cada negócio registado.',
    icon: Building2,
    group: 'Gestão',
    submodules: [
      { id: 'all', label: 'Todas' },
      { id: 'pending', label: 'Pendentes' },
      { id: 'active', label: 'Aprovadas' },
      { id: 'rejected', label: 'Rejeitadas' },
      { id: 'suspended', label: 'Suspensas' },
    ],
  },
  {
    id: 'events',
    label: 'Eventos e Bilhetes',
    help: 'Agenda e bilheteira',
    description:
      'Agenda cultural, aprovação de eventos, bilheteira emitida e desempenho de vendas.',
    icon: Ticket,
    group: 'Gestão',
    // O filtro por estado dos eventos já existe dentro do módulo (chips com
    // contagem); não se duplica aqui para não haver duas navegações iguais.
    submodules: [],
  },
  {
    id: 'users',
    label: 'Utilizadores',
    help: 'Contas e histórico',
    description:
      'Contas de cidadãos, empresas e equipas, com histórico de atividade e controlo de acesso.',
    icon: Users,
    group: 'Gestão',
    submodules: [],
  },
  {
    id: 'financials',
    label: 'Financeiro',
    help: 'Vendas e pagamentos',
    description:
      'Vendas, transações, comissões, pagamentos a empresas e reconciliação.',
    icon: DollarSign,
    group: 'Financeiro',
    submodules: [],
  },
  {
    id: 'pricing',
    label: 'Planos e Assinaturas',
    help: 'Planos e consumo',
    description:
      'Planos comerciais, funcionalidades incluídas, consumo e governação de preços.',
    icon: CreditCard,
    group: 'Financeiro',
    submodules: [],
  },
  {
    id: 'moderation',
    label: 'Moderação',
    help: 'Fila e decisões',
    description:
      'Fila de conteúdo submetido, decisões tomadas e histórico completo de moderação.',
    icon: ShieldAlert,
    group: 'Controlo',
    // A fila de moderação tem os seus próprios filtros (estado, tipo, empresa,
    // datas) dentro do módulo; a barra de submódulos duplicaria essa navegação.
    submodules: [],
  },
  {
    id: 'reports',
    label: 'Relatórios',
    help: 'Indicadores e exportação',
    description:
      'Relatórios operacionais e financeiros com filtros por período e exportação.',
    icon: BarChart3,
    group: 'Controlo',
    submodules: [],
  },
  {
    id: 'support',
    label: 'Suporte',
    help: 'Pedidos e respostas',
    description:
      'Pedidos de clientes e empresas, respostas da administração e estado de resolução.',
    icon: MessageSquare,
    group: 'Suporte',
    submodules: [],
  },
  {
    id: 'notifications',
    label: 'Notificações em massa',
    help: 'Comunicações segmentadas',
    description:
      'Envio de comunicações segmentadas e preferências de notificação da plataforma.',
    icon: Bell,
    group: 'Suporte',
    submodules: [],
  },
  {
    id: 'roles',
    label: 'Permissões',
    help: 'Funções e acessos',
    description:
      'Funções administrativas, matriz de acessos e políticas aplicadas a cada cargo.',
    icon: ShieldCheck,
    group: 'Administração',
    submodules: [],
  },
  {
    id: 'admin_staff',
    label: 'Equipa',
    help: 'Administradores e funções',
    description:
      'Administradores e funcionários, convites, funções e histórico de atividade.',
    icon: UserCheck,
    group: 'Administração',
    submodules: [],
  },
  {
    id: 'categories',
    label: 'Categorias e Etiquetas',
    help: 'Taxonomia da plataforma',
    description:
      'Categorias de eventos e empresas, subcategorias, ícones e ordenação no diretório.',
    icon: Tag,
    group: 'Administração',
    submodules: [],
  },
  {
    id: 'architecture',
    label: 'Sistema',
    help: 'Serviços e infraestrutura',
    description:
      'Estado dos serviços, base de dados, filas, integrações e incidentes registados.',
    icon: Server,
    group: 'Administração',
    submodules: [
      { id: 'overview', label: 'Visão Geral', description: 'Saúde global da plataforma.' },
      { id: 'infrastructure', label: 'Infraestrutura', description: 'Componentes e serviços reais.' },
      { id: 'resources', label: 'Recursos & Capacidade', description: 'CPU, memória, disco e armazenamento.' },
      { id: 'database', label: 'Base de Dados', description: 'PostgreSQL, tabelas, locks e backups.' },
      { id: 'apis', label: 'APIs & Integrações', description: 'Rotas e integrações externas.' },
      { id: 'incidents', label: 'Incidentes & Alertas', description: 'Deteção, gestão e resolução.' },
      { id: 'logs', label: 'Logs & Diagnóstico', description: 'Pesquisa e correlação técnica.' },
      { id: 'availability', label: 'Disponibilidade', description: 'Uptime, incidentes e SLO.' },
      { id: 'security', label: 'Segurança & Auditoria', description: 'Eventos de autenticação e autorização.' },
      { id: 'settings', label: 'Configurações', description: 'Intervalos, limites, retenção e SLO.' },
    ],
  },
  {
    id: 'audit_logs',
    label: 'Auditoria',
    help: 'Registos de atividade',
    description:
      'Registo imutável de ações administrativas, autenticações e eventos de segurança.',
    icon: History,
    group: 'Segurança',
    submodules: [],
  },
  {
    id: 'quality_audit',
    label: 'Auditoria e Qualidade',
    help: 'Testes e correções',
    description:
      'Execuções de testes, problemas encontrados, correções e retestes do sistema.',
    icon: ClipboardCheck,
    group: 'Segurança',
    submodules: [],
  },
];

export const ADMIN_MODULE_GROUPS: string[] = ADMIN_MODULES.reduce<string[]>((groups, module) => {
  if (!groups.includes(module.group)) groups.push(module.group);
  return groups;
}, []);

export function findAdminModule(id: string): AdminModuleDefinition | undefined {
  return ADMIN_MODULES.find((module) => module.id === id);
}
