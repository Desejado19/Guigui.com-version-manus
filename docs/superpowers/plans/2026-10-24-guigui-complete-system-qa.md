# Guigui.com Complete-System QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run and report a repeatable end-to-end local QA campaign for Guigui.com using Playwright, Newman, k6, and passive OWASP ZAP against a new PostgreSQL 18 test database.

**Architecture:** Add a guarded local test harness that provisions a uniquely named database only when it does not already exist, runs the existing migrations and synthetic demo fixtures, and starts the app on an explicit loopback-only port. Separate Playwright, API-route inventory/Newman, k6, and ZAP assets feed a sequenced runner that stores raw output locally and emits a sanitized campaign report.

**Tech Stack:** Node.js/TypeScript, PostgreSQL 18 and `pg`, Playwright, Newman, k6, OWASP ZAP Baseline, PowerShell for the Windows-local campaign runner.

**Spec:** `docs/superpowers/specs/2026-10-24-guigui-complete-system-qa-design.md`

## Global Constraints

- Target localhost only; use a new, disposable PostgreSQL 18 database; do not assume or use port 3000 or the existing `DATABASE_URL`.
- The synthetic SQL seed accepts only `guigui_pg18_synthetic_target`; create that database only if absent and stop if it already exists.
- Do not open `.env` files, snapshots, secrets, or existing database contents. Supply connection values directly to the local process; never include them in reports or tool uploads.
- Run the instruments in this order: Playwright, Newman, k6, then passive ZAP; record blocked phases explicitly.
- Run all existing `tests/*.spec.ts` E2E tests or record a safe, explicit reason for each blocked test; do not remove or suppress tests.
- Inventory every declared HTTP route; each route needs a safe scenario or a documented exclusion with its reason.
- Write only to the new test database, using unique synthetic identifiers for this run. Do not contact real payment, SMS, email, or other external providers.
- k6 is limited to at most 10 VUs for 60 seconds, GET-only against approved read endpoints, with p95 below 2,000 ms, failure rate below 1%, and all checks passing.
- ZAP is limited to a localhost baseline/passive scan; do not run active scan, exploit payloads, or aggressive fuzzing.
- Do not delete the test database or existing data. Keep the new database after the campaign until the user explicitly authorizes its removal.
- Do not install missing tools without explicit authorization. If k6 or ZAP is unavailable, mark the phase blocked and request authorization before installing.
- Keep raw tool artifacts local; publish only a manually checked, sanitized summary.

## Review Focus

- Wrong, non-loopback, pre-existing, or non-PostgreSQL-18 database target: target validation tests must fail before database creation, migration, or seeding.
- A pre-existing application on port 3000 or another host: the QA config and server preflight must reject it and bind only to `127.0.0.1` on the explicit QA port.
- `.env` auto-loading or credentials leaking through process output: bootstrap tests must prove only the explicit QA environment is used and redact connection values.
- API routes hidden behind mounted routers or dynamic registration: reconcile the inventory against every source registration and mount; do not accept unresolved dynamic routes or unexplained collection gaps.
- k6 threshold summaries disagreeing with the runner's exit/result data: report tests must retain raw numeric metrics and never infer success from threshold flags alone.

## File Structure and Responsibilities

