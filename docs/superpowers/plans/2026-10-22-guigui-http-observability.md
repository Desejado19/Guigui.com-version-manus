# Guigui.com HTTP Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move HTTP metrics collection, PostgreSQL persistence, and the existing JSON/Prometheus endpoints into `platform-foundation` without changing their observable behavior.

**Architecture:** Add a process-local metrics registry, inject a narrow PostgreSQL query port into an adapter, and compose application services plus Express middleware/handlers from `server.ts`. Preserve both routes, response formats, authorization, counter semantics, and asynchronous persistence.

**Tech Stack:** Node.js, TypeScript, Express 4, PostgreSQL via `pg`, Vitest, Playwright.

**Spec:** [2026-10-22-guigui-http-observability-design.md](../specs/2026-10-22-guigui-http-observability-design.md)

## Global Constraints

- "server.ts continues to be the composition root: instantiate the accumulator and dependencies, install middleware, and mount handlers."
- "The modules do not access the PostgreSQL singleton; the adapter receives persistence dependencies through composition."
- "GET /api/metrics requires the admin role and returns the current JSON operational summary."
- "GET /metrics remains unauthenticated and returns Prometheus text metrics."
- "In memory, an error is only a response with status `>= 500`."
- "Persisted `error_count` counts responses with status `>= 400`."
- "Preserve the current limit on the persisted route value to 255 characters."
- "Do not alter the schema, indexes, migrations, retention policy, or data lifecycle."
- "Do not alter public access to `/metrics`, labels, aggregations, or metric names."
- No new dependencies, no environment-variable changes, no database migrations, and no unrelated changes to health, product analytics, rate limiting, backups, or other domain modules.
- The workspace has no Git metadata; do not initialize Git or create commits.

## Review Focus

- HTTP 4xx and 5xx responses have intentionally different persistence and in-memory error counts. Tests: `keeps 4xx out of in-memory errors while counting 5xx` in Task 1 and `persists 4xx responses as database errors` in Task 2.
- PostgreSQL is not configured: persistence is a no-op and database metrics are `null`, without changing the process-local snapshot. Test: `returns null database summary and skips writes without a query port`.
- A metric write fails after a response: the response remains unchanged and failure is logged with `observability_persist_failed`. Test: `logs persistence failure without changing the completed response`.
- Route labels contain backslashes or quotes: Prometheus output escapes them as before. Test: `escapes route labels in Prometheus exposition`.
- The metrics endpoints have different access policies: anonymous `/api/metrics` access is rejected while `/metrics` stays public. Test: `keeps admin authorization on JSON metrics and public Prometheus access`.

---

### Task 1: Extract the process-local HTTP metrics registry

**Files:**
- Create: `server/modules/platform-foundation/observability/domain/httpMetrics.ts`
- Create: `tests/unit/httpMetrics.test.ts`

**Interfaces:**
- Produces:
  - `export type RouteHttpMetric = { count: number; errors: number; totalMs: number }`
  - `export type HttpMetricsSnapshot = { totalRequests: number; errors: number; routes: ReadonlyMap<string, RouteHttpMetric> }`
  - `export class HttpMetricsRegistry { record(route: string, statusCode: number, durationMs: number): void; snapshot(): HttpMetricsSnapshot }`
- `record` receives already-rounded durations from the middleware. It increments total and route counts, considers only `statusCode >= 500` an in-memory error, and preserves the route key exactly.
- `snapshot` must not expose mutable internal map/counter objects to callers.

- [ ] **Step 1: Write the registry behavior tests**

In `tests/unit/httpMetrics.test.ts`, add tests:

1. `records total requests and independent route counters`: record `GET /health` with `200` and `GET /events` with `404`; assert `totalRequests` is `2`, global `errors` is `0`, and each route has its expected count and duration.
2. `keeps 4xx out of in-memory errors while counting 5xx`: record status `400` and `500`; assert only the `500` increments global and route `errors`.
3. `does not let snapshot callers mutate registry state`: modify the copied metric object returned from `snapshot().routes.get(route)` and assert a subsequent snapshot retains the original values.

