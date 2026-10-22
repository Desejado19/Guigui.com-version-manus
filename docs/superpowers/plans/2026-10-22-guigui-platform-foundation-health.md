# Guigui.com Platform Foundation Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the existing health-check behavior into the first `platform-foundation` module slice while preserving the `/api/health` contract.

**Architecture:** Keep the Express application and all current routes in the same process. Move health composition into a platform-foundation application service and HTTP adapter, with database, AI status, clock, and logging supplied as dependencies; leave PostgreSQL and JSON persistence unchanged.

**Tech Stack:** Node.js, TypeScript, Express 4, Vitest, Playwright.

**Spec:** [2026-10-22-guigui-modular-ddd-migration-design.md](../specs/2026-10-22-guigui-modular-ddd-migration-design.md)

## Global Constraints

- "Manter o monólito num único processo."
- "Preservar PostgreSQL e JSON local como adaptadores suportados, sem fallback silencioso quando tal puder ocultar falha ou dividir escritas."
- "Preservar endpoints, formatos de resposta, permissões e comportamento observável, salvo mudança aprovada separadamente."
- "A extração não implica mudança de schema, migração de dados, alteração de identificadores ou troca de fornecedor de persistência."
- "A SPA e os seus componentes não são reorganizados nesta iniciativa."
- "Uma falha de integração deve ser explícita e diagnosticável. Não substituir erros por respostas de sucesso vazias, não esconder falhas com capturas genéricas e não alterar silenciosamente a persistência escolhida."
- "Não introduzir um barramento genérico de eventos ou transações distribuídas sem necessidade comprovada e decisão aprovada."
- Do not add dependencies, change `.env`, run database migrations, or initialize Git.
- This plan covers only the health-check slice; each later business context requires its own reviewed spec and implementation plan.
- The workspace has no Git metadata. Do not add commit steps or initialize a repository without separate authorization.

## Review Focus

- `DATABASE_URL` is absent: health remains `ok`, database is `{ configured: false, connected: false }`, and no database probe runs. Test: `returns healthy local JSON status without probing PostgreSQL`.
- PostgreSQL is configured but its health probe rejects: response is `degraded`, retains configured/disconnected state, and logs the failure. Test: `returns degraded and logs when the configured database probe fails`.
- PostgreSQL is configured and the probe succeeds: response is `ok` and persistent observability is true. Test: `returns healthy status when PostgreSQL is connected`.
- The optional Gemini client is inactive: the API still responds and reports `geminiActive: false`. Test: `preserves optional AI status in the health response`.
- Health response compatibility fields are accidentally dropped or renamed: status, app, timestamp, database, Gemini, and observability remain present. Test: `health: API reports the process and persistence state accurately`.

---

### Task 1: Pin the platform health application contract

**Files:**
- Create: `tests/unit/platform-foundation-health.test.ts`
- Modify: `tests/system-health.spec.ts`

**Interfaces:**
- Produces the expected application API for Task 2:
  - `getPlatformHealth(dependencies: HealthDependencies): Promise<HealthResponse>`
  - `HealthDependencies` has `databaseConfigured: boolean`, `checkDatabaseConnection: () => Promise<DatabaseHealth>`, `geminiActive: () => boolean`, `logger: Pick<Console, 'error'>`, and `now: () => Date`.
  - `HealthResponse` has `status: 'ok' | 'degraded'`, `app: 'Guigui.com Bissau'`, `timestamp: string`, `geminiActive: boolean`, `database: DatabaseHealth`, and `observability: { inProcess: true; persistent: boolean }`.

- [ ] **Step 1: Run the existing health characterization tests**

Run: `npm run test:unit -- tests/unit/healthService.test.ts tests/unit/securityRoutes.test.ts`

Expected: current classifier and route tests pass. If the baseline fails, record the exact failure and stop before changing behavior.

- [ ] **Step 2: Add application-service tests**

Add these Vitest cases to `tests/unit/platform-foundation-health.test.ts`, importing the expected API from `../../server/modules/platform-foundation/application/getPlatformHealth`:

1. `returns healthy local JSON status without probing PostgreSQL`: inject `databaseConfigured: false`; assert `checkDatabaseConnection` is not called and response fields are `status: 'ok'`, `database: { configured: false, connected: false }`, and `observability: { inProcess: true, persistent: false }`.
2. `returns healthy status when PostgreSQL is connected`: inject a successful database result; assert status is `ok`, database is configured and connected, and `observability.persistent` is true.
3. `returns degraded and logs when the configured database probe fails`: reject with `new Error('database unavailable')`; assert the promise resolves with status `degraded`, configured/disconnected database state, and a call to `logger.error`.
4. `preserves optional AI status in the health response`: inject `geminiActive: () => false`; assert the result contains `geminiActive: false`.
5. Use a fixed `now` value and assert `timestamp` equals its ISO string; assert `app` equals `Guigui.com Bissau`.

- [ ] **Step 3: Extend the end-to-end health contract assertions**

In the existing `health: API reports the process and persistence state accurately` test in `tests/system-health.spec.ts`, also assert `timestamp` is a string, `observability.inProcess` is `true`, and `observability.persistent` equals `body.database.connected`. Keep the existing status, app, database, and Gemini assertions.

- [ ] **Step 4: Run the new unit test to verify it fails before implementation**

