import { databasePool } from './db';
import { createPostgresRateLimitRepository } from './modules/platform-foundation/rate-limits/adapters/postgresRateLimitRepository';
import { createRateLimitService } from './modules/platform-foundation/rate-limits/application/rateLimitService';

function createService() {
  return createRateLimitService(
    databasePool ? createPostgresRateLimitRepository(databasePool) : null,
  );
}

export function consumeDistributedRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number,
): Promise<boolean | null> {
  return createService().consumeDistributedRateLimit(key, windowMs, maxRequests);
}

export function deleteExpiredRateLimitBuckets(): Promise<number> {
  return createService().deleteExpiredRateLimitBuckets();
}
