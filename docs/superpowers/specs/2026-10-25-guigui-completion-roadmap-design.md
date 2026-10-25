# Guigui.com completion roadmap design

**Date:** 2026-10-25
**Status:** Draft for user review
**Scope:** Reconcile and finish approved local application, QA, persistence, and modular-DDD work. Render deployment is explicitly excluded.

## Intent

Create one dependency-aware route to complete the approved work already represented by the repository's plans, without copying or redoing completed tasks. Use repository evidence (current implementation, tests, commits, execution ledgers, and generated reports) to establish status. Checklist boxes alone are not completion evidence.

The result is a verified, functioning local monolith with an evidence-based QA report and a sequentially completed seven-context DDD migration, subject to the existing context-specific approval gates.

## Current evidence and immediate blocker

- The repository contains plans for DDD foundation, simulated integrations, ticket purchase, HTTP observability, identity sessions, the seven-context DDD roadmap, platform health, runtime configuration, business-profile completeness, remaining identity extraction, PostgreSQL synthetic seed, complete-system QA, persistence inventory, and Render deployment.
- This roadmap covers the non-Render work only. Existing plans remain the source of truth for detailed task-level implementation; this document coordinates them and adds tasks only for confirmed gaps.
- The current checkout cannot pass `npm run check`, `npm run test:unit`, or `npm run build` because imports resolve to five absent `src/data` modules: `monetizationCatalog`, `subscriptionCatalog`, `adminStaffData`, `auditLogsData`, and `notificationsData`.
- An isolated startup attempt failed on the missing `monetizationCatalog` import. A separate Guigui.com process on port 3000 was observed but its checkout was not verified; it is not a valid test target and must remain untouched.
- Static route inventory validation passed for 98 routes (37 with Newman scenarios and 61 explicitly excluded); locale validation passed for 4 locales and 622 keys.
- The local QA campaign infrastructure and reports exist. The latest campaign report marks Playwright, Newman, k6, and ZAP as blocked; these are not live test results. The latest preflight lacked QA database configuration and `k6`/`psql`.
- Previous plan checklists conflict with newer execution evidence. Reconcile status from code, tests, commits, ledgers, and reports before scheduling work.

The missing data modules are a stop gate for restoring behavior: locate an authoritative version in repository history or approved project artifacts. Do not invent catalog entries, administrative data, audit records, or notification data. If no trustworthy source exists, document precisely what is missing and ask the user for an authoritative source before implementing replacements.

## Design choices

1. **Use a reconciliation roadmap, not a replacement mega-plan.** Retain context-specific plans and specifications. The new roadmap records dependencies, evidence, and sequencing; it links to existing tasks rather than duplicating their implementation steps.
2. **Restore a trustworthy runtime baseline before system tests.** Missing source modules currently prevent build and startup. Resolve those using verified sources, then restore type-check, build, unit tests, and isolated startup before interpreting live QA results.
3. **Capture a behavioral baseline before functional fixes and substantial DDD movement.** Once the app and its isolated QA prerequisites work, run the existing local campaign. Use findings to guide approved fixes and retain regression coverage during each context extraction.
4. **Keep the DDD migration sequential.** Complete/reconcile platform foundation and identity first, then migrate the five remaining bounded contexts in the approved order. Each context-specific implementation continues to require its own reviewed specification and plan where one is absent or materially stale.
5. **Keep external and persistent side effects gated.** No Render changes, production database access, schema migrations, paid resources, real provider calls, or changes to the unknown port-3000 process are part of this roadmap.

## Coordinated phases

### Phase 0 — Evidence reconciliation

Review every non-Render plan, its linked specification, relevant source and tests, recent commits, applicable execution ledger, and QA reports. Produce a crosswalk with one status per task: verified complete, incomplete, blocked, or obsolete/superseded (with evidence and reason). Resolve conflicts among the platform/identity plans, domain plans, PostgreSQL seed, persistence inventory, and QA campaign before setting task dependencies.

Do not change production code in this phase. Do not infer completion from a prior summary or checkbox alone.

### Phase 1 — Recover the local build and startup baseline

Trace each missing import to its consumers and search only trusted local repository history and approved project artifacts for the authoritative source. Restore only proven content and add focused verification where needed. If a source cannot be verified, stop that module's restoration and request the source rather than fabricating business data.

After recovery, require `npm run check`, `npm run test:unit`, and `npm run build` to pass, accounting explicitly for existing intentional skips. Start this checkout only with isolated environment variables, an empty dotenv source, and a temporary `GUIGUI_DATA_DIR`; require a successful health response and SPA response. Do not reuse port 3000 or a process whose source checkout is unknown.

### Phase 2 — Establish the behavioral QA baseline

Use the existing complete-system QA plan and harness after Phase 1 succeeds. Before any database creation, require all its loopback, PostgreSQL-version, uniqueness, fixture, and tool checks to pass. Use only the new synthetic QA database and its generated records; do not consume the process's inherited `DATABASE_URL`, application data snapshots, or production data.

Run the approved sequence: Playwright E2E, Newman API collection, bounded GET-only k6 (10 VUs for 60 seconds), then localhost-only passive ZAP. Preserve raw artifacts locally and publish the sanitized report. If prerequisites are unavailable, record phases as blocked, not passed; request only the missing local setup and do not install or provision anything outside the plan's approval rules.

### Phase 3 — Reconcile and close approved functional/persistence plans

Use Phase 0's crosswalk to resume only genuinely incomplete tasks from:

