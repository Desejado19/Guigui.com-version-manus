import { describe, expect, it, vi } from 'vitest';
import { createPostgresRateLimitRepository } from '../../server/modules/platform-foundation/rate-limits/adapters/postgresRateLimitRepository';
import { createRateLimitService } from '../../server/modules/platform-foundation/rate-limits/application/rateLimitService';

describe('platform-foundation rate-limit maintenance', () => {
  it('deletes expired buckets using the PostgreSQL clock', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ bucket_key: 'expired-a' }, { bucket_key: 'expired-b' }] });
    const repository = createPostgresRateLimitRepository({ query });

    const deleted = await repository.deleteExpiredRateLimitBuckets();

    expect(deleted).toBe(2);
    expect(query.mock.calls[0][0]).toContain('expires_at <= NOW()');
    expect(query.mock.calls[0][1]).toBeUndefined();
  });

  it('treats a bucket without a recorded expiry as expired', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ request_count: 1 }] });
    const repository = createPostgresRateLimitRepository({ query });
    const service = createRateLimitService(repository);

    await service.consumeDistributedRateLimit('legacy-bucket', 60_000, 5);

    expect(query.mock.calls[0][0]).toContain('expires_at IS NULL');
    expect(query.mock.calls[0][0]).toContain('THEN 1');
  });

  it('rejects invalid window and limit values before querying', async () => {
    const query = vi.fn();
    const service = createRateLimitService(
      createPostgresRateLimitRepository({ query }),
    );

    await expect(service.consumeDistributedRateLimit('invalid', -1, 1)).rejects.toThrow();
    await expect(service.consumeDistributedRateLimit('invalid', 1_000, -1)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