- [ ] **Step 2: Run the tests to verify they fail before implementation**

Run: `npm run test:unit -- tests/unit/httpMetrics.test.ts`

Expected: FAIL because `httpMetrics.ts` does not exist.

- [ ] **Step 3: Implement `HttpMetricsRegistry`**

Implement the types and class in `server/modules/platform-foundation/observability/domain/httpMetrics.ts`. Return a fresh map with copied metric values from each snapshot.

- [ ] **Step 4: Run the focused registry tests**

Run: `npm run test:unit -- tests/unit/httpMetrics.test.ts`

Expected: PASS with all three tests.

### Task 2: Extract PostgreSQL persistence and observability application services

**Files:**
- Create: `server/modules/platform-foundation/observability/application/observabilityService.ts`
- Create: `server/modules/platform-foundation/observability/adapters/postgresObservabilityRepository.ts`
- Create: `tests/unit/observabilityService.test.ts`

**Interfaces:**
- Consumes `HttpMetricsSnapshot` from Task 1.
- Produces:
  - `export type DatabaseObservability = { metricsDate: string; requests: number; errors: number }`
  - `export interface ObservabilityRepository { persistRequestMetric(route: string, statusCode: number, durationMs: number): Promise<void>; getDatabaseObservability(): Promise<DatabaseObservability | null> }`
  - `export type AdminMetricsResponse = { totalRequests: number; errors: number; routes: Array<{ route: string; count: number; errors: number; averageMs: number }>; database: DatabaseObservability | null }`
  - `export async function getAdminMetrics(snapshot: HttpMetricsSnapshot, repository: ObservabilityRepository): Promise<AdminMetricsResponse>`
  - `export async function renderPrometheusMetrics(snapshot: HttpMetricsSnapshot, repository: ObservabilityRepository): Promise<string>`
  - `export type ObservabilityQueryPort = { query(text: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }`
  - `export function createPostgresObservabilityRepository(queryPort: ObservabilityQueryPort | null): ObservabilityRepository`
- The repository port is injected; the adapter must not import `server/db.ts` or read `databasePool` directly.

- [ ] **Step 1: Write application and adapter contract tests**

In `tests/unit/observabilityService.test.ts`, add tests:

1. `builds the admin summary and route average from a snapshot`: supply a snapshot with 2 requests, 1 in-memory error, and one route with count `2`, errors `1`, and total duration `31`; assert `averageMs: 15.5` and the literal database summary returned by the repository.
2. `returns null database summary and skips writes without a query port`: create the repository with `null`, assert the database summary is `null`, and call persistence without a database side effect.
3. `persists 4xx responses as database errors`: capture the query and values; assert the SQL is parameterized, the status input `404` produces error value `1`, and route input is truncated to 255 characters.
4. `aggregates database metrics for the current date`: assert the summary query and returned literal `{ metricsDate, requests, errors }`.
5. `renders Prometheus metric names, types, values, labels, and final newline`: assert exact output for HTTP totals and a database summary.
6. `escapes route labels in Prometheus exposition`: use a route containing `\` and `"` and assert both are escaped in the exposition.

Mock only the query port at the persistence boundary; call the actual application service and adapter.

- [ ] **Step 2: Run the tests to verify they fail before implementation**

Run: `npm run test:unit -- tests/unit/observabilityService.test.ts`

Expected: FAIL because the new application and adapter modules do not exist.

- [ ] **Step 3: Implement the injected PostgreSQL repository**

Implement `createPostgresObservabilityRepository(queryPort)` in `server/modules/platform-foundation/observability/adapters/postgresObservabilityRepository.ts`. Preserve the current upsert/query SQL, parameter order, `>= 400` database error semantics, 255-character route limit, and `null`/no-op behavior when `queryPort` is `null`.