- `scripts/qa/validate-target.ts`: parse and validate QA-only environment values; expose a non-secret target contract without logging connection strings.
- `scripts/qa/provision-database.ts`: verify local PostgreSQL 18, create only a previously absent uniquely named database, and apply sorted SQL migrations without loading `.env`.
- `scripts/qa/run-campaign.ps1`: create an empty dotenv-config file, set explicit child-process variables, start and health-check the loopback server, sequence tools, preserve per-phase status, and leave the test database intact.
- `playwright.qa.config.ts`: dedicated QA base URL and report output, with no fallback to port 3000 or reuse of an unknown server.
- `tests/api/route-inventory.json`: exhaustive route matrix with method, path, source registration, auth/preconditions, safe scenario, and exclusion reason where applicable.
- `tests/api/guigui-local-qa.postman_collection.json`: local-only Newman collection whose requests and tests correspond to the inventory.
- `scripts/qa/discover-routes.ts`: statically discover Express routes in `server.ts` and mounted routers under `server/`; report unresolved dynamic registrations instead of silently omitting them.
- `tests/load/guigui-readonly.js`: bounded k6 GET-only scenario and exact thresholds.
- `scripts/qa/build-report.ts`: combine tool summaries into a sanitized local report without copying secrets, cookies, tokens, personal data, or raw request bodies.
- `tests/unit/qa-target.test.ts`, `tests/unit/qa-route-inventory.test.ts`, `tests/unit/qa-running-target.test.ts`, `tests/unit/qa-k6-config.test.ts`, `tests/unit/qa-zap-scope.test.ts`, and `tests/unit/qa-report.test.ts`: regression coverage for target safety, route accounting, tool scope, and report redaction.
- `package.json`: add explicit QA commands without changing existing test scripts.

---

### Task 1: Add the Guarded PostgreSQL QA Target

**Files:**
- Create: `scripts/qa/validate-target.ts`
- Create: `scripts/qa/provision-database.ts`
- Create: `tests/unit/qa-target.test.ts`
- Modify: `package.json` (QA setup command only)

**Interfaces:**
- `QaTarget` is `{ appHost: '127.0.0.1'; appPort: number; databaseName: string }` and contains no credentials.
- `parseQaTarget(env: NodeJS.ProcessEnv): QaTarget` consumes `QA_ADMIN_DATABASE_URL`, `QA_DATABASE_NAME`, and `QA_PORT`; validates the connection URL's loopback hostname and returns only non-secret target metadata.
- `provisionQaDatabase(target: QaTarget, adminConnectionString: string): Promise<void>` verifies PostgreSQL 18, refuses an existing database, creates only the validated QA database, and applies `db/migrations/*.sql` in sorted order. It never drops a database and does not load dotenv.

- [ ] **Step 1: Write failing target validation tests** in `tests/unit/qa-target.test.ts` for an accepted loopback URL and the rejection of a non-loopback database host, app port 3000, wrong database name, invalid port, and missing QA variables. Assert thrown messages do not contain the supplied connection string.
- [ ] **Step 2: Run `npx vitest run tests/unit/qa-target.test.ts`** and verify the tests fail because the QA target interface does not exist.
- [ ] **Step 3: Implement `parseQaTarget`** in `scripts/qa/validate-target.ts`; accept only loopback PostgreSQL hosts, HTTP app port 4313, and database name `guigui_pg18_synthetic_target`.
- [ ] **Step 4: Implement `provisionQaDatabase`** in `scripts/qa/provision-database.ts`; require server version 18.x, query only PostgreSQL metadata to confirm `guigui_pg18_synthetic_target` is absent, stop without creating or changing anything if it exists, create only that database, and apply SQL migration files to it. Do not import `dotenv/config`.
- [ ] **Step 5: Add `qa:provision` to `package.json`** and pass the database name/connection through explicit process environment variables; never print either connection string.
- [ ] **Step 6: Run `npx vitest run tests/unit/qa-target.test.ts` and `npm run check`**; expect all target tests and TypeScript checks to pass.
- [ ] **Step 7: Commit only Task 1 files** with message `test: add guarded local QA database setup`.

### Task 2: Inventory Every API Route and Build the Local Newman Collection

**Files:**
- Create: `tests/api/route-inventory.json`
- Create: `tests/api/guigui-local-qa.postman_collection.json`
- Create: `scripts/qa/discover-routes.ts`
- Create: `scripts/qa/validate-route-inventory.ts`
- Create: `tests/unit/qa-route-inventory.test.ts`
- Modify: `package.json` (Newman validation/run commands only)

