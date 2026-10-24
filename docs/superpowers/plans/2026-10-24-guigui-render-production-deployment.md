# Guigui.com Render Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a second Guigui.com production instance on its own Render URL, using the existing PostgreSQL database and preserving all required JSON-backed state, without changing the current service or domain.

**Architecture:** Keep the existing React/Vite SPA and Express API in one Node web service. Deploy through a Render Blueprint only after runtime/data audits, durable JSON storage selection, cost approval, backup verification, and database compatibility checks. Preserve the existing DDD migration roadmap as a separate sequential initiative; do not combine all seven context migrations with this deployment.

**Tech Stack:** Node.js, TypeScript, Express 4, React 19, Vite 6, PostgreSQL via `pg`, Vitest, Playwright, Render Blueprint.

**Spec:** [`docs/superpowers/specs/2026-10-24-guigui-render-and-ddd-modularization-design.md`](../specs/2026-10-24-guigui-render-and-ddd-modularization-design.md)

## Global Constraints

- Create a new Render production service; do not replace the current service.
- Validate first on the new Render URL; do not change or transfer the current domain.
- Use the existing PostgreSQL database; do not execute schema migrations automatically at startup.
- Inventory and preserve required JSON data before enabling writes; never assume those files are empty.
- Keep payments, SMS, email, and other external providers explicitly simulated.
- Do not provision paid resources before presenting the current cost estimate and obtaining approval.
- Store secrets only in private Render environment variables, never in code, logs, commits, or chat.
- Preserve observable HTTP contracts and permissions.
- Keep the application as a monolith in one process; do not introduce microservices or reorganize the SPA.
- The DDD migration remains sequential and follows `docs/superpowers/plans/2026-10-22-guigui-modular-ddd-migration.md`; each context still needs its own approved specification and plan.
- Every commit message includes `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.

## Review Focus

- `DATABASE_URL` absent or PostgreSQL unreachable: the health JSON must not be accepted as a connected/healthy production instance; Task 4 verifies `status`, `database.configured`, and `database.connected`.
- Persistent disk missing or mounted somewhere other than `GUIGUI_DATA_DIR`: the maintenance gate must remain enabled until the runtime path is verified and a restart preserves existing data; Tasks 5, 7, and 8.
- Data copied from the old service: backup, checksums/counts, and restore verification must succeed before copying; never overwrite an existing destination silently; Task 2.
- Render's generated public origin missing from application configuration: runtime config must derive `APP_URL`/allowed origins from the documented Render URL when no explicit value is supplied; Task 4.
- Blueprint accidentally matching or modifying the current Render service: use a unique new service name and validate Blueprint changes before provisioning; Task 6.

---

## File Structure

- Create `render.yaml` — declares only the new web service; no database resource or automatic migration command.
- Create `docs/deploy/render-production.md` — operator runbook for required environment variables, costs, deploy, smoke tests, and rollback.
- Create `docs/deploy/render-data-inventory.md` — records each runtime JSON/browser-backed data class, owner, current adapter, source-of-truth status, and preservation result; contains no record contents or secrets.
- Modify `server/modules/platform-foundation/config/platformRuntimeConfig.ts` — use Render's external service URL as the default application origin only when `APP_URL` is absent.
- Modify `tests/unit/platform-foundation-config.test.ts` — pin explicit-origin precedence and Render-origin fallback behavior.
- Create `server/modules/platform-foundation/http/maintenanceMiddleware.ts` — deny API traffic other than health while startup data restoration is in progress.
- Create `tests/unit/platform-foundation-maintenance.test.ts` — verify maintenance responses and health allowance.
- Modify `server.ts` — install the maintenance middleware and skip scheduled writers/backups while maintenance mode is enabled.
- Create `scripts/qa/verify-render-deployment.ts` — read-only HTTPS health verification restricted to the new `*.onrender.com` origin.
- Create `tests/unit/qa-render-deployment.test.ts` — target validation, redirect refusal, response-shape validation, and secret-safe errors for the read-only verifier.

## Tasks

### Task 1: Establish the deployment baseline and access gates

**Files:**
- Review: `package.json`
- Review: `scripts/start-production.mjs`
- Review: `server/entrypoint.ts`
- Review: `server/modules/platform-foundation/config/platformRuntimeConfig.ts`
- Review: `server/modules/platform-foundation/application/getPlatformHealth.ts`
- Review: `render.yaml` (confirm absent before creating)
- Create: `docs/deploy/render-production.md`

**Interfaces:**
- Consumes: Existing `npm run build`, `npm start`, `GET /api/health`, Render-generated `PORT`, and the approved deployment decisions in the spec.
- Produces: A baseline/runbook section recording exact local verification results, Render CLI/dashboard access availability, the current-service identity check, and explicit blockers. No cloud resource is created in this task.

- [ ] **Step 1: Verify the working tree and record the current deployment-relevant state**

Run:

```powershell
git status --short
git log -1 --oneline
Test-Path render.yaml
Get-Command render -ErrorAction SilentlyContinue
```

Expected: record whether the tree is clean, whether a Blueprint already exists, and whether the Render CLI is available. Do not print remote URLs containing credentials.

- [ ] **Step 2: Run the existing local checks without weakening them**

Run:

```powershell
npm run check
npm run test:unit
npm run build
```

Expected: record exact pass/fail totals and any known missing `src/data` imports; do not exclude tests or alter baselines to make these commands pass.

- [ ] **Step 3: Record the production start and health contract**

In `docs/deploy/render-production.md`, record that `npm run build` builds the SPA/server bundles, `npm start` runs `scripts/start-production.mjs`, the process binds to `PORT` and `0.0.0.0`, and `/api/health` returns HTTP 200 with a JSON health state.

- [ ] **Step 4: Confirm authenticated Render access before any provisioning**

If the Render CLI is installed, run its non-mutating version/authentication-status commands without printing tokens. Otherwise record that later deployment requires the user to use the Render Dashboard. Stop this task if the existing service cannot be positively distinguished from the proposed new service.

- [ ] **Step 5: Commit the deployment baseline/runbook**

```bash
git add docs/deploy/render-production.md
git commit -m "docs: record Render deployment preflight" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Inventory and preserve JSON-backed production data

