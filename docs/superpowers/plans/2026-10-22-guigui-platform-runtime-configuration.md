# Guigui.com Platform Runtime Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the shared runtime configuration and Vercel preflight into explicit, testable platform-foundation interfaces while preserving startup and application behavior.

**Architecture:** Add a pure configuration reader, a Vercel preparation adapter, and one explicit preflight helper. Development, production Node, and Vercel entrypoints run preflight before dynamically importing `server.ts` or its bundle; `server.ts` remains the route composition root.

**Tech Stack:** Node.js, TypeScript, Express 4, Vite 6, Vitest, Playwright, esbuild.

**Spec:** `docs/superpowers/specs/2026-10-22-guigui-platform-runtime-configuration-design.md`

## Global Constraints

- "Manter o monólito num único processo."
- "Preservar PostgreSQL e JSON local como adaptadores suportados, sem fallback silencioso quando tal puder ocultar falha ou dividir escritas."
- "Preservar endpoints, formatos de resposta, permissões e comportamento observável, salvo mudança aprovada separadamente."
- "A extração não implica mudança de schema, migração de dados, alteração de identificadores ou troca de fornecedor de persistência."
- "A SPA e os seus componentes não são reorganizados nesta iniciativa."
- "Uma falha de integração deve ser explícita e diagnosticável. Não substituir erros por respostas de sucesso vazias, não esconder falhas com capturas genéricas e não alterar silenciosamente a persistência escolhida."
- "Não introduzir um barramento genérico de eventos ou transações distribuídas sem necessidade comprovada e decisão aprovada."
- Do not add dependencies, change `.env`, run database migrations, or initialize Git.
- This plan covers only the runtime-configuration slice; rate limits, backups, scheduled domain work, and later business contexts require separate reviewed scope.
- Preserve current environment-variable names, defaults, precedence, port parsing, CORS parsing, and consumer-specific URL fallbacks.
- Vercel preparation must complete before importing modules that capture `GUIGUI_DATA_DIR`.
- Do not commit without explicit user approval; preserve unrelated staged, unstaged, and untracked work.

## Review Focus

- `VERCEL=1` with explicit `APP_URL` or `CORS_ALLOWED_ORIGINS`: explicit values remain authoritative and the production URL is derived only when absent. Test: `preserves explicit Vercel URL and CORS settings`.
- `GUIGUI_DATA_DIR` is captured during module evaluation: preflight completes before the server module is imported. Test: `prepares runtime before loading the application`.
- Vercel seed directory contains existing JSON, non-JSON files, and missing JSON in the destination: existing files are never overwritten and only missing JSON files are copied. Test: `copies only missing JSON files without overwriting destination data`.
- `PORT` is absent, `"0"`, or nonnumeric: retain the current `Number(value) || 3000` behavior. Test: `preserves the existing port fallback`.
- CORS configuration contains multiple, whitespace-padded, or empty origins and `APP_URL` may be absent: preserve split/trim/filter behavior without unifying URL fallbacks at other consumers. Test: `parses configured CORS origins and APP_URL fallback`.

---

### Task 1: Define the typed platform runtime configuration

**Files:**
- Create: `server/modules/platform-foundation/config/platformRuntimeConfig.ts`
- Create: `tests/unit/platform-foundation-config.test.ts`
- Modify: `server.ts`

**Interfaces:**
- Produces:
  - `export type PlatformRuntimeConfig = { port: number; isProduction: boolean; isVercel: boolean; appUrl: string | undefined; allowedOrigins: string[] }`
  - `export function loadPlatformRuntimeConfig(env: NodeJS.ProcessEnv): PlatformRuntimeConfig`
- `server.ts` uses this result for `PORT`, production checks, `APP_URL`, `CORS_ALLOWED_ORIGINS`, and `VERCEL` reads. Domain-specific secrets, flags, and integration configuration remain untouched.

- [ ] **Step 1: Write the configuration contract tests**

Create `tests/unit/platform-foundation-config.test.ts` with these cases:

