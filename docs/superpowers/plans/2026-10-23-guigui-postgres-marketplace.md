# PostgreSQL Marketplace Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make categories, businesses, and events use PostgreSQL as the only source when configured, while preserving the current local mode.

**Architecture:** Extract the existing category definitions into one typed source, store the complete group/category/subcategory tree in the existing relational table, and expose it through a public API. A dedicated marketplace state hook will select the source after checking health, replace browser data with database results in PostgreSQL mode, and persist entity changes through the existing resource endpoints rather than duplicating them in `app_state`.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Vitest, Playwright.

**Spec:** [../specs/2026-10-23-guigui-postgres-marketplace-design.md](../specs/2026-10-23-guigui-postgres-marketplace-design.md)

## Global Constraints

- Preserve the current local mode while `DATABASE_URL` is not configured; PostgreSQL is the only source when it is configured.
- Do not fall back to static or browser data after a PostgreSQL read failure or when the configured database returns empty lists.
- Do not run migrations automatically during website startup.
- Before any write, confirm the URL points to a new, empty database on the local PostgreSQL 18 instance; do not use the existing development database, shared databases, or production.
- Do not read or import `.env`, snapshots, existing data, `.tmp-mig.txt`, or `Guigui.com-sistema-completo.zip`.
- Keep the category seed idempotent, restricted to its own reference IDs, and incapable of deleting unrelated rows.
- Do not include the later cross-domain seed of 1,000 synthetic records in this slice.

## Review Focus

- PostgreSQL is configured but empty: stale browser businesses/events and static examples must not appear. Test in Task 3 with `configuredDatabaseIgnoresStaleBrowserData`.
- PostgreSQL is configured but the category query fails: return `CATEGORY_CATALOG_LOAD_FAILED`, not a static catalog. Test in Task 2 with `returnsExplicitErrorWhenCategoryReadFails`.
- PostgreSQL is not configured: retain the existing local businesses/events and static category behavior. Test in Task 3 with `preservesLocalMarketplaceWhenDatabaseIsNotConfigured`.
- The category rows arrive in an arbitrary order or contain inactive/orphan rows: construct a deterministic valid tree or fail explicitly. Test in Task 2 with `mapsCategoryRowsIndependentlyOfQueryOrder`, `excludesInactiveCategoryRows`, and `rejectsOrphanedCategoryRows`.
- The category seed is run more than once beside a non-seed row: update only its own stable IDs and preserve the other row. Test in Task 1 with `categorySeedIsIdempotentAndPreservesUnownedRows`.

---

### Task 1: Create the shared category catalog and safe seed

**Files:**
- Create: `src/data/categoryCatalog.ts`
- Create: `server/categoryCatalogSeed.ts`
- Create: `db/migrations/009_category_catalog_metadata.sql`
- Create: `tests/unit/categoryCatalog.test.ts`
- Create: `tests/unit/postgresCategorySeed.integration.test.ts`
- Modify: `src/data/initialData.ts`
- Modify: `scripts/seed-categories-db.ts`

**Interfaces:**
- Produces `CATEGORY_GROUPS` and `MAIN_CATEGORIES` from `src/data/categoryCatalog.ts`; `initialData.ts` re-exports them so existing imports keep working.
- Produces `CategorySeedRow` and `buildCategorySeedRows(): CategorySeedRow[]` in `server/categoryCatalogSeed.ts`.
- Produces `seedCategoryCatalog(client: Pick<PoolClient, 'query'>): Promise<void>`; it performs a transaction and upserts only the catalog's own IDs.
- Group seed rows store only `id`, `name`, and `description`. Main-category `iconName` is stored in `metadata`; subcategories are rows whose `parent_id` is the main-category ID. Subscription prices are not stored.

