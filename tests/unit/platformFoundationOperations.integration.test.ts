import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { applyPendingMigrations } from '../../server/postgresMigrationRunner';
import { createPostgresJobQueueRepository } from '../../server/modules/platform-foundation/jobs/adapters/postgresJobQueueRepository';
import { createPostgresOperationsMaintenanceRepository } from '../../server/modules/platform-foundation/maintenance/adapters/postgresOperationsMaintenanceRepository';
import { createPostgresRateLimitRepository } from '../../server/modules/platform-foundation/rate-limits/adapters/postgresRateLimitRepository';

const REQUIRED_DATABASE_NAME = 'guigui_pg18_platform_foundation_test';
const connectionString = process.env.PLATFORM_FOUNDATION_TEST_DATABASE_URL?.trim();

function isAllowedLocalTarget(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    return databaseName === REQUIRED_DATABASE_NAME && localHosts.has(url.hostname);
  } catch {
    return false;
  }
}

const approvedConnectionString = isAllowedLocalTarget(connectionString)
  ? connectionString
  : undefined;
const describeWithDatabase = approvedConnectionString ? describe : describe.skip;
const migrationsDirectory = path.resolve(process.cwd(), 'db', 'migrations');
const telemetryMigration = fs.readFileSync(
  path.join(migrationsDirectory, '012_platform_foundation_telemetry_retention.sql'),
  'utf8',
);

let pool: Pool | undefined;
const createdJobIds: string[] = [];
const createdRateLimitKeys: string[] = [];
const createdProductEventIds: string[] = [];
const createdMetricRows: Array<{ metricDate: string; route: string }> = [];

function requirePool(): Pool {
  if (!pool) throw new Error('The isolated platform-foundation database is not connected.');
  return pool;
}

async function assertCurrentDatabase(queryable: Pool | PoolClient = requirePool()): Promise<void> {
  const result = await queryable.query<{ database_name: string; server_version_num: number }>(
    `SELECT current_database() AS database_name,
      current_setting('server_version_num')::int AS server_version_num`,
  );
  const row = result.rows[0];
  if (
    row?.database_name !== REQUIRED_DATABASE_NAME
    || Math.floor(row.server_version_num / 10_000) !== 18
  ) {
    throw new Error('Platform-foundation integration tests require the approved local PostgreSQL 18 database.');
  }
}

async function verifiedQuery<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<{ rows: Row[]; rowCount: number | null }> {
  const target = requirePool();
  await assertCurrentDatabase(target);
  const result = await target.query<Row>(text, values);
  return { rows: result.rows, rowCount: result.rowCount };
}

describe('platform-foundation integration target guard', () => {
  it('rejects URLs that do not point to the named local disposable database', () => {
    expect(isAllowedLocalTarget(undefined)).toBe(false);
    expect(isAllowedLocalTarget('postgres://test@localhost/other_database')).toBe(false);
    expect(isAllowedLocalTarget(
      'postgres://test@db.example.invalid/guigui_pg18_platform_foundation_test',
    )).toBe(false);
    expect(isAllowedLocalTarget(
      'postgres://synthetic@127.0.0.1/guigui_pg18_platform_foundation_test',
    )).toBe(true);
  });
});

