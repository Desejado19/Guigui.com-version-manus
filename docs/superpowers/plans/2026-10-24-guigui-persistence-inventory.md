# Guigui.com PostgreSQL Persistence Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a code-evidenced inventory of every durable application data flow and an ordered, safe backlog for migrating all application-owned persistent data to PostgreSQL.

**Architecture:** This is a read-only audit, not a runtime change. Inspect each of the seven existing bounded contexts, trace UI/API/service/schema paths, and record each data flow in one evidence-based matrix. The final matrix separates PostgreSQL-owned data from transient state, environment configuration, external-provider state, static assets, and binary media.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, Vitest; Markdown for the inventory artifact.

**Spec:** [../specs/2026-10-24-guigui-persistence-inventory-design.md](../specs/2026-10-24-guigui-persistence-inventory-design.md)

## Global Constraints

- O destino é PostgreSQL para todos os dados persistentes próprios das funcionalidades do site.
- A migração será incremental, por contexto de domínio, e respeitará o mapa de capacidades existente.
- Em produção, a aplicação exige PostgreSQL configurado e conectado; indisponibilidade deve ser explícita e não pode ser ocultada por dados locais.
- O modo local pode continuar disponível exclusivamente para desenvolvimento e testes.
- Código da aplicação, HTML, CSS, JavaScript, imagens estáticas e outros artefactos do deploy não são dados de negócio e não serão movidos para tabelas.
- Para ficheiros enviados pelos utilizadores, o PostgreSQL poderá guardar metadados, propriedade e referências; o conteúdo binário poderá permanecer num armazenamento próprio de ficheiros.
- Nenhuma migration será executada automaticamente no arranque.
- Nenhuma importação, alteração ou eliminação será feita numa base existente sem identificação do alvo, backup e confirmação explícita do ambiente correto.
- Inspecionar ou revelar credenciais, ficheiros `.env`, snapshots ou dados de clientes está fora do escopo.
- O trabalho de inventário não lê segredos, não consulta/escreve em bases reais e não modifica comportamento de runtime.

## Review Focus

- **Local state that is authoritative in production:** trace writers and readers rather than labeling every localStorage use as cache; record findings in the owning context task.
- **A PostgreSQL table/service that is not actually on a user flow:** trace UI → API → service → repository/schema; record evidence in each owning context task.
- **Dual-write or stale fallback behavior:** check local and PostgreSQL write paths and production source-selection behavior; record in the owning context task.
- **Sensitive or externally owned state:** distinguish credential hashes/config secrets and provider-owned records from application data without reading values; record in identity, payments, and final reconciliation.
- **Transient, derived, static, and binary data:** classify these explicitly rather than forcing them into business tables; check in each context and final reconciliation.

---

### Task 1: Create the evidence matrix and inventory platform and identity

**Files:**
- Create: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Inspect: `CAPABILITY-MAP.md`
- Inspect: `docs/superpowers/specs/2026-10-22-guigui-modular-ddd-migration-design.md`
- Inspect: `server/db.ts`
- Inspect: `server/runtimeStore.ts`
- Inspect: `server/modules/platform-foundation/**`
- Inspect: `server/modules/identity-access/**`
- Inspect: `server.ts` authentication routes and middleware
- Inspect: `db/migrations/001_initial_schema.sql`
- Inspect by code reference only: `data/auth.json`, `data/sessions.json`, `data/password-reset-tokens.json`

**Interfaces:**
- Produces the report's evidence rules, classification definitions, matrix columns, and completed `platform-foundation` and `identity-access` sections.
- Each matrix entry records context/flow, entity/fields, current source, desired owner, schema coverage, real read/write path, gaps/risks, next slice, and validation.

- [ ] **Step 1: Create the report structure** with all seven context headings, the matrix columns defined in the spec, evidence rules, and data-classification definitions. Do not leave example values or placeholder rows.
- [ ] **Step 2: Inventory `platform-foundation`** by tracing DB configuration, health, observability, queue, rate-limit, and runtime-store code. Classify environment secrets/config separately from persistent application data.
- [ ] **Step 3: Inventory `identity-access`** by tracing account, credential, session, MFA, invitation, authorization, and lifecycle paths through HTTP/application/infrastructure/schema. Inspect only code references to JSON filenames; never open stored JSON contents.
- [ ] **Step 4: Verify the report section** has evidence paths for every claimed read/write flow and an explicit classification for transient or externally owned state.
- [ ] **Step 5: Run `git diff --check` and commit only the report** with `docs: inventory platform and identity persistence`.

### Task 2: Inventory business discovery

