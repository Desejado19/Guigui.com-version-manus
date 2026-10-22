import { describe, expect, it, vi } from 'vitest';
import {
  resolveSessionContext,
  type SessionReader,
} from '../../server/modules/identity-access/application/resolveSessionContext';

function createReader(
  overrides: Partial<SessionReader['getSession']> = {},
): { reader: SessionReader; getSession: ReturnType<typeof vi.fn> } {
  const getSession = vi.fn().mockResolvedValue(null);
  return {
    reader: {
      getSession: (token) => getSession(token) as ReturnType<SessionReader['getSession']>,
      ...overrides,
    },
    getSession,
  };
}

describe('resolução do contexto de sessão', () => {
  it('returns null without querying the reader when the token is absent', async () => {
    const { reader, getSession } = createReader();

    await expect(resolveSessionContext(undefined, reader)).resolves.toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('returns null when the reader has no matching session', async () => {
    const { reader } = createReader();

    await expect(resolveSessionContext('token-1', reader)).resolves.toBeNull();
  });

  it('treats a session without a role as unauthenticated', async () => {
    const { reader } = createReader({
      getSession: vi.fn().mockResolvedValue({ userId: 'user-1' }),
    } as Partial<SessionReader['getSession']>);

    await expect(resolveSessionContext('token-1', reader)).resolves.toBeNull();
  });

  it('returns only the user ID and role for a valid session', async () => {
    const { reader } = createReader({
      getSession: vi.fn().mockResolvedValue({ userId: 'user-1', role: 'business' }),
    } as Partial<SessionReader['getSession']>);

    await expect(resolveSessionContext('token-1', reader)).resolves.toEqual({
      userId: 'user-1',
      role: 'business',
    });
  });

  it('propagates session-reader errors', async () => {
    const failure = new Error('session store unavailable');
    const { reader } = createReader({
      getSession: vi.fn().mockRejectedValue(failure),
    } as Partial<SessionReader['getSession']>);

    await expect(resolveSessionContext('token-1', reader)).rejects.toBe(failure);
  });
});
