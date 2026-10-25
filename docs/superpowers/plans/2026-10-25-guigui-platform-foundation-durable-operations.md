# Durable Platform Foundation Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist platform jobs, rate limits, and approved telemetry safely in PostgreSQL while retaining the existing monolithic application.

**Architecture:** Keep the HTTP application and job worker as separate processes in the same monolith. `platform-foundation` owns queue lifecycle, rate-limit buckets, operational retention, and telemetry adapters; each business context owns its job handlers and payload rules.

**Tech Stack:** Node.js, TypeScript, Express, PostgreSQL 18 (`pg`), Vitest, existing migration runner.

**Spec:** [`docs/superpowers/specs/2026-10-25-guigui-platform-foundation-durable-operations-design.md`](../specs/2026-10-25-guigui-platform-foundation-durable-operations-design.md)

## Global Constraints

- The architecture remains one monolith; do not add microservices or dependencies.
- PostgreSQL is required in production; production never falls back to JSON or process memory.
- Local adapters may remain for development/tests; the separate worker always requires PostgreSQL because process memory is not shared.
- Migrations are explicit through `npm run db:migrate` with `DB_MIGRATION_URL` and `--confirm-target`; never run them on HTTP or worker startup.
- Platform-foundation integration tests use only `PLATFORM_FOUNDATION_TEST_DATABASE_URL`, pointing to the explicitly disposable, empty PostgreSQL 18 database `guigui_pg18_platform_foundation_test`; without it, they skip without connecting. The legacy PostgreSQL suite keeps using `TEST_DATABASE_URL` and must not share this database.
- Completed jobs and dead-letter jobs are retained for 30 days; product events for 365 days; expired rate-limit buckets are purged hourly; normalized HTTP aggregates have no automatic expiry.
- `request_metrics` persists route templates only; a missing template becomes `unmatched`, never a literal path, ID, or query string.
- Backup execution metadata belongs to Task 9; a generic queue status never proves a backup artifact is encrypted and verified.
- Do not inspect or modify real databases, import real data, deploy, or change Render in this plan.

## Review Focus

- **Stale worker after lease handoff:** a worker with an expired lease must not heartbeat, complete, or fail a job reclaimed by another worker. Pin with `lateWorkerCannotMutateReclaimedJob`.
- **Crash/restart while processing:** an expired lease must make a job recoverable without exceeding `maxAttempts` or reporting false success. Pin with `reclaimsExpiredLeaseAndDeadLettersAtAttemptLimit`.
- **Unregistered job type:** jobs without an owning handler remain pending and are not claimed or completed. Pin with `doesNotClaimJobsWithoutRegisteredHandlers`.
- **Dynamic/unmatched HTTP paths:** persisted metrics must not contain literal IDs, paths, or query values, including pre-migration rows. Pin with `persistsRouteTemplateOrUnmatchedOnly` and the legacy aggregation migration test.
- **Untrusted telemetry/error data:** unknown product events, non-allowlisted context, and error strings containing credentials/connection URLs must not be persisted or logged verbatim. Pin with `rejectsUnapprovedProductContext` and `redactsSensitiveDiagnostics`.

---

### Task 1: Add fenced durable job-queue operations

**Files:**
- Create: `db/migrations/010_platform_foundation_job_leases.sql`
- Create: `server/modules/platform-foundation/jobs/domain/jobQueue.ts`
- Create: `server/modules/platform-foundation/jobs/application/jobQueueService.ts`
- Create: `server/modules/platform-foundation/jobs/adapters/postgresJobQueueRepository.ts`
- Modify: `server/jobQueueService.ts` as the compatibility facade
- Create: `server/modules/platform-foundation/diagnostics/sanitizeDiagnostic.ts`
- Test: `tests/unit/platform-foundation-job-queue.test.ts`
- Test: `tests/unit/platform-foundation-diagnostics.test.ts`

