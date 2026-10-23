# Simulated Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run payment, ticket email, invitation email, and SMS flows through explicit simulation-only adapters while preparing typed boundaries for future providers and removing manual transfer payments.

**Architecture:** Define typed payment, email, and SMS ports and compose only deterministic simulation adapters in the server. Application services call those ports instead of SMTP or gateway functions; active payment methods are Orange Money and Telecel, while historical manual-payment records remain readable but cannot be created or manually processed.

**Tech Stack:** TypeScript, Express, React, Vitest, Playwright, existing Nodemailer/QR code modules (real email transport remains inactive).

**Spec:** [../specs/2026-10-20-simulated-integrations-design.md](../specs/2026-10-20-simulated-integrations-design.md)

## Global Constraints

- “Simulated adapters are the only adapters composed by the running application in this phase.”
- “They create deterministic simulation references and perform no outbound network I/O.”
- “Environment variables cannot switch the running system to a real provider.”
- “Keep historical transaction records; do not delete them.”
- “A delivery failure does not undo an already-confirmed simulated purchase.”
- “Message bodies, PINs, credentials, and provider secrets must not be written to logs.”
- “The receipt clearly explains that no external message was sent and that tickets remain available in the account.”

## Review Focus

- Configured SMTP/SMS credentials or URLs must not activate a real adapter — test composition with credentials set and assert simulated results/no outbound requests (Task 2).
- A pending simulated payment must not issue valid tickets — test pending responses and reservations without delivery (Tasks 1 and 4).
- A simulated payment confirmation must not be presented as a real provider payment — assert mode and receipt copy (Tasks 1 and 3).
- `manual_transfer` must be rejected for new purchases/payments while existing rows remain readable — test validators, routes, and legacy transaction fixtures (Task 1).
- Delivery or notification-persistence failures must not undo tickets or expose PII — test injected failures and log metadata (Tasks 2 and 3).

---

## File Structure

- Create `server/integrations/ports.ts` — provider-independent contracts and result types.
- Create `server/integrations/simulatedAdapters.ts` — deterministic payment, email, and SMS adapters; no SMTP or `fetch` imports.
- Modify `server/paymentService.ts` — make payment adapters asynchronous, simulated-only, and limited to active providers; retain webhook parsing/signature helpers for future adapters.
- Modify `server/ticketPurchaseDeliveryService.ts` — consume injected email/SMS ports and return explicit simulated states.
- Modify `server.ts` — compose simulation adapters; wire purchase, team invitation, SMS resend, payment creation, and webhook behavior through the active adapters.
- Modify `server/emailService.ts` and `server/smsGatewayService.ts` — isolate real transports as inactive future adapters; do not call them from active server routes.
- Modify `server/validationService.ts` — accept only Orange Money and Telecel for new payments and purchases.
- Modify `src/types.ts` — distinguish active payment providers from legacy stored provider values so old records can still render.
- Modify `src/components/TicketPurchaseModal.tsx` and `src/components/EventsView.tsx` — remove manual transfer choice/mapping and label payment simulation.
- Modify `src/components/AdminDashboard.tsx` — preserve legacy transaction display, but do not offer manual-transfer creation or confirmation actions.
- Modify `src/components/BusinessDashboard.tsx` — show simulation/pending state accurately and do not grant purchased quota until payment is confirmed.
- Modify `src/utils/i18n.ts` — provide simulation/not-sent copy consistently in Portuguese, English, French, and Spanish.
- Modify `.env.example` — state that SMTP/SMS values do not activate outbound delivery in simulation-only mode.
- Modify `tests/unit/paymentService.test.ts`, `tests/unit/validationService.test.ts`, and `tests/unit/ticketPurchaseDelivery.test.ts`; create `tests/unit/simulatedAdapters.test.ts` and `tests/unit/components/BusinessDashboard.test.tsx`.
- Modify `tests/ticket-purchase-modal.spec.ts` — cover payment choices, pending/confirmed simulation, and truthful delivery status.

## Task 1: Define Ports and Simulate Payment; Retire Manual Payment