- [ ] **Step 1: Add failing catalog and seed-row tests**

  In `tests/unit/categoryCatalog.test.ts`, assert five groups, sixteen main categories, unique IDs, valid group references, and deterministic, unique subcategory row IDs. Assert that category row metadata preserves each `iconName` and that sort order is explicit within each parent.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `npm run test:unit -- tests/unit/categoryCatalog.test.ts`
  Expected: FAIL because the shared catalog module and seed-row builder do not exist.

- [ ] **Step 3: Extract the canonical definitions**

  Move the current `CATEGORY_GROUPS` and `MAIN_CATEGORIES` definitions from `src/data/initialData.ts` into `src/data/categoryCatalog.ts`, preserving their IDs, labels, order, and types. Re-export them from `initialData.ts`; do not move or alter the subscription-price behavior.

- [ ] **Step 4: Add the additive schema migration and seed builder**

  Add `sort_order INTEGER NOT NULL DEFAULT 0` and `metadata JSONB NOT NULL DEFAULT '{}'::jsonb` to `categories` using `ADD COLUMN IF NOT EXISTS`. Implement deterministic subcategory IDs from the parent category ID and a normalized subcategory name. Build group, main-category, and subcategory rows in their defined order.

- [ ] **Step 5: Make the seed script use the shared seed service**

  Refactor `scripts/seed-categories-db.ts` to acquire a client and call `seedCategoryCatalog`. Upsert only rows from `buildCategorySeedRows`; do not add cleanup or delete behavior. Roll back and rethrow seed failures, release the client, close the pool, and exit non-zero on failure.

- [ ] **Step 6: Run the focused unit tests**

  Run: `npm run test:unit -- tests/unit/categoryCatalog.test.ts`
  Expected: PASS, including all five groups and sixteen main categories.

- [ ] **Step 7: Add the isolated-database idempotency test**

  In `tests/unit/postgresCategorySeed.integration.test.ts`, use only `TEST_DATABASE_URL`; skip without it. Seed twice, assert the expected reference-row count and metadata, and assert a separately inserted `test-unowned-category` row remains. Do not clear tables or use `DATABASE_URL` as a substitute.

- [ ] **Step 8: Commit the catalog slice**

  Commit only the shared catalog, migration, seed implementation, and their tests with `feat: seed complete PostgreSQL category catalog`.

### Task 2: Read the relational catalog through a typed API

**Files:**
- Create: `server/postgresCategoryService.ts`
- Create: `tests/unit/postgresCategoryService.test.ts`
- Create: `tests/unit/categoryRoutes.test.ts`
- Modify: `src/types.ts`
- Modify: `server.ts`

**Interfaces:**
- Adds `CategoryGroupSummary` and `CategoryCatalogResponse` to `src/types.ts`, matching the spec's response shape.
- Produces `categoryRowsToCatalog(rows: CategoryRow[]): CategoryCatalogResponse` and `listPostgresCategoryCatalog(): Promise<CategoryCatalogResponse>` in `server/postgresCategoryService.ts`.
- `listPostgresCategoryCatalog` returns static definitions only when PostgreSQL is not configured. With PostgreSQL configured, an empty table returns `{ groups: [], categories: [] }`; query or invalid-tree failures reject.
- Adds unauthenticated `GET /api/categories`; failures return HTTP 500 with code `CATEGORY_CATALOG_LOAD_FAILED`.

- [ ] **Step 1: Write failing service tests**

  In `tests/unit/postgresCategoryService.test.ts`, add `mapsCategoryRowsIndependentlyOfQueryOrder`, `excludesInactiveCategoryRows`, and `rejectsOrphanedCategoryRows`. Cover a populated tree with deliberately shuffled rows, an empty database result, inactive rows, an orphaned child, and a rejected query. Assert deterministic order, preserved `iconName`, and that no invalid tree or query error becomes an empty/success response.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `npm run test:unit -- tests/unit/postgresCategoryService.test.ts`
  Expected: FAIL because the service and response types do not exist.

