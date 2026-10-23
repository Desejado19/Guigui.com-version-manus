export type IdentityRole = 'user' | 'business' | 'admin';

export type BusinessTeamRole = 'manager' | 'editor' | 'finance' | 'support';

export interface BusinessTeamPermissions {
  profile: boolean;
  content: boolean;
  events: boolean;
  tickets: boolean;
  billing: boolean;
}

export interface PublicIdentity {
  id: string;
  name: string;
  email: string;
  role: IdentityRole;
  phone: string;
  neighborhood: string;
  avatarUrl: string;
  businessId?: string;
  businessName?: string;
  accountStatus?: 'active' | 'deactivated';
  teamRole?: BusinessTeamRole;
  teamPermissions?: BusinessTeamPermissions;
}

export interface IdentityAccount extends PublicIdentity {
  passwordHash: string;
  createdAt: string;
}

export type CreateIdentityAccount = Omit<PublicIdentity, 'id' | 'avatarUrl'> & {
  avatarUrl?: string;
  password: string;
};

export interface TeamInvitation {
  email: string;
  name: string;
  businessId: string;
  businessName: string;
  role: BusinessTeamRole;
  permissions: BusinessTeamPermissions;
  tokenHash: string;
  expiresAt: number;
  usedAt?: string;
}

export interface StoredSession {
  id?: string;
  userId: string;
  role?: IdentityRole;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
}