**Files:**
- Modify: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Inspect: `src/hooks/useMarketplaceData.ts`
- Inspect: `src/utils/persistentState.ts`
- Inspect: `src/data/initialData.ts`
- Inspect: `src/data/categoryCatalog.ts`
- Inspect: `src/components/BusinessDashboard.tsx`
- Inspect: `server/jsonBusinessStore.ts`
- Inspect: `server/postgresBusinessService.ts`
- Inspect: `server/postgresCategoryService.ts`
- Inspect: `server/postgresReviewService.ts`
- Inspect: `server.ts` business, category, review, and marketplace routes
- Inspect: relevant business/category/review migrations and import scripts

**Interfaces:**
- Consumes the report matrix from Task 1.
- Produces the completed `business-discovery` section, including businesses, categories, feed/content, offers, reviews, and media metadata/references.

- [ ] **Step 1: Trace marketplace source selection and writes** from `useMarketplaceData` through browser persistence, APIs, services, and schema; identify which durable records still have a local or JSON source of truth.
- [ ] **Step 2: Trace discovery subflows** for business profiles, catalog, reviews, posts/offers, and uploaded media metadata; distinguish static seed/catalog constants from mutable user data and binary media.
- [ ] **Step 3: Record each flow and gap** in the matrix with exact source paths and relevant tables/migrations; do not infer completion from an API or table existing.
- [ ] **Step 4: Verify every discovery entry** has its classification, actual read/write evidence, and a specific next-slice recommendation.
- [ ] **Step 5: Run `git diff --check` and commit only the report** with `docs: inventory business discovery persistence`.

### Task 3: Inventory payments and monetization

**Files:**
- Modify: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Inspect: `server/paymentService.ts`
- Inspect: `server/paymentAccessService.ts`
- Inspect: `server/postgresPaymentService.ts`
- Inspect: `server/postgresMonetizationService.ts`
- Inspect: `src/utils/subscriptions.ts`
- Inspect: `src/data/monetizationCatalog.ts`
- Inspect: `src/data/subscriptionCatalog.ts`
- Inspect: payment and monetization routes in `server.ts`
- Inspect: relevant migrations and `scripts/import-payments-postgres.ts`, `scripts/import-monetization-postgres.ts`
- Inspect by code reference only: `data/payments.json`, `data/monetization-ledger.json`, `data/monetization-wallets.json`

**Interfaces:**
- Consumes the report matrix from Task 2.
- Produces the completed `payments-monetization` section, separating application transaction records from provider-owned state and environment credentials.

- [ ] **Step 1: Trace checkout and payment lifecycle** from API/UI to payment service, PostgreSQL service, schema, and import path; document idempotency, provider references, and any non-PostgreSQL state.
- [ ] **Step 2: Trace subscriptions, plans, commissions, refunds, ledger, and wallets** from their consumers through writers/readers to schema.
- [ ] **Step 3: Record all flows and migration gaps** without reading payment files or provider secrets.
- [ ] **Step 4: Verify payment records are classified as synthetic/test, application-owned, or provider-owned as appropriate, and each has evidence paths.**
- [ ] **Step 5: Run `git diff --check` and commit only the report** with `docs: inventory payments persistence`.

### Task 4: Inventory events and ticketing

**Files:**
- Modify: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Inspect: `server/ticketPurchaseUseCase.ts`
- Inspect: `server/ticketPurchaseDomain.ts`
- Inspect: `server/ticketPurchasePorts.ts`
- Inspect: `server/ticketCatalogService.ts`
- Inspect: `server/ticketInventoryService.ts`
- Inspect: `server/ticketPurchaseDeliveryService.ts`
- Inspect: `server/postgresTicketService.ts`
- Inspect: `server/postgresTicketLifecycleService.ts`
- Inspect: `server/ticketAccessService.ts`
- Inspect: `server/offlineScannerService.ts`
- Inspect: `src/components/TicketScannerView.tsx`
- Inspect: event and ticket routes in `server.ts`, relevant migrations, and ticket import scripts
- Inspect by code reference only: `data/events.json`, `data/tickets.json`, `data/scheduled-items.json`

**Interfaces:**
- Consumes the report matrix from Task 3.
- Produces the completed `events-ticketing` section for events, inventory, reservations, orders, tickets, access validation, scanner/offline state, and scheduled items.

