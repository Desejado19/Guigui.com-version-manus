import { createHash } from 'node:crypto';
import { consumeDistributedRateLimit, resetDistributedRateLimit } from './rateLimitService';

// Fallback apenas quando não há base de dados (dev/testes sem Postgres).
const memoryBuckets = new Map<string, { startedAt: number; count: number }>();

function bucketKey(scope: string, account: string): string {
  const digest = createHash('sha256').update(`${scope}\0${account.trim().toLowerCase()}`).digest('hex');
  return `account:${scope}:${digest}`;
}

/**
 * Balde por conta: usa `rate_limit_buckets` quando existe base de dados e
 * memória local apenas como fallback. O identificador é sempre derivado por
 * hash para não guardar e-mails/telemóveis/tokens em claro.
 */
export async function consumeAccountRateLimit(
  scope: string,
  account: string,
  windowMs: number,
  maxAttempts: number,
): Promise<boolean> {
  const key = bucketKey(scope, account);
  const distributed = await consumeDistributedRateLimit(key, windowMs, maxAttempts);
  if (distributed !== null) return distributed;

  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    memoryBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= maxAttempts) return false;
  current.count += 1;
  return true;
}

export async function resetAccountRateLimit(scope: string, account: string): Promise<void> {
  const key = bucketKey(scope, account);
  const distributed = await resetDistributedRateLimit(key);
  if (distributed === null) memoryBuckets.delete(key);
}

export function accountRateLimitKey(scope: string, account: string): string {
  return bucketKey(scope, account);
}
