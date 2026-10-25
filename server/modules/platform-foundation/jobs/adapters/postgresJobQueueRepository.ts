import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  JobFailureResult,
  JobQueueRepository,
  JobType,
  LeasedQueueJob,
  QueueJob,
} from '../domain/jobQueue';

type JobQueueQueryPort = Pick<Pool, 'query'>;

interface JobQueueRow {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  idempotencyKey: string | null;
  leaseToken?: string;
  status?: 'pending' | 'dead_letter';
}

function toQueueJob<T extends Record<string, unknown>>(row: JobQueueRow): QueueJob<T> {
  if (
    typeof row.id !== 'string'
    || typeof row.type !== 'string'
    || typeof row.payload !== 'object'
    || row.payload === null
    || typeof row.attempts !== 'number'
    || typeof row.maxAttempts !== 'number'
    || typeof row.availableAt !== 'string'
  ) {
    throw new Error('Invalid PostgreSQL job queue result.');
  }
  return {
    id: row.id,
    type: row.type,
    payload: row.payload as T,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    availableAt: row.availableAt,
    ...(row.idempotencyKey ? { idempotencyKey: row.idempotencyKey } : {}),
  };
}

const RETURNING_JOB_COLUMNS = `
  id, job_type AS type, payload, attempts, max_attempts AS "maxAttempts",
  available_at::text AS "availableAt", idempotency_key AS "idempotencyKey"`;
const RETURNING_CLAIMED_JOB_COLUMNS = `
  job.id, job.job_type AS type, job.payload, job.attempts, job.max_attempts AS "maxAttempts",
  job.available_at::text AS "availableAt", job.idempotency_key AS "idempotencyKey"`;

export function createPostgresJobQueueRepository(
  queryPort: JobQueueQueryPort,
): JobQueueRepository {
  return {
    async enqueueJob<T extends Record<string, unknown>>(type, payload, options) {
      const result = await queryPort.query<JobQueueRow>(
        `INSERT INTO async_jobs (id, job_type, payload, idempotency_key, max_attempts)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (idempotency_key) DO UPDATE SET id=async_jobs.id
         RETURNING ${RETURNING_JOB_COLUMNS}`,
        [
          randomUUID(),
          type,
          JSON.stringify(payload),
          options.idempotencyKey ?? null,
          options.maxAttempts,
        ],
      );
      const row = result.rows[0];
      if (!row) throw new Error('PostgreSQL did not return the enqueued job.');
      return toQueueJob<T>(row);
    },

    async claimJob(registeredTypes): Promise<LeasedQueueJob | null> {
      if (registeredTypes.length === 0) return null;
      const leaseToken = randomUUID();
      const result = await queryPort.query<JobQueueRow>(
        `WITH exhausted_leases AS (
           UPDATE async_jobs
           SET status='dead_letter', dead_lettered_at=NOW(), locked_at=NULL, lease_token=NULL
           WHERE status='processing'
             AND locked_at <= NOW() - INTERVAL '5 minutes'
             AND attempts >= max_attempts
             AND job_type = ANY($1::text[])
         ), candidate AS (
           SELECT id
           FROM async_jobs
           WHERE job_type = ANY($1::text[])
             AND (
               (status='pending' AND available_at <= NOW())
               OR (
                 status='processing'
                 AND locked_at <= NOW() - INTERVAL '5 minutes'
                 AND attempts < max_attempts
               )
             )
           ORDER BY available_at, created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE async_jobs AS job
         SET status='processing', attempts=job.attempts+1, locked_at=NOW(), lease_token=$2::uuid
         FROM candidate
         WHERE job.id=candidate.id
         RETURNING ${RETURNING_CLAIMED_JOB_COLUMNS}, job.lease_token::text AS "leaseToken"`,
        [registeredTypes, leaseToken],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (typeof row.leaseToken !== 'string') {
        throw new Error('PostgreSQL did not return a job lease token.');
      }
      return {
        ...toQueueJob(row),
        leaseToken: row.leaseToken,
      };
    },

    async renewJobLease(id, leaseToken) {
      const result = await queryPort.query<{ id: string }>(
        `UPDATE async_jobs
         SET locked_at=NOW()
         WHERE id=$1 AND status='processing' AND lease_token=$2::uuid
           AND locked_at > NOW() - INTERVAL '5 minutes'
         RETURNING id`,
        [id, leaseToken],
      );
      return result.rows.length === 1;
    },

    async completeJob(id, leaseToken) {
      const result = await queryPort.query<{ id: string }>(
        `UPDATE async_jobs
         SET status='completed', completed_at=NOW(), locked_at=NULL, lease_token=NULL
         WHERE id=$1 AND status='processing' AND lease_token=$2::uuid
           AND locked_at > NOW() - INTERVAL '5 minutes'
         RETURNING id`,
        [id, leaseToken],
      );
      return result.rows.length === 1;
    },

    async failJob(id, leaseToken, diagnostic): Promise<JobFailureResult> {
      const result = await queryPort.query<{ status: 'pending' | 'dead_letter' }>(
        `UPDATE async_jobs
         SET status=CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
             dead_lettered_at=CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END,
             available_at=CASE WHEN attempts >= max_attempts THEN available_at
               ELSE NOW() + (POWER(2, attempts) * INTERVAL '1 minute') END,
             last_error=$3, locked_at=NULL, lease_token=NULL
         WHERE id=$1 AND status='processing' AND lease_token=$2::uuid
           AND locked_at > NOW() - INTERVAL '5 minutes'
         RETURNING status`,
        [id, leaseToken, diagnostic],
      );
      const status = result.rows[0]?.status;
      if (!status) return 'lease-lost';
      return status === 'dead_letter' ? 'dead-letter' : 'retrying';
    },
  };
}
