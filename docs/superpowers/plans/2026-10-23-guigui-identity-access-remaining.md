# Guigui Identity Access Remaining Implementation Plan

> **For agentic workers:** After the execution method is approved, use `superpowers:executing-plans` for Native execution or `superpowers:subagent-driven-development` for Subagent-driven execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining `identity-access` extraction while preserving approved HTTP contracts and moving identity behavior behind module-owned application and persistence boundaries.
**Status:** Approved for Native execution in the current checkout on 2026-10-23; no commits without explicit authorization.

**Architecture:** Extract identity use cases incrementally, retaining `server.ts` as the HTTP composition root and moving persistence behind module-owned adapters. Keep account/session DTOs and use-case ports independent of Express and PostgreSQL; collaborate with `business-discovery` through a consumer-owned port, without starting that context's migration. Normalize the reset-token JSON format as an approved, narrowly scoped hardening change.

**Tech Stack:** Node.js, TypeScript, Express 4, Vitest, PostgreSQL (`pg`), JSON file persistence.

**Spec:** [2026-10-23-guigui-identity-access-remaining-design.md](../specs/2026-10-23-guigui-identity-access-remaining-design.md)

## Global Constraints

- Preserve the paths, methods, parameters, payloads, responses, status codes, and current error messages/codes.
- Preserve the `guigui_session` cookie, session duration, token format, and revocation rules.
- Do not change authentication policies, roles, MFA policy, password requirements, session/token validity, cookies, or deactivated-account behavior.
- Do not change the PostgreSQL schema or migrate identity data except for the approved reset-token JSON normalization.
- Do not introduce new token, hash, MFA-secret, or password-hash exposure in DTOs or logs; preserve the current non-production `resetToken` response field.
- Forward operational failures to Express error middleware instead of converting them to absent sessions, empty success, or authentication failures.
- Keep business profile/member rules owned by `business-discovery`; use a published contract/port, not its internal persistence.
- Run PostgreSQL integration tests only with an isolated, explicitly configured `TEST_DATABASE_URL` and confirmed seed.
- Do not commit without explicit user authorization; preserve unrelated working-tree changes.

## Review Focus

- Legacy reset-token JSON contains raw-token keys: normalize valid entries using their stored hash, remove plaintext keys, and preserve unexpired resets where possible (Task 1).
- Session JSON/PostgreSQL behavior and operational failures must remain distinguishable from a missing session (Task 2).
- Login must preserve deactivated-account rejection, demo-account fallback rules, MFA gating, and cookie creation (Task 3).
- Business registration conflicts and partial failures must retain explicit compensation and never report success after a failed association (Task 3).
- Lifecycle and invitation inputs must retain the characterized account-identity, token-expiry/use-once, and business-association rules; pause for approval if characterization reveals a policy change is needed (Tasks 5-6).

---

## File Map

- `server/modules/identity-access/domain/identityTypes.ts` — module-owned role, public-account, credential-account, and session types.
- `server/modules/identity-access/application/identityAccessPorts.ts` — persistence and cross-context ports consumed by identity use cases.
- `server/modules/identity-access/application/authentication.ts` — login and account-registration use cases.
- `server/modules/identity-access/application/sessionOperations.ts` — session lookup, logout, and revocation use cases.
- `server/modules/identity-access/application/credentials.ts` — password change/reset and MFA use cases.
- `server/modules/identity-access/application/accountLifecycle.ts` — account deactivation/deletion orchestration.
- `server/modules/identity-access/application/teamInvitations.ts` — invitation lifecycle and business-context port.
- `server/modules/identity-access/infrastructure/` — JSON, PostgreSQL, session, and MFA adapters moved from legacy services.
- `server/modules/identity-access/index.ts` — public module composition/API consumed by `server.ts` and approved scripts.
- `server.ts` — keep route declarations and HTTP response mapping; replace direct identity persistence/rule calls with module use cases and public identity queries.
- `server/authService.ts`, `server/postgresAuthService.ts`, `server/sessionService.ts`, `server/mfaService.ts` — remove after all consumers move; do not leave parallel implementations.
- `tests/unit/authService.test.ts`, `tests/unit/sessionService.test.ts`, `tests/unit/mfaService.test.ts`, `tests/unit/securityRoutes.test.ts`, `tests/unit/businessRegistration.test.ts`, and focused new application/HTTP tests — preserve adapter behavior and prove module use cases/contracts.
- `scripts/reset-admin-password.ts`, `scripts/seed-demo-dataset.ts` — switch utility imports to the public identity module API where needed.