- [ ] **Step 3: Implement the typed row mapper and PostgreSQL reader**

  Implement `categoryRowsToCatalog` to sort by `sort_order` then ID, map groups/categories/subcategories using `parent_id`, exclude inactive rows, and reject orphaned rows or categories without a valid `metadata.iconName`. Query the existing `categories` table with explicit ordering and select only required columns.

- [ ] **Step 4: Add and test `GET /api/categories`**

  Wire the unauthenticated route in `server.ts`. Log read failures using the existing route conventions and return the stable error code without serving static data after a PostgreSQL failure. In `tests/unit/categoryRoutes.test.ts`, assert the response envelope in local mode and add `returnsExplicitErrorWhenCategoryReadFails` to verify the 500 status and `CATEGORY_CATALOG_LOAD_FAILED` code when the reader fails.

- [ ] **Step 5: Run the focused API and service tests**

  Run: `npm run test:unit -- tests/unit/postgresCategoryService.test.ts tests/unit/categoryRoutes.test.ts`
  Expected: PASS for local, empty, populated, malformed-tree, and query-failure cases.

- [ ] **Step 6: Commit the API slice**

  Commit only the service, route, types, and tests with `feat: expose PostgreSQL category catalog`.

### Task 3: Make the interface use one marketplace source

**Files:**
- Create: `src/hooks/useMarketplaceData.ts`
- Create: `tests/unit/useMarketplaceData.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/utils/persistentState.ts`
- Modify: `src/components/BusinessCard.tsx`
- Modify: `src/components/BusinessDashboard.tsx`
- Modify: `src/components/client/ClientBusinessProfile.tsx`

**Interfaces:**
- Produces `useMarketplaceData()` with `status: 'loading' | 'ready' | 'error'`, `source: 'postgres' | 'local' | null`, typed category groups/categories, businesses/events, their React setters, and an explicit load/persistence error.
- In PostgreSQL mode, the hook checks `/api/health`, then loads `/api/categories`, `/api/businesses`, and `/api/events`; it replaces state rather than merging it with local data.
- In local mode, it preserves browser businesses/events and the existing local category definitions.
- Business/event changes persist through `/api/businesses` and `/api/events`, not `/api/app-state`; initial remote hydration must not write old local values back to PostgreSQL.
- Category consumers receive the typed catalog through props: `App` -> `BusinessCard` and `BusinessDashboard` -> `ClientBusinessProfile`.

- [x] **Step 1: Add failing marketplace-source tests**

  In `tests/unit/useMarketplaceData.test.tsx`, cover `configuredDatabaseIgnoresStaleBrowserData`, `preservesLocalMarketplaceWhenDatabaseIsNotConfigured`, and a configured database request failure that enters the explicit error state without using local data. Also assert that initial remote hydration does not POST to `/api/app-state`, while a changed event is persisted through `/api/events`.

- [x] **Step 2: Run the focused tests and confirm they fail**

  Run: `npm run test:unit -- tests/unit/useMarketplaceData.test.tsx`
  Expected: FAIL because the marketplace hook does not exist.

- [x] **Step 3: Implement the source-aware marketplace hook**

  Resolve the source from `/api/health`. Do not expose browser-backed lists while source resolution is pending. In PostgreSQL mode, load the three APIs together and replace all three datasets; distinguish an empty response from a failed response. In local mode, retain existing local businesses/events. Track the last successfully loaded entity values so only subsequent changes are persisted through the resource APIs; never write these arrays to `app_state`.

- [x] **Step 4: Wire the hook into `App.tsx`**

  Replace only the businesses/events `usePersistentState` calls and the existing business merge effect. Add a visible error state for source/load failures. Remove `guigui_businesses` and `guigui_events` from generic `SYNCABLE_STATE_KEYS` so they cannot be fetched from or written to `app_state`; preserve other keys and local storage behavior.

