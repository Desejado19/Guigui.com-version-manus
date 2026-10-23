# Guigui.com Business Profile Completeness Implementation Plan

> This plan implements the approved profile-completeness feature spec. It does not execute the separate `business-discovery` DDD extraction.

**Goal:** Collect reliable business profile data, let owners complete it, present it honestly to the public, and let administrators curate homepage-featured businesses without changing campaign or subscription behavior.

**Spec:** [2026-10-20-business-profile-completeness-design.md](../specs/2026-10-20-business-profile-completeness-design.md)

**Approval:** The user approved the existing feature scope and explicitly requested a JSON business-persistence adapter on 2026-10-23.

## Architecture Decisions

- Use exactly one business persistence adapter per runtime: PostgreSQL when configured, otherwise a JSON adapter backed by `businesses.json` in the configured runtime data directory. Never fall back to JSON after a PostgreSQL failure or report success for a no-op.
- Missing JSON store means an empty collection. Malformed or unreadable business data is an explicit error; do not overwrite it with an empty list.
- Keep account email separate from the optional public business email. Public business APIs must not expose account email or legacy owner-email fields.
- Store optional-field applicability explicitly in business profile data; required fields cannot be marked not applicable.
- Store administrator homepage ordering separately from the legacy `featured` flag and subscription tier. Proposed representation: nullable `homepageFeaturedOrder` in the existing business JSON/JSONB data, requiring no SQL schema migration.
- Keep the existing API contracts where practical; preserve approval, subscription, moderation, review, follow, message, post, promotion, and campaign behavior.
- Keep the SPA structure and current composition root. Do not move the feature into `business-discovery` as part of this plan.
- Registration must not report success unless both the account and business profile are persisted. If one write succeeds before the other fails, compensate and surface any compensation failure.

## Global Constraints

- Do not add dependencies, change `.env`, perform a database migration, or initialize Git.
- Do not inspect, rewrite, or migrate existing user data while developing the JSON adapter. Adapter tests use isolated temporary directories only.
- Preserve PostgreSQL behavior when it is configured; do not switch persistence after an operational PostgreSQL error.
- Preserve existing approval status and server-owned ownership, verification, moderation, subscription, and creation fields during profile edits.
- Business accounts can edit only the business ID associated with their authenticated server-side user record.
- Do not invent profile information or use placeholder defaults as if the business supplied them.
- Preserve account email privacy. Only a separately entered public contact email may be returned publicly.
- Preserve active advertising campaigns and their impression/click behavior when adding featured-business slides.
- Preserve all unrelated staged, unstaged, and untracked changes. Do not commit without explicit user approval.
- `src/components/EventsView.tsx` is outside this feature scope and must remain untouched.

## Review Focus

- Missing, malformed, or unreadable `businesses.json`: initialize only when absent; otherwise propagate the error without overwriting data.
- PostgreSQL configured but unavailable: surface the PostgreSQL failure and do not fall back to JSON.
- Registration fails between account and business writes: no success response; compensate the completed write and report compensation failure explicitly.
- Business profile update: derive business ownership from the authenticated account; ignore/reject client attempts to change owner, approval, verification, moderation, subscription, and homepage-order fields.
- Public API response: never expose account email or legacy `ownerEmail`; expose `publicEmail` only when separately supplied.
- Hydration: preserve stored values and apply defaults only to missing fields; never replace existing values with empty form defaults.
- Featured businesses: only active, explicitly selected businesses are eligible; preserve administrator ordering; keep campaigns eligible after featured businesses; do not infer selection from subscription tier or legacy `featured`.
- Zero reviews and missing/broken images: do not show an earned rating or collapse card/profile layout.

---

### Task 1: Define profile validation and completion rules

**Files:**
- Modify: `src/types.ts`
- Create: `src/utils/businessProfile.ts`
- Create: `tests/unit/businessProfile.test.ts`

**Produces:**
- A pure, shared profile validator/completion calculator.
- Typed optional not-applicable fields and the proposed `homepageFeaturedOrder` property.
- A completion percentage based on the six required fields only: business name, category, subcategory, meaningful description, public phone, neighborhood.

- [ ] Test each required field when absent/blank, valid complete profiles, incomplete profiles, and optional fields marked not applicable.
- [ ] Confirm a not-applicable marker cannot satisfy a required field.
- [ ] Run `npm run test:unit -- tests/unit/businessProfile.test.ts`; observe the expected missing-helper failure.
- [ ] Implement the smallest pure helper without React, Express, storage, or database dependencies.
- [ ] Run the focused test and `npm run check`.