Run: `npm run test:unit -- tests/unit/platform-foundation-health.test.ts`

Expected: FAIL because the application module does not exist yet. Do not implement production code in this task.

### Task 2: Implement the platform health application service

**Files:**
- Create: `server/modules/platform-foundation/application/getPlatformHealth.ts`
- Modify: `server/healthService.ts`

**Interfaces:**
- Consumes the expected API from Task 1.
- Produces:
  - `export type DatabaseHealth = { configured: boolean; connected: boolean }`
  - `export type HealthStatus = 'ok' | 'degraded'`
  - `export type HealthDependencies = { databaseConfigured: boolean; checkDatabaseConnection: () => Promise<DatabaseHealth>; geminiActive: () => boolean; logger: Pick<Console, 'error'>; now: () => Date }`
  - `export type HealthResponse = { status: HealthStatus; app: 'Guigui.com Bissau'; timestamp: string; geminiActive: boolean; database: DatabaseHealth; observability: { inProcess: true; persistent: boolean } }`
  - `export function classifyHealth(database: DatabaseHealth): HealthStatus`
  - `export async function getPlatformHealth(dependencies: HealthDependencies): Promise<HealthResponse>`

- [ ] **Step 1: Implement the smallest service that satisfies the Task 1 tests**

Skip the database probe when `databaseConfigured` is false. When configured, catch probe errors, log the same message and error detail as the current route, and report `{ configured: true, connected: false }`. Derive health status via `classifyHealth`; derive persistence observability from `database.connected`.

- [ ] **Step 2: Preserve the existing health-service import path**

Keep `server/healthService.ts` as a compatibility re-export of `classifyHealth`, `DatabaseHealth`, and `HealthStatus` from the new module. Do not duplicate the classifier.

- [ ] **Step 3: Run the focused service tests**

Run: `npm run test:unit -- tests/unit/platform-foundation-health.test.ts tests/unit/healthService.test.ts`

Expected: all cases pass, including existing consumers of `server/healthService.ts`.

### Task 3: Extract the HTTP adapter and compose it into the existing server

**Files:**
- Create: `server/modules/platform-foundation/http/healthHandler.ts`
- Create: `tests/unit/platform-foundation-health-handler.test.ts`
- Modify: `server.ts`
- Modify: `README.md`
- Test: `tests/unit/securityRoutes.test.ts`
- Test: `tests/system-health.spec.ts`

**Interfaces:**
- Consumes `HealthDependencies` and `getPlatformHealth` from Task 2.
- Produces `createHealthHandler(dependencies: HealthDependencies): import('express').RequestHandler`.

- [ ] **Step 1: Write HTTP adapter tests**

In `tests/unit/platform-foundation-health-handler.test.ts`, start a real Express app on an ephemeral loopback port and exercise the handler with the real `getPlatformHealth` service. Add these cases:

1. `serializes platform health as JSON over HTTP`: assert HTTP 200 and the expected status, app, database, Gemini, and observability fields.
2. `forwards unexpected health failures to Express error middleware`: make the injected AI status provider throw; assert the test error middleware receives the error and returns HTTP 500.

- [ ] **Step 2: Run the new HTTP test to verify it fails before implementation**

Run: `npm run test:unit -- tests/unit/platform-foundation-health-handler.test.ts`

Expected: FAIL because the HTTP adapter module does not exist yet.

- [ ] **Step 3: Create the Express handler**

Implement `createHealthHandler` in `server/modules/platform-foundation/http/healthHandler.ts`. It calls `getPlatformHealth`, responds with the result as JSON, and forwards unexpected errors to Express `next(error)` rather than swallowing them.

- [ ] **Step 4: Replace only the inline `/api/health` implementation**

In `server.ts`, mount `createHealthHandler` at the existing `GET /api/health` path. Supply the current `databaseConfigured`, `checkDatabaseConnection`, `getAIClient` status, `console`, and system clock as dependencies. Remove the inline response logic and classifier import only if no other usage remains; do not move unrelated routes or alter middleware.

- [ ] **Step 5: Document the implemented module boundary**

Update the backend organization section in `README.md` to identify `server/modules/platform-foundation/` as the owner of the health application service and HTTP adapter, and clarify that `server.ts` composes it. Do not claim that the remaining backend has already been migrated.

- [ ] **Step 6: Verify the route and API contract**

Run: `npm run test:unit -- tests/unit/platform-foundation-health.test.ts tests/unit/healthService.test.ts tests/unit/securityRoutes.test.ts`

Expected: PASS, including the existing local JSON health route test.

Run: `npm run check`

Expected: TypeScript exits successfully without new errors.

Run: `npm run build`

Expected: Vite and the server bundle both complete successfully.

Run: start `npm run dev` in a separate terminal, then run `npm run test:e2e -- tests/system-health.spec.ts`.

Expected: the health endpoint returns HTTP success and preserves all asserted response fields; stop only the development server process started for this verification.

## Follow-on plans

After this health slice is reviewed and complete, create a separate spec and implementation plan for the remaining `platform-foundation` work, then one plan per business context in the approved order: identity-access, business-discovery, payments-monetization, events-ticketing, communication-support, and governance-operations. Each plan must inventory its existing routes, data ownership, consumers, and flow-specific tests before extraction.