## Tasks

### Task 1: Remove plaintext reset-token keys from JSON persistence

**Files:**
- Modify: `server/authService.ts`
- Test: `tests/unit/authService.test.ts`

**Interfaces:**
- Preserve `createPasswordReset(email): string | null` and `resetPassword(token, newPassword): boolean`.
- Persist reset records by token hash, not by raw token. The existing JSON record already contains `tokenHash`; use it to normalize valid legacy entries.

- [ ] **Step 1: Add failing migration and storage tests**

Add tests that seed a legacy `password-reset-tokens.json` record keyed by a raw token, reload the module, successfully consume the still-valid token, and assert the rewritten file contains no raw token. Also cover a new reset token, single-use behavior, expiry, malformed legacy records, and unknown tokens. A corrupt store must fail explicitly with a descriptive error instead of silently becoming an empty reset store.

- [ ] **Step 2: Run the focused tests and verify they fail for plaintext storage**

Run: `npm run test:unit -- tests/unit/authService.test.ts`

Expected: the new persistence assertion fails because the current JSON key contains the raw token.

- [ ] **Step 3: Normalize and persist reset records by hash**

On load, validate legacy records and normalize valid entries to a hash-keyed map; persist the normalized representation so raw legacy keys are removed. On issue and consume, compute the hash for lookup. Do not silently treat malformed store contents as an empty successful reset store.

- [ ] **Step 4: Run the focused tests**

Run: `npm run test:unit -- tests/unit/authService.test.ts`

Expected: PASS; valid legacy resets remain consumable, new and consumed tokens are not persisted in plaintext, and invalid/expired/reused tokens fail.

### Task 2: Establish identity-owned types, ports, and persistence adapters

**Files:**
- Create: `server/modules/identity-access/domain/identityTypes.ts`
- Create: `server/modules/identity-access/application/identityAccessPorts.ts`
- Create: `server/modules/identity-access/infrastructure/jsonIdentityRepository.ts`
- Create: `server/modules/identity-access/infrastructure/postgresIdentityRepository.ts`
- Create: `server/modules/identity-access/infrastructure/sessionRepository.ts`
- Create: `server/modules/identity-access/infrastructure/mfaRepository.ts`
- Create: `server/modules/identity-access/index.ts`
- Modify: `server/authService.ts`, `server/postgresAuthService.ts`, `server/sessionService.ts`, `server/mfaService.ts` as temporary compatibility re-exports until Task 7 removes them.
- Modify: `tests/unit/authService.test.ts`, `tests/unit/sessionService.test.ts`, `tests/unit/mfaService.test.ts`, `tests/unit/postgresServices.integration.test.ts`