**Dependency:** None.

### Task 2: Add strict JSON business storage

**Files:**
- Modify: `server/runtimeStore.ts`
- Create: `server/jsonBusinessStore.ts`
- Create: `tests/unit/jsonBusinessStore.test.ts`

**Produces:**
- JSON business reads/writes under the same configured data directory used by other runtime stores.
- Missing-file initialization without masking parse, permission, or write errors.
- Isolated tests that never use the repository's real `data` directory.

- [ ] Write tests using a temporary data directory for missing-file reads, round-trip writes, malformed JSON, read failures, and write failures.
- [ ] Run the tests and observe the expected missing-adapter failure.
- [ ] Implement strict business-store operations; do not weaken the existing generic `loadJson` fallback behavior for unrelated stores.
- [ ] Run `npm run test:unit -- tests/unit/jsonBusinessStore.test.ts`.

**Dependency:** Task 1 for the shared business record type.

### Task 3: Select the PostgreSQL or JSON business adapter explicitly

**Files:**
- Modify: `server/postgresBusinessService.ts`
- Modify: `server/jsonBusinessStore.ts`
- Create: `tests/unit/businessPersistence.test.ts`

**Produces:**
- Business listing and persistence use PostgreSQL when configured and JSON only when PostgreSQL is not configured.
- Owner assignment and the profile operations required by the feature work in both modes.
- PostgreSQL errors propagate without retrying or writing to JSON.

- [ ] Test list/create/update behavior in JSON mode, PostgreSQL delegation, and propagation of PostgreSQL failures without JSON writes.
- [ ] Verify stored business fields survive updates that change only profile fields.
- [ ] Run the focused tests and observe the missing/incorrect adapter behavior before implementation.
- [ ] Implement adapter selection using the existing `databasePool` configuration; do not dual-write.
- [ ] Run `npm run test:unit -- tests/unit/businessPersistence.test.ts tests/unit/jsonBusinessStore.test.ts`.

**Dependency:** Task 2.

### Task 4: Validate and persist complete business registration

**Files:**
- Modify: `server.ts`
- Modify: `server/postgresBusinessService.ts`
- Modify: `server/authService.ts` and/or `server/postgresAuthService.ts` only for compensation required by the selected adapter
- Create: `tests/unit/businessRegistration.test.ts`

**Produces:**
- The registration API validates required business-profile fields before creating the account.
- The initial business record includes category, subcategory, description, neighborhood, and public phone without copying the account email into public profile fields.
- Account/profile partial writes are compensated, with compensation failures reported explicitly.
- Existing plan and payment decisions remain unchanged; administrative approval still follows its existing PostgreSQL-only route.

- [ ] Test field-level invalid input, successful JSON and PostgreSQL registration, account/business write failures, compensation, and compensation failure.
- [ ] Test that account email is absent from the public business record and the public business response.
- [ ] Run `npm run test:unit -- tests/unit/businessRegistration.test.ts`; observe the expected contract failures.
- [ ] Implement registration validation and adapter-specific compensation without weakening citizen registration behavior.
- [ ] Run the focused registration and security-route tests.

**Dependency:** Tasks 1–3.

### Task 5: Collect required profile data during business registration

**Files:**
- Modify: `src/components/LoginModal.tsx`
- Modify: `src/App.tsx`
- Create: `tests/unit/components/LoginModal.test.tsx`

**Produces:**
- Business registration collects category, subcategory, description, public phone, and neighborhood before account creation.
- Blank prompts prevent silently submitting a preselected or fabricated neighborhood/contact value.
- The registered business profile returned by the API reaches the application state without being replaced by empty defaults.
- Existing plan selection, payment steps, and citizen registration remain unchanged.

- [x] Test required-field validation, submission payload, and preservation of the existing plan/payment flow.
- [x] Run the new component test and observe the missing required-field behavior.
- [x] Implement the form and typed registration response.
- [x] Run the focused component tests and `npm run check`.

**Dependency:** Task 4.

### Task 6: Secure business profile updates

**Files:**
- Modify: `server.ts`
- Modify: `server/postgresBusinessService.ts`
- Modify: `tests/unit/securityRoutes.test.ts`
- Create: `tests/unit/businessProfileRoutes.test.ts`

