export interface RateLimitRepository {
  consumeDistributedRateLimit(
    key: string,
    windowMs: number,
  ): Promise<number | null>;
  deleteExpiredRateLimitBuckets(now: Date): Promise<number>;
}

export interface RateLimitService {
  consumeDistributedRateLimit(
    key: string,
    windowMs: number,
    maxRequests: number,
  ): Promise<boolean | null>;
  deleteExpiredRateLimitBuckets(): Promise<number>;
}

export function createRateLimitService(
  repository: RateLimitRepository | null,
  now: () => Date = () => new Date(),
): RateLimitService {
  return {
    async consumeDistributedRateLimit(key, windowMs, maxRequests) {
      if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
        throw new RangeError('windowMs must be a positive integer.');
      }
      if (!Number.isSafeInteger(maxRequests) || maxRequests <= 0) {
        throw new RangeError('maxRequests must be a positive integer.');
      }
      if (!repository) return null;

      const requestCount = await repository.consumeDistributedRateLimit(
        key,
        windowMs,
      );
      return requestCount === null ? false : requestCount <= maxRequests;
    },
    async deleteExpiredRateLimitBuckets() {
      if (!repository) {
        throw new Error('PostgreSQL is required to delete rate-limit buckets.');
      }
      return repository.deleteExpiredRateLimitBuckets(now());
    },
  };
}
