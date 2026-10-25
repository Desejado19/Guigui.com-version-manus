# Guigui.com Durable PostgreSQL Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PostgreSQL the durable production source of truth for all application-owned data across the seven Guigui.com DDD contexts.

**Architecture:** Keep one Express monolith and migrate persistence in the approved context order. Require a connected PostgreSQL database in production, retain local adapters only for explicitly selected development/test mode, and cut over each context with an idempotent import, reconciliation, and a short write-freeze rather than dual writes.

**Tech Stack:** TypeScript, Express, PostgreSQL 18 for isolated integration tests, Vitest, Playwright, Newman, k6, OWASP ZAP.

**Spec:** [docs/superpowers/specs/2026-10-25-guigui-durable-postgres-persistence-design.md](../specs/2026-10-25-guigui-durable-postgres-persistence-design.md)

## Global Constraints

- PostgreSQL is mandatory in production; missing configuration or connectivity must never select JSON/localStorage fallback.
- Do not return write success until the PostgreSQL transaction commits.
- Keep migrations explicit and outside normal application startup.
- Do not use dual-write. Freeze writes to the context during its final import/reconciliation/cutover.
- Use only synthetic records and an isolated PostgreSQL 18 database for implementation and verification.
- Migration/import CLIs must use an explicit target variable and confirmation; never inherit the application's `DATABASE_URL` or auto-load `.env`.
- Do not manually inspect `.env`, existing snapshots, backups, customer data, or browser storage. Importers may read a source only after explicit approval for that source and context; tests use generated synthetic data. No production import or write without separate explicit approval.
- Preserve stable identifiers and existing HTTP/authorization behavior unless a context-specific approved design changes it.
- Keep each context as owner of its schema and repositories; cross-context access uses published contracts, not foreign tables or files.
- Use relational tables for durable domain data; use versioned JSONB only for genuinely variable payloads.
- Keep payment, email, SMS, and other provider adapters simulated unless separately approved.
- Do not deploy, provision a paid resource, or change Render as part of this plan.
- Do not commit credentials, connection strings, snapshots, or generated customer data.

## Review Focus

- Production with missing `DATABASE_URL`: startup/readiness must fail explicitly instead of selecting a local adapter. Pin in Task 1.
- PostgreSQL configured but unavailable during startup or a write: do not report healthy/success or fall back to JSON. Pin in Tasks 1 and 3.
- A configured but empty database: do not merge static/browser data into results or recreate stale records. Pin in Tasks 4–9.
- Duplicate, malformed, conflicting, or partially imported legacy records: preview/reject safely, keep imports idempotent, and preserve unrelated rows. Pin in Task 2 and each context import test.
- Browser-held legacy data with missing identity, invalid shape, or another owner: require authenticated preview/confirmation and reject ambiguous ownership. Pin in Tasks 4–9 where eligible records are owned.
- Restart, multiple processes, and concurrent retries: persisted state and idempotency must remain correct. Pin in Tasks 3–9.
- Schema or backup failure during rollout: leave a diagnosable state and never claim a successful migration/restore. Pin in Tasks 2 and 10.

---

## Implementation Boundaries

The system-wide design is approved, but some context-specific schemas, retention policies, and migration rules are not. **Before implementing each context task (Tasks 3–9), reconcile its inventory with current code, write or refresh that context's design and task plan, and stop for the user's approval.** Do not infer business policy or begin that context's code before this gate. Context task file lists below identify the known ownership surface; the approved context plan may add or narrow files.

This is the coordinating implementation plan; Tasks 3–9 are ordered context gates, not substitutes for those approved context-specific plans. Each context plan is a separate, reviewable implementation slice. Each task here is an independent commit; a context task consumes only verified outputs of its dependencies. Do not start the next context until its current tests and type-check pass.

### Task 1: Enforce the production PostgreSQL gate

**Files:**
- Create: `server/modules/platform-foundation/application/requireProductionDatabase.ts`
- Modify: `server/entrypoint.ts`
- Modify: `server/modules/platform-foundation/config/platformRuntimeConfig.ts`
- Modify: `server/modules/platform-foundation/hosting/runPlatformEntrypoint.ts`
- Modify: `server/modules/platform-foundation/application/getPlatformHealth.ts`
- Modify: `server/modules/platform-foundation/http/healthHandler.ts`
- Modify: `server.ts`
- Test: `tests/unit/platform-foundation-entrypoint.test.ts`
- Test: `tests/unit/platform-foundation-health.test.ts`
- Test: `tests/unit/platform-foundation-health-handler.test.ts`
- Test: `tests/unit/platform-foundation-config.test.ts`

