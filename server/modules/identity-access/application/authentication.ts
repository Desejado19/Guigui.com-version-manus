import { randomBytes } from 'node:crypto';
import type {
  CreateIdentityAccount,
  IdentityAccount,
  PublicIdentity,
} from '../domain/identityTypes';
import type {
  IdentityAccountRepository,
  IdentityMfaRepository,
  IdentitySessionRepository,
} from './identityAccessPorts';

export interface AuthenticationInput {
  email: string;
  password: string;
  mfaCode?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type AuthenticationResult =
  | { kind: 'authenticated'; user: PublicIdentity; sessionToken: string }
  | { kind: 'rejected'; reason: 'invalid_credentials' | 'deactivated' | 'suspended' | 'disabled' | 'mfa_required' | 'mfa_invalid' };

export interface BusinessRegistrationProfile {
  name: string;
  categoryId: string;
  groupGroupId: string;
  subcategoryId: string;
  description: string;
  phone: string;
  neighborhood: string;
  publicEmail?: string;
}

export interface BusinessProvisioningPort {
  validateProfile(profile: BusinessRegistrationProfile): { missingFields: string[] };
  createProfile(profile: BusinessRegistrationProfile & { id: string }): Promise<{ id: string }>;
  assignOwner(businessId: string, userId: string): Promise<boolean>;
  deleteProfile(businessId: string): Promise<boolean>;
}

export interface RegistrationInput extends CreateIdentityAccount {
  businessProfile?: BusinessRegistrationProfile;
  ipAddress?: string;
  userAgent?: string;
}

export type RegistrationResult =
  | { kind: 'created'; user: PublicIdentity; sessionToken: string; business?: BusinessRegistrationProfile & { id: string; status: 'pending' } }
  | { kind: 'invalid_profile'; missingFields: string[] }
  | { kind: 'duplicate_account' }
  | { kind: 'registration_failed'; error: unknown; compensationFailures: string[] };

export interface AuthenticationDependencies {
  accounts: IdentityAccountRepository;
  sessions: IdentitySessionRepository;
  mfa: IdentityMfaRepository;
  verifyPassword(password: string, encoded: string): boolean;
  demoAccountsEnabled: boolean;
  authenticateDemoAccount(email: string, password: string): Promise<PublicIdentity | null>;
  persistDemoAccount?(user: PublicIdentity, password: string): Promise<PublicIdentity>;
}

export interface RegistrationDependencies {
  accounts: IdentityAccountRepository;
  sessions: IdentitySessionRepository;
  businessProvisioning: BusinessProvisioningPort;
  persistBusinessProfile: boolean;
}

function toPublicIdentity(account: IdentityAccount): PublicIdentity {
  const { passwordHash: _passwordHash, createdAt: _createdAt, ...identity } = account;
  return identity;
}

export async function authenticateUser(
  input: AuthenticationInput,
  dependencies: AuthenticationDependencies,
): Promise<AuthenticationResult> {
  const email = input.email.trim().toLowerCase();
  const account = await dependencies.accounts.findByEmail(email);

  if (account?.accountStatus === 'deactivated') {
    return { kind: 'rejected', reason: 'deactivated' };
  }
  if (account?.accessStatus === 'suspended') {
    return { kind: 'rejected', reason: 'suspended' };
  }
  if (account?.accessStatus === 'disabled') {
    return { kind: 'rejected', reason: 'disabled' };
  }

  if (account && dependencies.verifyPassword(input.password, account.passwordHash)) {
    if (account.role === 'admin' && await dependencies.mfa.hasEnabledMfa(account.id)) {
      if (!input.mfaCode) return { kind: 'rejected', reason: 'mfa_required' };
      if (!await dependencies.mfa.verifyUserMfa(account.id, input.mfaCode)) {
        return { kind: 'rejected', reason: 'mfa_invalid' };
      }
    }
    const sessionToken = await dependencies.sessions.createSession({
      userId: account.id,
      role: account.role,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return { kind: 'authenticated', user: toPublicIdentity(account), sessionToken };
  }

  const demoUser = dependencies.demoAccountsEnabled
    ? await dependencies.authenticateDemoAccount(email, input.password)
    : null;
  if (!demoUser) return { kind: 'rejected', reason: 'invalid_credentials' };

  const user = dependencies.persistDemoAccount
    ? await dependencies.persistDemoAccount(demoUser, input.password)
    : demoUser;
  const sessionToken = await dependencies.sessions.createSession({
    userId: user.id,
    role: user.role,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
  return { kind: 'authenticated', user, sessionToken };
}

export async function registerIdentityAccount(
  input: RegistrationInput,
  dependencies: RegistrationDependencies,
): Promise<RegistrationResult> {
  const email = input.email.trim().toLowerCase();
  const profile = input.role === 'business' ? input.businessProfile : undefined;
  let createdBusinessId: string | undefined;
  let createdAccount: IdentityAccount | undefined;
  if (input.role === 'business') {
    if (!profile) return { kind: 'invalid_profile', missingFields: ['businessProfile'] };
    const validation = dependencies.businessProvisioning.validateProfile(profile);
    if (validation.missingFields.length > 0) {
      return { kind: 'invalid_profile', missingFields: validation.missingFields };
    }
  }

  try {
    if (await dependencies.accounts.findByEmail(email)) return { kind: 'duplicate_account' };

    let businessId: string | undefined;
    if (input.role === 'business' && profile && dependencies.persistBusinessProfile) {
      const proposedId = `biz-${Date.now()}-${randomBytes(3).toString('hex')}`;
      const business = await dependencies.businessProvisioning.createProfile({ ...profile, id: proposedId });
      businessId = business.id;
      createdBusinessId = business.id;
    } else if (input.role === 'business') {
      businessId = `biz-${Date.now()}-${randomBytes(3).toString('hex')}`;
    }

    const accountInput: CreateIdentityAccount = {
      name: input.name,
      email,
      password: input.password,
      role: input.role,
      phone: input.phone,
      neighborhood: input.neighborhood,
      ...(input.role === 'business' && profile ? {
        businessId,
        businessName: profile.name,
      } : {}),
    };
    const account = await dependencies.accounts.create(accountInput);
    if (!account) {
      if (createdBusinessId && !await dependencies.businessProvisioning.deleteProfile(createdBusinessId)) {
        return { kind: 'registration_failed', error: new Error('Business profile compensation failed.'), compensationFailures: ['business'] };
      }
      createdBusinessId = undefined;
      return { kind: 'duplicate_account' };
    }
    createdAccount = account;

    if (createdBusinessId && !await dependencies.businessProvisioning.assignOwner(createdBusinessId, account.id)) {
      throw new Error('Business registration could not associate the account with its business profile.');
    }

    const sessionToken = await dependencies.sessions.createSession({
      userId: account.id,
      role: account.role,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    const user = toPublicIdentity(account);
    if (businessId && profile) {
      user.businessId = businessId;
      user.businessName = profile.name;
    }
    return {
      kind: 'created',
      user,
      sessionToken,
      ...(businessId && profile ? { business: { ...profile, id: businessId, status: 'pending' as const } } : {}),
    };
  } catch (error) {
    const compensationFailures: string[] = [];
    if (createdAccount) {
      try {
        if (!await dependencies.accounts.delete(email)) compensationFailures.push('account');
      } catch {
        compensationFailures.push('account');
      }
    }
    if (createdBusinessId) {
      try {
        if (!await dependencies.businessProvisioning.deleteProfile(createdBusinessId)) compensationFailures.push('business');
      } catch {
        compensationFailures.push('business');
      }
    }
    return { kind: 'registration_failed', error, compensationFailures };
  }
}