**Files:**
- Create: `server/integrations/ports.ts`
- Modify: `server/paymentService.ts`
- Modify: `server/validationService.ts`
- Modify: `server.ts`
- Modify: `src/types.ts`
- Modify: `src/components/TicketPurchaseModal.tsx`
- Modify: `src/components/EventsView.tsx`
- Modify: `src/components/AdminDashboard.tsx`
- Test: `tests/unit/paymentService.test.ts`
- Test: `tests/unit/validationService.test.ts`
- Test: `tests/ticket-purchase-modal.spec.ts`

**Interfaces:**
- Produces `PaymentProvider = 'orange_money' | 'telecel'`.
- Produces `PaymentProviderAdapter.createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>` and `mode: 'simulated' | 'sandbox' | 'live'`; the active factory returns only `mode: 'simulated'`.
- `server/validationService.ts` exports active `PaymentMethod = PaymentProvider`; `src/types.ts` uses active `PaymentMethod` for requests and `HistoricalPaymentMethod = PaymentMethod | 'manual_transfer'` only for stored tickets/transactions.
- Consumes existing `PaymentIntentInput`, webhook parsing, provider status, and sandbox auto-confirm setting.

- [ ] **Step 1: Write failing unit and component assertions**

Update payment tests to assert that Orange Money and Telecel return deterministic provider references, `mode: 'simulated'`, and configured pending/confirmed results; assert the adapter registry has only those two providers. Update validation tests to assert `manual_transfer` is rejected for ticket purchase and general payment inputs. Update the modal test to assert there are exactly two payment options and neither is manual transfer. Add a request-level test posting `manual_transfer` to `/api/tickets/purchase` and `/api/payments/create`; both must return `400` before creating transactions or tickets.

- [ ] **Step 2: Run focused tests and verify expected failures**

Run: `npx vitest run tests/unit/paymentService.test.ts tests/unit/validationService.test.ts`

Expected: FAIL because payment results are synchronous/sandbox-only and the validators still accept `manual_transfer`.

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: the new manual-option assertion fails against the existing modal.

- [ ] **Step 3: Implement payment contracts and simulation-only payment flow**

Define `PaymentProvider = 'orange_money' | 'telecel'` and the async payment port in `server/integrations/ports.ts`. Keep the shared `PaymentMethod` alias for active inputs and add `HistoricalPaymentMethod = PaymentMethod | 'manual_transfer'` for stored records. Update `createPaymentAdapters` to return only Orange Money and Telecel simulation adapters with deterministic `OM-SIM-${transactionId}` / `TEL-SIM-${transactionId}` references and explicit simulation instructions. Keep `PAYMENT_SANDBOX_AUTOCONFIRM` as the simulation pending/confirmed switch. Await `createIntent` in both purchase and general payment routes. Reject webhooks for providers whose active mode is simulated with a clear non-active-provider response.

Remove `manual_transfer` from active validator sets and request contracts, remove `manualProofReference`-based new payment selection, and remove the checkout option/mapping. Default the ticket modal to Orange Money. Preserve legacy provider/status types and read-only records; reject manual confirmation attempts for historical manual-transfer rows without deleting them.

- [ ] **Step 4: Run focused tests and type-check**

Run: `npx vitest run tests/unit/paymentService.test.ts tests/unit/validationService.test.ts`

Expected: PASS; no active payment provider includes `manual_transfer`.

Run: `npm run check`

Expected: PASS; stored historical records continue to satisfy their legacy provider types.

- [ ] **Step 5: Run focused UI test and commit**

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: PASS; only Orange Money and Telecel are selectable.

