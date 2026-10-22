# Guigui Identity Access Sessions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract session-context resolution and Express authentication/role middleware into `identity-access` without changing existing routes, access policies, or persistence.

**Architecture:** A small application service maps a token and an injected session reader to `SessionContext | null`. An Express adapter composes that use case with the existing cookie-token and audit callbacks; `server.ts` remains the composition root and keeps the existing names used by route handlers.

**Tech Stack:** Node.js, TypeScript, Express 4, Vitest.

**Spec:** [2026-10-22-guigui-identity-access-sessions-design.md](../specs/2026-10-22-guigui-identity-access-sessions-design.md)

## Global Constraints

- Preserve the existing HTTP contracts and access policies.
- `server.ts` continues as the composition root.
- Do not change session expiry, token hashing, revocation, TTL, storage, or the behavior of deactivated accounts.
- Do not change the cookie, endpoint list, route role lists, audit behavior, schema, migrations, credentials, frontend, or response formats.
- Continue to use `server/sessionService.ts` for session operations; do not extract `createSession`, `revokeSession`, or `revokeAllUserSessions`.
- Do not extract login, registration, MFA, password change/reset, invitations, or account deactivation/deletion.
- Operational session-read failures must not be converted into `null`, `401`, or an empty success response; middleware forwards them to Express with `next(error)`.
- Do not include unrelated working-tree changes; stage exact paths and hunks for each task.
- No new dependencies, schema changes, or migrations.
- Run `npm run test:unit`, `npm run check`, and `npm run build` before considering the slice complete.

## Review Focus

- Missing token or session: application returns `null`; middleware preserves the exact `401` body.
- Existing session without a role: treat as unauthenticated, not as an authorized session.
- Valid session with an unlisted role: return the exact `403` and record the current audit details.
- Session reader failure: forward the original error to `next(error)`, not a credential failure.
- Citizen authorization denial: audit actor role remains `citizen`, with the original `req.path`, request ID, and required role list.

---

### Task 1: Add the session-context application service

**Files:**
- Create: `tests/unit/identityAccessApplication.test.ts`
- Create: `server/modules/identity-access/application/resolveSessionContext.ts`

**Interfaces:**
- Produces:
  - `export type SessionRole = 'user' | 'business' | 'admin'`
  - `export type SessionContext = { userId: string; role: SessionRole }`
  - `export type SessionReader = { getSession(token: string | undefined): Promise<{ userId: string; role?: SessionRole } | null> }`
  - `export function resolveSessionContext(token: string | undefined, reader: SessionReader): Promise<SessionContext | null>`
- The service returns `null` for an absent token, missing session, or session without a role. It returns only `userId` and `role` for a valid session and does not catch reader errors.

- [ ] **Step 1: Write application tests**

In `tests/unit/identityAccessApplication.test.ts`, add:

1. `returns null without querying the reader when the token is absent`: pass `undefined`, assert `null` and that `getSession` was not called.
2. `returns null when the reader has no matching session`: return `null` and assert `null`.
3. `treats a session without a role as unauthenticated`: return `{ userId: 'user-1' }` and assert `null`.
4. `returns only the user ID and role for a valid session`: return a session with `userId: 'user-1'` and role `'business'`; assert exactly `{ userId: 'user-1', role: 'business' }`.
5. `propagates session-reader errors`: reject with a sentinel error and assert the returned promise rejects with that same error.

- [ ] **Step 2: Run the tests to verify the application contract fails**

Run: `npm run test:unit -- tests/unit/identityAccessApplication.test.ts`

Expected: FAIL because `resolveSessionContext.ts` does not exist.

- [ ] **Step 3: Implement the application service**

Create `resolveSessionContext.ts` with the exact exported types and function above. Do not import Express, `server/sessionService.ts`, PostgreSQL, filesystem modules, or cookie helpers.

- [ ] **Step 4: Run application tests**

Run: `npm run test:unit -- tests/unit/identityAccessApplication.test.ts`

Expected: PASS for all five cases.

- [ ] **Step 5: Commit the application slice**

Stage only the application service and its test. Use commit message `feat: add identity session context service` and include the repository's required `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.

---

### Task 2: Extract the Express session-access middleware

**Files:**
- Create: `tests/unit/identityAccessMiddleware.test.ts`
- Create: `server/modules/identity-access/http/sessionAccessMiddleware.ts`

**Interfaces:**
- Consumes `SessionRole`, `SessionContext`, and `resolveSessionContext` from Task 1.
- Produces:
  - `export type AuthorizationDeniedAudit = { resource: string; actorRole: 'citizen' | 'business' | 'admin'; requestId: string; requiredRoles: SessionRole[] }`
  - `export type SessionAccessDependencies = { resolveContext(request: Request): Promise<SessionContext | null>; requestIdFrom(request: Request): string; onAuthorizationDenied(audit: AuthorizationDeniedAudit): void }`
  - `export function createSessionAccessMiddleware(dependencies: SessionAccessDependencies): { sessionContext(request: Request): Promise<SessionContext | null>; requireSession: RequestHandler; requireRole(...roles: SessionRole[]): RequestHandler }`