**Files:**
- Review: `server/runtimeStore.ts`
- Review: `server/modules/identity-access/infrastructure/jsonIdentityRepository.ts`
- Review: `server/modules/identity-access/infrastructure/sessionRepository.ts`
- Review: `server/postgresBusinessService.ts`
- Review: `server/postgresCommunicationService.ts`
- Review: `server/postgresReviewService.ts`
- Review: `server/schedulingService.ts`
- Review: `server/ticketInventoryService.ts`
- Review: `server/backupService.ts`
- Review: `src/utils/persistentState.ts`
- Review: `server.ts` app-state handlers
- Create: `docs/deploy/render-data-inventory.md`

**Interfaces:**
- Consumes: Runtime file paths under `GUIGUI_DATA_DIR` and `data/`, the app-state allowlist, and access to the current deployed service through an authenticated operator.
- Produces: A data-class inventory that identifies JSON files and browser-synchronized state, owner/context, PostgreSQL fallback or adapter behavior, source copy required, and verification method. The document must contain no user records, tokens, or connection values.

- [ ] **Step 1: Enumerate every JSON read/write and synchronized browser key**

Run targeted searches:

```powershell
rg -n "loadJson\(|loadJsonStrict\(|saveJson\(|readFileSync|writeFileSync|SYNCABLE_STATE_KEYS" server src
rg -n "app-state|APP_STATE_PREFIX" server.ts
```

Expected: each matching runtime store and each syncable browser key appears in the inventory; classify a key as PostgreSQL-backed only when its active path is confirmed from code.

- [ ] **Step 2: Inspect the current Render service's data sources through authorized access**