**Interfaces:**
- Produces `requireProductionDatabase(env: NodeJS.ProcessEnv, checkConnection: () => Promise<void>): Promise<void>`.
- Existing local/test behavior may start without PostgreSQL only when explicitly non-production.
- Production startup must check connectivity before loading the application/listening; health/readiness must distinguish an absent database from a connected one.

- [x] **Step 1: Write tests for production DB missing, unreachable, and connected cases**

  Cover `failsWhenProductionDatabaseUrlIsMissing`, `failsWhenProductionDatabaseIsUnreachable`, `startsProductionOnlyAfterDatabaseCheck`, and `allowsExplicitLocalModeWithoutDatabase`. Assert no application loader/listener runs on a failed production gate.

- [x] **Step 2: Run focused tests and verify they fail**

  Run: `npm run test:unit -- tests/unit/platform-foundation-entrypoint.test.ts tests/unit/platform-foundation-health.test.ts tests/unit/platform-foundation-health-handler.test.ts tests/unit/platform-foundation-config.test.ts --maxWorkers=1 --no-file-parallelism`
  Expected: new production-gate cases fail because startup currently does not enforce database readiness.

- [x] **Step 3: Implement and compose the production database gate**

  Use `databaseConfigured` and `checkDatabaseConnection()` from `server/db.ts`; do not log the URL or select a local adapter after a failed production check. Preserve the existing health response fields and return an unhealthy/degraded result when PostgreSQL is unavailable.

- [x] **Step 4: Run focused tests and type-check**

  Run the focused command from Step 2 and `npm run lint`.
  Expected: tests and type-check pass; local/test mode remains compatible.

- [x] **Step 5: Commit**

  Commit the gate, health behavior, and tests with `feat: require PostgreSQL in production`.

### Task 2: Make schema migrations and data imports explicit and safe

**Files:**
- Create: `server/postgresMigrationRunner.ts`
- Modify: `scripts/migrate-db.ts`
- Modify: `scripts/importRunner.ts`
- Modify: existing `scripts/import-*-postgres.ts` only through the shared importer contract
- Test: `tests/unit/postgresMigrationRunner.test.ts`
- Test: `tests/unit/importRunner.test.ts`

**Interfaces:**
- Produces `applyPendingMigrations(pool: Pool, migrationsDirectory: string): Promise<MigrationSummary[]>`.
- `MigrationSummary` is `{ filename: string; checksum: string; status: 'applied' | 'already_applied' }`.
- Produces `runImport<T>(options: ImportRunOptions<T>, mode: 'dry-run' | 'apply' = 'dry-run'): Promise<ImportSummary>`.
- `ImportSummary` is `{ mode: 'dry-run' | 'apply'; sourceCount: number; acceptedCount: number; rejectedCount: number; conflictCount: number; writtenCount: number }`.
- `db:migrate` records applied migration names and checksums, serializes concurrent runs, and rejects a changed migration that was already applied.
- A database with an existing schema but no migration ledger is not baselined blindly; recognize only an explicitly verified schema fingerprint or stop with a diagnostic for operator review.
- `db:migrate` uses explicit `DB_MIGRATION_URL`; importers use explicit `IMPORT_DATABASE_URL`. Neither reads `.env` or falls back to `DATABASE_URL`.
- Importers default to preview-only; writes require `--apply`, `--confirm-target <database-name>`, and a validated target. During this plan, apply-mode tests and runs are restricted to a disposable, isolated target; no production import is executed. Preview reports counts, conflicts, and rejected records without writing.

- [ ] **Step 1: Add failing migration-runner tests**

  Cover `appliesPendingMigrationsInOrder`, `doesNotReapplyMatchingMigration`, `rejectsChangedAppliedMigration`, `rollsBackFailedMigration`, `serializesConcurrentMigrationRuns`, and `rejectsUnknownUntrackedSchema`.