**Interfaces:**
- Each inventory entry has `method`, `path`, `source`, `authentication`, `preconditions`, and exactly one of `scenario` or `exclusionReason`.
- `discoverExpressRoutes(rootDir: string): RouteDiscoveryResult` returns the direct/mounted method, path, source file/line, compatibility prefix where declared, and unresolved dynamic registrations.
- `validateRouteInventory(inventory, collection, discoveredRoutes): RouteCoverageResult` rejects duplicate method/path entries, discovered routes missing from inventory, inventory entries missing from source, entries without a safe scenario or exclusion, covered routes missing a collection request, and collection requests not represented in the inventory.
- Collection variables are limited to `qaBaseUrl`, synthetic fixture IDs, and authentication tokens created during the same local run; no Postman Cloud workspace or environment is used.

- [ ] **Step 1: Write failing inventory tests** in `tests/unit/qa-route-inventory.test.ts` for duplicate routes, an unclassified route, a source route absent from inventory, an unresolved dynamic route, a missing collection request, and a valid explicitly excluded route.
- [ ] **Step 2: Run `npx vitest run tests/unit/qa-route-inventory.test.ts`** and verify it fails before the validator exists.
- [ ] **Step 3: Enumerate every Express HTTP route** registered from `server.ts` and mounted routers under `server/`; include both `/api` and `/api/v1` compatibility behavior where applicable. Record the source registration for every route, resolve each router mount, and explicitly map any dynamic registration. Put every route in `tests/api/route-inventory.json`, assigning a safe test or a concrete exclusion reason to each; do not accept unresolved registrations.
- [ ] **Step 4: Implement `discoverExpressRoutes`** in `scripts/qa/discover-routes.ts` using the TypeScript AST; resolve direct route declarations and statically imported/mounted routers, and report computed method/path registrations or unresolved router mounts explicitly.
- [ ] **Step 5: Implement `validateRouteInventory`** in `scripts/qa/validate-route-inventory.ts` and verify every discovered route has exactly one inventory entry, every inventory entry maps back to source, every non-excluded entry has a collection request, and excluded routes have none.
- [ ] **Step 6: Create the Newman collection** with local `qaBaseUrl`, authentication setup where required, unique synthetic IDs for write scenarios, and safe negative cases. Exclude any operation that could contact an external provider or create a real payment/message.
- [ ] **Step 7: Add `qa:api:check` and `qa:api` commands**; the check must compare the source AST, inventory, and collection. The run command must invoke local Newman against the explicit QA URL and write JSON/CLI results only under the local campaign output directory.
- [ ] **Step 8: Run `npx vitest run tests/unit/qa-route-inventory.test.ts` and `npm run qa:api:check`; run Newman only when the disposable DB preflight is available, then verify matrix counts, request counts, exit code, and sanitized output agree.**
- [ ] **Step 9: Commit only Task 2 files** with message `test: add complete local API route coverage`.

### Task 3: Run the Existing Playwright Suite Against the Isolated App

**Files:**
- Create: `playwright.qa.config.ts`
- Create: `scripts/qa/assert-running-target.ts`
- Create: `tests/unit/qa-running-target.test.ts`
- Modify: `server/modules/platform-foundation/config/platformRuntimeConfig.ts`
- Modify: `server.ts`
- Modify: `tests/unit/platform-foundation-config.test.ts`
- Modify: `package.json` (QA Playwright command only)
- Modify only if coverage inspection finds a missing critical flow: `tests/*.spec.ts`

**Interfaces:**
- The QA config requires `QA_BASE_URL` and rejects any non-loopback host or port 3000; it never falls back to `PW_PORT` or `http://127.0.0.1:3000`.
- `loadPlatformRuntimeConfig` returns `host: env.HOST?.trim() || '0.0.0.0'`; `server.ts` binds with that host so existing deployments retain their current default and QA can bind explicitly to `127.0.0.1`.
- `assertRunningTarget(baseUrl: string): Promise<void>` confirms the expected local health endpoint is responsive before Playwright starts and does not follow redirects to a different origin.