```powershell
git add server/integrations/ports.ts server/paymentService.ts server/validationService.ts server.ts src/types.ts src/components/TicketPurchaseModal.tsx src/components/EventsView.tsx src/components/AdminDashboard.tsx tests/unit/paymentService.test.ts tests/unit/validationService.test.ts tests/ticket-purchase-modal.spec.ts
git commit -m "feat: restrict payments to simulated providers" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 2: Compose Simulation-Only Email and SMS Delivery

**Files:**
- Create: `server/integrations/simulatedAdapters.ts`
- Modify: `server/integrations/ports.ts`
- Modify: `server/ticketPurchaseDeliveryService.ts`
- Modify: `server/emailService.ts`
- Modify: `server/smsGatewayService.ts`
- Modify: `server.ts`
- Modify: `tests/unit/ticketPurchaseDelivery.test.ts`
- Create: `tests/unit/simulatedAdapters.test.ts`

**Interfaces:**
- Consumes `PaymentProviderAdapter` and active provider types from Task 1.
- Produces `EmailDeliveryPort.sendTicketPurchase(input): Promise<IntegrationDeliveryResult>` and `EmailDeliveryPort.sendTeamInvitation(input): Promise<IntegrationDeliveryResult>`.
- Produces `SmsDeliveryPort.send(outbound: SmsOutbound): Promise<IntegrationDeliveryResult>`.
- `IntegrationDeliveryResult` is `{ mode: 'simulated'; state: 'simulated'; reference: string }`.
- `TicketPurchaseDeliveryResult.email` is `{ state: 'simulated' | 'failed' | 'unavailable'; reference?: string }`; `sms` is `{ state: 'simulated' | 'failed'; mode: 'simulated'; references: string[] }`. It must not include message bodies or claim delivery.
- `deliverConfirmedTicketPurchase(input, ports: { email: EmailDeliveryPort; sms: SmsDeliveryPort }): Promise<TicketPurchaseDeliveryResult>` uses injected ports.

- [x] **Step 1: Write failing tests for simulation adapters and injected delivery**

Add tests asserting stable simulation references and `state: 'simulated'` for ticket email, invitations, and SMS. Update delivery tests to inject fake ports, assert each ticket-holder group is passed to SMS, email targets the authenticated account, and notification persistence remains independent of external delivery. Add failure tests asserting email/SMS and notification-persistence failures do not undo tickets or throw past the purchase use case. Assert logs contain transaction/reference identifiers but not emails, phone numbers, ticket PINs, or message bodies.

- [x] **Step 2: Run focused tests and verify expected failures**

Run: `npx vitest run tests/unit/simulatedAdapters.test.ts tests/unit/ticketPurchaseDelivery.test.ts`

Expected: FAIL because simulation adapters and injectable delivery ports do not yet exist.

- [x] **Step 3: Implement typed ports, simulated adapters, and server composition**

Add the email/SMS contracts and deterministic simulated adapters without importing Nodemailer or calling `fetch`. Compose those adapters explicitly at server startup, independent of SMTP/SMS environment variables. Inject them into `deliverConfirmedTicketPurchase`; route team invitations and SMS resends through the same active ports. Preserve message-building helpers and real transport code only as inactive future adapters.

Update the SMS integration-status endpoint to report the active simulated adapter, not whether credentials happen to be present. Return `simulated` delivery states and references from routes; do not return message bodies or report sent/delivered. Keep internal notifications persisted as before.

- [x] **Step 4: Run unit tests with external credentials deliberately set**

Run: `npx vitest run tests/unit/simulatedAdapters.test.ts tests/unit/ticketPurchaseDelivery.test.ts`

Expected: PASS with simulated states. The test sets SMTP/SMS credentials and endpoints through Vitest environment stubs, spies on `fetch` and Nodemailer transport creation, and asserts neither is contacted; restore the original environment values and spies after the test.

- [x] **Step 5: Run type-check and commit**

Run: `npm run check`

Expected: PASS; all active email/SMS call sites use the ports.

```powershell
git add server/integrations/ports.ts server/integrations/simulatedAdapters.ts server/ticketPurchaseDeliveryService.ts server/emailService.ts server/smsGatewayService.ts server.ts tests/unit/ticketPurchaseDelivery.test.ts tests/unit/simulatedAdapters.test.ts
git commit -m "feat: simulate outbound email and sms" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: Show Simulation States and Preserve Historical Read-Only Data

**Files:**
- Modify: `src/components/EventsView.tsx`
- Modify: `src/components/AdminDashboard.tsx`
- Modify: `src/components/BusinessDashboard.tsx`
- Modify: `src/utils/i18n.ts`
- Modify: `tests/ticket-purchase-modal.spec.ts`
- Create: `tests/unit/components/BusinessDashboard.test.tsx`
- Modify: `tests/unit/ticketPurchaseNotification.test.ts` only if notification identity behavior changes during integration

