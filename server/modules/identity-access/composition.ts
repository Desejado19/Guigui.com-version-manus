import type {
  AccountLifecycleAuditEvent,
  AccountLifecycleInput,
  AccountLifecycleResult,
} from './application/accountLifecycle';
import { deactivateAccount, deleteAccount } from './application/accountLifecycle';
import {
  authenticateUser,
  registerIdentityAccount,
  type AuthenticationInput,
  type AuthenticationResult,
  type BusinessProvisioningPort,
  type GoogleIdTokenVerifier,
  type RegistrationInput,
  type RegistrationResult,
} from './application/authentication';
import {
  beginIdentityMfaSetup,
  changePassword,
  enableIdentityMfa,
  requestPasswordReset,
  resetPassword,
  type ChangePasswordInput,
} from './application/credentials';
import {
  getIdentitySession,
  logoutIdentitySession,
  revokeAllIdentitySessions,
} from './application/sessionOperations';
import {
  acceptTeamInvitation,
  createTeamInvitation,
  inspectTeamInvitation,
  type AcceptTeamInvitationInput,
  type AcceptTeamInvitationResult,
  type CreateTeamInvitationInput,
  type CreateTeamInvitationResult,
} from './application/teamInvitations';
import {
  createJsonCredentialRepository,
  createJsonIdentityRepository,
  createJsonTeamInvitationRepository,
  hashPassword,
  toPublicUser,
  verifyDemoPassword,
  verifyPassword,
} from './infrastructure/jsonIdentityRepository';
import { createMfaRepository } from './infrastructure/mfaRepository';
import { createPostgresIdentityRepository } from './infrastructure/postgresIdentityRepository';
import { createSessionRepository, SESSION_COOKIE_NAME } from './infrastructure/sessionRepository';
import type {
  BusinessInvitationAccess,
  IdentityAccountRepository,
  IdentityCredentialRepository,
} from './application/identityAccessPorts';
import type {
  IdentityAccount,
  PublicIdentity,
  StoredSession,
} from './domain/identityTypes';

export { hashPassword, SESSION_COOKIE_NAME, verifyPassword };

export type PublicIdentitySession = Pick<StoredSession, 'userId' | 'role' | 'expiresAt'>;

export interface IdentityAccessAccountReaders {
  findInviterById(userId: string): Promise<PublicIdentity | null>;
  findInvitedMemberById(userId: string): Promise<PublicIdentity | null>;
}

export interface IdentityAccessOptions {
  databaseConfigured: boolean;
  demoAccountsEnabled: boolean;
  demoUsers: Array<PublicIdentity & { password: string }>;
  businessProvisioning: BusinessProvisioningPort;
  createBusinessInvitationAccess(
    readers: IdentityAccessAccountReaders,
  ): BusinessInvitationAccess;
  /** Quando ausente, o login com Google é recusado. */
  verifyGoogleIdToken?: GoogleIdTokenVerifier;
}

export interface IdentityAccess {
  authenticate(input: AuthenticationInput): Promise<AuthenticationResult>;
  register(input: RegistrationInput): Promise<RegistrationResult>;
  getSession(token: string | undefined): Promise<PublicIdentitySession | null>;
  logout(token: string | undefined): Promise<boolean>;
  revokeAllSessions(userId: string): Promise<number>;
  changePassword(input: ChangePasswordInput): Promise<boolean>;
  requestPasswordReset(email: string): Promise<string | null>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  beginMfaSetup(userId: string, email: string): Promise<{ secret: string; otpauthUrl: string }>;
  enableMfa(userId: string, code: string): Promise<boolean>;
  deactivateAccount(
    input: AccountLifecycleInput,
    audit: (event: AccountLifecycleAuditEvent) => void,
  ): Promise<AccountLifecycleResult>;
  deleteAccount(
    input: AccountLifecycleInput,
    audit: (event: AccountLifecycleAuditEvent) => void,
  ): Promise<AccountLifecycleResult>;
  createTeamInvitation(input: CreateTeamInvitationInput): Promise<CreateTeamInvitationResult>;
  inspectTeamInvitation(token: string): ReturnType<typeof inspectTeamInvitation>;
  acceptTeamInvitation(input: AcceptTeamInvitationInput): Promise<AcceptTeamInvitationResult>;
  findById(userId: string): Promise<PublicIdentity | null>;
}

