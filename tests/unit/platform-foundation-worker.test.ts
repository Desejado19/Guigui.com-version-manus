import { describe, expect, it, vi } from 'vitest';
import {
  assertWorkerDatabaseReady,
  runJobWorker,
  type JobQueueOperations,
  type JobWorkerDependencies,
} from '../../server/modules/platform-foundation/jobs/application/runJobWorker';
import type { JobType, LeasedQueueJob } from '../../server/modules/platform-foundation/jobs/domain/jobQueue';

const leasedJob: LeasedQueueJob = {
  id: 'job-1',
  type: 'notification',
  payload: { message: 'hello' },
  attempts: 1,
  maxAttempts: 5,
  availableAt: '2026-10-25T13:00:00.000Z',
  leaseToken: 'lease-1',
};

function createQueue(
  overrides: Partial<JobQueueOperations> = {},
): JobQueueOperations {
  return {
    claimJob: vi.fn().mockResolvedValue(null),
    renewJobLease: vi.fn().mockResolvedValue(true),
    completeJob: vi.fn().mockResolvedValue(true),
    failJob: vi.fn().mockResolvedValue('retrying'),
    ...overrides,
  };
}

function createDependencies(
  controller: AbortController,
  overrides: Partial<JobWorkerDependencies> = {},
): JobWorkerDependencies {
  return {
    queue: createQueue(),
    handlers: { notification: vi.fn().mockResolvedValue(undefined) },
    runMaintenance: vi.fn().mockResolvedValue({
      expiredRateLimitBuckets: 0,
      completedJobs: 0,
      deadLetterJobs: 0,
      expiredProductEvents: 0,
    }),
    signal: controller.signal,
    now: () => new Date('2026-10-25T13:00:00.000Z'),
    sleep: async () => undefined,
    logger: { error: vi.fn(), warn: vi.fn() },
    ...overrides,
  };
}

