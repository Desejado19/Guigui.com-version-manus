import { BusinessTeamMember, BusinessTeamRole, TeamAction, TeamModuleAccess, UserProfile } from '../types';
import { accessFromLegacyPermissions, canPerformAction, hasModuleAccess, legacyPermissionsFromAccess } from '../config/teamAccess';

export type BusinessPermission = keyof BusinessTeamMember['permissions'];

/** Tab do painel → módulo de acesso (ver `config/teamAccess`). */
export const BUSINESS_TAB_ACCESS_MODULE: Record<string, string> = {
  overview: 'overview',
  my_business: 'my_business',
  stories: 'stories',
  posts: 'content',
  promotions: 'content',
  content: 'content',
  events: 'events',
  reviews: 'reviews',
  marketing: 'marketing',
  marketing_campaigns: 'marketing',
  marketing_calendar: 'marketing',
  tickets: 'tickets',
  order_history: 'order_history',
  redemptions: 'redemptions',
  payouts: 'payouts',
  clients: 'clients',
  billing: 'billing',
  pricing: 'billing',
  team: 'team',
  security: 'security',
  reports: 'reports',
  analytics: 'reports',
  export: 'export',
  support: 'support',
  communications: 'support',
  notifications: 'overview',
  settings: 'security',
};

/**
 * Acesso efectivo do utilizador autenticado na empresa.
 * `null` significa acesso total (conta titular da empresa).
 */
export function effectiveBusinessAccess(
  user: UserProfile | null | undefined,
  businessId: string,
  members: BusinessTeamMember[] = [],
): TeamModuleAccess | null {
  if (!user || user.role !== 'business' || user.businessId !== businessId) return {};
  if (user.teamAccess) return user.teamAccess;
  if (user.teamPermissions) return accessFromLegacyPermissions(user.teamPermissions);
  const member = getBusinessMember(user, businessId, members);
  if (!member) return null;
  if (member.access) return member.access;
  if (member.role in BUSINESS_ROLE_PERMISSIONS) return accessFromLegacyPermissions(member.permissions);
  return accessFromLegacyPermissions(member.permissions);
}

export function canAccessBusinessModule(
  user: UserProfile | null | undefined,
  businessId: string,
  members: BusinessTeamMember[],
  module: string,
): boolean {
  const access = effectiveBusinessAccess(user, businessId, members);
  return access === null || hasModuleAccess(access, module);
}

export function canPerformBusinessAction(
  user: UserProfile | null | undefined,
  businessId: string,
  members: BusinessTeamMember[],
  module: string,
  action: TeamAction = 'view',
): boolean {
  const access = effectiveBusinessAccess(user, businessId, members);
  return access === null || canPerformAction(access, module, action);
}

/** Permissões legadas derivadas do acesso granular (para os ecrãs antigos). */
export function legacyPermissionsForAccess(access: TeamModuleAccess | null): BusinessTeamMember['permissions'] {
  if (!access) return { profile: true, content: true, events: true, tickets: true, billing: true };
  return legacyPermissionsFromAccess(access);
}

/** Permissões por role de membro da equipa da empresa. */
export const BUSINESS_ROLE_PERMISSIONS: Record<BusinessTeamRole, BusinessTeamMember['permissions']> = {
  manager: { profile: true, content: true, events: true, tickets: true, billing: true },
  editor: { profile: true, content: true, events: true, tickets: false, billing: false },
  finance: { profile: false, content: false, events: false, tickets: true, billing: true },
  support: { profile: false, content: false, events: false, tickets: true, billing: false },
};

export function getBusinessMember(
  user: UserProfile,
  businessId: string,
  members: BusinessTeamMember[],
): BusinessTeamMember | undefined {
  if (user.businessId !== businessId || !user.email) return undefined;
  return members.find((member) => member.businessId === businessId && member.email.toLowerCase() === user.email?.toLowerCase());
}

/** Owners (business accounts without a matching team member) retain unrestricted access. */
export function hasBusinessPermission(
  user: UserProfile,
  businessId: string,
  members: BusinessTeamMember[],
  permission: BusinessPermission,
): boolean {
  if (user.role !== 'business' || user.businessId !== businessId) return false;
  if (user.teamPermissions) return user.teamPermissions[permission] === true;
  const member = getBusinessMember(user, businessId, members);
  if (!member) return true;
  return member.status === 'active' && member.permissions[permission] === true;
}

export const BUSINESS_TAB_PERMISSIONS: Record<string, BusinessPermission> = {
  my_business: 'profile',
  stories: 'content',
  posts: 'content',
  promotions: 'content',
  reviews: 'content',
  events: 'events',
  tickets: 'tickets',
  order_history: 'tickets',
  redemptions: 'tickets',
  billing: 'billing',
  analytics: 'profile',
  export: 'profile',
  settings: 'profile',
  team: 'profile',
  overview: 'profile',
  notifications: 'profile',
  communications: 'profile',
  support: 'profile',
};

/** Permissões de stories por role de utilizador */
export type StoryRole = 'citizen' | 'business' | 'admin';

/** Verifica se o utilizador pode criar stories */
export function canCreateStories(currentUser?: UserProfile | null, currentRole?: StoryRole | null): boolean {
  // Admin pode sempre criar
  if (currentRole === 'admin') return true;
  // Business pode criar (verificação de subscription feita no caller)
  if (currentRole === 'business' && currentUser) return true;
  // Cidadão não pode criar stories
  return false;
}

/** Verifica se o utilizador pode ver stories (todos os roles podem ver) */
export function canViewStories(currentRole?: StoryRole | null): boolean {
  // Todos os roles podem ver stories: cidadão, business e admin
  return true;
}

/** Obtém mensagem de login requerida baseada no role */
export function getRequireLoginMessage(currentRole?: StoryRole | null): string {
  if (currentRole === 'admin' || currentRole === 'business') {
    return 'Apenas contas de empresa e de administração publicam stories. Pode continuar a ver as stories das empresas.';
  }
  // Cidadão
  return 'Apenas contas de empresa e de administração publicam stories. Pode continuar a ver as stories das empresas.';
}

/** Alias usado pelo StoryModal. */
export function getStoryRequireLoginMessage(currentRole?: StoryRole | null): string {
  return getRequireLoginMessage(currentRole);
}

/** Verifica se o utilizador pode comentar stories no visualizador */
export function canCommentOnStory(currentRole?: StoryRole | null): boolean {
  // Todos os roles podem comentar no visualizador de stories
  return true;
}

/** Verifica se o utilizador tem permissão para moderar comments */
export function canModerateStoryComments(currentRole?: StoryRole | null): boolean {
  // Apenas admin pode moderar
  return currentRole === 'admin';
}

/** Permissões de stories por role */
export const STORY_PERMISSIONS = {
  admin: {
    canCreate: true,
    canView: true,
    canLike: true,
    canShare: true,
    canComment: true,
    canModerate: true,
  },
  business: {
    canCreate: true,
    canView: true,
    canLike: true,
    canShare: true,
    canComment: true,
    canModerate: false,
  },
  citizen: {
    canCreate: false,
    canView: true,
    canLike: true,
    canShare: true,
    canComment: true,
    canModerate: false,
  },
};

/** Obtém permissões completas baseadas no role */
export function getStoryPermissions(role: StoryRole) {
  return STORY_PERMISSIONS[role] || STORY_PERMISSIONS.citizen;
}