- `requireSession` and `requireRole` preserve the exact response messages and codes defined in the spec. Operational errors from session-context resolution are forwarded to `next(error)`.

- [ ] **Step 1: Write middleware tests**

In `tests/unit/identityAccessMiddleware.test.ts`, use a small Express test app and injected dependencies to add:

1. `returns the resolved context for a valid request`: assert `sessionContext(request)` returns only `userId` and `role`.
2. `requires a session and returns the established 401 response`: with a null context, assert status `401` and JSON `{ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' }`.
3. `allows a request when its session has a required role`: assert `requireRole('admin')` calls `next()` for an admin context.
4. `denies a valid session with the established 403 response`: use a user context with `requireRole('admin')`; assert status `403` and JSON `{ error: 'Não possui permissão para esta operação.', code: 'PERMISSION_DENIED' }`.
5. `records the current authorization-denial audit fields`: assert resource is `req.path`, user maps to `citizen`, request ID is injected unchanged, and `requiredRoles` contains `admin`.
6. `forwards a session-reader failure to next`: reject with a sentinel error and assert the Express error handler receives the same instance.

- [ ] **Step 2: Run the tests to verify the middleware contract fails**

Run: `npm run test:unit -- tests/unit/identityAccessMiddleware.test.ts`

Expected: FAIL because `sessionAccessMiddleware.ts` does not exist.

- [ ] **Step 3: Implement the middleware factory**

Implement the exact dependency and return types above. Use the application service through `resolveContext`; keep Express-specific behavior in this HTTP adapter and do not add request-scoped state.

- [ ] **Step 4: Run middleware and application tests**

Run: `npm run test:unit -- tests/unit/identityAccessMiddleware.test.ts tests/unit/identityAccessApplication.test.ts`

Expected: PASS for all application and middleware cases.

- [ ] **Step 5: Commit the HTTP adapter slice**

Stage only the HTTP adapter and its test. Use commit message `refactor: extract identity session access middleware` and include the required co-author trailer.

---

### Task 3: Compose the module and verify route compatibility

**Files:**
- Modify: `server.ts` (only imports and the local `sessionContext`, `requireSession`, and `requireRole` composition)
- Test: `tests/unit/securityRoutes.test.ts` (only add a focused regression if the existing cases do not cover the exact middleware boundary)
- No database, login, registration, account, or frontend files

**Interfaces:**
- Consumes the application and HTTP adapter contracts from Tasks 1 and 2.
- The composition creates a `SessionReader` from the existing `getSession` import and passes the existing `sessionTokenFromRequest`, `requestIdFrom`, and `recordAudit` behavior through injected callbacks.
- Existing route handlers continue to call the local names `sessionContext`, `requireSession`, and `requireRole` without route rewrites.

- [ ] **Step 1: Run the existing authorization and lifecycle regression tests before wiring**

Run: `npm run test:unit -- tests/unit/securityRoutes.test.ts`

Expected: PASS before integration; if it fails, record the baseline failure and stop before editing `server.ts`.

- [ ] **Step 2: Compose the identity-access module**

Replace only the three local implementations in `server.ts` with the factory output. Preserve cookie parsing, request-ID generation, audit action/resource/actor mapping, middleware order, route role arrays, response bodies, and every route call site. Use a narrow callback to map `AuthorizationDeniedAudit` into the existing `recordAudit` entry.

- [ ] **Step 3: Run focused route and module tests**

Run: `npm run test:unit -- tests/unit/identityAccessApplication.test.ts tests/unit/identityAccessMiddleware.test.ts tests/unit/securityRoutes.test.ts`

Expected: PASS, including existing access control, session revocation, account lifecycle, metrics-route, and tenant-isolation assertions.

- [ ] **Step 4: Run the complete unit suite, type-check, and build**

Run:

```powershell
npm run test:unit
npm run check
npm run build
```

Expected: all unit tests pass, TypeScript check succeeds, and the production build succeeds. Existing unrelated warnings may remain; do not expand scope to fix them.

- [ ] **Step 5: Review and commit only this slice**

Inspect the staged diff and confirm that `server.ts` contains only the identity-access imports/composition, with no hunks from unrelated pending work. Stage only the two new module files, their tests, and the selected `server.ts` hunks. Use commit message `refactor: compose identity session access module` and include the required co-author trailer.

### Checkpoint: Identity session access

- [ ] Application and middleware tests pass.
- [ ] Existing security-route and account/session lifecycle regressions pass.
- [ ] `npm run test:unit`, `npm run check`, and `npm run build` pass.
- [ ] No login, registration, MFA, reset, invitation, persistence, schema, or unrelated working-tree changes are included.
- [ ] The identity-access boundary and preserved contracts are accurately represented by the approved spec.