- [ ] **Step 2: Add failing importer-mode tests**

  Cover `defaultsToDryRun`, `dryRunDoesNotWrite`, `applyRequiresValidatedTarget`, `applyRequiresExactTargetConfirmation`, `refusesInheritedDatabaseUrl`, `repeatedApplyIsIdempotent`, and `preservesUnownedRows`. Use in-memory fakes or temporary fixtures.

- [ ] **Step 3: Run the focused tests and verify they fail**

  Run: `npm run test:unit -- tests/unit/postgresMigrationRunner.test.ts tests/unit/importRunner.test.ts --maxWorkers=1 --no-file-parallelism`
  Expected: FAIL because the migration ledger and preview/apply contract do not exist.

- [ ] **Step 4: Implement the migration ledger and transactional runner**

  Apply migrations in deterministic order under a PostgreSQL advisory lock. Store migration identity and SHA-256 checksum; execute each migration and its ledger entry transactionally. Require explicit `DB_MIGRATION_URL` and target confirmation; keep execution in the CLI, not the server entrypoint.

- [ ] **Step 5: Implement importer preview/apply modes**

  Refactor existing importers through the shared runner. Preview validates source shape and target identity without mutation. Apply is explicit, idempotent, transaction-scoped where feasible, and refuses an unverified target. Read only `IMPORT_DATABASE_URL`; do not print source records, credentials, or connection strings.

- [ ] **Step 6: Run focused tests and isolated PostgreSQL migration tests**

  Run the focused unit command, then the PostgreSQL 18 integration tests with only an explicitly created disposable `TEST_DATABASE_URL`.
  Cover fresh schema, the previous supported schema, repeated migration, and importer replay. Expected: all are safe; tests skip if the isolated target is not configured.

- [ ] **Step 7: Commit**

  Commit the migration/import tooling and tests with `feat: add safe PostgreSQL migration and import runner`.

### Task 3: Complete `platform-foundation` durable operations

**Files:**
- Create/update only after the `platform-foundation` context design is approved:
  - `server/modules/platform-foundation/**`
  - `server/jobQueueService.ts`
  - `server/rateLimitService.ts`
  - `server/productAnalyticsService.ts`
  - `db/migrations/*.sql`
  - `tests/unit/*platform*`, `tests/unit/*job*`, `tests/unit/*rate*`

**Interfaces:**
- Consumes Task 1's startup/readiness contract and Task 2's explicit migration runner.
- Produces durable PostgreSQL adapters for selected operational jobs, shared rate limits, and approved telemetry retention; health remains derived. Backup execution metadata is owned by Task 9.
- Retention values and worker ownership must be explicit in the approved context design; do not invent them in implementation.

- [ ] **Step 1: Reconcile the foundation inventory and obtain approval of its context design/plan**

  Resolve job worker lifecycle, rate-limit expiry, telemetry retention, backup status semantics, and the existing health/readiness contract. Stop before code until approved.

- [ ] **Step 2: Add failing repository and failure-policy tests**

  Cover `persistsOperationalStateAcrossRestart`, `keepsRateLimitsSharedAcrossInstances`, `doesNotUseMemoryFallbackInProduction`, and the approved retention boundaries.

- [ ] **Step 3: Implement the approved PostgreSQL schema, adapters, and explicit migrations**

  Keep binaries outside PostgreSQL; persist only metadata/references. A snapshot JSON or unencrypted dump must not produce a PostgreSQL backup success result.

- [ ] **Step 4: Verify**

  Run foundation unit tests, PostgreSQL 18 repository tests, `npm run lint`, and a restart-level test against a disposable database.
  Expected: jobs/operational records survive reconnect/restart; failures are explicit; no migration runs during app startup.

- [ ] **Step 5: Commit**

  Commit only foundation-owned migrations, adapters, and tests with `feat: persist platform operations in PostgreSQL`.

### Task 4: Complete `identity-access` persistence and browser-owned preferences

**Files:**
- Create/update only after the identity context design is approved:
  - `server/modules/identity-access/**`
  - identity route composition in `server.ts`
  - `scripts/import-users-postgres.ts`
  - `src/utils/persistentState.ts` and identity settings UI only for eligible account-owned preferences
  - `db/migrations/*.sql`
  - `tests/unit/identityAccess*.test.ts`, `tests/unit/*session*.test.ts`, `tests/unit/*credential*.test.ts`

