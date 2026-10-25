import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Provide a configurable fake pool so we can exercise the threshold logic and
// both the "no distributed store" and query-mock paths.
const queryMock = vi.fn();
let pool: unknown = null;

vi.mock('../../server/db', () => ({
  get databasePool() {
    return pool;
  },
  databaseConfigured: true,
}));

const { consumeDistributedRateLimit } = await import('../../server/rateLimitService');

beforeEach(() => {
  queryMock.mockReset();
  pool = null;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it('sets expiry at the end of the current window', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [{ request_count: 1 }] });

    await consumeDistributedRateLimit('ip:expiry', 60_000, 5);

    expect(queryMock.mock.calls[0][1]).toEqual(['ip:expiry', 60_000]);
    expect(queryMock.mock.calls[0][0]).toContain("NOW() + ($2 * INTERVAL '1 millisecond')");
  });

  it('starts a new window with a new expiry after the old window ends', async () => {
    pool = { query: queryMock };
    queryMock.mockResolvedValue({ rows: [{ request_count: 1 }] });

    await consumeDistributedRateLimit('ip:window', 60_000, 5);
    vi.advanceTimersByTime(60_000);
    await consumeDistributedRateLimit('ip:window', 60_000, 5);

    const query = queryMock.mock.calls[1][0] as string;
    expect(queryMock.mock.calls[1][1]).toEqual(['ip:window', 60_000]);
    expect(query).toContain('rate_limit_buckets.expires_at <= NOW()');
    expect(query).toContain('window_started_at=CASE');
    expect(query).toContain('expires_at=CASE');
  });

  it('rejects invalid window and request limits', async () => {
    await expect(consumeDistributedRateLimit('ip:invalid', 0, 5)).rejects.toThrow(
      'windowMs must be a positive integer.',
    );
    await expect(consumeDistributedRateLimit('ip:invalid', 1_000, 0)).rejects.toThrow(
      'maxRequests must be a positive integer.',
    );
  });

  it('does not log or include the bucket key when persistence fails', async () => {
    pool = { query: queryMock };
    queryMock.mockRejectedValue(new Error('database unavailable'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(consumeDistributedRateLimit('private-bucket-key', 1_000, 5))
      .rejects.toThrow('database unavailable');

    expect(errorSpy).not.toHaveBeenCalled();
    expect(queryMock.mock.calls[0][1][0]).toBe('private-bucket-key');
  });
});
