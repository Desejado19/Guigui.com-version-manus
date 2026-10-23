import { describe, expect, it, vi } from 'vitest';
import {
  getIdentitySession,
  logoutIdentitySession,
  revokeAllIdentitySessions,
} from '../../server/modules/identity-access/application/sessionOperations';
import type { IdentitySessionRepository } from '../../server/modules/identity-access/application/identityAccessPorts';

describe('identity session operations', () => {
  it('returns the existing session DTO for a supplied token', async () => {
    const session = {
      userId: 'user-1',
      role: 'user' as const,
      tokenHash: 'hash',
      createdAt: '2026-10-23T00:00:00.000Z',
      expiresAt: '2026-10-30T00:00:00.000Z',
    };
    const repository: IdentitySessionRepository = {
      createSession: async () => 'token',
      getSession: async () => session,
      revokeSession: async () => true,
      revokeAllUserSessions: async () => 1,
    };

    await expect(getIdentitySession('token', repository)).resolves.toEqual(session);
  });

  it('reports logout as false when no token is present', async () => {
    const revokeSession = vi.fn(async () => false);
    const repository: IdentitySessionRepository = {
      createSession: async () => 'token',
      getSession: async () => null,
      revokeSession,
      revokeAllUserSessions: async () => 0,
    };

    await expect(logoutIdentitySession(undefined, repository)).resolves.toBe(false);
    expect(revokeSession).toHaveBeenCalledWith(undefined);
  });

  it('returns the count from revoking all sessions for an account', async () => {
    const repository: IdentitySessionRepository = {
      createSession: async () => 'token',
      getSession: async () => null,
      revokeSession: async () => false,
      revokeAllUserSessions: async (userId) => userId === 'user-1' ? 3 : 0,
    };

    await expect(revokeAllIdentitySessions('user-1', repository)).resolves.toBe(3);
  });

  it('propagates repository errors instead of presenting a missing session', async () => {
    const repository: IdentitySessionRepository = {
      createSession: async () => 'token',
      getSession: async () => { throw new Error('session database unavailable'); },
      revokeSession: async () => false,
      revokeAllUserSessions: async () => 0,
    };

    await expect(getIdentitySession('token', repository)).rejects.toThrow('session database unavailable');
  });
});