**Interfaces:**
- Consumes Task 2's import contract and Task 3's production database guarantee.
- Produces PostgreSQL-owned accounts, membership/permissions, sessions, recovery tokens, MFA metadata, invitations, consent records, and eligible identity-owned preferences.
- Tokens are stored as hashes; sessions/recovery/invitations have explicit expiry and atomic consumption.

- [ ] **Step 1: Reconcile identity sources and obtain approval of its context design/plan**

  Resolve ownership of memberships/RBAC, pending invitations, recovery tokens, session metadata, and demo-account handling. Consent is identity-owned and linked to the authenticated account; specify its required lifecycle and the identity import conflict rules. Governance consumes published consent contracts only. Stop before code until approved.

- [ ] **Step 2: Add failing PostgreSQL and importer tests**

  Cover `importsIdentityRecordsIdempotently`, `keepsSessionAndInvitationOwnership`, `consumesRecoveryTokenOnce`, `revokesExpiredAndLogoutSessions`, `doesNotPersistRawTokens`, `consentBindsToAuthenticatedUser`, `rejectsCrossBusinessMembership`, and `reportsDatabaseFailureWithoutJsonFallback`.

- [ ] **Step 3: Implement identity-owned migrations and repositories**

  Route every durable identity read/write through the PostgreSQL adapter in production. Remove session dual-write and JSON recovery/invitation paths from production composition; keep explicit local adapters only for non-production.

- [ ] **Step 4: Implement the authenticated preference-transfer slice**

  Export only eligible identity-owned browser preferences, preview the normalized records, require the authenticated owner to confirm, and make transfer idempotent. Reject malformed or ambiguously owned records.

- [ ] **Step 5: Verify**

  Run identity unit/integration tests, authorization tests, `npm run lint`, and process-restart tests against synthetic data.
  Expected: authentication, invitations, revocation, and eligible preferences remain consistent after restart and fail explicitly when PostgreSQL is unavailable.

- [ ] **Step 6: Commit**

  Commit only identity-owned schema, repositories, import/transfer logic, and tests with `feat: persist identity access in PostgreSQL`.

### Task 5: Complete `business-discovery` persistence

**Files:**
- Create: `server/modules/business-discovery/**` after its design is approved
- Modify: `server/postgresBusinessService.ts`, `server/postgresCategoryService.ts`, `server/postgresReviewService.ts`, `server/categoryRoutes.ts`, `server.ts`
- Modify: `src/hooks/useMarketplaceData.ts`, `src/utils/persistentState.ts`, `src/services/reviewSync.ts`, relevant marketplace components
- Modify: `scripts/import-businesses-events-postgres.ts`
- Test: `tests/unit/*business*`, `tests/unit/*category*`, `tests/unit/*review*`
- Modify: `db/migrations/*.sql`

**Interfaces:**
- Consumes published identity user/owner contracts from Task 4.
- Produces PostgreSQL-owned businesses, editable categories, offers/feed content, reviews, favorites/follow preferences, and media metadata/references.
- Media bytes remain in a durable file/object store; PostgreSQL stores validated ownership and references only.

- [ ] **Step 1: Reconcile marketplace sources and obtain approval of its context design/plan**

  Decide the canonical contracts for business profiles, posts/stories/offers, reviews, category catalog, follows/mutes, static examples, and media references. Stop before code until approved.

- [ ] **Step 2: Add failing read/write/import tests**

  Cover `configuredEmptyDatabaseDoesNotShowStaticExamples`, `businessWritesRequireOwner`, `reviewPersistsAfterRestart`, `categorySeedIsIdempotent`, `mediaReferenceSurvivesRestart`, and `doesNotFallBackAfterDatabaseReadFailure`.

- [ ] **Step 3: Implement the approved schema, context module, API adapters, and UI selection**

  With PostgreSQL configured, the API/UI use only the context's database-backed results; empty results remain empty and errors remain errors. Do not duplicate marketplace entities in generic `app_state`.

- [ ] **Step 4: Implement synthetic and authenticated legacy import**

  Preserve stable business/category/review IDs, validate ownership and relations, and make eligible browser preference transfer previewable and repeatable.

