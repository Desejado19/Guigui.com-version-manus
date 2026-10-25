# Guigui.com UX/UI and Functional Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a read-only, evidence-backed audit report of Guigui.com user experience, profile flows, permissions, persistence, and critical commerce behavior.

**Architecture:** Trace user-visible actions through the React SPA, Express authorization and route handlers, application/services, and persistence or simulated adapters. Record findings incrementally in one audit report; do not change product code, database contents, environment configuration, or deployed systems.

**Tech Stack:** React, TypeScript, Express, PostgreSQL adapters, Vitest, Playwright, Newman, k6, OWASP ZAP, PowerShell.

**Spec:** `docs/superpowers/specs/2026-10-25-guigui-ux-ui-audit-design.md`

## Global Constraints

- This first deliverable is a read-only audit and report; do not change product code.
- Keep the application as a single-process monolith and preserve existing behavior.
- Do not connect to Render, production, external providers, inherited/unverified database URLs, or any non-loopback database.
- Do not execute migrations, import/seed data, edit `.env` or persistent environment settings, or make deployments during the audit. Test-process-only environment overrides may be set explicitly to blank database URLs for isolation.
- Do not invent business rules, records, providers, or evidence.
- Do not classify a flow as end-to-end functional merely because its UI renders or a unit test passes.
- Record skipped, unavailable, and blocked checks separately from passing checks.
- Preserve the administration-to-commercial-messaging permission boundary.
- If a test requires a database, run it only if existing safeguards establish the approved isolated target before writes; otherwise mark it blocked/not verified.
- Include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` in every commit created while executing this plan.
- Before each commit, inspect the staged diff and stage only the audit report; do not include unrelated user changes.

## Review Focus

- A user/business actor may cross a tenant boundary or an administrator may gain an unapproved capability — map UI visibility to server-side role/ownership guards and reconcile `tests/unit/platformWriteAccess.test.ts`, `tests/unit/ticketAccessService.test.ts`, `tests/unit/paymentAccessService.test.ts`, and `tests/unit/securityRoutes.test.ts`.
- A stale or invalid promotion price may differ between display, checkout, and finance — trace server-authoritative quote and marketing paths and inspect existing ticket quote/purchase tests; record absent coverage rather than infer correctness.
- A pending or simulated payment may appear paid or issue a usable ticket, or duplicate ticket use may be accepted — trace confirmation/issuance/validation and reconcile `tests/unit/paymentService.test.ts`, `tests/unit/ticketPurchaseUseCase.test.ts`, and the ticket validation tests.
- Browser-local state may be presented as durable even though API sync is absent or rejected — map `src/utils/persistentState.ts` keys to `/api/app-state/:key`, server handlers, and configured repositories.
- A QA command may load `.env`, contact a non-local target, or write to an unknown database — inspect its complete setup and target guards before running it; do not run `qa:full` or provision a database under this audit spec.

---

## File Structure and Responsibilities

- Review: `src/App.tsx`, `src/main.tsx`, `src/components/`, `src/hooks/`, `src/services/`, `src/utils/`, `src/data/`, and `src/locales/` — identify pages, actions, data sources, UI states, navigation, and translations.
- Review: `server.ts`, `server/modules/identity-access/`, `server/modules/platform-foundation/`, business/ticket/payment/marketing services, and database migration definitions — map routes, authorization, business logic, and persistence ownership without executing migrations.
- Review: `tests/`, `scripts/qa/`, `playwright.qa.config.ts`, `package.json`, and prior audit/QA reports — establish test evidence and safety limits.
- Create/update: `docs/reports/2026-10-25-guigui-ux-ui-audit.md` — the evidence matrix, findings, test results, and follow-on dependency map.

**Report row contract:** Every audited capability row records `profile`, `screen/action`, `frontend source`, `HTTP route or local-only action`, `server authorization`, `service/use case`, `persistence/provider`, `classification`, `evidence`, and `limitations`.

### Task 1: Establish a Safe Audit Baseline and Report

**Files:**
- Review: `git status`, `package.json`, `vitest.config.ts`, `scripts/qa/`, `playwright.qa.config.ts`, `docs/OPERATIONS.md`, and existing audit/QA reports.
- Create: `docs/reports/2026-10-25-guigui-ux-ui-audit.md`

**Interfaces:**
- Consumes: the approved audit specification and the existing repository/test safeguards.
- Produces: a baseline section recording commit/branch, scope, repository state, report row contract, and safe/blocked validation commands.

- [ ] **Step 1: Record repository baseline without opening secrets or data snapshots**

  Run `git status --short --branch` and `git log -8 --oneline`. Do not inspect `.env`, database URLs, snapshots, or contents of runtime data directories.

- [ ] **Step 2: Inspect commands and safety guards before running tests**

  Review `package.json`, `vitest.config.ts`, test setup imports, and QA scripts. Confirm which tests can run with database environment variables explicitly blank and which scripts can create databases, seed data, start services, or contact external hosts. If that boundary cannot be proven, do not run the uncertain command.

- [ ] **Step 3: Create the report with its evidence/status schema**

  Add the report metadata, scope limitations, capability-status definitions from the spec, and empty sections for public/citizen, business/organizer, administration, backend/data, UX/accessibility/i18n, critical commerce, and validation.

- [ ] **Step 4: Verify the initial report is complete and commit the audit baseline**

  Stage only the report, run `git diff --cached --check`, and confirm the staged diff contains only the report. Commit as `docs: start Guigui UX audit report`.

### Task 2: Audit Public and Citizen Journeys

**Files:**
- Review: `src/App.tsx`, `src/main.tsx`, `src/config/navigation.ts`, `src/components/Navbar.tsx`, `HeroHeader.tsx`, `EventsView.tsx`, `PromotionsView.tsx`, `BusinessCard.tsx`, `BusinessDetailModal.tsx`, `TicketPurchaseModal.tsx`, `MyTicketsPanel.tsx`, `QRCodeDisplay.tsx`, `LoginModal.tsx`, `CitizenDashboard.tsx`, `CommunicationHub.tsx`, `src/hooks/useMarketplaceData.ts`, and relevant navigation/communication utilities.
- Review: public/citizen route handlers in `server.ts` and their called services.
- Update: `docs/reports/2026-10-25-guigui-ux-ui-audit.md`

**Interfaces:**
- Consumes: Task 1 report schema and safe baseline.
- Produces: public/citizen inventory rows tracing discovery, directory/business detail, events, event detail, authentication/recovery, checkout, tickets/QR, notifications, messaging, and support to API/local state.

- [ ] **Step 1: Enumerate screens, navigation targets, and user actions**

  Record each public/citizen screen and action from the existing components and navigation configuration. Check link destinations and whether controls have handlers; do not infer runtime success from source appearance.

- [ ] **Step 2: Trace state and server paths**

  For each relevant action, trace frontend state/service to the exact HTTP route and service/persistence path. Mark local, synchronized, simulated, incomplete, inconsistent, or not verified using the report row contract.

- [ ] **Step 3: Reconcile existing test evidence**

  Review the tests related to navigation, authentication, marketplace, tickets, communications, and support. Record exact test names/files and whether they prove unit, API, browser, or persistence behavior.

- [ ] **Step 4: Update and verify the citizen report section**

  Populate the public/citizen matrix and findings with exact file/route/test references. Run `git diff --check`, confirm no product files changed, and commit as `docs: audit public and citizen journeys`.

### Task 3: Audit Business/Organizer and Administration Journeys

**Files:**
- Review: `src/components/BusinessDashboard.tsx`, `src/components/client/`, business event/marketing/ticket panels, `src/components/AdminDashboard.tsx`, `src/components/admin/`, and permission/navigation utilities.
- Review: business and administrator route registrations and guards in `server.ts`, plus services called by those routes.
- Update: `docs/reports/2026-10-25-guigui-ux-ui-audit.md`

**Interfaces:**
- Consumes: Task 1 report schema and Task 2 profile/action conventions.
- Produces: business/organizer and administrator capability matrices, including visible controls, route authorization, tenant ownership, and messaging boundary evidence.

- [ ] **Step 1: Map business and organizer screens/actions**

  Inventory profile/settings, services, posts, events, promotions/campaigns, ticket sales/scanning, subscriptions, and finance/reporting. Record routes, server guards, services, persistence, and missing/error/empty/loading states when visible in source/tests.

- [ ] **Step 2: Map administrator screens/actions and permissions**

  Inventory platform dashboard, users/businesses/events, moderation/reports, plans/finance, notifications/support, audit/operations, and campaign/content management. Confirm every route's server-side role guard and explicitly check that commercial conversation routes are not granted to administration by this audit.

- [ ] **Step 3: Reconcile profile-specific tests**

  Review existing business/admin permission, business profile, moderation, finance, support, campaign, and navigation tests. State exactly what each suite validates and what remains unverified.

- [ ] **Step 4: Update and verify both report sections**

  Populate the matrices and evidence-backed findings. Run `git diff --check`, confirm no product files changed, and commit as `docs: audit business and admin journeys`.

### Task 4: Trace API Authorization, Persistence, and Integration Boundaries

**Files:**
- Review: `server.ts`, `server/modules/identity-access/`, `server/modules/platform-foundation/`, `server/db.ts`, `server/runtimeStore.ts`, `server/platformWriteAccess.ts`, `server/integrations/`, `src/utils/persistentState.ts`, `src/services/`, and relevant migrations.
- Review: `docs/AUDITORIA-FLUXO-DADOS-PERFIS.md`, persistence inventory, operations docs, and QA target guards.
- Update: `docs/reports/2026-10-25-guigui-ux-ui-audit.md`

**Interfaces:**
- Consumes: UI action inventories from Tasks 2–3.
- Produces: route/authorization/persistence mapping, with localStorage, JSON, PostgreSQL, and simulated provider paths distinguished.

- [ ] **Step 1: Inventory registered API routes and middleware**

  Enumerate route method/path, mounted middleware, required role/session, and handler ownership from `server.ts` and any routers. Resolve dynamic/mounted route registrations or mark them unresolved.

- [ ] **Step 2: Trace authorization and tenant boundaries**

  Follow session/role resolution and business ownership checks through middleware and called services. Compare UI-level permission checks with server checks; never treat UI hiding as authorization evidence.

- [ ] **Step 3: Map persistence and external adapter selection**

  Trace browser persistence keys to API calls and server repositories; identify JSON/PostgreSQL selection and simulated integration adapters. Read schema definitions only; do not run migrations or inspect runtime data.

- [ ] **Step 4: Update and verify the backend/data report section**

  Record route coverage, unmapped paths, unresolved ownership, and persistence limits. Run `git diff --check`, confirm no product files changed, and commit as `docs: map Guigui API permissions and persistence`.

### Task 5: Audit Promotions, Payments, Ticket Purchase, and Validation

**Files:**
- Review: `server/ticketPurchaseDomain.ts`, `server/ticketPurchaseUseCase.ts`, `server/ticketPurchasePorts.ts`, `server/paymentService.ts`, `server/paymentAccessService.ts`, `server/ticketAccessService.ts`, `server/ticketInventoryService.ts`, `server/validationService.ts`, ticket lifecycle/marketing/payment routes in `server.ts`, and relevant database schema/migrations.
- Review: `src/components/PromotionsView.tsx`, `TicketPurchaseModal.tsx`, `TicketScannerView.tsx`, `MyTicketsPanel.tsx`, `SoldTicketsPanel.tsx`, and associated client/dashboard views.
- Review: `tests/unit/ticketPurchaseDomain.test.ts`, `ticketPurchaseUseCase.test.ts`, `paymentService.test.ts`, `paymentAccessService.test.ts`, `ticketAccessService.test.ts`, `ticketInventoryService` tests, and relevant API/browser tests.
- Update: `docs/reports/2026-10-25-guigui-ux-ui-audit.md`

**Interfaces:**
- Consumes: route, permission, persistence, and UX matrices from Tasks 2–4.
- Produces: an evidence-backed lifecycle map from offer/promotion to quote, payment state, ticket issuance, QR validation, duplicate-use prevention, financial records, and refund/cancellation policy.

- [ ] **Step 1: Trace promotion rules from display to server quote and finance**

  Identify authoritative price/discount/validity sources, validation points, limits, start/end/sold-out states, and financial recording. Mark every point where the chain cannot be verified; do not propose new business policy.

- [ ] **Step 2: Trace payment and ticket state transitions**

  Record supported provider modes, webhook/confirmation authority, idempotency, reservation/fulfillment behavior, ticket generation, QR/token validation, expiry, duplicate scan handling, and entry records. Explicitly distinguish simulated from live integrations.

- [ ] **Step 3: Identify cancellation/refund source and unresolved policies**

  Locate the authoritative commercial policy and user acceptance evidence. If absent, mark the relevant behavior blocked pending a business decision; do not infer a refund window or issue tickets as if payment were verified.

- [ ] **Step 4: Reconcile focused test evidence and update report**

  List existing test files and exact test cases for quotes, failure/retry, idempotency, inventory, payment and validation. Do not run DB-dependent tests unless Task 1 established an approved isolated target; record skipped integration coverage explicitly. Run `git diff --check`, confirm no product files changed, and commit as `docs: audit promotions payments and ticket lifecycle`.

### Task 6: Audit UX States, Responsive/Accessible Patterns, Localization, and Safe Validation

**Files:**
- Review: `src/components/ui/`, profile dashboards/forms/modals, `src/locales/*.ts`, `src/utils/i18n.ts`, `docs/INTERNATIONALIZATION.md`, responsive/accessibility and browser test files, `playwright.qa.config.ts`, QA campaign scripts, and package scripts.
- Update: `docs/reports/2026-10-25-guigui-ux-ui-audit.md`

**Interfaces:**
- Consumes: profile and flow matrices from Tasks 2–5.
- Produces: cross-cutting UX findings and a validation ledger separating passed, failed, skipped, unavailable, and blocked checks.

- [ ] **Step 1: Inspect UI states and shared component consistency**

  Review loading, success, error, empty, and no-results behavior; form validation; focus and keyboard patterns; responsive breakpoints; and reusable button/card/field/panel/modal/notification patterns. Tie each finding to a screen and source file.

- [ ] **Step 2: Verify localization evidence**

  Inspect all project locales and existing translation helpers. Run `npm run test:i18n` and `npm run audit:i18n`; report exact output and distinguish catalog parity from untranslated hard-coded UI text.

- [ ] **Step 3: Run only checks proven safe by Task 1**

  If test setup is verified not to load an inherited database target, run `npm run lint`, `npm run test:unit`, and `npm run build` with `DATABASE_URL`, `TEST_DATABASE_URL`, `PLATFORM_FOUNDATION_TEST_DATABASE_URL`, and `QA_ADMIN_DATABASE_URL` explicitly blank in the test process. Run `npm run test:integration -- --maxWorkers=1 --no-file-parallelism` only if its guards skip before pool creation when the target URLs are blank. Record exact counts and warnings; do not describe skipped DB tests as passed.

- [ ] **Step 4: Decide runtime QA status without weakening safeguards**

  Inspect whether the app can start on loopback without loading `.env`, connecting to a database, or reading existing runtime user data. Only if that is proven safe, inspect screens in a local browser at desktop/tablet/mobile sizes and use read-only navigation/keyboard checks; do not submit forms or trigger writes. Inspect whether Playwright, Newman, k6, and passive ZAP can run against that safe local app without provisioning, migrations, seeding, external network access, or an unknown runtime dataset. Do not run `npm run qa:full`, `npm run qa:provision`, or any command that provisions/seeds the QA database under this spec. If safe runtime prerequisites are absent, mark those phases blocked and state the precise missing prerequisite. Do not install tools.

- [ ] **Step 5: Update and verify the UX and validation ledger**

  Record checked findings, exact commands/output, and all blocked/skipped tools. Run `git diff --check`, confirm no product files changed, and commit as `docs: audit UX accessibility and validation`.

### Task 7: Consolidate, Self-Review, and Deliver the Audit

**Files:**
- Update: `docs/reports/2026-10-25-guigui-ux-ui-audit.md`
- Review: all report sections and referenced files/tests.

**Interfaces:**
- Consumes: report sections and validation evidence from Tasks 1–6.
- Produces: a complete report with ranked findings, unresolved decisions, and dependency-aware follow-on projects.

- [ ] **Step 1: Rank findings by user impact and evidence**

  Prioritize payment/promotion/ticket integrity, authorization/data loss, broken core journeys, and accessibility/UX issues. For every finding include severity, affected profile, exact file/route, observed evidence, confidence, user impact, and whether remediation needs a product/business decision.

- [ ] **Step 2: Reconcile completeness against the spec**

  Confirm all profile groups, public paths, actions, permissions, persistence types, business-critical flows, UX dimensions, languages, test outcomes, and limitations are represented. Replace unsupported claims with `not verified`; remove unsubstantiated completion language.

- [ ] **Step 3: Add the follow-on dependency map**

  List separate candidate implementation projects in the approved risk-led order. Mark each as proposed/not started and identify policy or isolated-runtime blockers; do not implement them or claim they are included in the audit.

- [ ] **Step 4: Run final document checks and commit**

  Run `git diff --check`; verify the final diff contains only the audit report; confirm no migrations, seeds, external calls, product-code edits, or deployment changes occurred. Commit as `docs: complete Guigui UX and functional audit`.

## Execution Boundaries

- The audit does not itself authorize fixes. After report review, implementation scopes receive separate specifications and plans.
- The risk-first order is a prioritization recommendation; each follow-on project's precise scope depends on audit findings and approved business rules.
- The QA campaign plan's database provisioning, synthetic seeding, and full tool sequence are outside this audit because this spec prohibits migrations and seeding.