describeWithDatabase('platform-foundation PostgreSQL lifecycle', () => {
  beforeAll(async () => {
    pool = new Pool({
      connectionString: approvedConnectionString,
      max: 2,
      connectionTimeoutMillis: 3_000,
    });
    await assertCurrentDatabase();

    const existingTables = await requirePool().query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'`,
    );
    if (
      existingTables.rows.length > 0
      && !existingTables.rows.some((row) => row.table_name === 'guigui_schema_migrations')
    ) {
      throw new Error('The platform-foundation integration database is not empty or migration-tracked.');
    }
    for (const { table_name: tableName } of existingTables.rows) {
      if (tableName === 'guigui_schema_migrations') continue;
      const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;
      const rows = await requirePool().query<{ has_rows: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM public.${quotedTableName}) AS has_rows`,
      );
      if (rows.rows[0]?.has_rows) {
        throw new Error('The platform-foundation integration database must contain no application data.');
      }
    }

    await assertCurrentDatabase();
    await applyPendingMigrations(requirePool(), migrationsDirectory);
    await assertCurrentDatabase();
    const migrationRows = await requirePool().query<{ filename: string }>(
      `SELECT filename FROM public.guigui_schema_migrations ORDER BY filename`,
    );
    expect(migrationRows.rows.map(({ filename }) => filename)).toContain(
      '012_platform_foundation_telemetry_retention.sql',
    );

    const operationRows = await requirePool().query<{
      jobs: number;
      buckets: number;
      product_events: number;
      request_metrics: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::int FROM async_jobs) AS jobs,
        (SELECT COUNT(*)::int FROM rate_limit_buckets) AS buckets,
        (SELECT COUNT(*)::int FROM product_events) AS product_events,
        (SELECT COUNT(*)::int FROM request_metrics) AS request_metrics`,
    );
    expect(operationRows.rows[0]).toEqual({
      jobs: 0,
      buckets: 0,
      product_events: 0,
      request_metrics: 0,
    });
  }, 30_000);

  afterEach(async () => {
    if (!pool) return;
    if (createdJobIds.length > 0) {
      await verifiedQuery(
        'DELETE FROM async_jobs WHERE id = ANY($1::text[])',
        [[...createdJobIds]],
      );
      createdJobIds.length = 0;
    }
    if (createdRateLimitKeys.length > 0) {
      await verifiedQuery(
        'DELETE FROM rate_limit_buckets WHERE bucket_key = ANY($1::text[])',
        [[...createdRateLimitKeys]],
      );
      createdRateLimitKeys.length = 0;
    }
    if (createdProductEventIds.length > 0) {
      await verifiedQuery(
        'DELETE FROM product_events WHERE id = ANY($1::text[])',
        [[...createdProductEventIds]],
      );
      createdProductEventIds.length = 0;
    }
    for (const metric of createdMetricRows) {
      await verifiedQuery(
        'DELETE FROM request_metrics WHERE metric_date = $1::date AND route = $2',
        [metric.metricDate, metric.route],
      );
    }
    createdMetricRows.length = 0;
  });

  afterAll(async () => {
    await pool?.end();
    pool = undefined;
  });

  it('applies the complete migration chain through 012', async () => {
    await assertCurrentDatabase();
    const result = await applyPendingMigrations(requirePool(), migrationsDirectory);

    expect(result.map(({ filename }) => filename)).toContain(
      '012_platform_foundation_telemetry_retention.sql',
    );
  });

  it('normalizes legacy telemetry rows without retaining paths or untyped context', async () => {
    const client = await requirePool().connect();
    const metricDate = '2001-02-03';
    const eventId = `platform-foundation-migration-${randomUUID()}`;
    const privateRoute = `/users/${randomUUID()}?email=synthetic@example.test`;
    try {
      await assertCurrentDatabase(client);
      await client.query('BEGIN');
      const baselineResult = await client.query<{
        requests: number;
        errors: number;
        duration: number;
      }>(
        `SELECT COALESCE(SUM(request_count), 0)::int AS requests,
          COALESCE(SUM(error_count), 0)::int AS errors,
          COALESCE(SUM(total_duration_ms), 0)::int AS duration
         FROM request_metrics WHERE metric_date = $1::date`,
        [metricDate],
      );
      const baseline = baselineResult.rows[0];
      if (!baseline) throw new Error('Could not read the telemetry migration baseline.');

      await assertCurrentDatabase(client);
      await client.query(
        `INSERT INTO request_metrics
          (metric_date, route, request_count, error_count, total_duration_ms)
         VALUES ($1::date, $2, 3, 1, 70)`,
        [metricDate, privateRoute],
      );
      await assertCurrentDatabase(client);
      await client.query(
        `INSERT INTO request_metrics
          (metric_date, route, request_count, error_count, total_duration_ms)
         VALUES ($1::date, $2, 2, 0, 30)`,
        [metricDate, `/companies/${randomUUID()}`],
      );
      await assertCurrentDatabase(client);
      await client.query(
        `INSERT INTO product_events
          (id, event_name, source, context)
         VALUES ($1, 'page_view', 'integration-test', $2::jsonb)`,
        [eventId, JSON.stringify({ email: 'synthetic@example.test' })],
      );
      await assertCurrentDatabase(client);
      await client.query(telemetryMigration);

      const aggregated = await client.query<{
        requests: number;
        errors: number;
        duration: number;
      }>(
        `SELECT request_count AS requests, error_count AS errors,
          total_duration_ms AS duration
         FROM request_metrics
         WHERE metric_date = $1::date AND route = 'unmatched'`,
        [metricDate],
      );
      expect(aggregated.rows[0]).toEqual({
        requests: baseline.requests + 5,
        errors: baseline.errors + 1,
        duration: baseline.duration + 100,
      });
      const legacyRoutes = await client.query<{ route: string }>(
        'SELECT route FROM request_metrics WHERE metric_date = $1::date AND route <> $2',
        [metricDate, 'unmatched'],
      );
      expect(legacyRoutes.rows).toEqual([]);
      const event = await client.query<{ context: Record<string, unknown> }>(
        'SELECT context FROM product_events WHERE id = $1',
        [eventId],
      );
      expect(event.rows[0]?.context).toEqual({});
      expect(JSON.stringify({
        legacyRoutes: legacyRoutes.rows,
        event: event.rows[0],
      })).not.toContain('synthetic@example.test');
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('resets expired rate-limit windows and removes only expired buckets', async () => {
    const repository = createPostgresRateLimitRepository(requirePool());
    const resetKey = `platform-foundation-reset-${randomUUID()}`;
    const expiredKey = `platform-foundation-expired-${randomUUID()}`;
    const activeKey = `platform-foundation-active-${randomUUID()}`;

    await assertCurrentDatabase();
    expect(await repository.consumeDistributedRateLimit(resetKey, 60_000)).toBe(1);
    createdRateLimitKeys.push(resetKey);
    await verifiedQuery(
      `UPDATE rate_limit_buckets SET expires_at = NOW() - INTERVAL '1 minute'
       WHERE bucket_key = $1`,
      [resetKey],
    );
    await assertCurrentDatabase();
    expect(await repository.consumeDistributedRateLimit(resetKey, 60_000)).toBe(1);

    await verifiedQuery(
      `INSERT INTO rate_limit_buckets
        (bucket_key, window_started_at, request_count, updated_at, expires_at)
       VALUES
        ($1, NOW() - INTERVAL '2 minutes', 1, NOW(), NOW() - INTERVAL '1 minute'),
        ($2, NOW(), 1, NOW(), NOW() + INTERVAL '1 hour')`,
      [expiredKey, activeKey],
    );
    createdRateLimitKeys.push(expiredKey, activeKey);
    await assertCurrentDatabase();
    expect(await repository.deleteExpiredRateLimitBuckets(new Date())).toBe(1);
    const activeBucket = await requirePool().query<{ bucket_key: string }>(
      'SELECT bucket_key FROM rate_limit_buckets WHERE bucket_key = $1',
      [activeKey],
    );
    expect(activeBucket.rows).toEqual([{ bucket_key: activeKey }]);
  });

  it('reclaims expired jobs after worker restart and fences the stale worker', async () => {
    const firstWorker = createPostgresJobQueueRepository(requirePool());
    await assertCurrentDatabase();
    const job = await firstWorker.enqueueJob(
      'notification',
      { integrationRun: randomUUID() },
      { idempotencyKey: `platform-foundation-job-${randomUUID()}`, maxAttempts: 3 },
    );
    createdJobIds.push(job.id);
    await assertCurrentDatabase();
    const firstLease = await firstWorker.claimJob(['notification']);
    expect(firstLease).not.toBeNull();
    if (!firstLease) throw new Error('Expected the first worker to claim the test job.');
    await assertCurrentDatabase();
    expect(await firstWorker.renewJobLease(job.id, firstLease.leaseToken)).toBe(true);

    await verifiedQuery(
      `UPDATE async_jobs SET locked_at = NOW() - INTERVAL '6 minutes'
       WHERE id = $1 AND lease_token = $2::uuid`,
      [job.id, firstLease.leaseToken],
    );
    const restartedWorker = createPostgresJobQueueRepository(requirePool());
    await assertCurrentDatabase();
    const reclaimedLease = await restartedWorker.claimJob(['notification']);
    expect(reclaimedLease).not.toBeNull();
    if (!reclaimedLease) throw new Error('Expected the restarted worker to reclaim the test job.');

    expect(reclaimedLease.leaseToken).not.toBe(firstLease.leaseToken);
    await assertCurrentDatabase();
    expect(await restartedWorker.renewJobLease(job.id, reclaimedLease.leaseToken)).toBe(true);
    await assertCurrentDatabase();
    expect(await firstWorker.completeJob(job.id, firstLease.leaseToken)).toBe(false);
    await assertCurrentDatabase();
    expect(await firstWorker.failJob(job.id, firstLease.leaseToken, 'stale worker')).toBe('lease-lost');
    await assertCurrentDatabase();
    expect(await restartedWorker.completeJob(job.id, reclaimedLease.leaseToken)).toBe(true);
  });

  it('applies retention boundaries and preserves active jobs and HTTP metrics', async () => {
    const repository = createPostgresOperationsMaintenanceRepository(requirePool());
    const now = new Date();
    const jobCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000);
    const eventCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1_000);
    const completedIds = [randomUUID(), randomUUID(), randomUUID()];
    const deadLetterIds = [randomUUID(), randomUUID(), randomUUID()];
    const pendingId = randomUUID();
    const processingId = randomUUID();
    const eventIds = [randomUUID(), randomUUID(), randomUUID()].map((id) => `pf-it-${id}`);
    const metricDate = '2001-03-07';
    const metricRoute = `/integration-${randomUUID()}`;

    const insertJob = async (
      id: string,
      status: 'completed' | 'dead_letter' | 'pending' | 'processing',
      terminalAt?: Date,
    ) => {
      if (status === 'completed') {
        await verifiedQuery(
          `INSERT INTO async_jobs
            (id, job_type, payload, status, attempts, max_attempts, completed_at)
           VALUES ($1, 'notification', '{}'::jsonb, 'completed', 1, 5, $2)`,
          [id, terminalAt],
        );
      } else if (status === 'dead_letter') {
        await verifiedQuery(
          `INSERT INTO async_jobs
            (id, job_type, payload, status, attempts, max_attempts, dead_lettered_at)
           VALUES ($1, 'notification', '{}'::jsonb, 'dead_letter', 5, 5, $2)`,
          [id, terminalAt],
        );
      } else {
        await verifiedQuery(
          `INSERT INTO async_jobs
            (id, job_type, payload, status, attempts, max_attempts, locked_at)
           VALUES ($1, 'notification', '{}'::jsonb, $2, 0, 5, NOW() - INTERVAL '40 days')`,
          [id, status],
        );
      }
      createdJobIds.push(id);
    };
    const insertEvent = async (eventId: string, occurredAt: Date) => {
      await verifiedQuery(
        `INSERT INTO product_events (id, event_name, source, occurred_at)
         VALUES ($1, 'page_view', 'integration-test', $2)`,
        [eventId, occurredAt],
      );
      createdProductEventIds.push(eventId);
    };

    await insertJob(completedIds[0]!, 'completed', new Date(jobCutoff.getTime() - 1_000));
    await insertJob(completedIds[1]!, 'completed', jobCutoff);
    await insertJob(completedIds[2]!, 'completed', new Date(jobCutoff.getTime() + 1_000));
    await insertJob(deadLetterIds[0]!, 'dead_letter', new Date(jobCutoff.getTime() - 1_000));
    await insertJob(deadLetterIds[1]!, 'dead_letter', jobCutoff);
    await insertJob(deadLetterIds[2]!, 'dead_letter', new Date(jobCutoff.getTime() + 1_000));
    await insertJob(pendingId, 'pending');
    await insertJob(processingId, 'processing');
    await insertEvent(eventIds[0]!, new Date(eventCutoff.getTime() - 1_000));
    await insertEvent(eventIds[1]!, eventCutoff);
    await insertEvent(eventIds[2]!, new Date(eventCutoff.getTime() + 1_000));
    await verifiedQuery(
      `INSERT INTO request_metrics
        (metric_date, route, request_count, error_count, total_duration_ms)
       VALUES ($1::date, $2, 1, 0, 1)`,
      [metricDate, metricRoute],
    );
    createdMetricRows.push({ metricDate, route: metricRoute });

    await assertCurrentDatabase();
    expect(await repository.deleteCompletedJobs(jobCutoff)).toBe(2);
    await assertCurrentDatabase();
    expect(await repository.deleteDeadLetterJobs(jobCutoff)).toBe(2);
    await assertCurrentDatabase();
    expect(await repository.deleteExpiredProductEvents(eventCutoff)).toBe(2);

    const remainingJobs = await requirePool().query<{ id: string; status: string }>(
      `SELECT id, status FROM async_jobs
       WHERE id = ANY($1::text[]) ORDER BY id`,
      [[completedIds[2], deadLetterIds[2], pendingId, processingId]],
    );
    expect(remainingJobs.rows.map(({ id }) => id).sort()).toEqual(
      [completedIds[2], deadLetterIds[2], pendingId, processingId].sort(),
    );
    expect(remainingJobs.rows).toEqual(expect.arrayContaining([
      { id: pendingId, status: 'pending' },
      { id: processingId, status: 'processing' },
    ]));
    const metric = await requirePool().query<{ request_count: number }>(
      'SELECT request_count FROM request_metrics WHERE metric_date = $1::date AND route = $2',
      [metricDate, metricRoute],
    );
    expect(metric.rows).toEqual([{ request_count: 1 }]);
  });
});