Use the current service's supported authenticated export/backup method. Do not put downloaded JSON or personal data in the repository. If the existing service cannot be accessed, mark this task blocked; do not deploy a blank replacement as if data were preserved.

- [ ] **Step 3: Create and verify a protected backup**

Store the backup outside Git in an operator-controlled protected location. Record only non-sensitive filenames, byte counts, record counts where safe, cryptographic checksums, and backup/restore verification status in `docs/deploy/render-data-inventory.md`.

- [ ] **Step 4: Test restore into an isolated local directory**

Restore the backup to a new temporary directory, verify JSON parseability and expected record counts, compare checksums for unchanged files, and remove only the specifically created temporary restore files after verification. Do not connect the restore to the production database.

- [ ] **Step 5: Commit only the sanitized inventory**

```bash
git add docs/deploy/render-data-inventory.md
git commit -m "docs: inventory Render runtime data sources" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Estimate durable storage and obtain cost approval

**Files:**
- Modify: `docs/deploy/render-production.md`
- Review: official Render disk, service plan, and pricing documentation

**Interfaces:**
- Consumes: Verified JSON backup size/record inventory from Task 2 and the user-approved policy that paid resources require a prior estimate.
- Produces: Dated monthly cost options and an explicit recommendation for a durable storage path. No service, disk, or paid plan is created in this task.

- [ ] **Step 1: Calculate the minimum required storage**

Use the verified backup size plus reasonable growth/headroom based on the recorded data inventory. State the selected disk size and why it is sufficient; do not infer size from the absent local `data/` directory.

- [ ] **Step 2: Compare supported persistence options**

Compare:

1. a Render persistent disk mounted at `/var/data` with `GUIGUI_DATA_DIR=/var/data`, requiring a paid single-instance web service; and
2. moving the remaining JSON-owned state to PostgreSQL, which is a separate DDD/persistence change and requires its own approved design, migration, and rollback plan.

Include current official price, relevant plan assumptions, limitations (single instance and ephemeral filesystem outside the mount), and monthly total for each viable option. Link sources and date the estimate.

- [ ] **Step 3: Pause for the user's storage/cost decision**

Present the estimate and obtain explicit approval before selecting a paid plan or disk. If no option is approved, stop before provisioning resources and keep the existing service unchanged.

- [ ] **Step 4: Record the approved option and commit the estimate**

Record only the chosen option, plan/disk size, estimated recurring amount, approval date, and source links in `docs/deploy/render-production.md`; do not record billing credentials.

```bash
git add docs/deploy/render-production.md
git commit -m "docs: record approved Render storage option" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Add Render runtime-origin support and read-only deployment verifier

**Files:**
- Modify: `server/modules/platform-foundation/config/platformRuntimeConfig.ts`
- Modify: `tests/unit/platform-foundation-config.test.ts`
- Create: `scripts/qa/verify-render-deployment.ts`
- Create: `tests/unit/qa-render-deployment.test.ts`
- Modify: `package.json` — add a read-only Render deployment verification script

**Interfaces:**
- Consumes: `loadPlatformRuntimeConfig(env: NodeJS.ProcessEnv): PlatformRuntimeConfig` and the Render `RENDER_EXTERNAL_URL` environment variable.
- Produces: `verifyRenderDeployment(baseUrl: string): Promise<{ status: 'ok'; databaseConnected: true }>`; it accepts only HTTPS URLs whose hostname is a `*.onrender.com` host, makes GET requests only to `/api/health`, refuses redirects, and requires HTTP success plus JSON `{ status: 'ok', database: { configured: true, connected: true } }`. Error messages must not expose the URL or database details.

- [ ] **Step 1: Add a failing runtime-config test for Render URL fallback**

In `tests/unit/platform-foundation-config.test.ts`, add tests asserting:

