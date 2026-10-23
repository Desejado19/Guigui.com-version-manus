import { describe, expect, it, vi } from 'vitest';
import type { IdentityAccount } from '../../server/modules/identity-access/domain/identityTypes';
import type { IdentityAccountRepository, IdentitySessionRepository } from '../../server/modules/identity-access/application/identityAccessPorts';
import { deactivateAccount, deleteAccount } from '../../server/modules/identity-access/application/accountLifecycle';

const account: IdentityAccount = {
  id: 'user-1',
  name: 'Fatou',
  email: 'fatou@guigui.com',
  role: 'user',
  phone: '+245 955 00 01',
  neighborhood: 'Bissau',
  avatarUrl: '',
  passwordHash: 'hash:current-password',
  createdAt: '2026-10-23T00:00:00.000Z',
};

function lifecycleDependencies(overrides: {
  account?: IdentityAccount | null;
  operationSucceeded?: boolean;
  revoked?: number;
  verifyPassword?: boolean;
} = {}) {
  const order: string[] = [];
  const accounts: IdentityAccountRepository = {
    findByEmail: async () => null,
    findById: async () => overrides.account === undefined ? account : overrides.account,
    create: async () => null,
    changePassword: async () => false,
    deactivate: vi.fn(async () => {
      order.push('deactivate');
      return overrides.operationSucceeded ?? true;
    }),
    delete: vi.fn(async () => {
      order.push('delete');
      return overrides.operationSucceeded ?? true;
    }),
  };
  const sessions: IdentitySessionRepository = {
    createSession: async () => 'session-token',
    getSession: async () => null,
    revokeSession: async () => false,
    revokeAllUserSessions: vi.fn(async () => {
      order.push('revoke-sessions');
      return overrides.revoked ?? 2;
    }),
  };
  const audit = vi.fn();
  return {
    accounts,
    sessions,
    audit,
    order,
    verifyPassword: vi.fn(() => overrides.verifyPassword ?? true),
  };
}

describe('identity account lifecycle use cases', () => {
  it('rejects a requested email that does not match the authenticated account', async () => {
    const dependencies = lifecycleDependencies();

    const result = await deactivateAccount({
      userId: account.id,
      actorRole: 'user',
      email: 'other@guigui.com',
      currentPassword: 'current-password',
    }, dependencies);

    expect(result).toEqual({ kind: 'identity_mismatch' });
    expect(dependencies.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'account_deactivation_denied',
      resourceId: account.id,
      success: false,
      metadata: { reason: 'session_account_mismatch' },
    }));
    expect(dependencies.accounts.deactivate).not.toHaveBeenCalled();
    expect(dependencies.sessions.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it('reports a missing authenticated account', async () => {
    const dependencies = lifecycleDependencies({ account: null });

    await expect(deactivateAccount({
      userId: account.id,
      actorRole: 'user',
      currentPassword: 'current-password',
    }, dependencies)).resolves.toEqual({ kind: 'account_not_found' });
  });

  it('rejects an incorrect current password without changing the account', async () => {
    const dependencies = lifecycleDependencies({ verifyPassword: false });

    await expect(deleteAccount({
      userId: account.id,
      actorRole: 'user',
      currentPassword: 'incorrect-password',
    }, dependencies)).resolves.toEqual({ kind: 'invalid_password' });
    expect(dependencies.accounts.delete).not.toHaveBeenCalled();
    expect(dependencies.sessions.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it('deactivates the account before revoking all sessions and auditing the result', async () => {
    const dependencies = lifecycleDependencies({ revoked: 3 });

    const result = await deactivateAccount({
      userId: account.id,
      actorRole: 'user',
      currentPassword: 'current-password',
    }, dependencies);

    expect(result).toEqual({ kind: 'success', revoked: 3 });
    expect(dependencies.order).toEqual(['deactivate', 'revoke-sessions']);
    expect(dependencies.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'account_deactivated',
      resourceId: account.id,
      success: true,
      metadata: { revoked: 3 },
    }));
  });

  it('deletes the account and revokes all sessions', async () => {
    const dependencies = lifecycleDependencies();

    await expect(deleteAccount({
      userId: account.id,
      actorRole: 'user',
      currentPassword: 'current-password',
    }, dependencies)).resolves.toEqual({ kind: 'success', revoked: 2 });
    expect(dependencies.order).toEqual(['delete', 'revoke-sessions']);
    expect(dependencies.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'account_deleted',
      metadata: { revoked: 2 },
    }));
  });

  it('does not revoke sessions when the account operation returns false', async () => {
    const dependencies = lifecycleDependencies({ operationSucceeded: false });

    await expect(deactivateAccount({
      userId: account.id,
      actorRole: 'user',
      currentPassword: 'current-password',
    }, dependencies)).resolves.toEqual({ kind: 'operation_failed' });
    expect(dependencies.sessions.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it('propagates persistence failures', async () => {
    const dependencies = lifecycleDependencies();
    vi.mocked(dependencies.accounts.delete).mockRejectedValue(new Error('persistence unavailable'));

    await expect(deleteAccount({
      userId: account.id,
      actorRole: 'user',
      currentPassword: 'current-password',
    }, dependencies)).rejects.toThrow('persistence unavailable');
  });

  it('propagates session revocation failures after the account operation', async () => {
    const dependencies = lifecycleDependencies();
    vi.mocked(dependencies.sessions.revokeAllUserSessions).mockRejectedValue(new Error('session store unavailable'));

    await expect(deactivateAccount({
      userId: account.id,
      actorRole: 'user',
      currentPassword: 'current-password',
    }, dependencies)).rejects.toThrow('session store unavailable');
    expect(dependencies.order).toEqual(['deactivate']);
    expect(dependencies.audit).not.toHaveBeenCalled();
  });
});