- [ ] **Step 1: Write failing tests** in `tests/unit/qa-running-target.test.ts` for `assertRunningTarget`, covering a valid loopback QA URL, port 3000, a non-loopback host, and an unavailable health endpoint; assert no connection details are printed.
- [ ] **Step 2: Run `npx vitest run tests/unit/qa-running-target.test.ts`** and verify the tests fail before the target checker exists.
- [ ] **Step 3: Add a failing platform-config assertion** that `HOST=127.0.0.1` selects loopback while an omitted `HOST` still selects `0.0.0.0`; update `loadPlatformRuntimeConfig` and `app.listen` to use the selected host.
- [ ] **Step 4: Implement `assertRunningTarget`** and add `playwright.qa.config.ts` to run all current `tests/*.spec.ts` in Chromium against the required `QA_BASE_URL`, retaining failures, traces, screenshots, and HTML/JSON reports.
- [ ] **Step 5: Add `qa:e2e` to `package.json`** and ensure the config does not start, reuse, or contact an unverified existing server.
- [ ] **Step 6: Compare the 17 existing E2E specs with the citizen, business, and admin critical flows; add only missing role-flow assertions, without deleting or weakening existing coverage.**
- [ ] **Step 7: Run the focused target-checker and platform-config tests, then `npm run qa:e2e` against the isolated app; account for all existing E2E files as passed, failed, or explicitly blocked.**
- [ ] **Step 8: Commit only Task 3 files** with message `test: isolate full Playwright QA run`.

### Task 4: Add the Bounded Read-Only k6 Scenario

**Files:**
- Create: `tests/load/guigui-readonly.js`
- Create: `scripts/qa/validate-k6-config.ts`
- Create: `tests/unit/qa-k6-config.test.ts`
- Modify: `package.json` (k6 QA command only)

**Interfaces:**
- `K6Options` is `{ vus: number; duration: string; thresholds: Record<string, string[]> }`; each `K6Endpoint` is `{ method: string; path: string; readOnly: boolean }`.
- `validateK6Config(target: string, options: K6Options, endpoints: K6Endpoint[]): void` rejects non-loopback targets, write methods, options outside the approved limits, or endpoints not marked read-only in the route inventory.
- k6 reads `QA_BASE_URL` and targets only read endpoints classified as safe in `tests/api/route-inventory.json`.
- Fixed options are `vus: 10`, `duration: '60s'`, `http_req_duration: ['p(95)<2000']`, and `http_req_failed: ['rate<0.01']`; checks must all pass.

- [ ] **Step 1: Write failing config tests** in `tests/unit/qa-k6-config.test.ts` for missing/non-loopback target, a write-method endpoint, more than 10 VUs, duration over 60 seconds, and altered thresholds.
- [ ] **Step 2: Run `npx vitest run tests/unit/qa-k6-config.test.ts`** and verify it fails before the safety validator exists.
- [ ] **Step 3: Implement `validateK6Config`** in `scripts/qa/validate-k6-config.ts` and have the runner verify the target, fixed options, and endpoint methods before starting k6.
- [ ] **Step 4: Implement `tests/load/guigui-readonly.js`** with a loopback-only target guard, GET-only approved endpoints, explicit response checks, the fixed VU/duration options, and the exact thresholds above.
- [ ] **Step 5: Add `qa:load`** to invoke `k6 run` with a local summary export; do not install k6 if absent.
- [ ] **Step 6: Run the config tests and, only after the disposable DB and application preflight plus the Playwright/Newman phases complete, run k6 for exactly 10 VUs and 60 seconds. Verify CLI exit status, raw metrics, and exported thresholds together; block k6 if target health is degraded.**
- [ ] **Step 7: Commit only Task 4 files** with message `test: add bounded read-only k6 campaign`.

### Task 5: Configure a Localhost-Only Passive ZAP Baseline

**Files:**
- Create: `scripts/qa/zap-local-baseline.ps1`
- Create: `scripts/qa/validate-zap-scope.ts`
- Create: `tests/unit/qa-zap-scope.test.ts`
- Modify: `package.json` (ZAP QA command only)

