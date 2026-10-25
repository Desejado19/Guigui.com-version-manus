# Guigui.com UX/UI and Functional Audit Design

**Date:** 2026-10-25
**Status:** Approved conversational design; awaiting written-spec review

## Purpose

Produce an evidence-backed audit of Guigui.com before product changes. The audit will identify user-facing and functional gaps across citizens/visitors, businesses/organizers, and administrators, then provide a risk-ranked basis for separately scoped implementation projects.

The broader modernization is intentionally decomposed. This specification covers only the first deliverable: the read-only audit and its report. It does not authorize product-code changes.

## Existing Context

Initial repository reconnaissance indicates:

- The frontend is a React SPA composed through `src/App.tsx`, with reusable UI components under `src/components/ui/`, profile dashboards, and locale catalogs under `src/locales/`.
- The backend is an Express monolith composed through `server.ts`; route handlers, services, persistence adapters, and domain code coexist in the repository.
- Existing documentation includes prior audits and plans for persistence, complete-system QA, identity, ticket purchase, and modular DDD. These documents are evidence to reconcile, not proof that a capability currently works.
- The latest repository commits address durable platform operations. This audit must not disturb that work or assume that prior test results still describe current runtime behavior.

These observations are preliminary. The audit must verify actual callers, contracts, storage paths, permissions, and executable test evidence before asserting status.

## Design Decisions

### Scope and order

Use this risk-led order for future implementation candidates:

1. Promotions, checkout, payments, and ticket issue/validation.
2. Citizen and visitor experience.
3. Business and organizer experience.
4. Administration.
5. Cross-cutting visual consistency, accessibility, responsiveness, and localization within each vertical slice.

This ordering prioritizes financial correctness, ticket integrity, authorization, and data integrity before visual polish. The audit itself will cover all profiles and cross-cutting areas, not only the first implementation candidate.

### Audit method

For each relevant screen and user action, trace:

`UI element/state -> frontend handler/service -> HTTP route -> authorization -> application/service -> persistence or external adapter -> response/UI state`

Classify observed capabilities as one of:

- `persisted`: evidence shows the behavior reaches its authoritative persistence path.
- `local/synchronized`: the browser holds local state and a defined API synchronization path exists.
- `simulated`: the flow uses a simulator, stub, fixture, or non-production adapter.
- `incomplete`: an expected action or essential path is absent or unfinished.
- `inconsistent`: the layers or user-visible states disagree.
- `not verified`: source inspection or safe local testing did not establish the behavior.

Do not classify a flow as end-to-end functional merely because its UI renders or a unit test passes. Record the evidence and limits behind each classification.

### UX and UI review

Inspect:

- Navigation, information hierarchy, links, buttons, and actions with no effective outcome.
- Form validation and useful success/error feedback.
- Loading, empty, error, success, and no-results states.
- Responsive behavior for desktop, tablet, and mobile.
- Keyboard operation, focus visibility, semantic controls, and contrast.
- Consistency and coverage of Portuguese, French, English, and Spanish locales where defined by the project.
- Existing reusable UI components and patterns, preserving those that are already correct.

The audit will identify specific affected screens and evidence. It will not prescribe a wholesale visual rewrite where the current implementation is sound.

### Profile, permission, and business-flow review

Map citizen/visitor, business/organizer, and administrator capabilities to the server-side authorization rules. In particular:

- Verify ownership/tenant boundaries and administrative permissions from the server, not only the frontend.
- Do not grant administrators access to commercial messages unless an existing approved permission explicitly allows it.
- Trace promotion pricing and validity through presentation, checkout, and financial records.
- Trace ticket purchase, payment state, issue, QR/token validation, duplicate use prevention, and entry recording.
- Identify the source of refund/cancellation policy and the payment methods actually supported.
- Record policy or provider gaps as blockers requiring an authoritative decision; do not invent business rules or claim simulated provider behavior is real.

### Safe test and environment boundary

- Inspect test commands and their safety guards before running them.
- Use only local, isolated environments and synthetic data for any runtime tests.
- Do not connect to Render, production, external providers, inherited/unverified database URLs, or any non-loopback database.
- Do not execute migrations, import/seed data, change environment configuration, or make deployments during the audit.
- If a test requires a database, run it only if the existing safeguards establish the approved isolated target before writes. Otherwise mark it blocked/not verified.
- Report skipped, unavailable, and blocked checks separately from passing checks.

## Deliverable

Create an audit report in `docs/reports/` containing:

1. Executive summary and scope/evidence limitations.
2. Screen, feature, route, profile, and permission inventory.
3. Data-flow and persistence map, including local-only and simulated paths.
4. UX/UI, accessibility, responsive, localization, and navigation findings.
5. Promotion, payment, ticketing, and refund/cancellation flow findings.
6. Risk-ranked issues with concrete file/route/test evidence.
7. Commands run and their exact outcomes; tests not run and why.
8. A dependency-aware list of implementation subprojects, without marking them complete.

## Acceptance Criteria

- All three profile groups and public/visitor paths are represented.
- Important user-visible actions are traced to their backend authorization and data path, or explicitly marked not verified.
- Simulated, browser-local, synchronized, and persisted behaviors are not conflated.
- Money, promotion, payment, ticket, and permission risks are prioritized with evidence.
- The administration-to-messaging boundary is explicitly checked and preserved.
- Responsive, accessibility, state-feedback, localization, navigation, and form concerns have concrete findings or are explicitly recorded as checked with no finding.
- No real data, external provider, deployment, or production database is touched.
- The report distinguishes verified behavior, test-only evidence, blocked checks, and assumptions.
- No product code is changed in this audit phase.

## Exclusions

- Implementing or restyling components.
- Changing API contracts, domain rules, persistence, permissions, or database schema.
- Replacing simulations with real payment, email, or SMS providers.
- Running active security scans or load campaigns against non-isolated targets.
- Completing the seven-context DDD migration as part of the UX audit.
- Declaring production readiness or deployment certification.

## Follow-on Work

After the report is reviewed, each implementation workstream will receive a separate scope, design/specification, and implementation plan. The first candidate is the risk-led promotion/payment/ticket flow; its exact scope depends on audit evidence and any unresolved commercial-policy decisions.