**Interfaces:**
- `IdentityRole = 'user' | 'business' | 'admin'`.
- `PublicIdentity` contains the existing public user fields; `IdentityAccount` adds internal `passwordHash` and `createdAt`; neither application DTO may expose those fields.
- `CreateIdentityAccount = Omit<PublicIdentity, 'id' | 'avatarUrl'> & { avatarUrl?: string; password: string }`.
- `IdentityAccountRepository` exposes `findByEmail(email: string): Promise<IdentityAccount | null>`, `findById(id: string): Promise<IdentityAccount | null>`, `create(input: CreateIdentityAccount): Promise<IdentityAccount | null>`, `changePassword(email: string, currentPassword: string, newPassword: string): Promise<boolean>`, `deactivate(email: string): Promise<boolean>`, and `delete(email: string): Promise<boolean>`. JSON adapter values normalize from `undefined` to `null`.
- `IdentitySessionRepository` exposes `createSession(input: { userId: string; role: IdentityRole; ipAddress?: string; userAgent?: string }): Promise<string>`, `getSession(token: string | undefined): Promise<StoredSession | null>`, `revokeSession(token: string | undefined): Promise<boolean>`, and `revokeAllUserSessions(userId: string): Promise<number>`.
- `IdentityMfaRepository` exposes `hasEnabledMfa(userId): Promise<boolean>`, `beginMfaSetup(userId, email): Promise<{ secret: string; otpauthUrl: string }>`, `enableMfa(userId, code): Promise<boolean>`, and `verifyUserMfa(userId, code): Promise<boolean>`.
- Export only application-facing types and operations through `index.ts`; do not expose adapter internals.

- [ ] **Step 1: Add adapter contract tests for current JSON/session/MFA behavior**

Keep the existing test cases and add assertions for normalized `null`/boolean results and propagated PostgreSQL failures. The session contract must still verify cookie name `guigui_session`, seven-day expiry, token hashing, single revoke, and revoke-all.

- [ ] **Step 2: Run focused tests before moving implementations**

Run: `npm run test:unit -- tests/unit/authService.test.ts tests/unit/sessionService.test.ts tests/unit/mfaService.test.ts`

Expected: PASS on the existing service paths before relocation.

- [ ] **Step 3: Move identity persistence behind module adapters**

Move the existing JSON, PostgreSQL, session, and MFA implementations into the listed infrastructure files. Move shared identity types out of `src/types`/legacy service ownership where needed; do not import frontend types from application code. Keep the four legacy paths as temporary re-export facades so existing consumers keep working until Task 7. Export only the application-facing interfaces through `index.ts`.

- [ ] **Step 4: Update adapter tests to target module-owned adapters**

Retain the current isolated JSON setup and PostgreSQL integration gating. Keep malformed password/hash behavior, JSON account normalization, MFA TOTP replay protection, and database error propagation covered.

- [ ] **Step 5: Run focused adapter tests and type-check**

Run: `npm run test:unit -- tests/unit/authService.test.ts tests/unit/sessionService.test.ts tests/unit/mfaService.test.ts`

Run: `npm run check`

Expected: PASS; legacy behavior is unchanged and adapters compile against module-owned types.

### Task 3: Extract login and registration use cases

**Files:**
- Create: `server/modules/identity-access/application/authentication.ts`
- Create: `server/modules/identity-access/application/sessionOperations.ts`
- Modify: `server/modules/identity-access/application/identityAccessPorts.ts`
- Modify: `server.ts`
- Test: `tests/unit/identityAccessAuthentication.test.ts`
- Test: `tests/unit/identityAccessSessions.test.ts`
- Test: `tests/unit/securityRoutes.test.ts`
- Test: `tests/unit/businessRegistration.test.ts`

**Interfaces:**
- `authenticateUser(input, dependencies)` accepts normalized email/password, optional MFA code, request IP/user-agent, and returns `{ kind: 'authenticated'; user: PublicIdentity; sessionToken: string }` or `{ kind: 'rejected'; reason: 'invalid_credentials' | 'deactivated' | 'mfa_required' | 'mfa_invalid' }`. Storage/MFA failures reject the promise.
- `registerIdentityAccount(input, dependencies)` accepts the existing registration DTO and returns a discriminated result for created, invalid-profile, duplicate-account, or failed-registration outcomes. Its business dependency is a consumer-owned provisioning port: `validateProfile(profile): { missingFields: string[] }`, `createProfile(profile): Promise<{ id: string }>`, `assignOwner(businessId, userId): Promise<boolean>`, and `deleteProfile(businessId): Promise<boolean>`.
- `getIdentitySession(token, dependencies)`, `logoutIdentitySession(token, dependencies)`, and `revokeAllIdentitySessions(userId, dependencies)` use `IdentitySessionRepository`; missing tokens retain current results and operational errors reject.
- Keep HTTP status/body mapping in `server.ts`; do not pass Express `Request`/`Response` into the application service.