**Interfaces:**
- `validateZapScope(baseUrl: string, mode: 'baseline' | 'passive'): void` accepts only the explicit loopback QA URL and baseline/passive mode.
- The wrapper requires the explicit QA base URL and limits ZAP to that localhost target in baseline/passive mode.
- Output includes machine-readable alert counts and a local raw report; it does not launch active scan, fuzzing, or exploit tests.

- [ ] **Step 1: Write failing scope tests** in `tests/unit/qa-zap-scope.test.ts` for loopback allow, non-loopback reject, port-3000 reject, and baseline-only mode.
- [ ] **Step 2: Run `npx vitest run tests/unit/qa-zap-scope.test.ts`** and verify it fails before the scope validator exists.
- [ ] **Step 3: Implement `validateZapScope`** in `scripts/qa/validate-zap-scope.ts` and call it from the wrapper before invoking ZAP.
- [ ] **Step 4: Implement the ZAP wrapper**; pin the scan target to `http://127.0.0.1:<QA_PORT>`, use only the baseline/passive scanner, and write raw output to the local campaign directory.
- [ ] **Step 5: Add `qa:zap`** without adding an installation step. If ZAP is unavailable, the runner must mark it blocked and request authorization rather than installing it.
- [ ] **Step 6: Run scope tests and, if the tool is available or separately authorized, execute the passive baseline; compare the result with the prior baseline of seven alerts (four medium-severity/high-confidence CSP wildcard alerts, one low, and two informational).**
- [ ] **Step 7: Commit only Task 5 files** with message `test: add localhost-only passive ZAP baseline`.

### Task 6: Orchestrate the Campaign and Produce a Sanitized Report

**Files:**
- Create: `scripts/qa/run-campaign.ps1`
- Create: `scripts/qa/seed-admin-fixture.ts`
- Create: `scripts/qa/build-report.ts`
- Create: `tests/unit/qa-report.test.ts`
- Create: `tests/unit/qa-admin-fixture.test.ts`
- Modify: `package.json` (single full-campaign command only)

**Interfaces:**
- `CampaignPhaseResult` is `{ status: 'passed' | 'failed' | 'blocked' | 'skipped'; exitCode: number | null; artifactPaths: string[] }`.
- `CampaignResults` is `{ runId: string; startedAt: string; commit: string; branch: string; toolVersions: Record<string, string | null>; phases: Record<'playwright' | 'newman' | 'k6' | 'zap', CampaignPhaseResult>; e2eCounts: { passed: number; failed: number; skipped: number; blocked: number }; apiCounts: { inventoried: number; covered: number; excluded: number }; k6Metrics: { vus: number | null; durationSeconds: number | null; p95Ms: number | null; failureRate: number | null; checksPassed: boolean | null; thresholdsPassed: boolean | null }; zapCounts: Record<'critical' | 'high' | 'medium' | 'low' | 'informational', number>; zapBaselineDelta: { new: number; resolved: number; unchanged: number }; limitations: string[] }`.
- `buildCampaignReport(results: CampaignResults): SanitizedCampaignReport` records tool versions, commit/branch/time, phase statuses, test counts, API route counts, k6 metrics/threshold results, ZAP counts/delta, and limitations.
- The PowerShell runner requires explicit `QA_ADMIN_DATABASE_URL`, `QA_DATABASE_NAME=guigui_pg18_synthetic_target`, and `QA_PORT=4313`; it constructs the app connection string from those QA-only values, never reads or inherits the parent `DATABASE_URL`, supplies an allowlisted child-process environment with no real provider credentials, and creates an empty `DOTENV_CONFIG_PATH` file so `dotenv/config` cannot load repository `.env`.
- After creating the empty database, run migrations, `npx tsx scripts/seed-categories-db.ts`, `npm run db:seed:synthetic:10000`, then import `db/seeds/guigui-synthetic-10000.sql` with `psql -X -v ON_ERROR_STOP=1 -f` and connection settings supplied only via `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`. Run `npm run db:seed-demo` after the synthetic SQL seed; never pass `--clean`. Do not run `db:ensure-demo-users`, which reads the repository JSON auth snapshot.
- Implement `scripts/qa/seed-admin-fixture.ts` to create the `admin.teste@guigui.com` test account with the existing E2E fixture password in the isolated PostgreSQL database, using the project password hash helper. Test and verify fixture counts before starting the app; all fixture emails, IDs, and phone numbers must be synthetic.
- The runner starts the app with `HOST=127.0.0.1` and `PORT=4313` (fail if occupied; never reuse another process), checks its health, runs Playwright → Newman → k6 → ZAP, and stops only the server process it started, including on failure.
- `SanitizedCampaignReport` is `Omit<CampaignResults, 'phases'> & { phases: Record<'playwright' | 'newman' | 'k6' | 'zap', { status: CampaignPhaseResult['status']; exitCode: number | null; artifactPaths: string[] }> }`; artifact paths are relative and the report never copies raw responses, cookies, tokens, connection values, or personal data.
- Raw tool output and the generated sanitized report remain under `test-results/qa/<run-id>/`; the runner does not delete the database, raw output, or other data.

