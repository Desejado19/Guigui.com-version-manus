import type {
  CreateIdentityAccount,
  IdentityAccount,
  BusinessTeamPermissions,
  BusinessTeamRole,
  IdentityRole,
  PublicIdentity,
  StoredSession,
  TeamInvitation,
} from '../domain/identityTypes';

export interface IdentityAccountRepository {
  findByEmail(email: string): Promise<IdentityAccount | null>;
  findById(id: string): Promise<IdentityAccount | null>;
  findByGoogleSubject(googleSubject: string): Promise<IdentityAccount | null>;
  /** Liga a identidade Google apenas se a conta ainda não tiver outra. */
  linkGoogleSubject(userId: string, googleSubject: string): Promise<boolean>;
  create(input: CreateIdentityAccount): Promise<IdentityAccount | null>;
  changePassword(email: string, currentPassword: string, newPassword: string): Promise<boolean>;
  deactivate(email: string): Promise<boolean>;
  delete(email: string): Promise<boolean>;
}

export interface IdentityCredentialRepository {
  changeDemoPassword?(email: string, currentPassword: string, newPassword: string, fallbackPassword?: string): Promise<boolean>;
  createPasswordReset(email: string): Promise<string | null>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
}

export interface IdentitySessionRepository {
  createSession(input: {
    userId: string;
    role: IdentityRole;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string>;
  getSession(token: string | undefined): Promise<StoredSession | null>;
  revokeSession(token: string | undefined): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
}

export interface IdentityMfaRepository {
  hasEnabledMfa(userId: string): Promise<boolean>;
  beginMfaSetup(userId: string, email: string): Promise<{ secret: string; otpauthUrl: string }>;
  enableMfa(userId: string, code: string): Promise<boolean>;
  verifyUserMfa(userId: string, code: string): Promise<boolean>;
}

export type IdentityTeamInvitationDetails = Omit<TeamInvitation, 'tokenHash' | 'usedAt'>;

export interface IdentityTeamInvitationRepository {
  create(input: Omit<TeamInvitation, 'tokenHash' | 'expiresAt' | 'usedAt'>, token: string): Promise<void>;
  inspect(token: string): Promise<IdentityTeamInvitationDetails | null>;
  consume(token: string): Promise<boolean>;
}

export interface BusinessInvitationAccess {
  validate(input: {
    inviterUserId: string;
    businessId: string;
    role: BusinessTeamRole;
    permissions: BusinessTeamPermissions;
  }): Promise<{ role: BusinessTeamRole; permissions: BusinessTeamPermissions } | null>;
  addMember(input: {
    userId: string;
    businessId: string;
    role: BusinessTeamRole;
    permissions: BusinessTeamPermissions;
  }): Promise<boolean>;
}