1. `uses local defaults when no shared runtime variables are configured`: port is `3000`, production and Vercel are false, `appUrl` is undefined, and origins are empty.
2. `preserves the existing port fallback`: absent, `"0"`, and nonnumeric `PORT` each produce `3000`; `"3102"` produces `3102`.
3. `parses configured CORS origins and APP_URL fallback`: split comma-delimited origins, trim whitespace, drop empty entries, use `APP_URL` only when CORS configuration is absent, and preserve an empty origin list when both are absent.
4. `reports production and Vercel modes from the supplied environment`: exact `NODE_ENV === 'production'` and truthy `VERCEL` behavior.
5. `preserves the configured APP_URL value`: keep the raw configured value so existing consumer-specific normalization and fallback behavior is unchanged.

- [ ] **Step 2: Run the tests and verify the expected missing-module failure**

Run: `npm run test:unit -- tests/unit/platform-foundation-config.test.ts`

Expected: FAIL because `platformRuntimeConfig.ts` does not exist yet.

- [ ] **Step 3: Implement `loadPlatformRuntimeConfig`**

Read only `NODE_ENV`, `PORT`, `APP_URL`, `CORS_ALLOWED_ORIGINS`, and `VERCEL`. Preserve `Number(env.PORT) || 3000`, exact production comparison, truthy Vercel detection, and the current CORS split/trim/filter logic. Do not read or validate secrets or `DATABASE_URL`.

- [ ] **Step 4: Replace only the shared environment reads in `server.ts`**

Create one runtime-config value in `server.ts` using `loadPlatformRuntimeConfig(process.env)`. Use its fields at the existing shared configuration sites, including `APP_URL` route consumers and the Vercel branch in `startServer`; leave business-specific environment reads unchanged.

- [ ] **Step 5: Run the focused configuration and existing health tests**

Run: `npm run test:unit -- tests/unit/platform-foundation-config.test.ts tests/unit/platform-foundation-health.test.ts tests/unit/healthService.test.ts`

Expected: all focused tests pass; the existing health response behavior is unchanged.

### Task 2: Extract Vercel preparation as an explicit, idempotent adapter

**Files:**
- Create: `server/modules/platform-foundation/hosting/prepareVercelRuntime.ts`
- Create: `tests/unit/platform-foundation-vercel.test.ts`
- Modify: `server/bootstrapVercel.ts`

**Interfaces:**
- Produces: `export function prepareVercelRuntime(env: NodeJS.ProcessEnv, sourceDataDirectory: string): void`
- The adapter mutates only the supplied environment object and the specified destination directory. `server/bootstrapVercel.ts` remains a temporary compatibility entry that invokes the new function until Task 4 switches all launchers; the final state has no side-effect bootstrap import.

- [ ] **Step 1: Write isolated preparation tests**

Create Vitest cases:

1. `does nothing when Vercel is not enabled`: environment and filesystem remain unchanged.
2. `sets Vercel defaults when values are absent`: set `NODE_ENV=production`; derive `APP_URL` from `VERCEL_URL`; derive CORS from the resulting `APP_URL`; use `/tmp/guigui-data` when `GUIGUI_DATA_DIR` is absent.
3. `preserves explicit Vercel URL and CORS settings`: leave explicit `APP_URL`, `CORS_ALLOWED_ORIGINS`, and `GUIGUI_DATA_DIR` unchanged.
4. `copies only missing JSON files without overwriting destination data`: use a temporary source and destination, preserve an existing destination JSON file, copy a missing JSON file, and ignore non-JSON files.
5. `is safe to run twice`: a second invocation leaves existing destination contents unchanged.
6. `propagates filesystem errors`: a failed directory preparation or copy rejects/throws to the caller instead of reporting success.

- [ ] **Step 2: Run the tests and verify the expected missing-module failure**

Run: `npm run test:unit -- tests/unit/platform-foundation-vercel.test.ts`

Expected: FAIL because the platform hosting adapter does not exist yet.

- [ ] **Step 3: Implement the adapter and preserve the current launch behavior**