- [ ] **Step 1: Write failing report tests** in `tests/unit/qa-report.test.ts` for normal results, blocked tools, inconsistent k6 threshold flags, and redaction of connection strings, cookies, tokens, synthetic email/phone values, and raw request bodies.
- [ ] **Step 2: Run `npx vitest run tests/unit/qa-report.test.ts`** and verify it fails before the report builder exists.
- [ ] **Step 3: Implement `buildCampaignReport`** in `scripts/qa/build-report.ts`; calculate outcome from observed exit status and numeric metrics, not a success-shaped fallback or a lone threshold flag.
- [ ] **Step 4: Write failing tests** in `tests/unit/qa-admin-fixture.test.ts` proving the QA administrator is created only as a synthetic admin fixture and password storage uses the project hash helper.
- [ ] **Step 5: Implement `scripts/qa/seed-admin-fixture.ts`** with an explicit QA database connection; refuse databases whose name is not `guigui_pg18_synthetic_target`, insert only the fixed E2E admin fixture, and never read JSON snapshots.
- [ ] **Step 6: Implement the runner** to verify tool availability before starting, apply migrations, category seed, 10,000-row synthetic SQL, demo dataset, and QA admin fixture in the stated order, set allowlisted child-process variables and fake/disabled provider integrations, run the approved phase sequence, record later phases as blocked when preconditions fail, preserve raw outputs locally, stop only its own server process, and never tear down the database.
- [ ] **Step 7: Add `qa:full`** to `package.json`; test the runner with mocked tool outcomes before invoking the actual external scanners.
- [ ] **Step 8: Run the complete local campaign only after all tool/scope preflights pass; verify the report accounts for every E2E test, every inventoried API route, all thresholds, the ZAP delta, and every blocked phase.**
- [ ] **Step 9: Run `npm run check`, the focused QA unit tests, and review the final report for secrets before sharing any summary.**
- [ ] **Step 10: Commit only Task 6 files and the sanitized reviewed summary, if approved for publication, with message `test: orchestrate and report local QA campaign`.**

## Final Self-Review

- **Spec coverage:** Local PostgreSQL 18 isolation and no-destruction are covered by Task 1; full route inventory/Newman by Task 2; all existing E2E tests by Task 3; exact k6 limits by Task 4; passive ZAP and seven-alert comparison by Task 5; sequence, blocked phases, sanitization, and retained artifacts by Task 6.
- **Step scan:** Each task separates failing tests, implementation, verification, and a scoped commit. Tool absence is a stop/request condition, not an implicit installation.
- **Type consistency:** The target contract is consumed by provisioning and the runner; the route inventory contract is consumed by validator and collection; report inputs are limited to the stated `CampaignResults` fields.
- **Review Focus:** Each of the five listed failure modes has a named validator or regression test in its owning task; API declaration coverage is also explicitly reconciled in Task 2.
- **Proportion:** The plan adds only the harness, route coverage, tool scenarios, and report needed to execute the approved campaign; it does not migrate production data or remediate findings.
