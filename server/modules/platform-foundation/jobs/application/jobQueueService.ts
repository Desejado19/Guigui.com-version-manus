import type {
  JobFailureResult,
  JobQueueRepository,
  JobType,
  LeasedQueueJob,
  QueueJob,
} from '../domain/jobQueue';
import { sanitizeDiagnostic } from '../../diagnostics/sanitizeDiagnostic';

export interface JobQueueService {
  enqueueJob<T extends Record<string, unknown>>(
    type: JobType,
    payload: T,
    options?: { idempotencyKey?: string; maxAttempts?: number },
  ): Promise<QueueJob<T>>;
  claimJob(registeredTypes: readonly JobType[]): Promise<LeasedQueueJob | null>;
  renewJobLease(id: string, leaseToken: string): Promise<boolean>;
  completeJob(id: string, leaseToken: string): Promise<boolean>;
  failJob(id: string, leaseToken: string, error: unknown): Promise<JobFailureResult>;
}

export function createJobQueueService(repository: JobQueueRepository): JobQueueService {
  return {
    async enqueueJob(type, payload, options = {}) {
      const maxAttempts = options.maxAttempts || 5;
      return repository.enqueueJob(type, payload, {
        ...options,
        maxAttempts,
      });
    },
    claimJob(registeredTypes) {
      if (registeredTypes.length === 0) return Promise.resolve(null);
      return repository.claimJob([...new Set(registeredTypes)]);
    },
    renewJobLease(id, leaseToken) {
      return repository.renewJobLease(id, leaseToken);
    },
    completeJob(id, leaseToken) {
      return repository.completeJob(id, leaseToken);
    },
    failJob(id, leaseToken, error) {
      return repository.failJob(id, leaseToken, sanitizeDiagnostic(error));
    },
  };
}
