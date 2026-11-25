import { randomBytes } from 'node:crypto';
import { normaliseEmailForAccount } from '../../../../shared/emailAddress';
import { normalizeUserText } from '../../../../shared/textNormalization';
import { toPublicIdentity } from '../domain/identityTypes';
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
  email?: string;
  password?: string;
  mfaCode?: string;
  ipAddress?: string;
  userAgent?: string;
  googleIdToken?: string;
}

export type AuthenticationResult =
  | { kind: 'authenticated'; user: PublicIdentity; sessionToken: string }
  | {
    kind: 'rejected';
    reason: 'invalid_credentials' | 'deactivated' | 'suspended' | 'disabled' | 'mfa_required' | 'mfa_invalid' | 'google_failed' | 'google_link_required' | 'google_link_conflict';
    /** E-mail verificado do Google, para o cliente pedir a confirmação da conta. */
    email?: string;
  };

/** Identidade devolvida depois de o ID token do Google ser verificado na assinatura e nas claims. */
export interface VerifiedGoogleIdentity {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

/** Verificador de ID tokens do Google. Devolve null quando o token não é válido. */
export type GoogleIdTokenVerifier = (idToken: string) => Promise<VerifiedGoogleIdentity | null>;

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
  /** Sem verificador configurado, o login Google é recusado. */
  verifyGoogleIdToken?: GoogleIdTokenVerifier;
}

export interface RegistrationDependencies {
  accounts: IdentityAccountRepository;
  sessions: IdentitySessionRepository;
  businessProvisioning: BusinessProvisioningPort;
  persistBusinessProfile: boolean;
}

function isUniqueConstraintError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : '';
  return code === '23505' || /duplicate key|unique constraint/i.test(message);
}

export async function authenticateUser(
  input: AuthenticationInput,
  dependencies: AuthenticationDependencies,
): Promise<AuthenticationResult> {
  // Login com Google: a assinatura e as claims do ID token são verificadas pelo
  // adaptador injectado; sem verificador configurado não há autenticação.
  if (input.googleIdToken) {
    const identity = dependencies.verifyGoogleIdToken
      ? await dependencies.verifyGoogleIdToken(input.googleIdToken)
      : null;
    if (!identity) return { kind: 'rejected', reason: 'google_failed' };

    // O verificador já exigiu `email_verified`, por isso a existência da caixa
    // é atestada pelo Google; aqui garantimos apenas que o endereço é válido.
    if (!normaliseEmailForAccount(identity.email).ok) {
      return { kind: 'rejected', reason: 'google_failed' };
    }

    // O `sub` do Google é a chave estável da identidade: se já estiver ligado a
    // uma conta, é essa a conta usada mesmo que o e-mail mude.
    let account = await dependencies.accounts.findByGoogleSubject(identity.googleId);

    if (!account) {
      const byEmail = await dependencies.accounts.findByEmail(identity.email);
      if (byEmail) {
        // O e-mail da Google já foi verificado pelo verificador do ID token.
        // Uma conta ligada a OUTRA identidade Google nunca é substituída; uma
        // conta local com o mesmo e-mail (mesmo com palavra-passe) é ligada.
        if (byEmail.googleSubject && byEmail.googleSubject !== identity.googleId) {
          return { kind: 'rejected', reason: 'google_link_conflict', email: identity.email };
        }
        if (!byEmail.googleSubject) {
          // O verificador já exigiu `email_verified`; a Google atesta a posse do
          // endereço. Por isso uma conta local com o mesmo e-mail é ligada e
          // usada de imediato, sem voltar a pedir a palavra-passe: o utilizador
          // entra na conta que já existe com um único clique em "Continuar com
          // a Google". Contas ligadas a outra identidade Google continuam a ser
          // recusadas acima, e os estados de acesso são validados mais abaixo.
          let linked = false;
          try {
            linked = await dependencies.accounts.linkGoogleSubject(byEmail.id, identity.googleId);
          } catch (error) {
            // Corrida com outro vínculo: a restrição única de google_sub não pode
            // transformar-se num 500. O cliente recebe um conflito explícito.
            if (isUniqueConstraintError(error)) {
              return { kind: 'rejected', reason: 'google_link_conflict', email: identity.email };
            }
            throw error;
          }
          if (!linked) {
            const owner = await dependencies.accounts.findByGoogleSubject(identity.googleId);
            if (!owner || owner.id !== byEmail.id) {
              return { kind: 'rejected', reason: 'google_link_conflict', email: identity.email };
            }
            account = owner;
          } else {
            account = { ...byEmail, googleSubject: identity.googleId };
          }
        } else {
          account = byEmail;
        }
      } else {
        // Conta nova criada como cidadã, com uma palavra-passe aleatória que
        // nunca é revelada: o acesso passa a ser feito pela própria Google.
        const name = identity.name || identity.email.split('@')[0];
        account = await dependencies.accounts.create({
          name,
          email: identity.email,
          password: randomBytes(32).toString('hex'),
          role: 'user',
          phone: '',
          neighborhood: 'Bissau',
          googleSubject: identity.googleId,
          ...(identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
        });
        if (!account) {
          // Corrida entre pedidos: outro pedido pode ter criado a conta (ou
          // ligado a identidade) entretanto. Nunca criar uma segunda e nunca
          // ligar automaticamente uma conta que entretanto ganhou palavra-passe.
          account = await dependencies.accounts.findByGoogleSubject(identity.googleId);
          if (!account) {
            const racedEmail = await dependencies.accounts.findByEmail(identity.email);
            if (racedEmail) {
              return { kind: 'rejected', reason: 'google_link_required', email: identity.email };
            }
            return { kind: 'rejected', reason: 'google_failed' };
          }
        }
      }
    }

    if (account.accountStatus === 'deactivated') return { kind: 'rejected', reason: 'deactivated' };
    if (account.accessStatus === 'suspended') return { kind: 'rejected', reason: 'suspended' };
    if (account.accessStatus === 'disabled') return { kind: 'rejected', reason: 'disabled' };

    // Uma conta só pode estar ligada a uma identidade Google. Se este e-mail já
    // pertence a outra identidade Google, recusa em vez de a substituir.
    if (account.googleSubject && account.googleSubject !== identity.googleId) {
      return { kind: 'rejected', reason: 'google_link_conflict', email: identity.email };
    }

        // MFA obrigatório para administradores (igual ao login por palavra-passe).
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

  const email = (input.email || '').trim().toLowerCase();
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

  if (account && dependencies.verifyPassword(input.password || '', account.passwordHash)) {
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
    ? await dependencies.authenticateDemoAccount(email, input.password || '')
    : null;
  if (!demoUser) return { kind: 'rejected', reason: 'invalid_credentials' };

  const user = dependencies.persistDemoAccount
    ? await dependencies.persistDemoAccount(demoUser, input.password || '')
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
      // Forma NFC: "João" grafado de forma composta ou decomposta fica idêntico.
      name: normalizeUserText(input.name),
      email,
      password: input.password,
      role: input.role,
      phone: input.phone,
      neighborhood: input.neighborhood,
      ...(input.role === 'business' && profile ? {
        businessId,
        businessName: normalizeUserText(profile.name),
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
