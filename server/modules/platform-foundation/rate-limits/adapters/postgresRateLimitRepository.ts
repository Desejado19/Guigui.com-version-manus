import type { Pool } from 'pg';
import type { RateLimitRepository } from '../application/rateLimitService';

type RateLimitQueryPort = Pick<Pool, 'query'>;

export function createPostgresRateLimitRepository(
  queryPort: RateLimitQueryPort,
): RateLimitRepository {
  return {
    async consumeDistributedRateLimit(key, windowMs) {
      const result = await queryPort.query<{ request_count: number }>(
        `INSERT INTO rate_limit_buckets
          (bucket_key,window_started_at,request_count,updated_at,expires_at)
         VALUES ($1,NOW(),1,NOW(),NOW() + ($2 * INTERVAL '1 millisecond'))
         ON CONFLICT (bucket_key) DO UPDATE SET
           window_started_at=CASE
             WHEN rate_limit_buckets.expires_at IS NULL OR rate_limit_buckets.expires_at <= NOW()
             THEN NOW()
             ELSE rate_limit_buckets.window_started_at
           END,
           request_count=CASE
             WHEN rate_limit_buckets.expires_at IS NULL OR rate_limit_buckets.expires_at <= NOW()
             THEN 1
             ELSE rate_limit_buckets.request_count+1
           END,
           expires_at=CASE
             WHEN rate_limit_buckets.expires_at IS NULL OR rate_limit_buckets.expires_at <= NOW()
             THEN NOW() + ($2 * INTERVAL '1 millisecond')
             ELSE rate_limit_buckets.expires_at
           END,
           updated_at=NOW()
         RETURNING request_count`,
        [key, windowMs],
      );
      const row = result.rows[0];
      return row ? Number(row.request_count) : null;
    },
    async deleteExpiredRateLimitBuckets() {
      const result = await queryPort.query<{ bucket_key: string }>(
        `DELETE FROM rate_limit_buckets
         WHERE expires_at <= NOW()
         RETURNING bucket_key`,
      );
      return result.rows.length;
    },
  };
}
