// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pollDeploy } from '../../../src/utils/deployPoller';

vi.mock('p-retry', () => {
  const retry = vi.fn();
  retry.mockResolvedValue({ status: 'succeeded' });
  return { default: retry, pRetry: retry };
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('deployPoller async retry', () => {
  it('succeeds after retries', async () => {
    const result = await pollDeploy({
      siteId: 'test',
      environment: 'preview' as const,
      requestId: 'req',
      manifestPath: './dist',
      maxAttempts: 5,
      baseDelayMs: 100,
    });
    expect(result.succeeded).toBe(true);
    expect(result.receipt).toMatchObject({ status: 'succeeded' });
  });
});
