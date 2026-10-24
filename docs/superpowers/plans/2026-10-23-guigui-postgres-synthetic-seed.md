# Synthetic PostgreSQL Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, versioned PostgreSQL seed for a clean local PG18 database, ready for import through the pgAdmin SQL Query Tool without creating or altering any existing data.

**Architecture:** The implementation keeps the workload outside the app runtime: a generator creates a SQL seed file from a fixed manifest, and a validation script checks the total row counts, IDs, and safety checks before the file is opened in pgAdmin. The SQL script is transactional, protected by target guards, and designed to be safe to re-run without destructive resets.

**Tech Stack:** TypeScript, Node.js, PostgreSQL 18, pgAdmin Query Tool, Vitest.

**Spec:** [../specs/2026-10-23-guigui-postgres-synthetic-seed-design.md](../specs/2026-10-23-guigui-postgres-synthetic-seed-design.md)

## Global Constraints

- Do not execute any database write until the target is a new, empty, disposable PostgreSQL 18 database on the local instance and the user confirms it.
- Do not use or expose the existing `DATABASE_URL` or any credential material from the environment.
- Do not include the category reference seed in the 1,000-row total; it stays outside the synthetic domain load.
- Keep the generator offline and deterministic; it must not connect to PostgreSQL when generating SQL.
- Use only synthetic IDs and synthetic values; no personal data or real credentials.
- Protect the import with target checks: version, database name, PG18, empty-schema guard, and one-way markers.
- Do not use `DELETE`, `TRUNCATE`, `DROP`, or any destructive action in the seed SQL or generator.
- Keep the generator and SQL import idempotent and rollback-safe for an empty disposable target.
- The final import only runs in a disposable local PG18 target after migrations are already applied and the catalog seed is in place.

## Review Focus

- Target safety: a script or SQL file must reject a non-disposable or non-empty target instead of writing onto a developer database. Test in Task 3 with `rejectsUnexpectedTargetDatabase`.
- Row accounting: the 1,000-row total must match the exact domain split, or the import is invalid. Test in Task 1 with `buildsExactSyntheticCountsAcrossDomains`.
- Idempotence: repeating the same seed must not duplicate rows or mutate non-seed records. Test in Task 2 with `repeatedSeedIsSafeAndNonDestructive`.
- Relationship integrity: every synthetic company/event/order/ticket/payment/notification must point to an existing record. Test in Task 2 with `allSyntheticReferencesResolveToExistingRows`.
- Safety of identity data: no login credentials or real names/phones may be generated. Test in Task 1 with `doesNotGenerateUsableCredentialsOrRealContactData`.

---

### Task 1: Define the 1,000-row manifest and failing validation tests

**Files:**
- Create: `scripts/generate-postgres-synthetic-seed.ts`
- Create: `tests/unit/postgresSyntheticSeed.test.ts`
- Create: `db/seeds/guigui-synthetic-1000.sql` (generated output, not hand-written if generation is preferred)

**Interfaces:**
- Produces `SYNTHETIC_SEED_MANIFEST` as an in-memory constant with the approved domain split and counts.
- Produces `createSyntheticSeedSql(manifest)` and `assertSyntheticSeedValid(manifest)` in the generator code.
- Consumes no database connection; all logic is offline and pure.

- [ ] **Step 1: Add failing tests for row counts and safety invariants**

  In `tests/unit/postgresSyntheticSeed.test.ts`, assert the exact total of 1,000 rows, the domain count split, and that every row uses a synthetic prefix and no real address/email/password is generated.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `npm run test:unit -- tests/unit/postgresSyntheticSeed.test.ts`
  Expected: FAIL because the generator and manifest do not exist yet.

- [ ] **Step 3: Publish the fixed test manifest**

  Define the exact distribution by domain using the approved totals: identity, companies, company members, events, ticket_types, reservations, orders, tickets, payment_transactions, commissions, refunds, plans, subscriptions, reviews, moderation_items, notifications, conversations, conversation_messages, support_tickets, support_replies, monetization_ledger, and monetization_wallets.

- [ ] **Step 4: Implement the manifest validator**

  Implement `assertSyntheticSeedValid(manifest)` to ensure the domain totals equal 1,000, the known tables are present, IDs are prefixed, and none of the generated values include live credentials or contact data.

- [ ] **Step 5: Run the focused test to verify it passes**

  Run: `npm run test:unit -- tests/unit/postgresSyntheticSeed.test.ts`
  Expected: PASS.

