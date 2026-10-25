# Render production rollout

## Scope and safety gates

This runbook concerns a **new** Render web service. It must not replace the current service or receive the current custom domain during initial validation. Keep provider integrations simulated. Do not run database migrations automatically or provision paid resources until the user has reviewed a dated cost estimate and explicitly approved it.

The new service shares the existing PostgreSQL database. Do not enable writes until the currently deployed application version, database schema compatibility, and all required JSON-backed data have been audited and restored to durable storage. Keep maintenance mode enabled during data restoration.

## Baseline on 2026-10-24

| Check | Result |
|---|---|
| Worktree | `agents/faz-um-teste-completo-no-sistema-sobre-fluxo`; clean before execution |
| `render.yaml` | Absent before this rollout |
| Render CLI | Not installed in the local environment |
| Render service identity/access | Not verifiable from this session; do not provision or alter remote services until the current service and new unique service name can be distinguished in the authenticated dashboard |
| Local `data/` directory | Absent in this checkout; this does not establish whether the deployed service has JSON data |
| `npm run check` | Failed on missing pre-existing imports under `src/data`: `monetizationCatalog`, `subscriptionCatalog`, `adminStaffData`, `auditLogsData`, and `notificationsData` |
| `npm run test:unit` | 12 files failed, 67 passed, 1 skipped; 495 tests passed and 85 skipped. The failed files depend on the same missing `src/data` modules. |
| `npm run build` | Failed because `src/App.tsx` imports missing `./data/auditLogsData` |

These failures block a production release until resolved or an approved, evidence-based alternative build is provided. Do not exclude tests or silence the missing imports to pass this gate.

## Local revalidation on 2026-10-25

All checks below ran at commit `6bbef38`. The startup attempt explicitly unset both database URLs, used an isolated `.local-qa/manual-startup-check/state` directory, loopback host/port, test mode, and an empty dotenv file; it did not connect to the database configured outside that isolated process.

| Check | Result |
|---|---|
| `npm run check` | Failed with 24 unresolved imports caused by the five absent modules already listed above. |
| `npm run test:unit` | 12 files failed, 67 passed, 1 skipped; 495 tests passed and 85 skipped. A rerun with all database URL variables unset reproduced the same result. Failed component/domain test imports reference the absent modules. |
| `npm run build` | Failed resolving `src/data/adminStaffData` imported by `src/App.tsx`. |
| `npm run dev` in isolated test mode | Failed before binding because `server/ticketPurchaseDomain.ts` imports absent `src/data/monetizationCatalog`; QA port 4313 remained unavailable. A separate Node process on port 3000 served a Guigui.com page and returned HTTP 200 with database connected, but could not be tied to this checkout; it was left untouched and excluded from testing. |
| `npm run qa:api:check` | Passed: 98 routes inventoried and 74 Newman requests. |
| `npm run test:i18n` | Passed: 4 locales and 622 translation keys. |
| `qa:full -PreflightOnly` | Did not run database provisioning, server, browser/API tests, load test, or ZAP. Campaign report: `test-results/qa/20261025-001148-451/report.json`. |

The campaign preflight found `QA_ADMIN_DATABASE_URL`, the reserved `QA_DATABASE_NAME`, `QA_PORT`, and `QA_ADMIN_FIXTURE_PASSWORD` missing from the local process; `k6` and `psql` were also unavailable. Playwright 1.62.1, Newman 6.2.1, and ZAP 2.17.0 were detected, but none of their live test phases ran. The campaign report's zero test/alert counts are placeholders, not passing results. The application in this checkout cannot currently be started or validated in a browser. A separate Guigui.com process was healthy on port 3000, but its source checkout is unverified and was not used for tests.

## Build, start, host, and health contract

- `npm run build` runs `vite build`, bundles `server.ts` to `dist/server.mjs`, and bundles the platform entrypoint to `dist/platform-preflight.mjs`.
- `npm start` runs `scripts/start-production.mjs`, which loads the production preflight bundle and then the server bundle.
- `server/modules/platform-foundation/config/platformRuntimeConfig.ts` binds to `PORT` (default `3000`) and `HOST` (default `0.0.0.0`).
- `GET /api/health` returns HTTP 200 JSON. Its `status` distinguishes a healthy process from a configured but disconnected database; deployment acceptance must additionally require `database.configured === true` and `database.connected === true`.
- Current runtime configuration does not yet consume Render's `RENDER_EXTERNAL_URL`; Task 4 in the implementation plan adds a tested default-origin fallback.

## Required deployment gates

1. Complete and sanitize the JSON/browser data inventory in `render-data-inventory.md`; the current deployed service must be inspected through authorized Render access.
2. Create and verify a protected backup and an isolated restore before transferring anything to the new service.
3. Present the current monthly cost estimate for the chosen durable-storage option and obtain explicit approval before provisioning a paid web tier or persistent disk.
4. Confirm the new service is uniquely named and the existing deployment can be identified. If Render access is unavailable, stop and use the dashboard manually; never request an API token or database URL in chat.
5. Configure required secret variables directly in the private Render service settings. Do not place secret values in this file, `render.yaml`, repository files, logs, or chat.
6. Keep the new service in maintenance mode while restoring JSON files to the approved durable path; verify checksums and safe record counts before enabling API writes.
7. Verify existing PostgreSQL schema compatibility without running migrations. Stop if the deployed commit or database compatibility cannot be confirmed.
8. Validate the new `*.onrender.com` URL with the read-only health verifier and GET-only smoke tests. Do not run purchase, payment, refund, invitation, admin-write, or deletion flows against the shared production database.

## Environment variables

Set secret values only in the private Render environment:

- `DATABASE_URL`
- `SESSION_COOKIE_SECRET`
- `TICKET_SIGNING_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `SCANNER_DOOR_CODE`

Non-secret settings include `NODE_ENV=production`, `HOST=0.0.0.0`, `PORT` supplied by Render, `RENDER_EXTERNAL_URL` supplied by Render, `APP_MAINTENANCE_MODE=true` during restoration, and `GUIGUI_DATA_DIR` set to the approved durable mount when a persistent disk is approved. Do not add real payment/SMS/email provider credentials; keep payment sandbox/simulation behavior explicit.

## Cost estimate and approval

**Status:** Not estimated. A verified backup size and data inventory are prerequisites. No paid plan or disk is approved or provisioned.

After inventory, compare a persistent disk mounted at `/var/data` (with `GUIGUI_DATA_DIR=/var/data`) against a separately designed migration of the remaining JSON-owned state to PostgreSQL. Include the service tier, disk size, monthly total, and Render's single-instance and ephemeral-filesystem limitations. Link dated official pricing sources. Stop until the user explicitly approves an option and cost limit.

## Deploy, verify, and rollback

Deploy only the unique new service from an approved commit and validated Blueprint. Keep maintenance mode enabled until the data restore and PostgreSQL health checks pass. For the first public validation, use only the Render-generated service URL; do not alter the current domain.

After read-only health and SPA checks, verify disk-backed state survives one controlled restart. Record only commit ID, service URL, non-sensitive checksums/counts, and test outcomes.

Rollback by stopping or disabling only the new service. Preserve its disk, the existing database, the current Render service, and the current domain. Before any further action, assess whether the new service made writes to the shared database.

## DDD follow-up

The Render deployment is separate from the seven-context DDD migration. After the new service is validated, continue the approved sequential roadmap in `../superpowers/plans/2026-10-22-guigui-modular-ddd-migration.md`. Each context requires its own reviewed specification and plan. Do not claim the seven modules are complete as part of this deployment.
