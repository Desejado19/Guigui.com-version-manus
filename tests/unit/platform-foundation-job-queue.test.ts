import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJobQueueService } from '../../server/modules/platform-foundation/jobs/application/jobQueueService';
import { createInMemoryJobQueueRepository } from '../../server/modules/platform-foundation/jobs/adapters/inMemoryJobQueueRepository';

function createQueue() {
  return createJobQueueService(createInMemoryJobQueueRepository());
}

function advanceTime(milliseconds: number): void {
  vi.setSystemTime(Date.now() + milliseconds);
}

describe('platform-foundation job queue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('claims only registered job types', async () => {
    const queue = createQueue();
    await queue.enqueueJob('webhook', { event: 'company.updated' });
    await queue.enqueueJob('notification', { recipient: 'user-1' });

    expect(await queue.claimJob(['export'])).toBeNull();
    const notification = await queue.claimJob(['notification']);
    const webhook = await queue.claimJob(['webhook']);

    expect(notification?.type).toBe('notification');
    expect(webhook?.type).toBe('webhook');
  });

  it('uses a fresh lease token after reclaiming a job', async () => {
    const queue = createQueue();
    await queue.enqueueJob('export', { exportId: 'export-1' });
    const firstLease = await queue.claimJob(['export']);
    advanceTime(6 * 60 * 1000);

    const secondLease = await queue.claimJob(['export']);

    expect(firstLease).not.toBeNull();
    expect(secondLease).not.toBeNull();
    expect(secondLease?.leaseToken).not.toBe(firstLease?.leaseToken);
  });

  it('prevents a late worker from mutating a reclaimed job', async () => {
    const queue = createQueue();
    await queue.enqueueJob('webhook', { event: 'payment.completed' });
    const oldLease = await queue.claimJob(['webhook']);
    advanceTime(6 * 60 * 1000);
    const currentLease = await queue.claimJob(['webhook']);

    if (!oldLease || !currentLease) throw new Error('Expected both lease claims');

    expect(await queue.renewJobLease(oldLease.id, oldLease.leaseToken)).toBe(false);
    expect(await queue.completeJob(oldLease.id, oldLease.leaseToken)).toBe(false);
    expect(await queue.failJob(oldLease.id, oldLease.leaseToken, new Error('late failure'))).toBe('lease-lost');
    expect(await queue.renewJobLease(currentLease.id, currentLease.leaseToken)).toBe(true);
    expect(await queue.completeJob(currentLease.id, currentLease.leaseToken)).toBe(true);
  });

  it('completes a job only when the lease token matches', async () => {
    const queue = createQueue();
    await queue.enqueueJob('export', { exportId: 'export-2' });
    const lease = await queue.claimJob(['export']);

    if (!lease) throw new Error('Expected a job lease');

    expect(await queue.completeJob(lease.id, 'stale-token')).toBe(false);
    expect(await queue.renewJobLease(lease.id, lease.leaseToken)).toBe(true);
    expect(await queue.completeJob(lease.id, lease.leaseToken)).toBe(true);
  });

  it('does not let an expired lease renew before another worker reclaims it', async () => {
    const queue = createQueue();
    await queue.enqueueJob('export', { exportId: 'export-3' });
    const lease = await queue.claimJob(['export']);

    if (!lease) throw new Error('Expected a job lease');

    advanceTime(5 * 60 * 1000);

    expect(await queue.renewJobLease(lease.id, lease.leaseToken)).toBe(false);
    expect(await queue.completeJob(lease.id, lease.leaseToken)).toBe(false);
  });

  it('fails a job only when the lease token matches', async () => {
    const queue = createQueue();
    await queue.enqueueJob('notification', { recipient: 'user-2' });
    const lease = await queue.claimJob(['notification']);

    if (!lease) throw new Error('Expected a job lease');

    expect(await queue.failJob(lease.id, 'stale-token', new Error('stale failure'))).toBe('lease-lost');
    expect(await queue.renewJobLease(lease.id, lease.leaseToken)).toBe(true);
    expect(await queue.failJob(lease.id, lease.leaseToken, new Error('retryable failure'))).toBe('retrying');
  });

  it('reclaims expired leases and dead-letters after the attempt limit', async () => {
    const queue = createQueue();
    await queue.enqueueJob('reconciliation', { runId: 'run-1' }, { maxAttempts: 2 });
    const firstAttempt = await queue.claimJob(['reconciliation']);
    advanceTime(6 * 60 * 1000);
    const finalAttempt = await queue.claimJob(['reconciliation']);
    advanceTime(6 * 60 * 1000);

    const afterAttemptLimit = await queue.claimJob(['reconciliation']);

    expect(firstAttempt?.attempts).toBe(1);
    expect(finalAttempt?.attempts).toBe(2);
    expect(afterAttemptLimit).toBeNull();
  });

  it('does not fall back to a process-local queue in production without PostgreSQL', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', '');
    const { enqueueJob } = await import('../../server/jobQueueService');

    await expect(enqueueJob('notification', { recipient: 'user-3' }))
      .rejects.toThrow('PostgreSQL is required for production queue operations.');
  });
});