**Interfaces:**
- Consumes: The existing safe `applyPendingMigrations` runner and production PostgreSQL gate from the persistence roadmap.
- Produces:
  - `type JobType = 'notification' | 'webhook' | 'export' | 'backup' | 'reconciliation'`
  - `interface QueueJob<T = Record<string, unknown>> { id: string; type: JobType; payload: T; attempts: number; maxAttempts: number; availableAt: string; idempotencyKey?: string }`
  - `type LeasedQueueJob<T = Record<string, unknown>> = QueueJob<T> & { leaseToken: string }`
  - `claimJob(registeredTypes: readonly JobType[]): Promise<LeasedQueueJob | null>`
  - `renewJobLease(id: string, leaseToken: string): Promise<boolean>`
  - `completeJob(id: string, leaseToken: string): Promise<boolean>`
  - `failJob(id: string, leaseToken: string, error: unknown): Promise<'retrying' | 'dead-letter' | 'lease-lost'>`
  - `enqueueJob<T extends Record<string, unknown>>(type: JobType, payload: T, options?: { idempotencyKey?: string; maxAttempts?: number }): Promise<QueueJob<T>>`
  - `sanitizeDiagnostic(error: unknown, maxLength?: number): string`

- [ ] **Step 1: Add failing queue lifecycle and fencing tests**

  Test `claimsOnlyRegisteredTypes`, `usesFreshLeaseTokenForEachClaim`, `lateWorkerCannotMutateReclaimedJob`, `completeRequiresCurrentLease`, `failRequiresCurrentLease`, `reclaimsExpiredLeaseAndDeadLettersAtAttemptLimit`, and `requiresPostgreSQLForProductionQueueOperations`. Assert that stale lease operations return `false`/`lease-lost` and never change the new owner's job.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- --run tests/unit/platform-foundation-job-queue.test.ts`
  Expected: FAIL because the leased queue contract and fencing token do not exist.

- [ ] **Step 3: Add migration 010 and implement the queue module**

  Add `lease_token UUID`, `dead_lettered_at TIMESTAMPTZ`, and a partial index for processing leases. Keep `completed_at` as the completion timestamp. A claim assigns a fresh application-generated UUID; heartbeat, completion, and failure updates require the matching `(id, lease_token)`. Reclaim expired processing jobs; once `attempts >= max_attempts`, mark them dead-letter with a terminal timestamp. Preserve the five-attempt default and existing exponential backoff.

  `sanitizeDiagnostic(error, maxLength = 500)` must redact PostgreSQL URLs and sensitive key/value tokens, then truncate to the requested bound. Persist only its output in `last_error`; never persist a job payload or raw diagnostic.

- [ ] **Step 4: Run focused queue and diagnostic tests**

  Run: `npm run test:unit -- --run tests/unit/platform-foundation-job-queue.test.ts tests/unit/platform-foundation-diagnostics.test.ts`
  Expected: PASS, including stale-worker fencing and diagnostic redaction.

- [ ] **Step 5: Commit**

  Commit migration, queue module, facade, and tests with `feat: add fenced PostgreSQL job queue`.

### Task 2: Add rate-limit bucket expiry

**Files:**
- Create: `db/migrations/011_platform_foundation_rate_limit_expiry.sql`
- Create: `server/modules/platform-foundation/rate-limits/application/rateLimitService.ts`
- Create: `server/modules/platform-foundation/rate-limits/adapters/postgresRateLimitRepository.ts`
- Modify: `server/rateLimitService.ts` as the compatibility facade
- Modify: `tests/unit/rateLimitService.test.ts`
- Create: `tests/unit/platform-foundation-rate-limit-maintenance.test.ts`

**Interfaces:**
- Consumes: Task 1's diagnostic and module conventions.
- Produces:
  - `consumeDistributedRateLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean | null>`
  - `deleteExpiredRateLimitBuckets(): Promise<number>`