- [x] **Step 5: Pass the catalog to all category consumers**

  Remove direct `MAIN_CATEGORIES` imports from `BusinessCard.tsx` and `ClientBusinessProfile.tsx`; add typed category props. Pass the hook's category list from `App` into both `BusinessCard` instances and `BusinessDashboard`, then into `ClientBusinessProfile`. Keep the existing category group pricing state out of this catalog path.

- [x] **Step 6: Verify the focused unit tests and type check**

  Run: `npm run test:unit -- tests/unit/useMarketplaceData.test.tsx`
  Then run: `npm run check`
  Expected: PASS; configured-empty data remains empty, local mode remains available, and the TypeScript check succeeds.

- [x] **Step 7: Commit the frontend source-selection slice** (`c4a6251`)

  Commit only the hook, state wiring, category props, and tests with `feat: make marketplace data PostgreSQL authoritative`.

### Task 4: Validate against the isolated PostgreSQL 18 database

**Files:**
- Create: `tests/postgres-marketplace.spec.ts`
- No other files are changed unless a failed test identifies a defect in Tasks 1-3.

**Interfaces:**
- Consumes the API and UI contracts from Tasks 1-3.
- Uses a newly created, empty, disposable local PostgreSQL 18 database for all migration, seed, integration, and database-backed browser checks. Never drops or resets an existing database.

- [ ] **Step 1: Add the focused browser test**

  In `tests/postgres-marketplace.spec.ts`, create uniquely named synthetic `BusinessRecord` and `EventRecord` fixtures through the existing PostgreSQL service, then verify they appear after reload and the category filter/profile use the seeded catalog. Keep the empty-database/no-stale-browser assertion in the hook test from Task 3; do not delete or reset database rows in the browser test.

- [ ] **Step 2: Confirm the database target before writing**

  Using a read-only connection, confirm PostgreSQL reports version 18, inspect only the target database name and whether it is empty, and confirm it is not the existing development database. If the intended fresh database name already exists or the instance cannot be identified, stop and request a new target; do not drop, truncate, or reuse it.

- [ ] **Step 3: Apply migrations and seed only the category reference data**

  Set `DATABASE_URL` only in the process environment for the verified disposable database, run `npm run db:migrate`, then run `scripts/seed-categories-db.ts`. Do not print or persist the connection URL. Verify group, main-category, and subcategory counts and confirm the unrelated-row fixture remains.

- [ ] **Step 4: Run isolated integration and browser checks**

  Set `TEST_DATABASE_URL` only to that same disposable database and run:

  ```powershell
  npm run test:unit -- tests/unit/postgresCategorySeed.integration.test.ts
  ```

  Expected: PASS; a second seed makes no duplicates and the unowned-row fixture remains.

- [ ] **Step 5: Start the app against the isolated database and run the browser test**

  Start the development server with `DATABASE_URL` set only in its process environment to the verified disposable database. Confirm `/api/health` reports `database.configured: true`; confirm `/api/categories`, `/api/businesses`, and `/api/events` return the expected database records. Keep the server running while executing:

  ```powershell
  npm run test:e2e -- tests/postgres-marketplace.spec.ts
  ```

  Expected: PASS; the synthetic business and event remain visible after a full page reload.

- [ ] **Step 6: Run the required repository checks**

  Run: `npm run test:unit`
  Run: `npm run check`
  Run: `npm run build`
  Expected: all three pass; PostgreSQL integration tests are run only with the validated disposable database configured.

- [ ] **Step 7: Commit the end-to-end test**

  Commit only `tests/postgres-marketplace.spec.ts` with `test: verify PostgreSQL marketplace source`.

## Execution Notes

- Do not load the eventual 1,000 synthetic records as part of this plan; that belongs to roadmap slice 6 and requires its own approved specification.
- Do not include the pre-existing staged `.tmp-mig.txt` or `Guigui.com-sistema-completo.zip` in any task commit.
- Preserve unrelated pre-existing working-tree changes; stage only the files named in each task.