- [ ] **Step 4: Implement application summary and Prometheus formatting**

Implement `getAdminMetrics` and `renderPrometheusMetrics` in `server/modules/platform-foundation/observability/application/observabilityService.ts`. Preserve current metric names, HELP/TYPE lines, `>= 500` in-memory totals, route escaping, database gauges only when a summary exists, and the final newline.

- [ ] **Step 5: Run the focused application and adapter tests**

Run: `npm run test:unit -- tests/unit/observabilityService.test.ts`

Expected: PASS with all six tests and no live database dependency.

### Task 3: Move HTTP instrumentation and handlers into the module

**Files:**
- Create: `server/modules/platform-foundation/observability/http/observabilityMiddleware.ts`
- Create: `server/modules/platform-foundation/observability/http/observabilityHandlers.ts`
- Create: `tests/unit/observabilityHttp.test.ts`
- Remove after checking references: `server/observabilityService.ts`
- Remove after checking references: `server/prometheusService.ts`
- Modify: `server.ts`
- Modify: `tests/unit/securityRoutes.test.ts`
- Modify: `tests/system-health.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes `HttpMetricsRegistry`, `ObservabilityRepository`, `getAdminMetrics`, and `renderPrometheusMetrics` from Tasks 1–2.
- Produces:
  - `export type ObservabilityMiddlewareDependencies = { registry: HttpMetricsRegistry; persistRequestMetric: ObservabilityRepository['persistRequestMetric']; requestIdFrom: (request: import('express').Request) => string; logger: Pick<Console, 'error' | 'log'>; now?: () => number }`
  - `export function createObservabilityMiddleware(dependencies: ObservabilityMiddlewareDependencies): import('express').RequestHandler`
  - `export type ObservabilityHandlerDependencies = { registry: HttpMetricsRegistry; repository: ObservabilityRepository }`
  - `export function createObservabilityHandlers(dependencies: ObservabilityHandlerDependencies): { adminMetrics: import('express').RequestHandler; prometheusMetrics: import('express').RequestHandler }`
- Mount the returned `adminMetrics` at `/api/metrics` behind the existing `requireRole('admin')`, and `prometheusMetrics` at `/metrics` without adding authentication.
- Preserve existing middleware order, request-ID behavior, logging thresholds, asynchronous write error event and request route selection.

- [ ] **Step 1: Write HTTP middleware and handler tests**

In `tests/unit/observabilityHttp.test.ts`, use a real Express server bound to an ephemeral loopback port and the real registry/application services. Add tests:

1. `records a completed response and preserves its request ID`: request a test route returning 200 with a supplied request ID; assert `X-Request-Id` and the registry snapshot after the response.
2. `logs persistence failure without changing the completed response`: reject the injected persistence promise; assert the original response remains 200 and the logger receives structured `observability_persist_failed` data with request ID and message.
3. `logs 4xx and slow responses but not ordinary successful responses`: send a 404 and a response whose injected monotonic clock advances by at least 1,000 ms; assert those events are logged and a fast 200 is not.
4. `returns the admin summary as JSON`: call the admin handler directly in the test app and assert JSON content type and the current `totalRequests`, `errors`, `routes`, and `database` fields.
5. `returns Prometheus exposition as public plain text`: call the Prometheus handler without an auth middleware and assert `text/plain`, the metric text, and final newline.
6. `forwards database read failures to Express error middleware`: reject `getDatabaseObservability` from the repository and assert the test error middleware receives the failure rather than a success-shaped fallback.

- [ ] **Step 2: Run the HTTP tests to verify they fail before implementation**

Run: `npm run test:unit -- tests/unit/observabilityHttp.test.ts`

Expected: FAIL because the HTTP module files do not exist.

- [ ] **Step 3: Implement the measurement middleware**

Implement `createObservabilityMiddleware` in `server/modules/platform-foundation/observability/http/observabilityMiddleware.ts`. Capture response completion, route, status, duration and request ID; update the registry; start repository persistence without awaiting it; log a persistence rejection using the current event fields; and retain the current slow/error request log behavior.

- [ ] **Step 4: Implement the two metrics handlers**

Implement `createObservabilityHandlers` in `server/modules/platform-foundation/observability/http/observabilityHandlers.ts`. The JSON handler calls `getAdminMetrics` and returns JSON. The Prometheus handler calls `renderPrometheusMetrics`, sets `text/plain`, and sends the returned document. Forward unexpected read/formatting errors to Express `next(error)`.

- [ ] **Step 5: Compose the extracted module in `server.ts`**

Create one `HttpMetricsRegistry` and one repository from a narrow query-port wrapper around the existing `databasePool` (or `null`). Replace the inline request metric state and metric middleware with `createObservabilityMiddleware`, supplying the existing `requestIdFrom`, logger, and monotonic clock. Replace only the two inline metrics handlers with `createObservabilityHandlers`, retaining `requireRole('admin')` on `/api/metrics` and the unauthenticated `/metrics` route. Do not change neighboring middleware or routes.

- [ ] **Step 6: Add route access regression tests**

In `tests/unit/securityRoutes.test.ts`, add:

1. `rejects anonymous access to JSON metrics`: GET `/api/metrics` without a cookie and assert HTTP 401.
2. `allows an authenticated admin to read JSON metrics`: log in the existing admin test user, request `/api/metrics`, and assert HTTP 200 with `totalRequests`, `errors`, `routes`, and `database`.
3. `keeps Prometheus metrics publicly accessible`: GET `/metrics` anonymously and assert HTTP 200, `text/plain`, and `# TYPE guigui_http_requests_total counter`.

