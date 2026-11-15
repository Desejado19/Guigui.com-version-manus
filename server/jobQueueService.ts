import { randomUUID } from 'node:crypto';
import { databasePool, withDbIdentity } from './db';

// Infraestrutura de plataforma (processador de background): escreve sempre
// como sistema, no padrão da auditoria (fase 1).

export type JobType = 'notification' | 'webhook' | 'export' | 'backup' | 'reconciliation';

export interface QueueJob<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  payload: T;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
}

const memoryQueue: QueueJob[] = [];

export async function enqueueJob<T extends Record<string, unknown>>(
  type: JobType,
  payload: T,
  options: { idempotencyKey?: string; maxAttempts?: number } = {},
): Promise<QueueJob<T>> {
  const id = randomUUID();
  const maxAttempts = options.maxAttempts || 5;
  if (databasePool) {
    const result = await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
      databasePool!.query<QueueJob<T>>(
        `INSERT INTO async_jobs (id, job_type, payload, idempotency_key, max_attempts)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (idempotency_key) DO UPDATE SET id=async_jobs.id
         RETURNING id, job_type AS type, payload, attempts, max_attempts AS "maxAttempts", available_at AS "availableAt"`,
        [id, type, JSON.stringify(payload), options.idempotencyKey || null, maxAttempts],
      ),
    );
    return result.rows[0] as QueueJob<T>;
  }
  const job = { id, type, payload, attempts: 0, maxAttempts, availableAt: new Date().toISOString() };
  memoryQueue.push(job);
  return job;
}

export async function claimJob(): Promise<QueueJob | null> {
  if (!databasePool) return memoryQueue.shift() || null;
  const result = await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
  databasePool!.query<QueueJob>(
    `UPDATE async_jobs
     SET status='processing', attempts=attempts+1, locked_at=NOW()
     WHERE id = (
       SELECT id FROM async_jobs
       WHERE status='pending' AND available_at <= NOW()
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED LIMIT 1
     )
     RETURNING id, job_type AS type, payload, attempts, max_attempts AS "maxAttempts", available_at AS "availableAt"`,
  ));
  return result.rows[0] || null;
}

export async function completeJob(id: string): Promise<void> {
  if (!databasePool) return;
  await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
    databasePool!.query(`UPDATE async_jobs SET status='completed', completed_at=NOW() WHERE id=$1`, [id]),
  );
}

export async function failJob(id: string, error: Error): Promise<'retrying' | 'dead-letter'> {
  const message = error.message.slice(0, 2000);
  if (!databasePool) return 'dead-letter';
  const result = await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
  databasePool!.query<{ attempts: number; max_attempts: number }>(
    `UPDATE async_jobs
     SET status=CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
         available_at=CASE WHEN attempts >= max_attempts THEN available_at ELSE NOW() + (POWER(2, attempts) * INTERVAL '1 minute') END,
         last_error=$2, locked_at=NULL
     WHERE id=$1
     RETURNING attempts, max_attempts`,
    [id, message],
  ));
  // (result.rows)
  if (!result.rows) return 'dead-letter';
  const row = result.rows[0];
  return row && row.attempts >= row.max_attempts ? 'dead-letter' : 'retrying';
}