- [ ] **Step 1: Add failing application tests**

Cover valid credentials, wrong credentials, deactivated account, enabled-admin MFA required/invalid/valid, demo-account fallback, duplicate registration, normal user registration, business profile validation, and business registration failure after profile creation with successful and failed compensation. Session tests cover lookup DTO, logout with missing/unknown/valid token, revoke-all count, and repository error propagation.

- [ ] **Step 2: Run focused application tests**

Run: `npm run test:unit -- tests/unit/identityAccessAuthentication.test.ts tests/unit/identityAccessSessions.test.ts`

Expected: FAIL because the use cases do not yet exist.

- [ ] **Step 3: Implement the login and registration application services**

Use injected account/session/MFA/business ports. Preserve current login response inputs and the existing business registration compensation/audit outcome. Do not implement business persistence in `identity-access`.

- [ ] **Step 4: Route the existing login/register endpoints through the use cases**

Retain `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/auth/session`, and `/api/auth/sessions/revoke-all` and their current response mapping. Add route regression assertions for session cookie, user DTO, session lookup, logout/revoke-all results, registration status/body, and business association.

- [ ] **Step 5: Run application and route tests**

Run: `npm run test:unit -- tests/unit/identityAccessAuthentication.test.ts tests/unit/identityAccessSessions.test.ts tests/unit/businessRegistration.test.ts tests/unit/securityRoutes.test.ts`

Expected: PASS, including registration conflict and compensation coverage.

### Task 4: Extract password and MFA use cases

**Files:**
- Create: `server/modules/identity-access/application/credentials.ts`
- Modify: `server/modules/identity-access/application/identityAccessPorts.ts`
- Modify: `server.ts`
- Modify: `tests/unit/mfaService.test.ts`
- Test: `tests/unit/identityAccessCredentials.test.ts`
- Test: `tests/unit/securityRoutes.test.ts`

**Interfaces:**
- `changePassword(input, dependencies): Promise<boolean>` preserves the current email/current-password/new-password contract.
- `requestPasswordReset(email, dependencies): Promise<string | null>` and `resetPassword(token, newPassword, dependencies): Promise<boolean>` preserve the existing 15-minute, single-use, non-production response behavior while using the hash-only reset store.
- Inject MFA methods matching `IdentityMfaRepository`; do not make the use case depend on PostgreSQL.

- [ ] **Step 1: Add failing credential/MFA use-case tests**

Cover current-password success/failure, unknown reset account, successful reset, expired/used/unknown token, reset storage migration, MFA setup rejecting without PostgreSQL using the current configuration error, invalid TOTP, successful TOTP enablement, and replay rejection.

- [ ] **Step 2: Run focused use-case tests**

Run: `npm run test:unit -- tests/unit/identityAccessCredentials.test.ts tests/unit/mfaService.test.ts`

Expected: FAIL for the new application service cases; existing adapter behavior remains covered.

- [ ] **Step 3: Implement credential and MFA application services**

Delegate persistence and TOTP to the adapters from Task 2; propagate operational errors. Do not change password policy, MFA role policy, or database schema.

- [ ] **Step 4: Route password and MFA endpoints through the application services**

Keep `/api/auth/change-password`, `/api/auth/request-password-reset`, `/api/auth/reset-password`, `/api/auth/mfa/setup`, and `/api/auth/mfa/enable` responses unchanged, including reset-token exposure only outside production.

- [ ] **Step 5: Run focused tests**

Run: `npm run test:unit -- tests/unit/identityAccessCredentials.test.ts tests/unit/mfaService.test.ts tests/unit/securityRoutes.test.ts`

Expected: PASS; hash-only persistence is verified and route contracts remain unchanged.

### Task 5: Extract account deactivation and deletion

