import { describe, expect, it, vi } from 'vitest';
import {
  resolveSessionContext,
  type SessionReader,
} from '../../server/modules/identity-access/application/resolveSessionContext';

describe('resolveSessionContext', () => {
  it('returns null without querying the reader when the token is absent', async () => {
    const reader: SessionReader = {
      getSession: vi.fn().mockResolvedValue(null),
    };

    await expect(resolveSessionContext(undefined, reader)).resolves.toBeNull();
    expect(reader.getSession).not.toHaveBeenCalled();
  });

  it('returns null when the reader has no matching session', async () => {
    const reader: SessionReader = {
      getSession: vi.fn().mockResolvedValue(null),
    };

    await expect(resolveSessionContext('token-1', reader)).resolves.toBeNull();
  });

  it('treats a session without a role as unauthenticated', async () => {
    const reader: SessionReader = {
      getSession: vi.fn().mockResolvedValue({ userId: 'user-1' }),
    };

    await expect(resolveSessionContext('token-1', reader)).resolves.toBeNull();
  });

  it('returns only the user ID and role for a valid session', async () => {
    const reader: SessionReader = {
      getSession: vi.fn().mockResolvedValue({
        userId: 'user-1',
        role: 'business',
        extra: 'not part of the context',
      }),
    };

    await expect(resolveSessionContext('token-1', reader)).resolves.toEqual({
      userId: 'user-1',
      role: 'business',
    });
  });

  it('propagates session-reader errors', async () => {
    const error = new Error('session store unavailable');
    const reader: SessionReader = {
      getSession: vi.fn().mockRejectedValue(error),
    };

    await expect(resolveSessionContext('token-1', reader)).rejects.toBe(error);
  });
});
