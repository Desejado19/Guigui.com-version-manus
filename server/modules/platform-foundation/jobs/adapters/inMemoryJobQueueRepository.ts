import { randomUUID } from 'node:crypto';
import type {
  JobFailureResult,
  JobQueueRepository,
  JobType,
  LeasedQueueJob,
  QueueJob,
} from '../domain/jobQueue';

const LEASE_DURATION_MS = 5 * 60 * 1000;

type StoredJob = QueueJob & {
  status: 'pending' | 'processing' | 'completed' | 'dead_letter';
  createdAt: number;
  lockedAt: number | null;
  leaseToken: string | null;
  deadLetteredAt: number | null;
  lastError: string | null;
};

function toQueueJob<T extends Record<string, unknown>>(job: StoredJob): QueueJob<T> {
  return {
    id: job.id,
    type: job.type,
    payload: job.payload as T,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt,
    ...(job.idempotencyKey ? { idempotencyKey: job.idempotencyKey } : {}),
  };
}

function hasCurrentLease(job: StoredJob, leaseToken: string, now: number): boolean {
  return job.status === 'processing'
    && job.leaseToken === leaseToken
    && job.lockedAt !== null
    && now - job.lockedAt < LEASE_DURATION_MS;
}

export function createInMemoryJobQueueRepository(): JobQueueRepository {
  const jobs: StoredJob[] = [];

  return {
    async enqueueJob<T extends Record<string, unknown>>(type, payload, options) {
      const now = Date.now();
      const job: StoredJob = {
        id: randomUUID(),
        type,
        payload,
        attempts: 0,
        maxAttempts: options.maxAttempts,
        availableAt: new Date(now).toISOString(),
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
        status: 'pending',
        createdAt: now,
        lockedAt: null,
        leaseToken: null,
        deadLetteredAt: null,
        lastError: null,
      };
      jobs.push(job);
      return toQueueJob<T>(job);
    },

    async claimJob(registeredTypes) {
      const now = Date.now();
      const registered = new Set(registeredTypes);
      for (const job of jobs) {
        if (
          job.status === 'processing'
          && job.lockedAt !== null
          && now - job.lockedAt >= LEASE_DURATION_MS
          && job.attempts >= job.maxAttempts
          && registered.has(job.type)
        ) {
          job.status = 'dead_letter';
          job.deadLetteredAt = now;
          job.lockedAt = null;
          job.leaseToken = null;
        }
      }

      const candidates = jobs
        .filter((job) => registered.has(job.type) && (
          (job.status === 'pending' && Date.parse(job.availableAt) <= now)
          || (
            job.status === 'processing'
            && job.lockedAt !== null
            && now - job.lockedAt >= LEASE_DURATION_MS
            && job.attempts < job.maxAttempts
          )
        ))
        .sort((left, right) => Date.parse(left.availableAt) - Date.parse(right.availableAt)
          || left.createdAt - right.createdAt);
      const job = candidates[0];
      if (!job) return null;

      job.status = 'processing';
      job.attempts += 1;
      job.lockedAt = now;
      job.leaseToken = randomUUID();
      return {
        ...toQueueJob(job),
        leaseToken: job.leaseToken,
      };
    },

    async renewJobLease(id, leaseToken) {
      const job = jobs.find((candidate) => candidate.id === id);
      const now = Date.now();
      if (!job || !hasCurrentLease(job, leaseToken, now)) return false;
      job.lockedAt = now;
      return true;
    },

    async completeJob(id, leaseToken) {
      const job = jobs.find((candidate) => candidate.id === id);
      if (!job || !hasCurrentLease(job, leaseToken, Date.now())) return false;
      job.status = 'completed';
      job.lockedAt = null;
      job.leaseToken = null;
      return true;
    },

    async failJob(id, leaseToken, diagnostic): Promise<JobFailureResult> {
      const job = jobs.find((candidate) => candidate.id === id);
      const now = Date.now();
      if (!job || !hasCurrentLease(job, leaseToken, now)) return 'lease-lost';

      job.lastError = diagnostic;
      job.lockedAt = null;
      job.leaseToken = null;
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead_letter';
        job.deadLetteredAt = now;
        return 'dead-letter';
      }

      job.status = 'pending';
      job.availableAt = new Date(now + (2 ** job.attempts) * 60_000).toISOString();
      return 'retrying';
    },
  };
}
