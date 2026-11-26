import { describe, it, expect, vi, beforeEach } from 'vitest';

// Provide a configurable fake pool so we can exercise the threshold logic and
// both the "no distributed store" and query-mock paths.
const queryMock = vi.fn();
let pool: unknown = null;

vi.mock('../../server/db', () => ({
  get databasePool() {
    return pool;
  },
  databaseConfigured: true,
  withDbIdentity: (_identity: unknown, callback: () => unknown) => callback(),
}));

const { consumeDistributedRateLimit } = await import('../../server/rateLimitService');

beforeEach(() => {
  queryMock.mockReset();
  pool = null;
});

describe('consumeDistributedRateLimit', () => {
  it('returns null when no distributed store is configured', async () => {
    pool = null;
    expect(await consumeDistributedRateLimit('ip:1', 60_000, 10)).toBeNull();
  });

  it('allows requests while the count is within the limit', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [{ request_count: 1 }] });
    expect(await consumeDistributedRateLimit('ip:1', 60_000, 10)).toBe(true);
  });

  it('allows the request that reaches exactly the limit', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [{ request_count: 10 }] });
    expect(await consumeDistributedRateLimit('ip:1', 60_000, 10)).toBe(true);
  });

  it('blocks once the count exceeds the limit', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [{ request_count: 11 }] });
    expect(await consumeDistributedRateLimit('ip:1', 60_000, 10)).toBe(false);
  });

  it('fails closed when the row cannot be read', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [] });
    // No count -> treated as maxRequests + 1 -> blocked.
    expect(await consumeDistributedRateLimit('ip:1', 60_000, 10)).toBe(false);
  });

  it('passes the key and window to the query', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [{ request_count: 1 }] });
    await consumeDistributedRateLimit('user:42', 30_000, 5);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0][1]).toEqual(['user:42', 30_000]);
  });
});