Move the existing Vercel environment and JSON-copy behavior into `prepareVercelRuntime`. Resolve all file operations from the supplied source directory and `env.GUIGUI_DATA_DIR`; retain the existing “copy only if destination is missing” rule. The new adapter has no top-level side effects. Keep `server/bootstrapVercel.ts` as a short temporary call-through to preserve Vercel behavior until the launchers switch in Task 4.

- [ ] **Step 4: Verify both the adapter and compatibility path**

Run: `npm run test:unit -- tests/unit/platform-foundation-vercel.test.ts tests/unit/platform-foundation-config.test.ts`

Expected: all cases pass; the new adapter is side-effect free on import, and the compatibility entry continues applying the old Vercel preparation behavior.

### Task 3: Add a tested preflight-before-import entrypoint

**Files:**
- Create: `server/modules/platform-foundation/hosting/runPlatformEntrypoint.ts`
- Create: `server/entrypoint.ts`
- Create: `tests/unit/platform-foundation-entrypoint.test.ts`

**Interfaces:**
- Produces:
  - `export function runPlatformEntrypoint<T>(env: NodeJS.ProcessEnv, sourceDataDirectory: string, loadApplication: () => Promise<T>): Promise<T>`
  - `runPlatformEntrypoint` calls `prepareVercelRuntime(env, sourceDataDirectory)` before `loadApplication`, returns the loader result, and propagates preparation errors without calling the loader.
  - `server/entrypoint.ts` loads dotenv and calls `runPlatformEntrypoint(process.env, path.resolve(process.cwd(), 'data'), () => import('../server.js'))`.

- [ ] **Step 1: Write the order and failure tests**

Add:

1. `prepares runtime before loading the application`: use `VERCEL=1`, a temporary source/destination directory, and a loader callback that observes the Vercel defaults and copied JSON; assert it returns the loader result.
2. `does not load the application when preparation fails`: configure a destination that causes filesystem preparation to fail; assert the error propagates and the loader is not called.

- [ ] **Step 2: Run the tests and verify the expected missing-module failure**

Run: `npm run test:unit -- tests/unit/platform-foundation-entrypoint.test.ts`

Expected: FAIL because `runPlatformEntrypoint` does not exist yet.

- [ ] **Step 3: Implement the sequencing helper**

Implement the helper by calling `prepareVercelRuntime` with the supplied environment and source directory, then returning/awaiting `loadApplication()`. It must not open listeners or start timers.

- [ ] **Step 4: Create the source runtime entrypoint**

Use `import 'dotenv/config'` and import only the sequencing/preparation modules statically. Call `runPlatformEntrypoint` with a dynamic import of the existing `server.ts`. Do not import route modules directly from the entrypoint.

- [ ] **Step 5: Run the entrypoint and Vercel tests**

Run: `npm run test:unit -- tests/unit/platform-foundation-entrypoint.test.ts tests/unit/platform-foundation-vercel.test.ts`

Expected: all tests pass, including preparation-before-loader order and error propagation.

### Task 4: Wire development, Node production, and Vercel launchers

**Files:**
- Modify: `scripts/dev.mjs`
- Modify: `scripts/start-production.mjs`
- Modify: `index.mjs`
- Modify: `package.json`
- Modify: `server.ts`

**Interfaces:**
- Consumes `runPlatformEntrypoint`, `prepareVercelRuntime`, and `loadPlatformRuntimeConfig` from Tasks 1–3.
- Produces `dist/platform-preflight.mjs`, built from `runPlatformEntrypoint.ts` with the preparation adapter bundled. The built server bundle remains a separately loaded module so preflight finishes before its imports execute.
- Development invokes `server/entrypoint.ts` through the existing local `tsx` runner. Production and Vercel use the compiled preflight artifact and dynamically import `dist/server.mjs`.

- [ ] **Step 1: Route the development launcher through the source entrypoint**

Update `scripts/dev.mjs` to invoke `server/entrypoint.ts` while preserving its existing path-with-`#` junction behavior, arguments, environment, and child-process handling.

- [ ] **Step 2: Add a separate build output for the preflight**

Update the build script to compile `server/modules/platform-foundation/hosting/runPlatformEntrypoint.ts` to `dist/platform-preflight.mjs` as a separate Node ESM bundle. Keep `dist/server.mjs` as the existing server bundle; do not statically combine the application into the preflight artifact.