function asPublicIdentity(account: IdentityAccount | null): PublicIdentity | null {
  return account ? toPublicUser(account) : null;
}export function createIdentityAccess(options: IdentityAccessOptions): IdentityAccess {
  const jsonAccounts = createJsonIdentityRepository();
  const accounts = options.databaseConfigured
    ? createPostgresIdentityRepository()
    : jsonAccounts;
  const sessions = createSessionRepository();
  const mfa = createMfaRepository();
  const jsonCredentials = createJsonCredentialRepository();
  const credentials: IdentityCredentialRepository = options.databaseConfigured
    ? {
      createPasswordReset: jsonCredentials.createPasswordReset,
      resetPassword: jsonCredentials.resetPassword,
    }
    : jsonCredentials;
  const invitations = createJsonTeamInvitationRepository();
  const invitationAccounts: IdentityAccountRepository = jsonAccounts;

  const businessAccess = options.createBusinessInvitationAccess({
    findInviterById: async (userId) => asPublicIdentity(await accounts.findById(userId)),
    findInvitedMemberById: async (userId) => asPublicIdentity(await invitationAccounts.findById(userId)),
  });
  const invitationDependencies = {
    accounts: invitationAccounts,
    invitations,
    businessAccess,
  };  const credentialDependencies = { accounts, credentials };

  return {
    authenticate: (input) => authenticateUser(input, {
      accounts,
      sessions,
      mfa,
      verifyPassword,
      demoAccountsEnabled: options.demoAccountsEnabled,
      verifyGoogleIdToken: options.verifyGoogleIdToken,
      authenticateDemoAccount: async (email, password) => {
        const demo = options.demoUsers.find((user) => (
          user.email === email && verifyDemoPassword(user.email, password, user.password)
        ));
        if (!demo) return null;
        const { password: _password, ...identity } = demo;
        return identity;
      },
      ...(options.databaseConfigured ? {
        persistDemoAccount: async (user: PublicIdentity, password: string) => {
          const stored = await accounts.create({ ...user, password });
          if (stored) return toPublicUser(stored);
          const existing = await accounts.findByEmail(user.email);
          return existing ? toPublicUser(existing) : user;
        },
      } : {}),
    }),
    register: (input) => registerIdentityAccount(input, {
      accounts,
      sessions,
      businessProvisioning: options.businessProvisioning,
      persistBusinessProfile: true,
    }),
    getSession: async (token) => {
      const session = await getIdentitySession(token, sessions);
      return session
        ? { userId: session.userId, role: session.role, expiresAt: session.expiresAt }
        : null;
    },
    logout: (token) => logoutIdentitySession(token, sessions),
    revokeAllSessions: (userId) => revokeAllIdentitySessions(userId, sessions),
    changePassword: (input) => changePassword(input, credentialDependencies),
    requestPasswordReset: (email) => requestPasswordReset(email, credentialDependencies),
    resetPassword: (token, newPassword) => resetPassword(token, newPassword, credentialDependencies),
    beginMfaSetup: (userId, email) => beginIdentityMfaSetup(userId, email, mfa),
    enableMfa: (userId, code) => enableIdentityMfa(userId, code, mfa),
    deactivateAccount: (input, audit) => deactivateAccount(input, {
      accounts,
      sessions,
      verifyPassword,
      audit,
    }),
    deleteAccount: (input, audit) => deleteAccount(input, {
      accounts,
      sessions,
      verifyPassword,
      audit,
    }),
    createTeamInvitation: (input) => createTeamInvitation(input, invitationDependencies),
    inspectTeamInvitation: (token) => inspectTeamInvitation(token, invitationDependencies),
    acceptTeamInvitation: (input) => acceptTeamInvitation(input, invitationDependencies),
    findById: async (userId) => asPublicIdentity(await accounts.findById(userId)),
  };
}