- [ ] **Step 1: Add failing expiry and validation tests**

  Test `setsExpiryAtWindowEnd`, `resetsExpiredWindowAndExpiry`, `deletesOnlyExpiredBuckets`, `expiresLegacyBucketsWithoutKnownWindow`, `rejectsInvalidWindowAndLimit`, and `doesNotLogBucketKey`. Assert that an active bucket is not removed and that expiry does not slide forward on every request.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- --run tests/unit/rateLimitService.test.ts tests/unit/platform-foundation-rate-limit-maintenance.test.ts`
  Expected: FAIL because the expiry field and cleanup contract do not exist.

- [ ] **Step 3: Add migration 011 and implement expiry-aware rate limits**

  Add `expires_at TIMESTAMPTZ` and its cleanup index. Existing rows have no recorded window duration; mark them expired rather than inventing a duration. Persist each new window's exact expiry; on expiration, reset both count and expiry. Keep `null` only for local no-database mode; database errors propagate.

- [ ] **Step 4: Run focused rate-limit tests**

  Run: `npm run test:unit -- --run tests/unit/rateLimitService.test.ts tests/unit/platform-foundation-rate-limit-maintenance.test.ts`
  Expected: PASS, including boundary-time and legacy-row cases.

- [ ] **Step 5: Commit**

  Commit the expiry migration, adapter/facade, and tests with `feat: expire PostgreSQL rate limit buckets`.

### Task 3: Constrain product telemetry and normalize persistent routes

**Files:**
- Create: `db/migrations/012_platform_foundation_telemetry_retention.sql`
- Create: `server/modules/platform-foundation/analytics/application/productAnalyticsService.ts`
- Create: `server/modules/platform-foundation/analytics/adapters/postgresProductAnalyticsRepository.ts`
- Modify: `server/productAnalyticsService.ts` as the compatibility facade
- Modify: `server/modules/platform-foundation/observability/http/observabilityMiddleware.ts`
- Modify: `server/modules/platform-foundation/observability/adapters/postgresObservabilityRepository.ts`
- Modify: `tests/unit/observabilityHttp.test.ts`
- Create: `tests/unit/platform-foundation-product-analytics.test.ts`

**Interfaces:**
- Consumes: Task 1's `sanitizeDiagnostic`.
- Produces:
  - `normalizePersistentRoute(routeTemplate: string | undefined): string`
  - `type ProductEventName = 'page_view' | 'search_submitted' | 'search_result_clicked' | 'checkout_started' | 'payment_completed' | 'payment_failed' | 'ticket_purchased'`
  - `interface ProductEventInput { eventName: ProductEventName; source: string; appVersion?: string; userId?: string; sessionId?: string; context?: Record<string, unknown> }`
  - `persistProductEvent(input: ProductEventInput): Promise<void>`
  - The current event-name allowlist with an initially empty event-specific context allowlist.

- [ ] **Step 1: Add failing route and product-event validation tests**

  Test `persistsRouteTemplateOrUnmatchedOnly`, `keepsInProcessRegistryBehavior`, `rejectsUnknownProductEvents`, `rejectsUnapprovedProductContext`, `usesEmptyContextByDefault`, and `sanitizesTelemetryFailureDiagnostics`. Include a request to `/users/person-123?email=private@example.test`; assert the persistent repository receives only `unmatched` when no Express template exists.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- --run tests/unit/observabilityHttp.test.ts tests/unit/platform-foundation-product-analytics.test.ts`
  Expected: FAIL because persistence currently accepts literal paths and arbitrary context.

- [ ] **Step 3: Add migration 012 and implement telemetry boundaries**

  Collapse existing `request_metrics` rows by date into `unmatched`, preserving request/error counts and duration totals. Clear legacy untyped `product_events.context` to `{}` while preserving event identity, source, timestamps, and relations. Add an index supporting event retention by `occurred_at`. New product events use the existing event-name allowlist, default to `{}`, and reject context keys until an owning context publishes an event-specific allowlist. Persist only Express route templates; otherwise persist `unmatched`. Log persistence failures with `sanitizeDiagnostic` and do not change an HTTP response already sent.

- [ ] **Step 4: Verify route and event behavior**

  Run: `npm run test:unit -- --run tests/unit/observabilityHttp.test.ts tests/unit/platform-foundation-product-analytics.test.ts`
  Expected: PASS; verify that the in-process metrics registry behavior and HTTP response remain unchanged.

- [ ] **Step 5: Commit**

  Commit the telemetry migration, services, middleware, and tests with `feat: constrain durable platform telemetry`.

### Task 4: Implement hourly platform-data maintenance