**Interfaces:**
- Consumes purchase response `transaction.providerMode === 'simulated'` and `delivery.email.state === 'simulated'` / `delivery.sms.state === 'simulated'`.
- Consumes the stable `notif-ticket-${transactionId}` identifier already used by the server and client.
- Produces receipt copy that distinguishes payment simulation, email simulation/not sent, SMS simulation/not sent, and internal notification creation.

- [x] **Step 1: Write failing receipt assertions**

Update the Playwright purchase flow to assert that a simulated confirmed purchase says payment is simulated, email/SMS were simulated and not sent, the user notification is present, and all tickets remain available. Update the pending-payment path to use a simulated Orange Money or Telecel response and assert no valid-ticket receipt or delivery state is shown. Add a focused `BusinessDashboard` component test proving pending simulated payments do not add quota and confirmed simulated payments do.

- [x] **Step 2: Run the focused Playwright test and verify expected failures**

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: FAIL because the current receipt reports successful email/SMS delivery and does not identify the payment as simulated.

- [x] **Step 3: Implement accessible, localized simulation copy**

Update `EventsView` to parse explicit simulation states and display “simulated/not sent” messages; do not infer delivery from a non-failed response. Show payment simulation status from the transaction mode. Keep actual ticket proof, order total, and in-app notification unchanged. Update `BusinessDashboard` so pending simulated provider responses never grant quota or claim a real SMS/API payment. Preserve historical payment rows in the admin view, label manual-transfer entries as legacy/read-only, and remove manual-transfer confirmation actions while leaving unrelated reconciliation controls intact.

Add corresponding translation keys to Portuguese, English, French, and Spanish dictionaries in `src/utils/i18n.ts`.

- [x] **Step 4: Run the focused UI and locale checks**

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: PASS for pending and confirmed simulations and for responsive receipt layout.

Run: `npx vitest run tests/unit/components/BusinessDashboard.test.tsx`

Expected: PASS; pending simulation does not grant posts/promotions, while confirmed simulation does and is labeled as simulated.

Run: `npm run check:locales`

Expected: PASS for all four locales with matching keys.

- [x] **Step 5: Commit**

```powershell
git add src/components/EventsView.tsx src/components/AdminDashboard.tsx src/components/BusinessDashboard.tsx src/utils/i18n.ts tests/ticket-purchase-modal.spec.ts tests/unit/components/BusinessDashboard.test.tsx
git commit -m "feat: label simulated ticket purchase delivery" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: Document Simulation-Only Configuration and Verify the Full Change

**Files:**
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-10-20-simulated-integrations-design.md` only if implementation reveals an approved design detail needs clarification.
- Verify: all files and tests listed above.

**Interfaces:**
- Consumes the active simulation-only server composition from Tasks 1–3.
- Produces environment documentation that clearly states SMTP and SMS gateway variables do not enable external delivery in this phase.

- [x] **Step 1: Update environment documentation**

Revise the SMTP and SMS comments in `.env.example` to state that credentials/endpoints are reserved for future adapters and are ignored by the current simulation-only composition.

- [x] **Step 2: Run focused unit, locale, Playwright, and type checks**

Run: `npm run check`

Expected: PASS.

Run: `npm run test:unit`

Expected: PASS; report any pre-existing skipped tests accurately.

Run: `npm run check:locales`

Expected: PASS.

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: PASS; UI shows two providers, truthful simulation states, no ticket delivery on pending payment, and preserves ticket proof layout.

- [x] **Step 3: Run production build and commit**

Run: `npm run build`

Expected: frontend and server bundles build successfully. Existing chunk-size warnings, if still present, are not failures and should be reported separately.

```powershell
git add .env.example
git commit -m "docs: clarify simulation-only provider configuration" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Dependencies

- Task 1 is prerequisite to Tasks 2 and 3.
- Task 2 is prerequisite to Task 3 because receipt states come from the delivery ports.
- Task 4 follows Tasks 1–3 and performs final verification.
