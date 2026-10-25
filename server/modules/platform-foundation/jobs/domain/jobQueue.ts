export const JOB_TYPES = [
  'notification',
  'webhook',
  'export',
  'backup',
  'reconciliation',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export interface QueueJob<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  payload: T;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  idempotencyKey?: string;
}

export type LeasedQueueJob<T = Record<string, unknown>> = QueueJob<T> & {
  leaseToken: string;
};

export type JobFailureResult = 'retrying' | 'dead-letter' | 'lease-lost';

export interface JobQueueRepository {
  enqueueJob<T extends Record<string, unknown>>(
    type: JobType,
    payload: T,
    options: { idempotencyKey?: string; maxAttempts: number },
  ): Promise<QueueJob<T>>;
  claimJob(registeredTypes: readonly JobType[]): Promise<LeasedQueueJob | null>;
  renewJobLease(id: string, leaseToken: string): Promise<boolean>;
  completeJob(id: string, leaseToken: string): Promise<boolean>;
  failJob(id: string, leaseToken: string, diagnostic: string): Promise<JobFailureResult>;
}