**Files:**
- Create: `server/modules/platform-foundation/maintenance/application/runOperationsMaintenance.ts`
- Create: `server/modules/platform-foundation/maintenance/adapters/postgresOperationsMaintenanceRepository.ts`
- Create: `tests/unit/platform-foundation-operations-maintenance.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3's terminal timestamps, rate-limit expiry, and telemetry retention fields.
- Produces:
  - `runOperationsMaintenance(repository: OperationsMaintenanceRepository, now: Date): Promise<OperationsMaintenanceSummary>`
  - `type OperationsMaintenanceSummary = { expiredRateLimitBuckets: number; completedJobs: number; deadLetterJobs: number; expiredProductEvents: number }`
  - `OperationsMaintenanceRepository.deleteExpiredRateLimitBuckets(): Promise<number>`
  - `OperationsMaintenanceRepository.deleteCompletedJobs(cutoff: Date): Promise<number>`
  - `OperationsMaintenanceRepository.deleteDeadLetterJobs(cutoff: Date): Promise<number>`
  - `OperationsMaintenanceRepository.deleteExpiredProductEvents(cutoff: Date): Promise<number>`

- [ ] **Step 1: Add failing retention-boundary tests**

  Test `purgesCompletedJobsAfter30Days`, `purgesDeadLetterJobsAfter30Days`, `purgesProductEventsAfter365Days`, `purgesExpiredRateLimitBuckets`, `keepsPendingAndProcessingJobs`, `doesNotDeleteHttpMetrics`, and `propagatesMaintenanceFailures`. Test records exactly on each boundary and just inside/outside it.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- --run tests/unit/platform-foundation-operations-maintenance.test.ts`
  Expected: FAIL because the maintenance use case and repository do not exist.

- [ ] **Step 3: Implement maintenance repositories and retention rules**

  Use terminal timestamps for the 30-day job policies and `occurred_at` for the 365-day event policy. Delete only expired rate buckets using PostgreSQL `NOW()` as the authoritative clock. Do not delete pending/processing jobs or any `request_metrics` rows. Return explicit deletion counts; propagate database errors.

- [ ] **Step 4: Run retention tests**

  Run: `npm run test:unit -- --run tests/unit/platform-foundation-operations-maintenance.test.ts`
  Expected: PASS for all retention boundaries and preserved rows.

- [ ] **Step 5: Commit**

  Commit maintenance use case, adapter, and tests with `feat: add platform operations retention`.

### Task 5: Run a continuous, fenced worker process

**Files:**
- Create: `server/modules/platform-foundation/jobs/application/runJobWorker.ts`
- Modify: `scripts/worker.ts`
- Create: `tests/unit/platform-foundation-worker.test.ts`
- Modify: `docs/OPERATIONS.md`

**Interfaces:**
- Consumes: Task 1's leased queue operations and Task 4's maintenance use case.
- Produces:
  - `type JobHandler = (payload: Record<string, unknown>, context: JobExecutionContext) => Promise<void>`
  - `type JobExecutionContext = { signal: AbortSignal; idempotencyKey?: string }`
  - `interface JobQueueOperations { claimJob(registeredTypes: readonly JobType[]): Promise<LeasedQueueJob | null>; renewJobLease(id: string, leaseToken: string): Promise<boolean>; completeJob(id: string, leaseToken: string): Promise<boolean>; failJob(id: string, leaseToken: string, error: unknown): Promise<'retrying' | 'dead-letter' | 'lease-lost'> }`
  - `type JobHandlerRegistry = Partial<Record<JobType, JobHandler>>`
  - `interface JobWorkerDependencies { queue: JobQueueOperations; handlers: JobHandlerRegistry; runMaintenance(now: Date): Promise<OperationsMaintenanceSummary>; signal: AbortSignal; now(): Date; sleep(milliseconds: number, signal: AbortSignal): Promise<void>; logger: Pick<Console, 'error' | 'warn'> }`
  - `runJobWorker(dependencies: JobWorkerDependencies): Promise<void>`
  - A worker handler registry keyed by `JobType`; this task registers no business handlers.

- [ ] **Step 1: Add failing worker runtime tests**

  Test `continuesPollingWhenIdle`, `doesNotClaimJobsWithoutRegisteredHandlers`, `renewsLeaseEveryMinute`, `abortsHandlerAfterLeaseLossAndDoesNotAck`, `abortsHandlerWhenLeaseRenewalFails`, `stopsClaimingAndDrainsOnSignal`, `backsOffDatabaseFailuresUpTo30Seconds`, `runsMaintenanceHourly`, and `requiresPostgreSQLBeforeStarting`. Assert the empty registry never claims `backup` or another unsupported type; document at-least-once delivery so future handlers use `idempotencyKey`. Preserve the existing API health/readiness contract and do not make it depend on worker availability.