**Produces:**
- Profile writes require a business or administrator session.
- Business ownership is derived from the authenticated user record; cross-business edits are denied.
- Field validation is enforced at the server boundary.
- Server-owned fields, including owner, approval, verification, moderation, subscription, and featured order, are preserved.
- Persistence failures return an explicit error and do not become success responses.

- [x] Add route tests for unauthenticated, wrong-owner, valid owner, administrator, invalid input, protected-field tampering, and persistence failure.
- [x] Run the tests and verify each failing case reproduces the missing behavior.
- [x] Implement an allowlisted profile update through the selected adapter.
- [x] Run `npm run test:unit -- tests/unit/businessProfileRoutes.test.ts tests/unit/securityRoutes.test.ts`.

**Dependency:** Tasks 1–3.

### Task 7: Hydrate stored profiles and protect public contact data

**Files:**
- Modify: `server.ts`
- Modify: `server/postgresBusinessService.ts`
- Modify: `src/App.tsx`
- Create: `tests/unit/businessProfileHydration.test.ts`

**Produces:**
- Public list/bootstrap responses include persisted profile values but exclude account email and legacy owner-email fields.
- A separate `publicEmail` is included only when explicitly provided.
- Client hydration merges stored values and defaults only genuinely absent fields; it does not overwrite a populated profile with blank/default values.

- [x] Test a complete stored record, an incomplete legacy record, and records containing private account-email fields.
- [x] Run the tests and observe the current data-loss/privacy behavior.
- [x] Implement explicit public serialization and value-preserving hydration.
- [x] Run `npm run test:unit -- tests/unit/businessProfileHydration.test.ts tests/unit/securityRoutes.test.ts`.

**Dependency:** Tasks 1–4.

### Task 8: Add profile completion and reliable dashboard saving

**Files:**
- Modify: `src/components/client/ClientBusinessProfile.tsx`
- Modify: `src/components/BusinessDashboard.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/unit/components/BusinessDashboard.test.tsx`
- Create: `tests/unit/components/ClientBusinessProfile.test.tsx`

**Produces:**
- The dashboard displays required-field completion and missing/recommended items.
- Existing stored values hydrate into the editor; optional fields can be explicitly marked not applicable.
- Save waits for the API result, shows success only after persistence, and exposes failure without discarding the form.
- Editing cannot alter approval, subscription, verification, moderation, or featured-selection state.

- [x] Test complete/incomplete profiles, missing versus not-applicable values, populated-field hydration, successful save, and failed save.
- [x] Run the component tests and reproduce blocked saves when legacy relative image paths fail native URL validation.
- [x] Implement API-backed editing, recommended-field guidance, and accessible loading/success/error states.
- [x] Run both focused component tests and `npm run check`.

**Dependency:** Tasks 1, 5–7.

### Task 9: Improve directory cards and public business profiles

**Files:**
- Modify: `src/components/BusinessCard.tsx`
- Modify: `src/components/BusinessDetailModal.tsx`
- Create: `tests/unit/components/BusinessCard.test.tsx`
- Create: `tests/unit/components/BusinessDetailModal.test.tsx`

**Produces:**
- Cards prioritize the specified public profile fields and show ratings only when reviews exist.
- Missing/broken cover and logo images use local, branded fallbacks; no remote placeholder is treated as business data.
- Public profiles omit empty values and retain existing contact, navigation, follow, message, review, post, and promotion interactions.
- Layout and fallback controls remain keyboard accessible and usable on narrow screens.

- [x] Test complete and incomplete profiles, zero reviews, missing/broken images, and existing action callbacks.
- [x] Run the component tests and observe the current blank/placeholder rendering.
- [x] Implement local fallbacks and conditional sections without changing existing interactions.
- [x] Run the focused component tests and `npm run test:i18n`.

**Dependency:** Tasks 1 and 7.

### Task 10: Persist administrator-curated featured-business ordering

**Files:**
- Modify: `server.ts`
- Modify: `server/postgresBusinessService.ts`
- Create: `tests/unit/businessFeaturedRoutes.test.ts`

**Produces:**
- An authenticated administrator can select, order, and remove homepage-featured businesses.
- Only active businesses can be publicly selected; status changes prevent pending, rejected, or suspended records from appearing.
- Ordering is stored separately from the legacy `featured` flag and subscription tier, using existing JSON/JSONB data without a migration.
- Unauthorized callers cannot change the curated list.

