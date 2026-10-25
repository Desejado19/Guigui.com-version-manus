# Guigui.com Remaining Work Completion Plan

> **For agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` only after the user selects an execution method. Execute this coordination plan in order; use the linked approved plans as the implementation source of truth for their individual code changes.

**Goal:** Reconcile and complete the approved local QA, runtime, persistence, functional, and seven-context DDD work without repeating completed tasks or touching Render.

**Architecture:** This is a dependency and evidence roadmap, not a replacement implementation plan. It resumes existing context-specific plans, adds work only for verified gaps, restores the local runtime before QA, captures a behavioral baseline before major domain changes, and then completes the modular monolith one context at a time.

**Tech Stack:** Node.js, TypeScript, React, Express, Vite, PostgreSQL 18, Vitest, Playwright, Newman, k6, OWASP ZAP, PowerShell.

**Spec:** [`docs/superpowers/specs/2026-10-25-guigui-completion-roadmap-design.md`](../specs/2026-10-25-guigui-completion-roadmap-design.md)

## Global Constraints

- Keep the application as a single-process monolith; do not introduce microservices.
- Keep `server.ts` as the composition root unless an approved context-specific design says otherwise.
- Preserve endpoints, DTOs, permissions, persistence selection, and failure semantics.
- Preserve supported JSON and PostgreSQL adapters; do not silently switch persistence.
- Do not introduce automatic schema migration, distributed transactions, or generic event infrastructure.
- Do not invent catalogs, administrative data, audit records, notifications, or other business records when an authoritative source is missing.
- Work only in the current local worktree; leave Render and external deployments alone.
- Do not stop, mutate, or test against the unverified application on port 3000.
- Do not connect QA tools to an inherited, production, or non-loopback database.
- Do not delete an existing database, application data, reports, or user changes as cleanup.
- Keep payment, email, SMS, and other external provider integrations simulated.
- Run the full local QA sequence only against the new synthetic PostgreSQL 18 QA database: Playwright, Newman, k6, then passive localhost-only ZAP.
- Limit k6 to 10 VUs for 60 seconds, GET-only approved endpoints, p95 below 2,000 ms, failure rate below 1%, and all checks passing.
- Do not run ZAP active scan, exploit payloads, or aggressive fuzzing.
- Use test-first changes, verify each task with its named commands, and report passes, failures, and blocks distinctly.
- Respect each existing plan's approval, schema, data, dependency installation, and commit rules; this roadmap is not blanket authorization for changes outside those scopes.

## Review Focus

- Missing `src/data` imports: restore only a source proven by trusted Git history or approved artifacts; never fabricate domain records. Task 2.
- PostgreSQL QA target override, non-loopback host, wrong version, or existing synthetic database: stop before creation or writes. Task 3.
- QA run against the process on port 3000, an inherited `DATABASE_URL`, real data, or an external provider: reject before traffic or persistence. Tasks 3–4.
- Authentication/session, cross-business authorization, payment status, ticket reservation, and delivery contracts: preserve existing observable behavior and cover regressions during the owning child plan. Tasks 5–9.
- Context extraction changes routes, persistence ownership, or cross-context dependency direction: stop and resolve against the approved DDD spec before proceeding to the next context. Tasks 10–14.

---

## Existing plans and source of truth

The plan crosswalk must cover all non-Render plans listed in the approved design. Their detailed file lists, interfaces, tests, and task steps remain authoritative:

- [`2026-10-19-guigui-ddd-foundation.md`](2026-10-19-guigui-ddd-foundation.md)
- [`2026-10-20-simulated-integrations.md`](2026-10-20-simulated-integrations.md)
- [`2026-10-21-ticket-purchase-experience.md`](2026-10-21-ticket-purchase-experience.md)
- [`2026-10-22-guigui-platform-foundation-health.md`](2026-10-22-guigui-platform-foundation-health.md)
- [`2026-10-22-guigui-platform-runtime-configuration.md`](2026-10-22-guigui-platform-runtime-configuration.md)
- [`2026-10-22-guigui-http-observability.md`](2026-10-22-guigui-http-observability.md)
- [`2026-10-22-guigui-identity-access-sessions.md`](2026-10-22-guigui-identity-access-sessions.md)
- [`2026-10-22-guigui-modular-ddd-migration.md`](2026-10-22-guigui-modular-ddd-migration.md)
- [`2026-10-23-guigui-business-profile-completeness.md`](2026-10-23-guigui-business-profile-completeness.md)
- [`2026-10-23-guigui-identity-access-remaining.md`](2026-10-23-guigui-identity-access-remaining.md)
- [`2026-10-23-guigui-postgres-synthetic-seed.md`](2026-10-23-guigui-postgres-synthetic-seed.md)
- [`2026-10-24-guigui-persistence-inventory.md`](2026-10-24-guigui-persistence-inventory.md)
- [`2026-10-24-guigui-complete-system-qa.md`](2026-10-24-guigui-complete-system-qa.md)

The Render rollout is excluded, even though it remains a file in the repository.

## Task 1: Reconcile completion evidence and dependencies

**Files:**
- Review: all non-Render plans and their linked specifications listed above
- Review: relevant implementation, tests, Git history, execution ledgers, and QA reports
- Record: this plan's SDD ledger under `.superpowers/sdd/2026-10-25-guigui-completion-roadmap/progress.md`

**Interfaces:**
- Consumes: approved requirements and existing plan/test/commit evidence.
- Produces: a task-by-task crosswalk with `verified complete`, `incomplete`, `blocked`, or `superseded` status, the evidence for each status, and dependencies between the unfinished tasks.

- [ ] **Step 1: Establish the worktree baseline**

Run `git status --short`, `git log -15 --oneline`, and inspect all plan-specific execution ledgers. Record uncommitted changes without modifying or discarding them.

- [ ] **Step 2: Reconcile each plan against executable evidence**

For every task, compare its acceptance criteria with current code, named tests, commits, and ledgers. A checked checkbox, checkpoint summary, static plan, or zero placeholder count is not sufficient evidence by itself.

- [ ] **Step 3: Resolve overlaps and order dependencies**

Identify overlapping platform, identity, persistence, seed, QA, and DDD tasks. Select one authoritative child task for each deliverable; record which tasks are already complete and must not be repeated. Record unresolved policy/schema/data conflicts as blockers, not guesses.

- [ ] **Step 4: Record the crosswalk and gate**

Append the evidence-backed crosswalk, task dependencies, and any ruling to the SDD ledger. Do not edit product code in this task.

**Verification:** Every listed non-Render plan has a status and evidence; no work is scheduled solely from a checkbox or summary.

## Task 2: Recover the missing source modules and restore the local baseline

**Files:**
- Review: all consumers of `src/data/monetizationCatalog`, `subscriptionCatalog`, `adminStaffData`, `auditLogsData`, and `notificationsData`
- Review: Git history and approved project artifacts for authoritative module sources
- Restore only verified source files at their existing import paths
- Test: existing consumer and domain tests identified in the crosswalk

**Interfaces:**
- Consumes: Task 1 crosswalk and trusted source provenance.
- Produces: importable authoritative modules at the expected paths, or an evidence-backed blocked record naming each module for which no trustworthy source exists.

- [ ] **Step 1: Trace each missing import to its consumer and expected exports**

Use source imports and existing tests to enumerate the exact exports and behavior required for each missing module. Do not infer catalog values or record contents from placeholder fixtures.

- [ ] **Step 2: Search trusted local history for each module**

Search reachable Git commits/branches and approved local artifacts. Record the source commit/path and verify that it corresponds to the current consumers and approved specifications.

- [ ] **Step 3: Restore from verified source or stop**

If the authoritative implementation exists, restore that exact implementation surgically and add/update regression tests only where the existing tests do not pin the consumer contract. If any required content has no trusted source, stop restoration for that content and request the authoritative artifact; do not create substitute values.

- [ ] **Step 4: Run focused consumer tests and the project baseline**

Run the focused tests identified in Step 1, then `npm run check`, `npm run test:unit`, and `npm run build`. Account for intentional skips; do not skip or weaken failing tests.

- [ ] **Step 5: Verify isolated startup**

Start only this checkout with `NODE_ENV=test`, loopback host, a dedicated unused QA port, an empty dotenv source, database variables unset unless the disposable QA database has been verified, and a temporary `GUIGUI_DATA_DIR`. Verify HTTP 200 from health and the SPA. Do not bind to or inspect port 3000 as a test target.

**Gate:** If a missing module cannot be restored from an authoritative source, record the exact files/exports missing and stop before claiming the app baseline or live QA is ready.

## Task 3: Reconcile persistence inventory and prepare the disposable QA data path

**Files:**
- Resume: [`2026-10-24-guigui-persistence-inventory.md`](2026-10-24-guigui-persistence-inventory.md)
- Resume: [`2026-10-23-guigui-postgres-synthetic-seed.md`](2026-10-23-guigui-postgres-synthetic-seed.md)
- Resume: QA database setup from [`2026-10-24-guigui-complete-system-qa.md`](2026-10-24-guigui-complete-system-qa.md)
- Review: `scripts/qa/validate-target.ts`, `scripts/qa/provision-database.ts`, and route inventory

**Interfaces:**
- Consumes: verified runtime baseline from Task 2 and QA loopback target contract from the QA plan.
- Produces: reconciled persistence inventory and a validated synthetic QA seed/target setup; creates the QA database only when all existing guards pass.

- [ ] **Step 1: Complete the persistence-plan crosswalk**

Resume only the inventory tasks verified incomplete in Task 1. Record each data class, owner, persistence adapter, source-of-truth status, and preservation result without copying production record contents or secrets.

- [ ] **Step 2: Complete and verify the synthetic seed plan**

Resume the approved seed plan's failing tests, implementation, and verification steps. Preserve its row manifest, unique identifiers, loopback target guard, and refusal to reuse an existing database.

- [ ] **Step 3: Re-run QA target and seed tests**

Run the exact focused tests named by the two child plans and their required type checks. Expected: valid local synthetic target is accepted; non-loopback, endpoint overrides, wrong database/version, and pre-existing database are rejected before creation or writes.

- [ ] **Step 4: Verify readiness without printing database URLs**

Check the local QA toolchain and required environment variable presence using names/status only. Do not print values. If PostgreSQL 18, the local fixture secret, or required tools are absent, record the block and do not provision.

## Task 4: Run the first isolated, full-system QA campaign

**Files:**
- Resume: [`2026-10-24-guigui-complete-system-qa.md`](2026-10-24-guigui-complete-system-qa.md)
- Test/report: `test-results/qa/<run-id>/report.json` and local raw artifacts
- Review: `scripts/qa/run-campaign.ps1` and `scripts/qa/build-report.ts`

**Interfaces:**
- Consumes: passing app baseline from Task 2, safe QA data path from Task 3, and the existing QA campaign harness.
- Produces: a sanitized evidence report for the unrefactored behavioral baseline, with each phase reported as passed, failed, or blocked.

- [ ] **Step 1: Run the campaign preflight**

Run the approved `qa:full` preflight and `npm run qa:api:check`. Expected: the target, tools, route coverage, port, and synthetic database conditions are validated before provisioning or sending test traffic.

- [ ] **Step 2: Stop on any unsafe or missing prerequisite**

Do not fall back to port 3000, inherited `DATABASE_URL`, live data, or remote tools. If a required tool/setup is missing, record the campaign as blocked and continue only with independently safe static checks.

- [ ] **Step 3: Execute approved live phases in order**

Only after preflight passes, run Playwright, Newman, k6, and passive ZAP in that order against the isolated local target. k6 must remain 10 VUs/60 seconds/GET-only. ZAP must remain localhost-only and passive.

- [ ] **Step 4: Inspect and retain the sanitized report**

Verify that the report commit and run ID are correct, counts match the raw local summaries, zero counts are not represented as success for blocked phases, and no secret, cookie, token, personal data, or raw request body is present.

## Task 5: Complete platform foundation and observability work

**Files:**
- Resume the DDD foundation plan and the platform health, runtime configuration, and HTTP observability plans listed above.
- Change only the files and tests named by those child plans.

**Interfaces:**
- Consumes: reconciled statuses from Task 1 and verified runtime/QA baseline from Tasks 2–4.
- Produces: tested platform-foundation health, runtime, hosting, and observability behavior, with existing HTTP and startup contracts preserved.

- [ ] **Step 1: Resume only incomplete health and runtime tasks**

Execute the remaining checked-against-source tasks from the DDD foundation, platform health, and runtime configuration plans in their stated dependency order. Reuse their tests and acceptance criteria.

- [ ] **Step 2: Resume HTTP observability tasks**

Execute the remaining tasks in `2026-10-22-guigui-http-observability.md`. Keep authentication and metrics exposure behavior unchanged unless a separately approved requirement says otherwise.

- [ ] **Step 3: Run child-plan tests and platform regression checks**

Run each child plan's named test commands, then `npm run check`, `npm run test:unit`, `npm run build`, and the isolated health/SPA smoke test. Do not advance if a failure remains unexplained.

## Task 6: Complete identity-access sessions and remaining extraction

**Files:**
- Resume: `2026-10-22-guigui-identity-access-sessions.md`
- Resume: `2026-10-23-guigui-identity-access-remaining.md`
- Change only the files and tests named by those plans.

**Interfaces:**
- Consumes: platform runtime/observability contracts from Task 5 and the approved identity module ports.
- Produces: the identity session, authentication, credentials, lifecycle, and invitation behaviors defined by the approved child plans, preserving HTTP contracts and failure semantics.

- [ ] **Step 1: Reconcile session-plan implementation**

Compare its three task criteria with current code and tests. Execute only remaining tasks; do not duplicate already extracted session-context behavior.

- [ ] **Step 2: Resume remaining identity extraction**

Execute remaining tasks in order from `2026-10-23-guigui-identity-access-remaining.md`. Preserve its reset-token normalization, use-case boundaries, adapter selection, compensation behavior, and explicit error propagation.

- [ ] **Step 3: Run identity regressions**

Run the focused tests named in both plans, then the full unit suite and applicable Playwright authentication/session flows against the isolated QA service. Verify anonymous, wrong-role, deactivated-account, session failure, invitation expiry/use-once, and cross-business cases.

## Task 7: Reconcile and complete business-profile functionality

**Files:**
- Resume: [`2026-10-23-guigui-business-profile-completeness.md`](2026-10-23-guigui-business-profile-completeness.md)
- Change only its named frontend, backend, persistence, and tests.

**Interfaces:**
- Consumes: completed/reconciled identity contracts from Task 6 and existing business persistence adapters.
- Produces: the approved complete business registration, profile update/hydration, privacy, completion, and featured-order flows.

- [ ] **Step 1: Map each profile-plan task to existing code/tests**

Use the crosswalk to separate verified complete steps from remaining requirements; preserve current profile/ownership rules.

- [ ] **Step 2: Implement remaining plan tasks test-first**

Resume the child plan's task steps in order; do not create a parallel profile implementation or relax authorization.

- [ ] **Step 3: Verify profile behavior**

Run its focused unit/component/API tests, applicable Playwright profile flows, and all project baseline checks. Verify persisted public profile fields do not expose private account or owner data.

## Task 8: Complete simulated payment integrations and ticket-purchase experience

**Files:**
- Resume: [`2026-10-20-simulated-integrations.md`](2026-10-20-simulated-integrations.md)
- Resume: [`2026-10-21-ticket-purchase-experience.md`](2026-10-21-ticket-purchase-experience.md)
- Change only files and tests named by the child plans.

**Interfaces:**
- Consumes: reconciled identity, business, and payment contracts from Tasks 6–7.
- Produces: explicit simulated payment/delivery outcomes and the approved ticket-purchase, reservation, issuance, and UI behavior.

- [ ] **Step 1: Reconcile completed integration and purchase requirements**

Map each child-plan requirement to current code and tests; preserve existing simulator modes and do not add real provider credentials.

- [ ] **Step 2: Complete the simulated integration plan**

Resume only its unverified/incomplete tasks, including pending/confirmed distinctions, active provider allowlist, and truthful delivery status.

- [ ] **Step 3: Complete the ticket-purchase plan**

Resume only its remaining tasks, keeping pending payments from issuing valid tickets or claiming delivery and preserving reservation/inventory behavior.

- [ ] **Step 4: Verify end-to-end purchase contracts**

Run both child plans' focused tests, payment/ticket audits, full unit suite, and applicable Playwright flows. Verify no real payment, SMS, or email service is contacted.

## Task 9: Complete the five remaining DDD contexts sequentially

**Files:**
- Resume: [`2026-10-22-guigui-modular-ddd-migration.md`](2026-10-22-guigui-modular-ddd-migration.md)
- Create a context-specific reviewed specification and implementation plan before coding whenever the roadmap lacks a current approved artifact.
- Change only files named in the approved context plan.

**Interfaces:**
- Consumes: completed `platform-foundation` and `identity-access`, approved context contracts, and passing pre-migration baseline.
- Produces: one verified modular context per approved DDD task, with preserved API and persistence behavior.

- [ ] **Step 1: Reconcile the DDD roadmap and interface dependencies**

Resume the approved roadmap from its first incomplete task. Check dependency direction and public contracts before generating any context implementation plan.

- [ ] **Step 2: Specify, approve, and migrate `business-discovery`**

Use its existing approved design if it covers the remaining scope; otherwise obtain approval of a context-specific specification and plan. Implement and verify only after that gate.

- [ ] **Step 3: Verify `business-discovery` before continuing**

Run its context plan's unit/integration/API/E2E checks and inspect that it consumes published cross-context contracts rather than another module's internals.

- [ ] **Step 4: Specify, approve, and migrate `payments-monetization`**

Apply the same design/plan approval gate. Preserve simulated provider behavior, transaction semantics, and existing persistence contracts.

- [ ] **Step 5: Verify payments before continuing**

Run the context plan's tests and payment audits; do not use real provider calls or change the database schema without separate approval.

- [ ] **Step 6: Specify, approve, and migrate `events-ticketing`**

Apply the same gate. Preserve inventory, reservation, ticket issuance, scanner, and purchase behavior.

- [ ] **Step 7: Verify ticketing before continuing**

Run the context plan's ticket/domain/API/E2E tests and confirm pending payments never create valid tickets.

- [ ] **Step 8: Specify, approve, and migrate `communication-support`**

Apply the same gate. Preserve conversation, support, notification, and simulated delivery behavior.

- [ ] **Step 9: Verify communication before continuing**

Run the context plan's focused tests and verify authorized conversation visibility and read/write behavior.

- [ ] **Step 10: Specify, approve, and migrate `governance-operations`**

Apply the same gate. Preserve moderation, audit, and administrative authorization contracts.

- [ ] **Step 11: Verify governance and all context boundaries**

Run its focused tests plus the DDD roadmap's dependency/boundary checks. Confirm all seven contexts have a reviewed acceptance record and there are no unapproved dependency cycles.

## Task 10: Run final complete-system verification and publish the handoff

**Files:**
- Resume: [`2026-10-24-guigui-complete-system-qa.md`](2026-10-24-guigui-complete-system-qa.md)
- Review: all seven module directories and composition root
- Publish: sanitized QA report and final status in the plan's SDD ledger

**Interfaces:**
- Consumes: all task outputs and the approved final QA target/tool configuration.
- Produces: final evidence mapping each approved requirement to tests/results, with any accepted deferrals explicitly recorded.

- [ ] **Step 1: Run the final code-quality gates**

Run `npm run check`, `npm run test:unit`, `npm run build`, route-inventory validation, locale checks, and the approved isolated startup/health/SPA checks. Expected: all pass, with intentional skips enumerated and no unresolved failure.

- [ ] **Step 2: Run the final isolated system campaign**

Execute the complete QA campaign in its approved order and against the disposable local target only. Verify Playwright/Newman results, k6 numerical thresholds, and passive ZAP report contents.

- [ ] **Step 3: Reconcile requirements, exclusions, and blocks**

Compare all child plan acceptance criteria to implementation and evidence. Record any remaining unaccepted block and do not call the roadmap complete while it remains.

- [ ] **Step 4: Produce and commit the final handoff**

Publish only sanitized reports and the final evidence crosswalk. Follow each child plan's commit restrictions and include the required co-author trailer on any authorized commit.

## Dependency summary

- Task 1 precedes every other task.
- Task 2 depends on Task 1 and blocks all live runtime/QA work.
- Task 3 depends on Task 2 and gates Task 4.
- Task 4 provides the pre-migration behavior baseline for Tasks 5–9.
- Task 5 precedes Task 6 under the approved DDD sequence.
- Task 6 precedes Tasks 7–9 where identity contracts are consumed.
- Task 7 precedes Task 8 when purchase flows rely on business profile contracts.
- Task 9's five contexts are strictly sequential; each context must pass its own gates before the next begins.
- Task 10 depends on all prior implementation and context-verification tasks.