- [ ] **Step 1: Trace event creation and publication** from UI/API through service and PostgreSQL schema; identify any local seed or persisted browser state still used in production.
- [ ] **Step 2: Trace ticket purchase, reservations, delivery, validation, and offline scanner flows**, identifying durable records versus device-local temporary state.
- [ ] **Step 3: Record every flow and migration gap** with migration, service, route, and UI evidence where each exists.
- [ ] **Step 4: Verify offline behavior is not misclassified as durable server truth** and all event/ticket rows have a source and owner.
- [ ] **Step 5: Run `git diff --check` and commit only the report** with `docs: inventory events and ticketing persistence`.

### Task 5: Inventory communication and support

**Files:**
- Modify: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Inspect: `server/postgresCommunicationService.ts`
- Inspect: `src/services/communicationSync.ts`
- Inspect: `src/services/notificationService.ts`
- Inspect: `src/utils/appCommunicationFlows.ts`
- Inspect: `src/utils/communicationPolling.ts`
- Inspect: communication/support routes in `server.ts` and relevant migrations
- Inspect by code reference only: `data/conversations.json`, `data/conversation-messages.json`

**Interfaces:**
- Consumes the report matrix from Task 4.
- Produces the completed `communication-support` section for conversations, messages, notifications, support tickets/replies, polling, and delivery integrations.

- [ ] **Step 1: Trace conversation and message reads/writes** through client sync, HTTP routes, service, and schema; identify duplicate local persistence or polling-only state.
- [ ] **Step 2: Trace notification and support lifecycles**, including any external SMS/email delivery boundary, and distinguish durable notification records from delivery attempts or ephemeral UI state.
- [ ] **Step 3: Record the flows and gaps** with owner, current source, PostgreSQL coverage, and next-slice recommendations.
- [ ] **Step 4: Verify the matrix does not treat successful external delivery as the source of truth for the application's message/notification record.**
- [ ] **Step 5: Run `git diff --check` and commit only the report** with `docs: inventory communication persistence`.

### Task 6: Inventory governance and operations

**Files:**
- Modify: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Inspect: `server/postgresAuditService.ts`
- Inspect: `server/postgresModerationService.ts`
- Inspect: `src/utils/moderation.ts`
- Inspect: `src/utils/moderationWorkflow.ts`
- Inspect: admin routes and operational handlers in `server.ts`
- Inspect: relevant audit/moderation migrations and import scripts
- Inspect by code reference only: `data/audit-logs.json`, `data/moderation-logs.json`, `data/backup-logs.json`

**Interfaces:**
- Consumes the report matrix from Task 5.
- Produces the completed `governance-operations` section for moderation, reports, audit trails, administrative operations, backups, and operational telemetry.

- [ ] **Step 1: Trace moderation and reports** from admin/user flows through routes and services to schema or local/file persistence.
- [ ] **Step 2: Trace audit and administrative operational records**, distinguishing durable accountability records from logs/metrics that are transient or exported to an external observability system.
- [ ] **Step 3: Record remaining flows and gaps** without reading log or backup data.
- [ ] **Step 4: Verify sensitive values are absent from the report** and each listed durable audit record has a retention/ownership recommendation.
- [ ] **Step 5: Run `git diff --check` and commit only the report** with `docs: inventory governance persistence`.

### Task 7: Reconcile cross-context coverage and publish the migration backlog

**Files:**
- Modify: `docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`
- Inspect: all report sections and `CAPABILITY-MAP.md`
- Inspect: `db/migrations/*.sql`, persistence/import scripts, and the production DB requirement/configuration paths

**Interfaces:**
- Consumes all seven completed context sections.
- Produces a prioritized gap backlog, cross-context dependency order, and the final acceptance checklist for the inventory.

- [ ] **Step 1: Cross-check the seven contexts** against `CAPABILITY-MAP.md`; every context must have data flows or a reasoned no-owned-persistent-state result.
- [ ] **Step 2: Cross-check schema against consumers**; list tables with no proven user-flow path and durable flows with no proven PostgreSQL read/write path.
- [ ] **Step 3: Deduplicate and prioritize gaps** using the approved context order and real dependencies; define each next domain-specific specification as a separate project.
- [ ] **Step 4: Run the report acceptance checklist**: all matrix columns populated; every claim has code/schema evidence; data classes are explicit; no secret/customer values; no real database queried or modified.
- [ ] **Step 5: Run `git diff --check`, commit the final report** with `docs: complete PostgreSQL persistence inventory`, and report remaining database migrations as not yet implemented.

## Final Verification

- Confirm the report has all seven contexts and the exact matrix fields defined in the spec.
- Confirm no stored data, secrets, snapshots, or live databases were inspected.
- Confirm only the inventory report changed during execution; no runtime or schema changes belong in this subproject.
- No build or unit test run is required because the subproject is documentation-only.