### Task 2: Generate the SQL seed and safe import contract

**Files:**
- Modify: `scripts/generate-postgres-synthetic-seed.ts`
- Create: `db/seeds/guigui-synthetic-1000.sql`
- Create: `tests/unit/postgresSyntheticSeedImport.test.ts`

**Interfaces:**
- Produces `generateSyntheticSeedSql(manifest): string` and `writeSyntheticSeedSql(outputPath: string)`.
- Produces a SQL file that starts a transaction, checks the target safety guard, inserts rows with synthetic prefixes, and prints final counts.
- The generator does not hit the network or the database; it only writes SQL text.

- [ ] **Step 1: Write failing import-shape tests**

  In `tests/unit/postgresSyntheticSeedImport.test.ts`, assert the SQL contains the target guard, the transaction wrapper, and the expected per-table inserts for the approved counts. Confirm it does not contain `TRUNCATE`, `DELETE`, `DROP`, or external API calls.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `npm run test:unit -- tests/unit/postgresSyntheticSeedImport.test.ts`
  Expected: FAIL because the generator has not emitted the SQL contract yet.

- [ ] **Step 3: Implement deterministic SQL generation**

  Build the SQL generation in `scripts/generate-postgres-synthetic-seed.ts` using a deterministic array of domain rows, stable IDs, and valid row references. Include a target check such as a `SELECT` against `current_database()`, `current_setting('server_version_num')`, and an empty-target validation guard before inserts.

- [ ] **Step 4: Write the generated SQL file**

  Generate `db/seeds/guigui-synthetic-1000.sql` from the manifest, with per-table inserts and a final count query. Keep the file importable in pgAdmin Query Tool and no-op safe if target checks fail.

- [ ] **Step 5: Run the focused validation tests**

  Run: `npm run test:unit -- tests/unit/postgresSyntheticSeed.test.ts tests/unit/postgresSyntheticSeedImport.test.ts`
  Expected: PASS.

### Task 3: Add the target guard and import instructions

**Files:**
- Create: `scripts/validate-postgres-synthetic-seed.ts`
- Modify: `db/seeds/guigui-synthetic-1000.sql`
- Modify: `docs/superpowers/specs/2026-10-23-guigui-postgres-synthetic-seed-design.md` (only if needed after review)

**Interfaces:**
- Produces `validateSyntheticSeedTarget` to check database version, name, and target status before import.
- Produces instructions for opening the SQL in pgAdmin but does not execute writes from within this repository.

- [ ] **Step 1: Write failing guard tests**

  In `tests/unit/postgresSyntheticSeedImport.test.ts`, add `rejectsUnexpectedTargetDatabase` and `rejectsNonEmptyTarget` as assertions against the validation helper or generated SQL guard logic.

- [ ] **Step 2: Run the focused test and confirm it fails**

  Run: `npm run test:unit -- tests/unit/postgresSyntheticSeedImport.test.ts`
  Expected: FAIL because the guard logic is not implemented.

- [ ] **Step 3: Implement the guard logic**

  Reuse the SQL safety pattern to reject non-PG18 hosts, invalid database names, or pre-existing business rows. The guard must be explicit and transactional; there is no silent fallback.

- [ ] **Step 4: Write import instructions**

  Add a short `README`-style note or SQL comment block at the top of the generated SQL file describing the PG18 target, the import path in pgAdmin, the migration precondition, and the no-destructive-safe behavior.

- [ ] **Step 5: Run the focused guard tests**

  Run: `npm run test:unit -- tests/unit/postgresSyntheticSeedImport.test.ts`
  Expected: PASS.

### Task 4: Final verification and commit

**Files:**
- All generated and validation files from Tasks 1-3
- Tests covering the generator and guard logic

**Interfaces:**
- Final output is the generated SQL seed plus the generator and validation tests, all committed in a single safe scope.

- [ ] **Step 1: Run the complete repository checks with the new seed files present**

  Run: `npm run test:unit`  
  Run: `npm run check`  
  Expected: all pass with the new synthetic-seed generator tests included.

- [ ] **Step 2: Review the diff for safety**

  Confirm the target guard, no-destructive semantics, and exact 1,000-row counts remain intact.

- [ ] **Step 3: Commit**

  Commit only the synthetic seed generator, SQL output, and validation tests with `feat: generate synthetic pgAdmin data seed`.

---

## Handoff

This plan is ready for review. The next step is to confirm the execution method before implementation begins.