- explicit `APP_URL` takes precedence over `RENDER_EXTERNAL_URL`;
- when `APP_URL` is absent, `RENDER_EXTERNAL_URL` populates `appUrl` and is the default allowed origin;
- when both values are absent, existing local defaults remain unchanged.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run tests/unit/platform-foundation-config.test.ts`

Expected: FAIL because `RENDER_EXTERNAL_URL` is not yet used.

- [ ] **Step 3: Implement the smallest runtime-origin fallback**

Update `loadPlatformRuntimeConfig` so `appUrl` resolves to `env.APP_URL || env.RENDER_EXTERNAL_URL`, and derive default allowed origins from that resolved value while preserving explicit `CORS_ALLOWED_ORIGINS` precedence.

- [ ] **Step 4: Add failing read-only verifier tests**

In `tests/unit/qa-render-deployment.test.ts`, test a valid HTTPS `service.onrender.com` health response; reject HTTP, localhost, non-Render domains, credentials, paths, query strings, redirects, non-2xx responses, malformed JSON, disconnected/unconfigured databases, and errors containing URL/secret data. Assert only GET is issued and no redirect is followed.

- [ ] **Step 5: Run the verifier tests to confirm the missing implementation fails**

Run: `npx vitest run tests/unit/qa-render-deployment.test.ts`

Expected: FAIL because the verifier is not implemented.

- [ ] **Step 6: Implement `verifyRenderDeployment`**

Create the verifier in `scripts/qa/verify-render-deployment.ts`, use the same strict host/URL parsing rules as the tests, perform only the health GET, parse the response as unknown, and validate its required fields before returning success. Surface safe error messages and propagate a failing process exit code from the CLI.

- [ ] **Step 7: Wire the script and verify Task 4**

Add `qa:render:verify` to `package.json`; run:

```powershell
npx vitest run tests/unit/platform-foundation-config.test.ts tests/unit/qa-render-deployment.test.ts
npx tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --types node,vitest/globals scripts/qa/verify-render-deployment.ts tests/unit/qa-render-deployment.test.ts
npm run check
```

Expected: focused tests and focused typecheck pass; `npm run check` passes or its unchanged pre-existing failures are recorded without suppressions.

- [ ] **Step 8: Commit the runtime-origin support**

```bash
git add package.json server/modules/platform-foundation/config/platformRuntimeConfig.ts tests/unit/platform-foundation-config.test.ts scripts/qa/verify-render-deployment.ts tests/unit/qa-render-deployment.test.ts
git commit -m "feat: verify Render deployment health safely" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Add a safe maintenance gate for initial data restoration

**Files:**
- Modify: `server/modules/platform-foundation/config/platformRuntimeConfig.ts`
- Modify: `tests/unit/platform-foundation-config.test.ts`
- Create: `server/modules/platform-foundation/http/maintenanceMiddleware.ts`
- Create: `tests/unit/platform-foundation-maintenance.test.ts`
- Modify: `server.ts`

**Interfaces:**
- Consumes: `PlatformRuntimeConfig.maintenanceMode`, defaulting to `false` unless `APP_MAINTENANCE_MODE=true`.
- Produces: `createMaintenanceMiddleware(enabled: boolean): RequestHandler`, which allows only `GET /api/health` while enabled and responds HTTP 503 with stable `{ error, code: 'MAINTENANCE_MODE' }` JSON for all other `/api` requests. The server skips scheduled JSON writers and backup scheduling while this mode is enabled.

- [ ] **Step 1: Add failing runtime configuration tests**

Assert `APP_MAINTENANCE_MODE=true` enables the flag, `false`, empty, and missing values leave it disabled, and existing defaults are unchanged.

- [ ] **Step 2: Run the config tests to verify they fail**

Run: `npx vitest run tests/unit/platform-foundation-config.test.ts`

Expected: FAIL because `maintenanceMode` is not yet part of the runtime configuration.

- [ ] **Step 3: Add failing maintenance middleware tests**

Assert that maintenance mode calls `next()` only for `GET /api/health`; `GET /api/events`, `POST /api/auth/login`, and `DELETE /api/tickets/:id` return HTTP 503 with code `MAINTENANCE_MODE` without calling `next()`. Assert disabled mode always calls `next()`.

