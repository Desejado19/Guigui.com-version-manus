import { describe, expect, it, vi } from 'vitest';
import type { IdentityAccount, PublicIdentity } from '../../server/modules/identity-access/domain/identityTypes';
import type {
  IdentityAccountRepository,
  IdentityMfaRepository,
  IdentitySessionRepository,
} from '../../server/modules/identity-access/application/identityAccessPorts';
import {
  authenticateUser,
  registerIdentityAccount,
} from '../../server/modules/identity-access/application/authentication';

const account: IdentityAccount = {
  id: 'user-1',
  name: 'Fatou',
  email: 'fatou@guigui.com',
  role: 'user',
  phone: '+245 955 00 01',
  neighborhood: 'Bissau',
  avatarUrl: '',
  passwordHash: 'hash:correct-password',
  createdAt: '2026-10-23T00:00:00.000Z',
};

function authDependencies(overrides: {
  account?: IdentityAccount | null;
  hasMfa?: boolean;
  validMfa?: boolean;
  demoUser?: PublicIdentity | null;
} = {}) {
  const accounts: IdentityAccountRepository = {
    findByEmail: async () => overrides.account === undefined ? account : overrides.account,
    findById: async () => account,
    create: async () => account,
    changePassword: async () => false,
    deactivate: async () => false,
    delete: async () => false,
  };
  const sessions: IdentitySessionRepository = {
    createSession: vi.fn(async () => 'opaque-session-token'),
    getSession: async () => null,
    revokeSession: async () => false,
    revokeAllUserSessions: async () => 0,
  };
  const mfa: IdentityMfaRepository = {
    hasEnabledMfa: async () => overrides.hasMfa ?? false,
    beginMfaSetup: async () => ({ secret: 'secret', otpauthUrl: 'otpauth://test' }),
    enableMfa: async () => false,
    verifyUserMfa: async () => overrides.validMfa ?? false,
  };

  return {
    accounts,
    sessions,
    mfa,
    verifyPassword: (password: string, hash: string) => hash === `hash:${password}`,
    demoAccountsEnabled: true,
    authenticateDemoAccount: async () => overrides.demoUser ?? null,
    businessProvisioning: {
      validateProfile: () => ({ missingFields: [] }),
      createProfile: async ({ id }: { id: string }) => ({ id }),
      assignOwner: async () => true,
      deleteProfile: async () => true,
    },
    persistBusinessProfile: false,
  };
}

const businessProfile = {
  name: 'New Business',
  categoryId: 'services',
  groupGroupId: 'services',
  subcategoryId: 'local',
  description: 'A valid business description.',
  phone: '+245 955 00 02',
  neighborhood: 'Bissau',
};