- [ ] **Step 5: Verify**

  Run the focused marketplace tests, PostgreSQL integration tests, Playwright marketplace flows, `npm run lint`, and restart/reconciliation tests.
  Expected: empty/populated DB, ownership, media references, and import retries behave deterministically without static/local fallback in production.

- [ ] **Step 6: Commit**

  Commit only business-discovery files and tests with `feat: persist business discovery in PostgreSQL`.

### Task 6: Complete `payments-monetization` persistence

**Files:**
- Create: `server/modules/payments-monetization/**` after its design is approved
- Modify: `server/postgresPaymentService.ts`, `server/postgresMonetizationService.ts`, `server/postgresCatalogService.ts`, payment/monetization routes in `server.ts`
- Modify: `scripts/import-payments-postgres.ts`, `scripts/import-monetization-postgres.ts`, `scripts/import-catalog-postgres.ts`
- Modify: `src/utils/subscriptions.ts`, monetization/admin UI only where it reads or writes durable state
- Test: `tests/unit/*payment*`, `tests/unit/*monetization*`, `tests/unit/*subscription*`
- Modify: `db/migrations/*.sql`

**Interfaces:**
- Consumes published business identity/reference contracts from Tasks 4–5.
- Produces a single PostgreSQL source for editable catalog, plans, subscriptions, commissions, payments, transaction ledger, reconciliation, and refunds, plus eligible account-owned browser preferences through authenticated transfer.
- Payment providers remain simulated; persistence and idempotency do not depend on an external provider.

- [ ] **Step 1: Reconcile finance sources and obtain approval of its context design/plan**

  Define canonical catalog ownership, transaction/subscription state transitions, fee calculations, refund semantics, and import conflict rules. Stop before code until approved.

- [ ] **Step 2: Add failing atomicity and retry tests**

  Cover `paymentRetryAfterRestartIsIdempotent`, `refundAndLedgerAreAtomic`, `subscriptionStateComesFromPostgres`, `catalogHasOneOwner`, and `databaseFailureDoesNotReturnSuccess`.

- [ ] **Step 3: Implement schema, context repositories, and transactional use cases**

  Make all production reads derive from PostgreSQL ledger/state and commit durable writes before responding. Keep simulated provider adapters and avoid direct table access to `business-discovery`.

- [ ] **Step 4: Implement explicit synthetic/approved import and reconciliation**

  Import catalog, subscriptions, and transaction records idempotently; transfer only approved eligible browser preferences after authenticated preview; report conflicts without overwriting unrelated records.

- [ ] **Step 5: Verify**

  Run payment/monetization unit and PostgreSQL integration tests, `npm run lint`, restart/retry tests, and relevant API flows.
  Expected: totals, fees, refunds, and ledger entries reconcile under retries and failures.

- [ ] **Step 6: Commit**

  Commit only payments-monetization files and tests with `feat: persist monetization in PostgreSQL`.

### Task 7: Complete `events-ticketing` persistence

**Files:**
- Create: `server/modules/events-ticketing/**` after its design is approved
- Modify: `server/ticketPurchaseUseCase.ts`, `server/ticketCatalogService.ts`, `server/ticketInventoryService.ts`, `server/postgresTicketService.ts`, `server/postgresTicketLifecycleService.ts`, `server/offlineScannerService.ts`
- Modify: ticket/event routes in `server.ts`, ticket purchase/scanner/dashboard components
- Modify: `scripts/import-tickets-postgres.ts`, `scripts/import-businesses-events-postgres.ts`
- Test: `tests/unit/*ticket*`, `tests/unit/*purchase*`, `tests/unit/*scanner*`
- Modify: `db/migrations/*.sql`

**Interfaces:**
- Consumes published event/business references from Task 5 and payment transaction contracts from Task 6.
- Produces a durable multi-unit order, reservation, idempotency key, transaction reference, ticket issuance/lifecycle, server-authoritative scanner state, and a minimal authenticated transfer for eligible legacy browser ticket references.
- Local scanner state is never authoritative; ticket snapshots contain no raw PIN or unnecessary credential data.