**Files:**
- Create: `server/modules/identity-access/application/accountLifecycle.ts`
- Modify: `server/modules/identity-access/application/identityAccessPorts.ts`
- Modify: `server.ts`
- Test: `tests/unit/identityAccessLifecycle.test.ts`
- Modify: `tests/unit/securityRoutes.test.ts`

**Interfaces:**
- `deactivateAccount(input, dependencies): Promise<AccountLifecycleResult>` and `deleteAccount(input, dependencies): Promise<AccountLifecycleResult>`.
- Inputs use the authenticated `userId`, current password, and optional requested email; dependencies provide account lookup/update/delete, session revocation, and audit.
- HTTP handlers continue to map the existing identity mismatch, not-found, invalid-password, and success results.

- [ ] **Step 1: Add failing lifecycle tests**

Cover unauthenticated requests, requested-email mismatch, missing account, wrong password, deactivation/deletion success, all-session revocation, and failure propagation from persistence/revocation.

- [ ] **Step 2: Run the focused lifecycle tests**

Run: `npm run test:unit -- tests/unit/identityAccessLifecycle.test.ts tests/unit/securityRoutes.test.ts`

Expected: FAIL for new application cases; current route regressions remain available for comparison.

- [ ] **Step 3: Implement the lifecycle use cases**

Resolve the account by authenticated user ID, verify the current password, perform the requested account operation, revoke that account's active sessions, and return the existing audit metadata. Preserve current operation ordering; if characterization identifies an unsafe ordering, pause and request explicit user approval before changing it. Surface partial failures explicitly.

- [ ] **Step 4: Route deactivation/deletion through the use cases**

Keep `/api/account/deactivate` and `/api/account/delete` request/response contracts and audit actions unchanged.

- [ ] **Step 5: Run lifecycle and route tests**

Run: `npm run test:unit -- tests/unit/identityAccessLifecycle.test.ts tests/unit/securityRoutes.test.ts`

Expected: PASS, including identity mismatch and session revocation assertions.

### Task 6: Extract team invitation lifecycle

**Files:**
- Create: `server/modules/identity-access/application/teamInvitations.ts`
- Modify: `server/modules/identity-access/application/identityAccessPorts.ts`
- Modify: `server.ts`
- Test: `tests/unit/identityAccessInvitations.test.ts`
- Test: `tests/unit/identityAccessInvitationRoutes.test.ts`
- Modify: `tests/unit/authService.test.ts`

**Interfaces:**
- `createTeamInvitation(input, dependencies)`, `inspectTeamInvitation(token, dependencies)`, and `acceptTeamInvitation(input, dependencies)` retain existing invitation DTO/result semantics.
- `BusinessInvitationAccess.validate(input)` receives the authenticated inviter ID, business ID, role, and permissions and returns the canonical accepted role/permissions or `null`; `BusinessInvitationAccess.addMember(input)` associates the accepted account with that business. Identity application code must not import `BusinessTeamMember` from frontend `src/types`. If characterization shows that validation would change current authorization outcomes, stop and obtain user approval before enforcing that change.
- Keep token issuance/storage, expiry, one-use state, and email-delivery simulation in their current modes.

- [ ] **Step 1: Add failing invitation use-case and route tests**

Cover valid inspection/acceptance, wrong/expired/used token, duplicate account, invalid role/permissions, authenticated business creation, existing `201`/`400`/`404`/`409`/`503` responses, and rejection/explicit blocking when the business port cannot validate the association.

- [ ] **Step 2: Run focused invitation tests**

Run: `npm run test:unit -- tests/unit/identityAccessInvitations.test.ts tests/unit/identityAccessInvitationRoutes.test.ts`

Expected: FAIL for the new module use cases and route harness.

- [ ] **Step 3: Implement invitation use cases and the business port**

Move invitation lifecycle rules to `identity-access`; require the injected business port for association/permitted team context. Preserve 48-hour expiry, token hashing, one-use acceptance, and the existing simulated email behavior.

- [ ] **Step 4: Route invitation endpoints through the module**

Keep the three existing `/api/business/team/invitations` routes and current request/response shapes.