describe('identity authentication use case', () => {
  it('creates a session for a valid account and returns only its public identity', async () => {
    const dependencies = authDependencies();

    const result = await authenticateUser({
      email: ' FATOU@GUIGUI.COM ',
      password: 'correct-password',
      ipAddress: '127.0.0.1',
      userAgent: 'unit-test',
    }, dependencies);

    expect(result).toEqual({
      kind: 'authenticated',
      user: {
        id: 'user-1',
        name: 'Fatou',
        email: 'fatou@guigui.com',
        role: 'user',
        phone: '+245 955 00 01',
        neighborhood: 'Bissau',
        avatarUrl: '',
      },
      sessionToken: 'opaque-session-token',
    });
  });

  it('rejects invalid credentials', async () => {
    const result = await authenticateUser(
      { email: 'fatou@guigui.com', password: 'wrong-password' },
      authDependencies(),
    );

    expect(result).toEqual({ kind: 'rejected', reason: 'invalid_credentials' });
  });

  it('rejects deactivated accounts before issuing a session', async () => {
    const result = await authenticateUser(
      { email: account.email, password: 'correct-password' },
      authDependencies({ account: { ...account, accountStatus: 'deactivated' } }),
    );

    expect(result).toEqual({ kind: 'rejected', reason: 'deactivated' });
  });

  it('requires an MFA code for an admin with enabled MFA', async () => {
    const result = await authenticateUser(
      { email: account.email, password: 'correct-password' },
      authDependencies({ account: { ...account, role: 'admin' }, hasMfa: true }),
    );

    expect(result).toEqual({ kind: 'rejected', reason: 'mfa_required' });
  });

  it('rejects an invalid MFA code for an admin with enabled MFA', async () => {
    const result = await authenticateUser(
      { email: account.email, password: 'correct-password', mfaCode: '000000' },
      authDependencies({ account: { ...account, role: 'admin' }, hasMfa: true, validMfa: false }),
    );

    expect(result).toEqual({ kind: 'rejected', reason: 'mfa_invalid' });
  });

  it('accepts a valid MFA code and issues a session', async () => {
    const result = await authenticateUser(
      { email: account.email, password: 'correct-password', mfaCode: '123456' },
      authDependencies({ account: { ...account, role: 'admin' }, hasMfa: true, validMfa: true }),
    );

    expect(result.kind).toBe('authenticated');
  });

  it('supports the configured demo-account fallback', async () => {
    const { passwordHash: _passwordHash, createdAt: _createdAt, ...demoUser }: PublicIdentity & Partial<IdentityAccount> = account;
    const dependencies = authDependencies({ account: null, demoUser });

    const result = await authenticateUser(
      { email: demoUser.email, password: 'demo-password' },
      dependencies,
    );

    expect(result).toMatchObject({ kind: 'authenticated', user: { id: demoUser.id } });
  });

  it('rejects duplicate account registration', async () => {
    const result = await registerIdentityAccount({
      name: 'Fatou',
      email: account.email,
      password: 'new-password',
      role: 'user',
      phone: account.phone,
      neighborhood: account.neighborhood,
    }, authDependencies());

    expect(result).toEqual({ kind: 'duplicate_account' });
  });

  it('creates a user account and session', async () => {
    const result = await registerIdentityAccount({
      name: 'New User',
      email: 'new-user@guigui.com',
      password: 'new-password',
      role: 'user',
      phone: '+245 955 00 02',
      neighborhood: 'Bissau',
    }, authDependencies({ account: null }));

    expect(result).toMatchObject({ kind: 'created', sessionToken: 'opaque-session-token' });
  });

  it('returns business-profile validation failures before creating an account', async () => {
    const dependencies = authDependencies({ account: null });
    const result = await registerIdentityAccount({
      name: 'New Business',
      email: 'new-business@guigui.com',
      password: 'new-password',
      role: 'business',
      phone: '+245 955 00 02',
      neighborhood: 'Bissau',
      businessProfile,
    }, {
      ...dependencies,
      accounts: { ...dependencies.accounts, create: vi.fn(async () => account) },
      businessProvisioning: {
        validateProfile: () => ({ missingFields: ['categoryId'] }),
        createProfile: vi.fn(),
        assignOwner: vi.fn(),
        deleteProfile: vi.fn(),
      },
    });

    expect(result).toEqual({ kind: 'invalid_profile', missingFields: ['categoryId'] });
  });

  it('compensates business profile creation when account creation conflicts', async () => {
    const deleteProfile = vi.fn(async () => true);
    const dependencies = authDependencies({ account: null });
    const result = await registerIdentityAccount({
      name: 'New Business',
      email: 'new-business@guigui.com',
      password: 'new-password',
      role: 'business',
      phone: '+245 955 00 02',
      neighborhood: 'Bissau',
      businessProfile,
    }, {
      ...dependencies,
      accounts: { ...dependencies.accounts, create: async () => null },
      businessProvisioning: {
        validateProfile: () => ({ missingFields: [] }),
        createProfile: async () => ({ id: 'business-1' }),
        assignOwner: async () => true,
        deleteProfile,
      },
      persistBusinessProfile: true,
    });

    expect(result).toEqual({ kind: 'duplicate_account' });
    expect(deleteProfile).toHaveBeenCalledWith('business-1');
  });

  it('reports a business-registration compensation failure instead of returning a duplicate', async () => {
    const dependencies = authDependencies({ account: null });
    const result = await registerIdentityAccount({
      name: 'New Business',
      email: 'new-business@guigui.com',
      password: 'new-password',
      role: 'business',
      phone: '+245 955 00 02',
      neighborhood: 'Bissau',
      businessProfile,
    }, {
      ...dependencies,
      accounts: { ...dependencies.accounts, create: async () => null },
      businessProvisioning: {
        validateProfile: () => ({ missingFields: [] }),
        createProfile: async () => ({ id: 'business-1' }),
        assignOwner: async () => true,
        deleteProfile: async () => false,
      },
      persistBusinessProfile: true,
    });

    expect(result).toMatchObject({ kind: 'registration_failed', compensationFailures: ['business'] });
  });
});