- [ ] **Step 2: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- --run tests/unit/platform-foundation-worker.test.ts`
  Expected: FAIL because the current worker is one-shot and uses no-op handlers.

- [ ] **Step 3: Implement the continuous worker**

  Poll every 1 second while idle; process one job per process; support multiple processes through the queue's `SKIP LOCKED` claim. Use a 5-minute lease with a heartbeat each minute. Any lease-renewal result of `false` or error aborts the handler and prevents acknowledgement; a failed completion/failure write is logged safely and left for lease-based recovery, never reported as success. Retry database connection errors with exponential delay capped at 30 seconds. In `scripts/worker.ts`, wire `SIGTERM`/`SIGINT` to an `AbortController`, stop claiming and drain the active job, then close the pool in `finally`. Require `DATABASE_URL` and a successful PostgreSQL check for this separate process in every environment; never use its process-local queue as a substitute for the API queue. Run maintenance immediately at startup and every hour thereafter. No registered handler means no claim; no-op success is forbidden.

- [ ] **Step 4: Verify worker tests and operations documentation**

  Run: `npm run test:unit -- --run tests/unit/platform-foundation-worker.test.ts`
  Expected: PASS; `docs/OPERATIONS.md` describes the continuous worker, shutdown, retry, and handler-ownership behavior.

- [ ] **Step 5: Commit**

  Commit worker runtime, tests, and operations documentation with `feat: run durable platform worker continuously`.

### Task 6: Verify the PostgreSQL lifecycle and close the context

**Files:**
- Create: `tests/unit/platformFoundationOperations.integration.test.ts`
- Modify: `package.json` integration test command
- Modify: `docs/OPERATIONS.md` and relevant database setup documentation

**Interfaces:**
- Consumes: Tasks 1–5's queue, rate-limit, telemetry, maintenance, and worker contracts.
- Produces: PostgreSQL 18 integration coverage guarded by `PLATFORM_FOUNDATION_TEST_DATABASE_URL` whose connected database name must equal `guigui_pg18_platform_foundation_test`. The legacy integration suite remains guarded by `TEST_DATABASE_URL` and uses its existing `guigui_pg18_synthetic_target`.

- [ ] **Step 1: Add isolated PostgreSQL integration tests**

  Cover applying the full migration chain through 012 to an empty disposable target, historical telemetry normalization, rate-limit reset/expiry, job claim/heartbeat/reclaim after a worker-instance restart, retention cleanup, and stale-worker fencing. If `PLATFORM_FOUNDATION_TEST_DATABASE_URL` is unset or its parsed database name is not exactly `guigui_pg18_platform_foundation_test`, skip before creating a pool. Create a dedicated `pg.Pool` from that URL, pass it to the migration runner and repositories, and re-check `current_database()` before any DDL/DML; do not overwrite `DATABASE_URL` or reuse the legacy suite's pool. Use only IDs created by each test and clean those rows afterward; never drop the database or query a production target.

  Set `test:integration` to `vitest run tests/unit/postgresServices.integration.test.ts tests/unit/platformFoundationOperations.integration.test.ts`; the legacy test continues using `TEST_DATABASE_URL`, and the new test uses only its dedicated URL.

- [ ] **Step 2: Run the integration command safely**

  Run: `npm run test:integration -- --maxWorkers=1 --no-file-parallelism`
  Expected: the package command runs both integration files; the platform-foundation suite connects only when `PLATFORM_FOUNDATION_TEST_DATABASE_URL` identifies the dedicated empty target, while the legacy suite uses only `TEST_DATABASE_URL`. Either suite skips before connecting when its own URL is absent.

- [ ] **Step 3: Run final verification**

  Run: `npm run test:unit -- --maxWorkers=1 --no-file-parallelism`, `npm run lint`, and `npm run build`.
  Expected: all unit tests, type checks, and production build pass; report database-dependent skips separately.

- [ ] **Step 4: Commit**

  Commit integration coverage and remaining documentation with `test: verify durable platform operations`.
