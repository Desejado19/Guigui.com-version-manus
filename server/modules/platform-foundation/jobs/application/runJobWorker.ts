import { sanitizeDiagnostic } from '../../diagnostics/sanitizeDiagnostic';
import type {
  JobType,
  LeasedQueueJob,
} from '../domain/jobQueue';
import { JOB_TYPES } from '../domain/jobQueue';
import type { OperationsMaintenanceSummary } from '../../maintenance/application/runOperationsMaintenance';

const IDLE_POLL_MS = 1_000;
const LEASE_RENEWAL_MS = 60_000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1_000;
const MAX_BACKOFF_MS = 30_000;

export type JobExecutionContext = {
  signal: AbortSignal;
  idempotencyKey?: string;
};

export type JobHandler = (
  payload: Record<string, unknown>,
  context: JobExecutionContext,
) => Promise<void>;

export interface JobQueueOperations {
  claimJob(registeredTypes: readonly JobType[]): Promise<LeasedQueueJob | null>;
  renewJobLease(id: string, leaseToken: string): Promise<boolean>;
  completeJob(id: string, leaseToken: string): Promise<boolean>;
  failJob(
    id: string,
    leaseToken: string,
    error: unknown,
  ): Promise<'retrying' | 'dead-letter' | 'lease-lost'>;
}

export type JobHandlerRegistry = Partial<Record<JobType, JobHandler>>;

export interface JobWorkerDependencies {
  queue: JobQueueOperations;
  handlers: JobHandlerRegistry;
  runMaintenance(now: Date): Promise<OperationsMaintenanceSummary>;
  signal: AbortSignal;
  now(): Date;
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
  logger: Pick<Console, 'error' | 'warn'>;
}

export function assertWorkerDatabaseReady(database: {
  configured: boolean;
  connected: boolean;
}): void {
  if (!database.configured) {
    throw new Error('DATABASE_URL is required for the worker.');
  }
  if (!database.connected) {
    throw new Error('PostgreSQL must be connected before the worker starts.');
  }
}

function logFailure(
  logger: Pick<Console, 'error' | 'warn'>,
  level: 'error' | 'warn',
  event: string,
  error: unknown,
): void {
  logger[level](JSON.stringify({
    event,
    message: sanitizeDiagnostic(error),
  }));
}

async function executeJob(
  dependencies: JobWorkerDependencies,
  job: LeasedQueueJob,
  handler: JobHandler,
): Promise<void> {
  const handlerController = new AbortController();
  const heartbeatController = new AbortController();
  let leaseLost = false;
  let renewalFailed = false;

  const heartbeat = async (): Promise<void> => {
    while (!heartbeatController.signal.aborted) {
      await dependencies.sleep(LEASE_RENEWAL_MS, heartbeatController.signal);
      if (heartbeatController.signal.aborted) return;

      try {
        const renewed = await dependencies.queue.renewJobLease(job.id, job.leaseToken);
        if (!renewed) {
          leaseLost = true;
          handlerController.abort();
          logFailure(dependencies.logger, 'warn', 'worker_lease_lost', job.id);
          return;
        }
      } catch (error) {
        renewalFailed = true;
        handlerController.abort();
        logFailure(dependencies.logger, 'error', 'worker_lease_renewal_failed', error);
        return;
      }
    }
  };

  const heartbeatTask = heartbeat();
  let handlerFailed = false;
  let handlerError: unknown;
  try {
    await handler(job.payload, {
      signal: handlerController.signal,
      ...(job.idempotencyKey ? { idempotencyKey: job.idempotencyKey } : {}),
    });
  } catch (error) {
    handlerFailed = true;
    handlerError = error;
  } finally {
    heartbeatController.abort();
    await heartbeatTask;
  }

  if (leaseLost || renewalFailed) return;

  if (handlerFailed) {
    try {
      const result = await dependencies.queue.failJob(job.id, job.leaseToken, handlerError);
      if (result === 'lease-lost') {
        logFailure(dependencies.logger, 'warn', 'worker_failure_lease_lost', job.id);
      }
    } catch (error) {
      logFailure(dependencies.logger, 'error', 'worker_failure_write_failed', error);
    }
    return;
  }

  try {
    const completed = await dependencies.queue.completeJob(job.id, job.leaseToken);
    if (!completed) {
      logFailure(dependencies.logger, 'warn', 'worker_completion_lease_lost', job.id);
    }
  } catch (error) {
    logFailure(dependencies.logger, 'error', 'worker_completion_write_failed', error);
  }
}

export async function runJobWorker(dependencies: JobWorkerDependencies): Promise<void> {
  const registeredTypes = JOB_TYPES.filter((type) => dependencies.handlers[type]);
  let nextMaintenanceAt = Number.NEGATIVE_INFINITY;
  let consecutiveFailures = 0;

  while (!dependencies.signal.aborted) {
    try {
      const currentTime = dependencies.now();
      if (currentTime.getTime() >= nextMaintenanceAt) {
        await dependencies.runMaintenance(currentTime);
        nextMaintenanceAt = dependencies.now().getTime() + MAINTENANCE_INTERVAL_MS;
      }

      if (registeredTypes.length === 0) {
        await dependencies.sleep(IDLE_POLL_MS, dependencies.signal);
        continue;
      }

      const job = await dependencies.queue.claimJob(registeredTypes);
      consecutiveFailures = 0;
      if (!job) {
        await dependencies.sleep(IDLE_POLL_MS, dependencies.signal);
        continue;
      }

      const handler = dependencies.handlers[job.type];
      if (!handler) {
        logFailure(dependencies.logger, 'warn', 'worker_handler_missing', job.type);
        continue;
      }
      await executeJob(dependencies, job, handler);
    } catch (error) {
      if (dependencies.signal.aborted) break;
      logFailure(dependencies.logger, 'error', 'worker_operation_failed', error);
      const delay = Math.min(1_000 * (2 ** consecutiveFailures), MAX_BACKOFF_MS);
      consecutiveFailures += 1;
      await dependencies.sleep(delay, dependencies.signal);
    }
  }
}
