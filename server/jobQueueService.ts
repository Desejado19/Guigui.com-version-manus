import { databasePool } from './db';
import { createJobQueueService } from './modules/platform-foundation/jobs/application/jobQueueService';
import { createInMemoryJobQueueRepository } from './modules/platform-foundation/jobs/adapters/inMemoryJobQueueRepository';
import { createPostgresJobQueueRepository } from './modules/platform-foundation/jobs/adapters/postgresJobQueueRepository';
import type { JobType, QueueJob } from './modules/platform-foundation/jobs/domain/jobQueue';

export type { JobType, QueueJob } from './modules/platform-foundation/jobs/domain/jobQueue';
export { JOB_TYPES } from './modules/platform-foundation/jobs/domain/jobQueue';

const service = createJobQueueService(
  databasePool
    ? createPostgresJobQueueRepository(databasePool)
    : createInMemoryJobQueueRepository(),
);

function requireProductionPostgreSQL(): void {
  if (!databasePool && process.env.NODE_ENV === 'production') {
    throw new Error('PostgreSQL is required for production queue operations.');
  }
}

export async function enqueueJob<T extends Record<string, unknown>>(
  type: JobType,
  payload: T,
  options: { idempotencyKey?: string; maxAttempts?: number } = {},
): Promise<QueueJob<T>> {
  requireProductionPostgreSQL();
  return service.enqueueJob(type, payload, options);
}

export async function claimJob(registeredTypes: readonly JobType[]) {
  requireProductionPostgreSQL();
  return service.claimJob(registeredTypes);
}

export async function renewJobLease(id: string, leaseToken: string): Promise<boolean> {
  requireProductionPostgreSQL();
  return service.renewJobLease(id, leaseToken);
}

export async function completeJob(id: string, leaseToken: string): Promise<boolean> {
  requireProductionPostgreSQL();
  return service.completeJob(id, leaseToken);
}

export async function failJob(id: string, leaseToken: string, error: unknown) {
  requireProductionPostgreSQL();
  return service.failJob(id, leaseToken, error);
}
