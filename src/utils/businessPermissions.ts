import { BusinessTeamMember, BusinessTeamRole, UserProfile } from '../types';

export type BusinessPermission = keyof BusinessTeamMember['permissions'];

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