- [ ] Test administrator authorization, stable ordering, active-only eligibility, removal, and persistence failure.
- [ ] Run the tests and observe the missing route/ordering contract.
- [ ] Implement admin-only persistence through the business adapter, preserving the profile and server-owned fields.
- [ ] Run `npm run test:unit -- tests/unit/businessFeaturedRoutes.test.ts tests/unit/businessPersistence.test.ts`.

**Dependency:** Tasks 1–3 and 6.

### Task 11: Add administrator featured-business controls

**Files:**
- Modify: `src/components/AdminDashboard.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/admin/FeaturedBusinessesAdmin.tsx`
- Create: `tests/unit/components/FeaturedBusinessesAdmin.test.tsx`

**Produces:**
- Administrators can select only active businesses, reorder them, remove them, and receive explicit save errors.
- The UI does not infer selection from tier or legacy `featured` state.
- Existing approval, suspension, subscription, and export controls remain unchanged.

- [ ] Test selection eligibility, ordering, removal, API failure, and preservation of other business fields.
- [ ] Run the component test and observe the missing management surface.
- [ ] Implement accessible selection and up/down ordering controls using existing UI conventions.
- [ ] Run the focused test and `npm run check`.

**Dependency:** Task 10.

### Task 12: Combine featured businesses and advertising in the homepage rotation

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/FeaturedHomepageBanner.tsx`
- Create: `tests/unit/components/FeaturedHomepageBanner.test.tsx`

**Produces:**
- Selected active businesses appear before active advertising campaigns in the shared rotation.
- Business slides link to the public profile and are clearly labeled as featured businesses, not paid campaigns.
- Campaigns continue to rotate and retain their existing impression/click behavior.
- The banner is omitted when there are neither featured businesses nor active campaigns.

- [ ] Test ordering, business/campaign labels, campaign callbacks, and the empty state.
- [ ] Run the component test and observe the existing campaign-only presentation.
- [ ] Implement the shared rotation without altering campaign eligibility or subscription state.
- [ ] Run the focused component test.

**Dependency:** Tasks 7 and 10–11.

### Task 13: Verify complete profile flows and document the delivered scope

**Files:**
- Modify: `README.md`
- Create: `tests/business-profile.spec.ts`

**Produces:**
- Playwright coverage for registration/profile completion, public privacy/rendering, save errors, administrator featured ordering, and campaign coexistence.
- Documentation describes the actual persistence modes and profile behavior without claiming a broader backend migration.

- [x] Run `npm run test:e2e -- tests/business-profile.spec.ts` against isolated test data.
- [x] Run `npm run test:unit -- --maxWorkers=1 --no-file-parallelism`.
- [x] Run `npm run check`, `npm run test:i18n`, `npm run build`, and `git diff --check`.
- [x] Report skipped tests and any environment-dependent E2E limitations; do not weaken or skip existing tests.

**Dependency:** Tasks 1–12.

## Checkpoints

- **After Tasks 1–4:** profile rules, both persistence adapters, and registration API pass focused tests; no success-shaped persistence fallback remains.
- **After Tasks 5–8:** registration and dashboard flows preserve profile data and report save outcomes correctly.
- **After Tasks 9–12:** public presentation and administrator homepage featuring pass component and API tests.
- [x] **Complete:** focused Playwright, full unit suite, type-check, i18n validation, build, and whitespace checks pass; unrelated changes remain untouched.

## Risks and Open Questions

| Risk / question | Mitigation or proposed resolution |
|---|---|
| “Meaningful description” has no numeric threshold in the spec. | Proposed default for review: at least 30 non-whitespace characters after trimming. Confirm before Task 1 implementation. |
| The spec does not name which optional fields can be marked not applicable. | Proposed allowlist: exact address, opening hours, public email, WhatsApp, website, social links, and service languages. Missing logo/cover/gallery remains simply missing, not “not applicable.” Confirm before Task 1 implementation. |
| Registration writes account and business records separately. | Use adapter-specific compensation; test both rollback and compensation failure before treating registration as successful. |
| `runtimeStore.loadJson` treats parse/read failures as fallback values. | The business adapter must use strict read semantics and must not overwrite malformed data. |
| Legacy `email` may contain an account email and be present in business JSONB. | Public serialization exposes only an explicit `publicEmail`; keep legacy private values out of public DTOs. |
| Existing generic `featured` data has other directory/UI behavior. | Use a separate persisted ordering field; do not change the legacy flag or tier behavior. |
| Existing working tree contains unrelated staged, unstaged, and untracked changes. | Keep the implementation restricted to task files and stage no unrelated paths; no commit is authorized. |