describe('platform-foundation continuous worker', () => {
  it('continues polling while the queue is idle', async () => {
    const controller = new AbortController();
    const queue = createQueue({
      claimJob: vi.fn(async () => {
        if (vi.mocked(queue.claimJob).mock.calls.length === 2) controller.abort();
        return null;
      }),
    });
    const worker = createDependencies(controller, { queue });

    await runJobWorker(worker);

    expect(queue.claimJob).toHaveBeenCalledTimes(2);
  });

  it('does not claim jobs without registered handlers', async () => {
    const controller = new AbortController();
    const queue = createQueue();
    const worker = createDependencies(controller, {
      queue,
      handlers: {},
      sleep: async () => controller.abort(),
    });

    await runJobWorker(worker);

    expect(queue.claimJob).not.toHaveBeenCalled();
  });

  it('renews the active lease once per minute while the handler runs', async () => {
    const controller = new AbortController();
    let claimCount = 0;
    let heartbeatCount = 0;
    let finishHandler: (() => void) | undefined;
    const handlerFinished = new Promise<void>((resolve) => {
      finishHandler = resolve;
    });
    const queue = createQueue({
      claimJob: vi.fn(async (_types: readonly JobType[]) => {
        claimCount += 1;
        if (claimCount === 2) controller.abort();
        return claimCount === 1 ? leasedJob : null;
      }),
      renewJobLease: vi.fn(async () => {
        heartbeatCount += 1;
        if (heartbeatCount === 2) finishHandler?.();
        return true;
      }),
    });
    const handler = vi.fn(() => handlerFinished);
    const sleep = vi.fn(async () => undefined);
    const worker = createDependencies(controller, {
      queue,
      handlers: { notification: handler },
      sleep,
    });

    await runJobWorker(worker);

    expect(queue.renewJobLease).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(60_000, expect.any(AbortSignal));
    expect(queue.completeJob).toHaveBeenCalledWith(leasedJob.id, leasedJob.leaseToken);
  });

  it('aborts the handler after lease loss and does not acknowledge the job', async () => {
    const controller = new AbortController();
    let claimCount = 0;
    const queue = createQueue({
      claimJob: vi.fn(async () => {
        claimCount += 1;
        if (claimCount === 2) controller.abort();
        return claimCount === 1 ? leasedJob : null;
      }),
      renewJobLease: vi.fn().mockResolvedValue(false),
    });
    const handler = vi.fn((_payload: Record<string, unknown>, context: { signal: AbortSignal }) => (
      new Promise<void>((resolve) => context.signal.addEventListener('abort', () => resolve(), { once: true }))
    ));
    const worker = createDependencies(controller, {
      queue,
      handlers: { notification: handler },
      sleep: async (milliseconds) => {
        if (milliseconds === 60_000) return;
      },
    });

    await runJobWorker(worker);

    expect(handler).toHaveBeenCalled();
    expect(queue.completeJob).not.toHaveBeenCalled();
    expect(queue.failJob).not.toHaveBeenCalled();
  });

  it('aborts the handler when lease renewal fails', async () => {
    const controller = new AbortController();
    let claimCount = 0;
    const queue = createQueue({
      claimJob: vi.fn(async () => {
        claimCount += 1;
        if (claimCount === 2) controller.abort();
        return claimCount === 1 ? leasedJob : null;
      }),
      renewJobLease: vi.fn().mockRejectedValue(new Error('lease database unavailable')),
    });
    const handler = vi.fn((_payload: Record<string, unknown>, context: { signal: AbortSignal }) => (
      new Promise<void>((resolve) => context.signal.addEventListener('abort', () => resolve(), { once: true }))
    ));
    const worker = createDependencies(controller, {
      queue,
      handlers: { notification: handler },
      sleep: async (milliseconds) => {
        if (milliseconds === 60_000) return;
      },
    });

    await runJobWorker(worker);

    expect(handler).toHaveBeenCalled();
    expect(queue.completeJob).not.toHaveBeenCalled();
    expect(queue.failJob).not.toHaveBeenCalled();
  });

  it('stops claiming and drains the active handler on shutdown', async () => {
    const controller = new AbortController();
    let claimCount = 0;
    let finishHandler: (() => void) | undefined;
    let markHandlerStarted: (() => void) | undefined;
    const handlerStarted = new Promise<void>((resolve) => {
      markHandlerStarted = resolve;
    });
    const handlerFinished = new Promise<void>((resolve) => {
      finishHandler = resolve;
    });
    const queue = createQueue({
      claimJob: vi.fn(async () => {
        claimCount += 1;
        return claimCount === 1 ? leasedJob : null;
      }),
    });
    const handler = vi.fn(() => {
      markHandlerStarted?.();
      return handlerFinished;
    });
    const worker = createDependencies(controller, {
      queue,
      handlers: { notification: handler },
      sleep: async () => undefined,
    });
    const running = runJobWorker(worker);
    await handlerStarted;
    controller.abort();
    finishHandler?.();
    await running;

    expect(queue.claimJob).toHaveBeenCalledTimes(1);
    expect(queue.completeJob).toHaveBeenCalledWith(leasedJob.id, leasedJob.leaseToken);
  });

  it('backs off database failures exponentially up to 30 seconds', async () => {
    const controller = new AbortController();
    const delays: number[] = [];
    let attempts = 0;
    const queue = createQueue({
      claimJob: vi.fn(async () => {
        attempts += 1;
        if (attempts <= 7) throw new Error('database connection failed');
        controller.abort();
        return null;
      }),
    });
    const worker = createDependencies(controller, {
      queue,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    });

    await runJobWorker(worker);

    expect(delays.slice(0, 7)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });

  it('runs maintenance at startup and again after one hour', async () => {
    const controller = new AbortController();
    let currentTime = new Date('2026-10-25T13:00:00.000Z');
    let claimCount = 0;
    const queue = createQueue({
      claimJob: vi.fn(async () => {
        claimCount += 1;
        if (claimCount === 2) controller.abort();
        return null;
      }),
    });
    const sleep = vi.fn(async (milliseconds: number) => {
      if (milliseconds === 1_000) {
        currentTime = new Date(currentTime.getTime() + 60 * 60 * 1000);
      }
    });
    const worker = createDependencies(controller, {
      queue,
      now: () => currentTime,
      sleep,
    });

    await runJobWorker(worker);

    expect(worker.runMaintenance).toHaveBeenCalledTimes(2);
  });

  it('requires a configured and connected PostgreSQL database before starting', () => {
    expect(() => assertWorkerDatabaseReady({ configured: false, connected: false })).toThrow(
      'DATABASE_URL is required for the worker.',
    );
    expect(() => assertWorkerDatabaseReady({ configured: true, connected: false })).toThrow(
      'PostgreSQL must be connected before the worker starts.',
    );
    expect(() => assertWorkerDatabaseReady({ configured: true, connected: true })).not.toThrow();
  });
});
