import type { TeamModuleAccess } from '../../../../src/config/teamAccess';

export type IdentityRole = 'user' | 'business' | 'admin';

export type BusinessTeamRole = 'manager' | 'editor' | 'finance' | 'support';

export interface BusinessTeamPermissions {
  profile: boolean;
  content: boolean;
  events: boolean;
  tickets: boolean;
  billing: boolean;
}

export type IdentityAccessStatus = 'active' | 'pending' | 'suspended' | 'disabled';

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
  /** Acesso granular por módulo do colaborador empresarial. */
  teamAccess?: TeamModuleAccess;
  /** Acesso granular por módulo de um membro da equipa administrativa. */
  adminAccess?: TeamModuleAccess;
  jobTitle?: string;
  accessStatus?: IdentityAccessStatus;
}

export interface IdentityAccount extends PublicIdentity {
  passwordHash: string;
  createdAt: string;
  /** Claim `sub` do Google; nunca é exposta na identidade pública. */
  googleSubject?: string;
}

/**
 * Projecção pública de uma conta: remove credenciais e metadados internos.
 * Usada por todos os endpoints que devolvem o utilizador (login, sessão,
 * convite de equipa) para que o cliente receba sempre a mesma forma.
 */
export function toPublicIdentity(account: IdentityAccount): PublicIdentity {
  const { passwordHash: _passwordHash, createdAt: _createdAt, googleSubject: _googleSubject, ...identity } = account;
  return identity;
}

export type CreateIdentityAccount = Omit<PublicIdentity, 'id' | 'avatarUrl'> & {
  avatarUrl?: string;
  password: string;
  googleSubject?: string;
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