- DDD foundation and platform health/runtime configuration;
- HTTP observability;
- identity-access sessions and remaining identity extraction;
- business-profile completeness;
- simulated integrations and ticket-purchase experience;
- PostgreSQL synthetic seed;
- persistence inventory.

Follow the approved plan for each task, preserve HTTP/persistence contracts, and add no parallel or replacement implementation. Use the Phase 2 QA report to prioritize confirmed behavior gaps. If a plan conflicts with an approved specification or a verified shared interface, record the smallest explicit ruling and stop for user input when the decision changes business policy, schema, security policy, or persisted data.

### Phase 4 — Complete the seven-context modular-monolith roadmap

Continue from the approved DDD roadmap and its evidence crosswalk:

1. Reconcile/complete `platform-foundation`.
2. Reconcile/complete `identity-access`.
3. Migrate `business-discovery`.
4. Migrate `payments-monetization`.
5. Migrate `events-ticketing`.
6. Migrate `communication-support`.
7. Migrate `governance-operations`.

Keep one process and `server.ts` as the composition root unless a context-specific approved design says otherwise. Preserve endpoints, DTOs, permissions, persistence selection, and failure semantics. Do not introduce microservices, automatic schema migration, distributed transactions, or generic event infrastructure. Complete and verify one context before starting the next. Obtain approval of a context-specific design and plan wherever the existing approved documents do not already provide the required scope.

### Phase 5 — Final system verification and handoff

Run the complete applicable checks on the final tree: type-check, full unit suite, production build, isolated startup, route inventory, browser/API campaign, k6 thresholds, and passive ZAP. Report each command and evidence, test counts, tool versions, artifacts, and any exclusions or blocks. Reconcile each approved requirement with an implementation or explicit user-approved deferral. Do not describe a blocked phase as successful or claim the complete system was validated if any required phase did not run.

## Safety and compatibility constraints

- Work only in the current local worktree; leave Render and external deployments alone.
- Do not stop, mutate, or test against the unverified application on port 3000.
- Never expose, copy, or print secrets. Do not send credentials in chat or reports.
- Do not connect QA tooling to an inherited, production, or non-loopback database.
- Do not delete an existing database, application data, reports, or user changes as cleanup.
- Do not invent or silently default missing catalogs, accounts, audit state, notification data, or other business records.
- Keep payment, email, SMS, and other external provider integrations simulated.
- Preserve supported JSON and PostgreSQL adapters and do not switch persistence silently.
- Keep the monolith in one process and complete contexts sequentially.
- Apply test-first changes, run the exact checks for each slice, and maintain auditable task/commit records under the repository's existing workflow.
- Treat plan approval as authorization to produce the next plan, not as blanket approval for business-policy changes, schema/data changes, external actions, tool installation, or new context implementation outside its approved scope.

## Definition of completion

The roadmap is complete only when:

1. Every non-Render approved plan has a reconciled status and evidence; no completed task was repeated without cause.
2. The source modules required for this checkout are restored from trusted sources, or unresolved source gaps are explicitly documented and approved by the user.
3. Type-check, unit tests, build, and isolated startup/health checks pass on the final tree; all skips and exclusions are accounted for.
4. The baseline and final complete-system QA campaigns have executed each approved phase successfully, or the user has explicitly accepted a documented blocker/deferral for the specific phase.
5. All seven DDD contexts satisfy their approved context-level acceptance criteria, with compatibility verification after each context.
6. The final report distinguishes verified passes, failures, and accepted/unaccepted blocks and links sanitized artifacts.
7. Render remains untouched by this roadmap.

## Open implementation planning gates

- Phase 0 must establish a trustworthy, task-by-task completion map before implementation scheduling.
- Phase 1 may require the user to supply authoritative missing modules if none exist in trusted local sources.
- Phase 3 requires the approved disposable local PostgreSQL setup, local fixture configuration, and all campaign tools.
- Each DDD context remains gated by its own specification/plan review if existing artifacts do not already cover the exact remaining work.
- Any production database, schema, paid-resource, external provider, deployment, or business-policy decision remains outside this roadmap until separately approved.

## Existing plans governed by the crosswalk

The reconciliation phase covers these local plans. It does not copy their task checklists into this design:

- [DDD foundation](../plans/2026-10-19-guigui-ddd-foundation.md)
- [Simulated integrations](../plans/2026-10-20-simulated-integrations.md)
- [Ticket purchase experience](../plans/2026-10-21-ticket-purchase-experience.md)
- [Platform health](../plans/2026-10-22-guigui-platform-foundation-health.md)
- [Platform runtime configuration](../plans/2026-10-22-guigui-platform-runtime-configuration.md)
- [HTTP observability](../plans/2026-10-22-guigui-http-observability.md)
- [Identity sessions](../plans/2026-10-22-guigui-identity-access-sessions.md)
- [Seven-context modular DDD roadmap](../plans/2026-10-22-guigui-modular-ddd-migration.md)
- [Business-profile completeness](../plans/2026-10-23-guigui-business-profile-completeness.md)
- [Remaining identity extraction](../plans/2026-10-23-guigui-identity-access-remaining.md)
- [PostgreSQL synthetic seed](../plans/2026-10-23-guigui-postgres-synthetic-seed.md)
- [Persistence inventory](../plans/2026-10-24-guigui-persistence-inventory.md)
- [Complete-system QA](../plans/2026-10-24-guigui-complete-system-qa.md)

The [Render production rollout](../plans/2026-10-24-guigui-render-production-deployment.md) is deliberately excluded and must not be resumed under this roadmap.