- [ ] **Step 4: Run the middleware test to verify it fails**

Run: `npx vitest run tests/unit/platform-foundation-maintenance.test.ts`

Expected: FAIL because `createMaintenanceMiddleware` does not exist.

- [ ] **Step 5: Implement and install the maintenance gate**

Add `maintenanceMode` to `PlatformRuntimeConfig`, implement the middleware in the foundation HTTP adapter, and install it after the existing JSON/localization middleware but before business routes. Keep `/api/health` available for Render checks.

- [ ] **Step 6: Suppress startup writers while maintenance is enabled**

In `server.ts`, do not run `ensureDemoScheduledItems`, `processDueScheduledItems`, their interval, or `startBackupScheduler` while `runtimeConfig.maintenanceMode` is true. Preserve normal startup behavior when the flag is false.

- [ ] **Step 7: Verify maintenance mode**

Run:

```powershell
npx vitest run tests/unit/platform-foundation-config.test.ts tests/unit/platform-foundation-maintenance.test.ts
npm run check
```

Expected: focused tests pass; any existing full type-check failures are unchanged and recorded.

- [ ] **Step 8: Commit the maintenance gate**

```bash
git add server/modules/platform-foundation/config/platformRuntimeConfig.ts tests/unit/platform-foundation-config.test.ts server/modules/platform-foundation/http/maintenanceMiddleware.ts tests/unit/platform-foundation-maintenance.test.ts server.ts
git commit -m "feat: gate API traffic during data restoration" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 6: Define and validate the new Render Blueprint

**Files:**
- Create: `render.yaml`
- Modify: `docs/deploy/render-production.md`

**Interfaces:**
- Consumes: The approved unique service name, current branch/repository, and Task 3's explicit storage/cost decision.
- Produces: A Blueprint that declares only the new web service, runs `npm ci && npm run build`, starts with `npm start`, checks `/api/health`, binds the Render-provided port, sets `GUIGUI_DATA_DIR` to the approved persistent mount when a disk is selected, and never creates a PostgreSQL database or runs schema migrations.

- [ ] **Step 1: Draft the unique-service Blueprint**

Use a service name that cannot match the current service. Include the Node runtime, exact build/start commands, health-check path, and safe non-secret environment defaults. Declare secret values with Render's non-committed/synced-secret mechanism; never put a credential value in YAML.

- [ ] **Step 2: Encode only the approved storage decision**

If the approved choice is a persistent disk, set its approved mount and `GUIGUI_DATA_DIR` consistently, and set `APP_MAINTENANCE_MODE=true` for the initial deploy. If the disk was not approved, do not create a Blueprint that starts writable JSON-backed production flows on ephemeral storage; stop deployment planning and request a separately approved persistence migration plan.

- [ ] **Step 3: Validate the Blueprint without provisioning**

Use the current Render Blueprint validator/CLI if authenticated and available, or Render's dashboard validation before creating resources. Confirm the planned diff contains only the new service and the explicitly approved disk; do not sync/apply it during validation.

- [ ] **Step 4: Review environment-variable and health behavior**

Document the secret keys required by current production validation (`DATABASE_URL`, `SESSION_COOKIE_SECRET`, `TICKET_SIGNING_SECRET`, `PAYMENT_WEBHOOK_SECRET`, and `SCANNER_DOOR_CODE`) and non-secret runtime values. Keep provider integration credentials absent. Confirm the health check's HTTP status alone is not sufficient: the Task 4 verifier must also see `database.connected: true`.

- [ ] **Step 5: Commit the Blueprint and runbook**

```bash
git add render.yaml docs/deploy/render-production.md
git commit -m "feat: define isolated Render web service" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 7: Provision, restore, and deploy the second service

**Files:**
- Review: `render.yaml`
- Review: `docs/deploy/render-data-inventory.md`
- Review: `docs/deploy/render-production.md`
- External action: Render Dashboard or authenticated Render CLI