Extend the health/platform E2E test or add a focused test in `tests/system-health.spec.ts` to assert the public Prometheus endpoint remains accessible and text-formatted; do not add assertions against unstable exact counters.

- [ ] **Step 7: Remove the old service files only after checking consumers**

Search the workspace for imports/references to `server/observabilityService.ts` and `server/prometheusService.ts`. After `server.ts` uses the new module and no consumer remains, remove those legacy files so there is one implementation of each repository/formatter behavior.

- [ ] **Step 8: Document the implemented module boundary**

Update the backend architecture section in `README.md` to state that `platform-foundation/observability/` owns HTTP metrics accumulation, persistence adapter, middleware and handlers, while `server.ts` composes them. Do not claim that other business contexts have been migrated.

- [ ] **Step 9: Run focused route tests and quality checks**

Run: `npm run test:unit -- tests/unit/httpMetrics.test.ts tests/unit/observabilityService.test.ts tests/unit/observabilityHttp.test.ts tests/unit/securityRoutes.test.ts`

Expected: all focused tests pass, including admin/public route access.

Run: `npm run check`

Expected: TypeScript exits successfully.

Run: `npm run build`

Expected: Vite and the server bundle complete successfully.

Run: `npm run test:unit`

Expected: all non-skipped unit tests pass; existing intentionally skipped integration tests remain reported.

Run: start `npm run dev` separately, then `npm run test:e2e -- tests/system-health.spec.ts`.

Expected: the health/platform suite passes, including the public Prometheus compatibility assertion. Stop only the server process started for verification.

## Self-review coverage

- Domain counting, route averages, and snapshot isolation are covered by Task 1.
- SQL parameters, 255-character route handling, `>= 400` database errors, no-database mode and daily aggregation are covered by Task 2.
- Prometheus names/types/values/escaping/final newline and absent database gauges are covered by Task 2.
- Response completion, request ID, asynchronous persistence failure, error forwarding, JSON and text formats are covered by Task 3.
- Admin authorization and public Prometheus access are covered by Task 3 route tests.
- Frontend, health, product analytics, rate limits, backup, schemas, dependencies, secrets, and other domain contexts remain outside the plan.

## Git/workspace note

The workspace currently has no Git metadata. There are no commit steps; do not initialize Git without explicit authorization.