- [ ] **Step 5: Run invitation and route tests**

Run: `npm run test:unit -- tests/unit/identityAccessInvitations.test.ts tests/unit/identityAccessInvitationRoutes.test.ts tests/unit/securityRoutes.test.ts`

Expected: PASS; no direct business repository or frontend type import remains in identity application code.

### Task 7: Complete module composition and remove legacy identity access

**Files:**
- Modify: `server/modules/identity-access/index.ts`
- Modify: `server.ts`
- Modify: `scripts/reset-admin-password.ts`, `scripts/seed-demo-dataset.ts`
- Delete after migration: `server/authService.ts`, `server/postgresAuthService.ts`, `server/sessionService.ts`, `server/mfaService.ts`
- Modify: `tests/unit/authService.test.ts`, `tests/unit/sessionService.test.ts`, `tests/unit/mfaService.test.ts`, `tests/unit/postgresServices.integration.test.ts`, `tests/unit/securityRoutes.test.ts`

**Interfaces:**
- `server.ts` consumes only the public identity module API for identity use cases and the minimal public identity query required by other route handlers.
- Scripts consume public password-hash helpers; no script imports module infrastructure internals.
- No non-identity consumer imports a repository or model owned by `identity-access`.

- [ ] **Step 1: Verify remaining legacy imports**

Search `server.ts`, scripts, and tests for imports from the four legacy service paths and module infrastructure. Record the remaining consumers to update in this task; do not add a new static-analysis tool solely for this check.

- [ ] **Step 2: Run module and route regression tests**

Run: `npm run test:unit -- tests/unit/identityAccessApplication.test.ts tests/unit/identityAccessMiddleware.test.ts tests/unit/securityRoutes.test.ts tests/unit/businessRegistration.test.ts`

Expected: PASS before changing the remaining consumers.

- [ ] **Step 3: Replace direct persistence/rule calls with the module API**

Update all `server.ts` consumers of user lookup, password hashing, sessions, MFA, and account actions, including non-identity routes that need public identity data. Update the two utility scripts to use public helpers. Remove legacy service files only after `rg` confirms there are no remaining imports.

- [ ] **Step 4: Run focused unit, integration-gated, type, and build checks**

Run: `npm run test:unit -- tests/unit/authService.test.ts tests/unit/sessionService.test.ts tests/unit/mfaService.test.ts tests/unit/identityAccessApplication.test.ts tests/unit/identityAccessMiddleware.test.ts tests/unit/identityAccessAuthentication.test.ts tests/unit/identityAccessCredentials.test.ts tests/unit/identityAccessLifecycle.test.ts tests/unit/identityAccessInvitations.test.ts tests/unit/identityAccessInvitationRoutes.test.ts tests/unit/securityRoutes.test.ts tests/unit/businessRegistration.test.ts tests/unit/postgresServices.integration.test.ts`

Expected: PASS; PostgreSQL-only cases remain skipped unless an isolated `TEST_DATABASE_URL` is explicitly configured.

Run: `npm run check`

Expected: PASS with no type errors.

Run: `npm run build`

Expected: PASS; report any pre-existing frontend chunk-size warning without changing unrelated bundle behavior.

- [ ] **Step 5: Run the complete unit suite**

Run: `npm run test:unit`

Expected: PASS; infrastructure-dependent tests stay skipped unless their explicitly approved prerequisites are configured.

- [ ] **Step 6: Verify the module boundary and completion criteria**

Run a final import search over `server.ts`, scripts, and production sources. Expected: no imports from legacy identity service paths or module infrastructure outside `identity-access`; no schema migration, no frontend change, all endpoint contracts covered, and no unrelated working-tree changes staged or committed.

## Completion Gate

- All seven tasks are independently tested and complete.
- The full unit suite, `npm run check`, and `npm run build` pass.
- PostgreSQL integration evidence is reported only if a confirmed isolated test database was used.
- Any newly discovered policy or contract change is paused for user approval rather than silently bundled.
- No commit is created without explicit user authorization.