**Interfaces:**
- Consumes: A validated Blueprint, explicit approved cost, verified backup, durable storage, existing PostgreSQL compatibility evidence, and secrets entered directly in Render.
- Produces: A live new Render URL with the old service/domain unchanged, JSON state restored to the approved persistent path, and a recorded deployment/restore result without secret values.

- [ ] **Step 1: Reconfirm the target service and database before provisioning**

Verify the service name is unique and the database connection targets the approved existing PostgreSQL instance. Do not paste or log the connection string. Compare the deployed and candidate commits; if `db/migrations/` changed or the current deployed commit cannot be established, stop for a read-only schema compatibility review. Never run `npm run db:migrate` against production as part of this plan.

- [ ] **Step 2: Provision only the approved Render resources**

Create/sync the new Blueprint through authenticated Render access with `APP_MAINTENANCE_MODE=true`. If access is unavailable, stop and provide exact dashboard steps; do not ask the user to send an API token in chat.

- [ ] **Step 3: Configure secrets in Render**

Set required secrets directly in the private service environment. Confirm simulation mode remains active and no real-provider credentials are present. Never print secret values.

- [ ] **Step 4: Restore the verified JSON backup**

While maintenance mode remains enabled, transfer only inventoried files to the approved persistent mount using an authenticated transfer path. Refuse to overwrite a non-empty destination; compare file names, sizes, checksums, and safe record counts against the verified backup before disabling maintenance.

- [ ] **Step 5: Deploy without database migrations**

Verify build and start logs contain no secret values; confirm `/api/health` reports PostgreSQL connected. Only after the restored data and disk are verified, set `APP_MAINTENANCE_MODE=false` and perform the controlled deploy that enables API traffic.

### Task 8: Verify the new URL and document rollback

**Files:**
- Review: `scripts/qa/verify-render-deployment.ts`
- Modify: `docs/deploy/render-production.md`
- External action: read-only requests to the newly created Render URL

**Interfaces:**
- Consumes: The exact new `https://<service>.onrender.com` URL and deployed commit ID.
- Produces: A recorded read-only health verification and a rollback procedure that leaves the old service, domain, and existing database intact.

- [ ] **Step 1: Run the read-only Render health verifier**

Run: `npm run qa:render:verify -- https://<new-service>.onrender.com`

Expected: success only when `/api/health` returns an `ok` status and confirms `database.configured: true` and `database.connected: true`; all redirects and other hosts are refused.

- [ ] **Step 2: Verify the SPA and selected public read endpoints**

Use browser or HTTP GET checks against the exact new Render URL. Confirm the SPA loads and selected public GET endpoints return valid response shapes. Do not run purchase, payment, refund, invitation, admin write, or data deletion flows against the shared production database.

- [ ] **Step 3: Verify JSON persistence across a controlled restart**

Verify the approved non-sensitive sentinel and inventoried file checksums remain unchanged across one controlled restart/redeploy. Do not alter customer records to create a test sentinel.

- [ ] **Step 4: Record results and explicit limitations**

Record the deployed commit, URL, health result, data restore checksums/counts, and any blocked flows without recording credentials or personal data. State that the domain remains unchanged and external providers remain simulated.

- [ ] **Step 5: Test the rollback procedure without deleting data**

Document how to stop/disable only the new service, preserve the disk and database, and assess any writes made by the new instance before further action. Do not delete the service, disk, or database as a test.

- [ ] **Step 6: Commit the deployment verification record**

```bash
git add docs/deploy/render-production.md
git commit -m "docs: record Render deployment verification" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## DDD Follow-up

This plan deliberately stops at a stable second deployment. After the new URL is validated, continue the approved sequential roadmap in [`docs/superpowers/plans/2026-10-22-guigui-modular-ddd-migration.md`](2026-10-22-guigui-modular-ddd-migration.md). Do not begin the next context until its own specification and implementation plan have been reviewed and approved. The deployment plan does not claim the seven DDD modules are complete.

## External References

- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
- [Render persistent disks](https://render.com/docs/disks)
- [Render pricing](https://render.com/pricing)