- [ ] **Step 3: Update the Node production launcher**

Load dotenv, set the existing production mode, call `runPlatformEntrypoint` from `dist/platform-preflight.mjs` with `process.env`, the project `data` directory, and a dynamic import of `dist/server.mjs`. Preserve the app's default export and existing listener behavior.

- [ ] **Step 4: Update the Vercel entrypoint**

Make `index.mjs` load dotenv and the compiled preflight first, call `runPlatformEntrypoint` with `process.env`, the project `data` directory, and a dynamic import of `dist/server.mjs`, then export the resulting Express app as the default. Do not change `vercel.json` behavior or deploy.

- [ ] **Step 5: Remove the old side-effect bootstrap import**

Remove `import './server/bootstrapVercel.js'` from `server.ts` only after all three launch paths use the explicit preflight. Change `server/bootstrapVercel.ts` into a pure compatibility re-export of `prepareVercelRuntime`; remove the file only when the repository has no remaining consumers.

- [ ] **Step 6: Verify generated launch artifacts**

Run: `npm run build`

Expected: Vite, server bundle, and preflight ESM artifact all build successfully; the output keeps the existing oversized-chunk warning only.

### Task 5: Document and verify startup compatibility end to end

**Files:**
- Modify: `README.md`
- Test: `tests/system-health.spec.ts`
- Test: all focused platform-foundation configuration, hosting, entrypoint, health, and observability tests

**Interfaces:**
- Consumes all production entrypoint behavior from Tasks 1–4.
- Produces documentation that describes the explicit runtime preflight without claiming the rest of the backend has migrated.

- [ ] **Step 1: Document the verified boundary**

Update the backend organization section to identify the runtime configuration and Vercel preparation owners, state that the three launch paths run preflight before importing the server, and clarify that routes remain composed in `server.ts`.

- [ ] **Step 2: Run focused platform health and route regression tests**

Run: `npm run test:unit -- tests/unit/platform-foundation-config.test.ts tests/unit/platform-foundation-vercel.test.ts tests/unit/platform-foundation-entrypoint.test.ts tests/unit/platform-foundation-health.test.ts tests/unit/platform-foundation-health-handler.test.ts tests/unit/healthService.test.ts tests/unit/securityRoutes.test.ts`

Expected: all selected files pass with no changes to existing health status, route response, or persistence behavior.

- [ ] **Step 3: Run the full unit suite and type-check**

Run: `npm run test:unit -- --maxWorkers=1 --no-file-parallelism`

Expected: all non-skipped unit tests pass; report the skipped count.

Run: `npm run check`

Expected: TypeScript exits successfully without new errors.

- [ ] **Step 4: Verify the local development launch path**

Start the app with `DATABASE_URL=''`, an isolated `GUIGUI_DATA_DIR`, and `PORT=3102`; verify the SPA HTML, a transformed frontend module, and `GET /api/health`; run:

```powershell
$env:PW_PORT='3102'
npm run test:e2e -- tests/system-health.spec.ts --grep "health: API reports the process and persistence state accurately"
```

Expected: the focused E2E test passes and health response fields remain compatible. Stop only the process started for this test and remove only its isolated data directory.

- [ ] **Step 5: Verify Node production and Vercel preflight without deployment**

Run the Node production launcher with a temporary data directory and isolated port/configuration; verify it reaches the existing production configuration checks and starts only when those checks pass. Run the Vercel preflight with a temporary environment/directory and confirm explicit URL/CORS precedence and data-directory preparation. Do not deploy, use real credentials, or connect to a real database.

- [ ] **Step 6: Check the final whitespace diff**

Run: `git diff --check`

Expected: exit code 0. Preserve all unrelated staged, unstaged, and untracked files; do not commit without explicit user approval.

## Follow-on plans

After this runtime-configuration slice is reviewed and complete, prepare one plan per business context in the approved order: identity-access, business-discovery, payments-monetization, events-ticketing, communication-support, and governance-operations. Each plan inventories routes, data ownership, consumers, and flow-specific tests before extraction.