- [ ] **Step 1: Reconcile ticketing flows and obtain approval of its context design/plan**

  Approve the order aggregate, reserve/pay/issue transitions, ownership checks, offline scanner behavior, snapshot removal, and retry/recovery rules before code.

- [ ] **Step 2: Add failing multi-unit, concurrency, and secret-minimization tests**

  Cover `multiUnitPurchaseCreatesOneReconciledOrder`, `retriesAfterRestartDoNotDoubleIssue`, `concurrentReservationsRespectInventory`, `scannerRequiresServerOwnedTicketState`, and `ticketProjectionContainsNoRawPin`.

- [ ] **Step 3: Implement the approved transactional ticketing schema and use cases**

  Persist order, reservation, payment reference, inventory change, and issuance with approved transaction/idempotency boundaries. Remove production reliance on `payments.json`, memory maps, and raw-credential snapshots.

- [ ] **Step 4: Implement idempotent synthetic/approved import and scanner persistence**

  Reconcile multi-unit orders and ticket ownership without issuing duplicate tickets. Transfer only eligible browser references after authenticated preview; never import raw PINs or stale ticket credentials. Keep provider adapters simulated.

- [ ] **Step 5: Verify**

  Run ticket purchase/lifecycle/scanner unit and PostgreSQL integration tests, `npm run lint`, and Playwright buyer/organizer scenarios.
  Expected: retries, process restarts, and concurrent reservations preserve inventory and order consistency.

- [ ] **Step 6: Commit**

  Commit only events-ticketing files and tests with `feat: persist ticketing workflows in PostgreSQL`.

### Task 8: Complete `communication-support` persistence

**Files:**
- Create: `server/modules/communication-support/**` after its design is approved
- Modify: `server/postgresCommunicationService.ts`, `server/schedulingService.ts`, `src/services/communicationSync.ts`, `src/services/notificationService.ts`, `src/utils/communicationPolling.ts`
- Modify: communication/support/notification routes in `server.ts` and related UI components
- Create/update importer only after inventory confirms a source; do not invent a legacy notifications file
- Test: `tests/unit/*communication*`, `tests/unit/*notification*`, `tests/unit/*support*`
- Modify: `db/migrations/*.sql`

**Interfaces:**
- Consumes published user/business/event references; no direct reads of other contexts' tables.
- Produces durable conversations, messages, support requests/replies, notifications, per-user preferences, and delivery status required by the approved flow.
- External channels remain simulated; retry/outbox semantics are specified before implementation.

- [ ] **Step 1: Reconcile communication sources and obtain approval of its context design/plan**

  Define history, retention, delivery status, retry/outbox scope, ownership, and eligible browser migration before code.

- [ ] **Step 2: Add failing isolation and restart tests**

  Cover `conversationHistorySurvivesRestart`, `userCannotReadOtherUsersConversation`, `notificationPreferencesPersistPerUser`, `supportRepliesAreDurable`, and `simulatedDeliveryFailureIsVisibleAndRetryable`.

- [ ] **Step 3: Implement the approved context schema, adapters, and API/UI source selection**

  Remove production copies in generic `app_state` or browser storage as authoritative state; never treat delivery simulation as proof of external delivery.

- [ ] **Step 4: Implement context-owned idempotent imports and preference transfer**

  Transfer only eligible authenticated user-owned preferences; reject invalid or ambiguous records and preserve unrelated rows.

- [ ] **Step 5: Verify**

  Run communication unit/PostgreSQL tests, `npm run lint`, and restart/isolation/UI flows using simulated channels only.
  Expected: durable history and preferences remain owner-isolated; failures are explicit and repeatable.

- [ ] **Step 6: Commit**

  Commit only communication-support files and tests with `feat: persist communication and support in PostgreSQL`.

### Task 9: Complete `governance-operations` persistence

**Files:**
- Create: `server/modules/governance-operations/**` after its design is approved
- Modify: `server/postgresModerationService.ts`, `server/postgresAuditService.ts`, `server/backupService.ts`
- Modify: moderation, consent, audit, backup, and admin routes in `server.ts`
- Modify: `scripts/import-moderation-postgres.ts`, `scripts/import-audit-postgres.ts`
- Test: `tests/unit/*moderation*`, `tests/unit/*audit*`, `tests/unit/*consent*`, `tests/unit/*backup*`
- Modify: `db/migrations/*.sql`

