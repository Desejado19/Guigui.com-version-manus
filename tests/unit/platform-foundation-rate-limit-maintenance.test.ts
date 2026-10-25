import { describe, expect, it, vi } from 'vitest';
import { createPostgresRateLimitRepository } from '../../server/modules/platform-foundation/rate-limits/adapters/postgresRateLimitRepository';
import { createRateLimitService } from '../../server/modules/platform-foundation/rate-limits/application/rateLimitService';

describe('platform-foundation rate-limit maintenance', () => {
  it('deletes only buckets expired at the maintenance time', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ bucket_key: 'expired-a' }, { bucket_key: 'expired-b' }] });
    const repository = createPostgresRateLimitRepository({ query });
    const now = new Date('2026-10-25T13:00:00.000Z');

    const deleted = await repository.deleteExpiredRateLimitBuckets(now);

    expect(deleted).toBe(2);
    expect(query.mock.calls[0][0]).toContain('expires_at <= $1');
    expect(query.mock.calls[0][1]).toEqual([now]);
  });

  it('treats a bucket without a recorded expiry as expired', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ request_count: 1 }] });
    const repository = createPostgresRateLimitRepository({ query });
    const service = createRateLimitService(repository, () => new Date('2026-10-25T13:00:00.000Z'));

    await service.consumeDistributedRateLimit('legacy-bucket', 60_000, 5);

    expect(query.mock.calls[0][0]).toContain('expires_at IS NULL');
    expect(query.mock.calls[0][0]).toContain('THEN 1');
  });

  it('rejects invalid window and limit values before querying', async () => {
    const query = vi.fn();
    const service = createRateLimitService(
      createPostgresRateLimitRepository({ query }),
      () => new Date('2026-10-25T13:00:00.000Z'),
    );

    await expect(service.consumeDistributedRateLimit('invalid', -1, 1)).rejects.toThrow();
    await expect(service.consumeDistributedRateLimit('invalid', 1_000, -1)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
