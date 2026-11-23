/**
 * Catálogo central de acessos do Guigui.com.
 *
 * Fonte única para a matriz de permissões usada por empresas e administração:
 * módulos, acções granulares, funções predefinidas e funções de verificação.
 * O servidor importa este ficheiro para autorizar pedidos, por isso aqui não
 * podem existir ícones, JSX nem dependências de browser.
 */

export type TeamAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'export'
  | 'manage';

export const TEAM_ACTIONS: TeamAction[] = [
  'view',
  'create',
  'edit',
  'delete',
  'approve',
  'reject',
  'publish',
  'export',
  'manage',
];

export const TEAM_ACTION_LABELS: Record<TeamAction, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Eliminar',
  approve: 'Aprovar',
  reject: 'Rejeitar',
  publish: 'Publicar',
  export: 'Exportar',
  manage: 'Gerir configurações',
};

/** Módulos do painel empresarial, com as acções que cada um suporta. */
export const BUSINESS_ACCESS_MODULES: Array<{ id: string; label: string; actions: TeamAction[] }> = [
  { id: 'overview', label: 'Visão Geral', actions: ['view'] },
  { id: 'my_business', label: 'Minha Empresa', actions: ['view', 'edit'] },
  { id: 'stories', label: 'Stories', actions: ['view', 'create', 'delete', 'publish'] },
  { id: 'content', label: 'Conteúdo', actions: ['view', 'create', 'edit', 'delete', 'publish'] },
  { id: 'events', label: 'Eventos', actions: ['view', 'create', 'edit', 'delete', 'publish'] },
  { id: 'reviews', label: 'Avaliações', actions: ['view', 'edit', 'reject'] },
  { id: 'marketing', label: 'Marketing', actions: ['view', 'create', 'edit', 'delete', 'publish'] },
  { id: 'tickets', label: 'Bilhetes', actions: ['view', 'create', 'edit', 'delete', 'approve', 'reject'] },
  { id: 'order_history', label: 'Histórico de pedidos', actions: ['view', 'edit', 'export'] },
  { id: 'redemptions', label: 'Levantamentos e entregas', actions: ['view', 'approve', 'reject'] },
  { id: 'payouts', label: 'Levantamentos', actions: ['view', 'create', 'approve', 'reject'] },
  { id: 'clients', label: 'Clientes', actions: ['view', 'edit', 'export'] },
  { id: 'billing', label: 'Facturação', actions: ['view', 'edit', 'export'] },
  { id: 'team', label: 'Equipa e permissões', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { id: 'security', label: 'Segurança', actions: ['view', 'manage'] },
  { id: 'reports', label: 'Relatórios', actions: ['view', 'export'] },
  { id: 'export', label: 'Exportação', actions: ['view', 'export'] },
  { id: 'support', label: 'Suporte', actions: ['view', 'create', 'edit'] },
];

/** Módulos do painel administrativo. */
export const ADMIN_ACCESS_MODULES: Array<{ id: string; label: string; actions: TeamAction[] }> = [
  { id: 'overview', label: 'Visão Geral', actions: ['view'] },
  { id: 'businesses', label: 'Empresas e Negócios', actions: ['view', 'edit', 'approve', 'reject'] },
  { id: 'events', label: 'Eventos e Bilhetes', actions: ['view', 'edit', 'approve', 'reject'] },
  { id: 'users', label: 'Utilizadores', actions: ['view', 'edit', 'delete'] },
  { id: 'financials', label: 'Financeiro', actions: ['view', 'approve', 'reject', 'export'] },
  { id: 'pricing', label: 'Planos e Assinaturas', actions: ['view', 'edit', 'manage'] },
  { id: 'moderation', label: 'Moderação', actions: ['view', 'approve', 'reject'] },
  { id: 'reports', label: 'Relatórios', actions: ['view', 'export'] },
  { id: 'support', label: 'Suporte', actions: ['view', 'edit'] },
  { id: 'external_email', label: 'Email externo', actions: ['view', 'create'] },
  { id: 'notifications', label: 'Notificações em massa', actions: ['view', 'create', 'publish'] },
  { id: 'roles', label: 'Permissões', actions: ['view', 'edit', 'manage'] },
  { id: 'admin_staff', label: 'Equipa', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  { id: 'categories', label: 'Categorias e Etiquetas', actions: ['view', 'create', 'edit', 'delete'] },
  { id: 'architecture', label: 'Sistema', actions: ['view', 'manage'] },
  { id: 'capabilities', label: 'Configurações Globais', actions: ['view', 'edit', 'manage'] },
  { id: 'audit_logs', label: 'Auditoria', actions: ['view', 'export'] },
  { id: 'quality_audit', label: 'Auditoria e Qualidade', actions: ['view', 'edit'] },
];

/** Mapa de módulos → acções concedidas. A presença do módulo é a autorização de acesso. */
export type TeamModuleAccess = Record<string, TeamAction[]>;

export interface TeamAccessPreset {
  id: string;
  label: string;
  description: string;
  access: TeamModuleAccess;
}

function accessFromModuleIds(
  modules: string[],
  catalogue: Array<{ id: string; actions: TeamAction[] }>,
): TeamModuleAccess {
  const access: TeamModuleAccess = {};
  catalogue.forEach((module) => {
    if (modules.includes(module.id)) access[module.id] = [...module.actions];
  });
  return access;
}

const business = (modules: string[]) => accessFromModuleIds(modules, BUSINESS_ACCESS_MODULES);
const admin = (modules: string[]) => accessFromModuleIds(modules, ADMIN_ACCESS_MODULES);

export const BUSINESS_ACCESS_PRESETS: TeamAccessPreset[] = [
  {
    id: 'manager',
    label: 'Gestor',
    description: 'Todos os módulos operacionais, sem gestão de equipa nem exportação financeira.',
    access: business(['overview', 'my_business', 'stories', 'content', 'events', 'reviews', 'marketing', 'tickets', 'order_history', 'redemptions', 'clients', 'reports', 'support']),
  },
  {
    id: 'finance',
    label: 'Financeiro',
    description: 'Facturação, levantamentos, relatórios e exportação financeira.',
    access: business(['overview', 'billing', 'payouts', 'order_history', 'reports', 'export']),
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Stories, conteúdo, campanhas, avaliações e relatórios de marketing.',
    access: business(['overview', 'stories', 'content', 'marketing', 'reviews', 'reports']),
  },
  {
    id: 'events',
    label: 'Gestor de eventos',
    description: 'Eventos, bilhetes, validação de entradas e histórico de pedidos.',
    access: business(['overview', 'events', 'tickets', 'order_history', 'redemptions']),
  },
  {
    id: 'support',
    label: 'Atendimento ao cliente',
    description: 'Clientes, suporte e leitura de pedidos para responder a dúvidas.',
    access: business(['overview', 'clients', 'support', 'order_history']),
  },
  {
    id: 'custom',
    label: 'Colaborador personalizado',
    description: 'Escolha manualmente os módulos e as acções permitidas.',
    access: {},
  },
];

export const ADMIN_ACCESS_PRESETS: TeamAccessPreset[] = [
  {
    id: 'general',
    label: 'Administrador geral',
    description: 'Acesso completo a todos os módulos administrativos.',
    access: admin(ADMIN_ACCESS_MODULES.map((module) => module.id)),
  },
  {
    id: 'operations',
    label: 'Gestor de operações',
    description: 'Empresas, eventos, utilizadores e moderação.',
    access: admin(['overview', 'businesses', 'events', 'users', 'moderation', 'reports', 'support']),
  },
  {
    id: 'moderator',
    label: 'Moderador',
    description: 'Fila de moderação, empresas e eventos.',
    access: admin(['overview', 'moderation', 'businesses', 'events']),
  },
  {
    id: 'finance',
    label: 'Gestor financeiro',
    description: 'Financeiro, planos, relatórios e exportação.',
    access: admin(['overview', 'financials', 'pricing', 'reports']),
  },
  {
    id: 'support',
    label: 'Gestor de suporte',
    description: 'Suporte, notificações e leitura de utilizadores.',
    access: admin(['overview', 'support', 'notifications', 'users']),
  },
  {
    id: 'analyst',
    label: 'Analista',
    description: 'Relatórios, auditoria e visão geral em modo de leitura.',
    access: admin(['overview', 'reports', 'audit_logs', 'financials']),
  },
  {
    id: 'staff',
    label: 'Colaborador administrativo',
    description: 'Escolha manualmente os módulos e as acções permitidas.',
    access: {},
  },
];

function sanitizeActions(actions: unknown, allowed: TeamAction[]): TeamAction[] {
  if (!Array.isArray(actions)) return [];
  const unique = Array.from(new Set(actions.filter((action): action is TeamAction => TEAM_ACTIONS.includes(action as TeamAction))));
  return unique.filter((action) => allowed.includes(action));
}

/** Valida e normaliza um mapa de módulos → acções contra o catálogo do âmbito. */
export function normalizeTeamAccess(
  input: unknown,
  scope: 'business' | 'admin',
): TeamModuleAccess {
  const catalogue = scope === 'admin' ? ADMIN_ACCESS_MODULES : BUSINESS_ACCESS_MODULES;
  const result: TeamModuleAccess = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  catalogue.forEach((module) => {
    const raw = (input as Record<string, unknown>)[module.id];
    if (!raw) return;
    const actions = sanitizeActions(raw, module.actions);
    if (actions.includes('view')) result[module.id] = actions;
  });
  return result;
}

export function grantedModules(access: TeamModuleAccess | undefined | null): string[] {
  if (!access) return [];
  return Object.keys(access).filter((module) => Array.isArray(access[module]) && access[module].includes('view'));
}

export function hasModuleAccess(access: TeamModuleAccess | undefined | null, module: string): boolean {
  return grantedModules(access).includes(module);
}

export function canPerformAction(
  access: TeamModuleAccess | undefined | null,
  module: string,
  action: TeamAction = 'view',
): boolean {
  if (!access) return false;
  const actions = access[module];
  if (!Array.isArray(actions) || !actions.includes('view')) return false;
  return actions.includes(action);
}

/** Converte o acesso por módulos nas antigas chaves booleanas (compatibilidade). */
export function legacyPermissionsFromAccess(access: TeamModuleAccess | undefined | null): {
  profile: boolean;
  content: boolean;
  events: boolean;
  tickets: boolean;
  billing: boolean;
} {
  return {
    profile: hasModuleAccess(access, 'my_business'),
    content: hasModuleAccess(access, 'content') || hasModuleAccess(access, 'stories'),
    events: hasModuleAccess(access, 'events'),
    tickets: hasModuleAccess(access, 'tickets'),
    billing: hasModuleAccess(access, 'billing'),
  };
}

/** Converte as antigas permissões booleanas num mapa de módulos. */
export function accessFromLegacyPermissions(permissions: {
  profile?: boolean;
  content?: boolean;
  events?: boolean;
  tickets?: boolean;
  billing?: boolean;
} | undefined | null): TeamModuleAccess {
  const access: TeamModuleAccess = { overview: ['view'] };
  if (!permissions) return access;
  if (permissions.profile) access.my_business = ['view', 'edit'];
  if (permissions.content) {
    access.content = ['view', 'create', 'edit', 'publish'];
    access.stories = ['view', 'create', 'publish'];
    access.reviews = ['view', 'edit'];
  }
  if (permissions.events) {
    access.events = ['view', 'create', 'edit', 'publish'];
    access.tickets = ['view', 'create', 'edit'];
    access.order_history = ['view'];
    access.redemptions = ['view', 'approve'];
  }
  if (permissions.tickets) {
    access.tickets = ['view', 'create', 'edit', 'approve', 'reject'];
    access.order_history = ['view'];
    access.redemptions = ['view', 'approve', 'reject'];
  }
  if (permissions.billing) {
    access.billing = ['view', 'export'];
    access.payouts = ['view', 'create'];
    access.reports = ['view', 'export'];
    access.export = ['view', 'export'];
  }
  return access;
}

export function accessPresetById(
  scope: 'business' | 'admin',
  id: string,
): TeamAccessPreset | undefined {
  const presets = scope === 'admin' ? ADMIN_ACCESS_PRESETS : BUSINESS_ACCESS_PRESETS;
  return presets.find((preset) => preset.id === id);
}