**Interfaces:**
- Consumes published identity/actor and domain-entity reference contracts; never queries another context's private tables.
- Produces schema-aligned moderation items, individual reports, attributed audit records, and durable backup execution metadata. Consent is owned by `identity-access` in Task 4 and is consumed through its published contract.
- Backup bytes remain encrypted external artifacts; reports remain derived unless a separately approved requirement says otherwise.

- [ ] **Step 1: Reconcile governance policy and obtain approval of its context design/plan**

  Resolve moderation `item_data`, individual report lifecycle, actor/IP minimization, the governance-facing consent contract, retention, and backup verification before code.

- [ ] **Step 2: Add failing schema/ownership/retention tests**

  Cover `moderationItemRoundTripsThroughVersionedSchema`, `reportsKeepIndividualReporterHistory`, `auditPersistsActorAndBeforeAfterData`, and `backupCannotCompleteWithoutVerifiedEncryptedArtifact`.

- [ ] **Step 3: Implement approved schema and PostgreSQL-owned governance use cases**

  Align migrations, writers, readers, and importers. Require successful durable writes before success responses and remove production fallback to JSON.

- [ ] **Step 4: Implement idempotent import and isolated backup/restore verification**

  Do not inspect or restore existing backups; use generated synthetic artifacts and temporary directories.

- [ ] **Step 5: Verify**

  Run governance unit/PostgreSQL tests, `npm run lint`, access/retention tests, and an encrypted backup/restore drill against an isolated database.
  Expected: actor ownership, moderation/report history, consent, and backup metadata reconcile across restarts.

- [ ] **Step 6: Commit**

  Commit only governance-operations files and tests with `feat: persist governance operations in PostgreSQL`.

### Task 10: Prove complete persistence and publish cutover evidence

**Files:**
- Modify: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Modify: `docs/DEPLOY.md` only if deployment guidance materially differs from verified behavior
- Modify: `tests/e2e/**`, `tests/api/**`, and `scripts/qa/**` only for evidence gaps found in the approved QA plan
- Test: all context-specific integration, API, and UI tests

**Interfaces:**
- Consumes verified outputs from Tasks 1–9.
- Produces a field-level reconciliation report, tested restart/cutover evidence, backup/restore result, and sanitized QA campaign report.
- This task does not run a production import or deployment.

- [ ] **Step 1: Add end-to-end restart and fallback regression coverage**

  Cover one durable synthetic record from each context across API write, process restart, and API read; assert no local/static record appears when PostgreSQL is empty and no JSON fallback occurs when the database fails.

- [ ] **Step 2: Run checks in increasing scope**

  Run focused tests, PostgreSQL 18 integration tests, `npm run lint`, `npm run build`, the complete unit suite, and the approved local QA campaign against its isolated synthetic database.
  Expected: all required phases pass or are explicitly blocked with missing prerequisites; no phase is reported successful based on placeholder counts.

- [ ] **Step 3: Run the isolated backup/restore and data reconciliation drills**

  Verify encrypted artifact integrity and restore into a separate empty test database; compare entity counts, foreign-key/ownership invariants, and import idempotency.
  Expected: restore and reconciliation pass without accessing existing backups or production data.

- [ ] **Step 4: Update the persistence inventory with evidence**

  Replace static-only status with code/test evidence per field and context. Mark any unimplemented, unapproved, or blocked source as incomplete; do not claim all data is persistent until every durable entity has passed the acceptance criteria.

- [ ] **Step 5: Commit**

  Commit only regression tests, validated documentation, and sanitized local QA evidence with `test: verify durable PostgreSQL persistence`.

## Final Acceptance Gate

- [ ] All seven context tasks and their context-specific approval gates are complete.
- [ ] Production startup/readiness cannot select a local persistence path.
- [ ] Every approved durable entity has a PostgreSQL-backed owner, migration, repository, import/reconciliation result, and restart-level test.
- [ ] Eligible browser data transfer is authenticated, reviewed by its owner, and idempotent.
- [ ] No real data migration, Render deployment, or external provider action occurred without separate approval.
- [ ] Full type-check/build/unit/API/UI/QA and isolated restore evidence is recorded.
