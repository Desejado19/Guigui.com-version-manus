# Ticket Purchase Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a reliable, responsive ticket purchase journey with server-validated checkout, issued tickets in the buyer's account, truthful simulated delivery, and a focused DDD application boundary.

**Architecture:** Keep HTTP and React as adapters around a ticket-purchase application service. Resolve ticket offers from server-owned event data, calculate quotes and reserve inventory before creating a simulated payment intent, and issue tickets only after confirmation. Persist events/tickets in PostgreSQL when available and use the server's JSON runtime store for local simulation; keep payment, email, and SMS adapters simulated only.

**Tech Stack:** TypeScript, React, Express, PostgreSQL, existing JSON runtime store, Vitest, Playwright.

**Spec:** [../specs/2026-10-21-ticket-purchase-experience-design.md](../specs/2026-10-21-ticket-purchase-experience-design.md)

## Global Constraints

- “Orange Money and Telecel remain simulated payment methods.”
- “Simulated payment confirmation is automatic by default.”
- “A pending payment never issues tickets or reports successful delivery.”
- “Email and SMS remain simulations and must be reported as not sent.”
- “A delivery or notification failure must not undo tickets already issued after payment confirmation.”
- “The server is authoritative for event and ticket type, current price, availability, fees, buyer identity and contact, and policy acceptance.”
- “Keep the server composition root on simulated payment, email, and SMS adapters only. Environment variables must not activate external providers.”
- “Preserve existing API response compatibility where practical and retain historical records without destructive data migrations.”
- “Extract only purchase orchestration that is necessary to make the flow testable and maintainable; do not conduct a repository-wide refactor.”

## Review Focus

- Client-tampered ticket type, unit price, or total must not change a server-calculated quote — cover in Task 1.
- Unauthenticated purchases and invalid, unpublished, or stale event/ticket offers must not reach payment creation — cover in Task 1.
- Concurrent purchases at the final available inventory must not oversell, including active pending reservations — cover in Task 1.
- Repeated requests with the same idempotency key must not duplicate payment, tickets, or notifications — cover in Task 1.
- A confirmed purchase must remain visible without PostgreSQL, and a notification/email/SMS failure must not hide or roll back tickets — cover in Task 3.

---

## File Structure

- Create `server/ticketPurchaseDomain.ts` for server-side offer/quantity validation and quote calculation.
- Create `server/ticketPurchasePorts.ts` for provider-independent catalog and inventory contracts used by the application layer.
- Create `server/ticketCatalogService.ts` to resolve active offers from persisted event records and the local simulation store.
- Create `server/ticketPurchaseUseCase.ts` in Task 4 for orchestration behind typed ticket-domain ports.
- Modify `server.ts` only to adapt HTTP requests/responses, persist authorized event snapshots for local simulation, and compose the use case.
- Modify `server/postgresBusinessService.ts` to expose persisted event offers and keep ticket type catalog rows synchronized with event data.
- Modify `server/postgresTicketService.ts` to reserve inventory atomically, persist the ticket type/account association, and list tickets for the authenticated buyer.
- Modify `server/validationService.ts` to validate purchase identity, policy, selected event/ticket identifiers, and payment method without treating client prices as authoritative.
- Modify `server/runtimeStore.ts` only if a narrowly scoped helper is needed for the server-owned local event/ticket simulation store.
- Modify `src/components/TicketPurchaseModal.tsx` and `src/components/EventsView.tsx` for checkout errors and receipt data returned by the server.
- Modify `src/components/MyTicketsPanel.tsx` and the existing account notification flow only where needed to expose persisted tickets and the purchase notification.
- Modify `tests/ticket-purchase-modal.spec.ts`, `tests/unit/ticketPurchaseDelivery.test.ts`, and `tests/unit/ticketPurchaseNotification.test.ts`; create focused purchase-domain/use-case tests.
- Add a non-destructive migration only if the existing `ticket_types` and `tickets` schema cannot represent the required inventory reservation; prefer existing quantity, status, and expiry columns.

## Task 1: Validate Checkout Offers, Quotes, and Inventory

**Files:**
- Create: `server/ticketPurchaseDomain.ts`
- Create: `server/ticketPurchasePorts.ts`
- Create: `server/ticketCatalogService.ts`
- Modify: `server.ts`
- Modify: `server/postgresBusinessService.ts`
- Modify: `server/postgresTicketService.ts`
- Modify: `server/validationService.ts`
- Test: `tests/unit/ticketPurchaseDomain.test.ts`
- Test: `tests/unit/ticketPurchaseCatalog.test.ts`
- Test: `tests/ticket-purchase-modal.spec.ts`

**Interfaces:**
- Produces `TicketOffer` with `eventId`, optional `businessId`, `eventTitle`, `ticketTypeId`, `ticketTypeName`, `unitPriceXOF`, `availableQuantity`, `soldQuantity`, and `salesOpen`.
- Produces `TicketCatalogPort.getOffer(eventId: string, ticketTypeId: string): Promise<TicketOffer | null>` and `TicketInventoryPort.reserve(input: { offer: TicketOffer; quantity: number; reservationId: string; expiresAt: string }): Promise<'reserved' | 'unavailable'>`, plus `confirm(reservationId: string): Promise<void>` and `release(reservationId: string): Promise<void>`.
- Produces `getTicketOffer(eventId: string, ticketTypeId: string): Promise<TicketOffer | null>` in `server/ticketCatalogService.ts`. Read persisted PostgreSQL event data when configured; otherwise read server-owned event snapshots from the local runtime store. Only published, sale-open events and ticket types are returned.
- Produces `quoteTicketPurchase(input: { offer: TicketOffer; quantity: number; catalog: MonetizationCatalog }): TicketPurchaseQuoteResult` in `server/ticketPurchaseDomain.ts`. Return a discriminated result for invalid quantity, closed sales, sold out/insufficient inventory, or a valid quote; a valid quote contains unit price, quantity, fee breakdown, and buyer total.
- Implements `TicketInventoryPort` so it atomically reserves the requested quantity for both confirmed and pending simulated payments. PostgreSQL uses the existing `ticket_types.quantity` and ticket status/expiry data under a row lock; local simulation updates the server-owned event/ticket store before awaiting payment.
- Consumes existing `PaymentProviderAdapter`, `calculateTicketFees`, and explicit `policyAccepted`/`policyVersion`/`policyAcceptedAt` validation.

- [ ] **Step 1: Write failing domain and catalog tests**

Add `quoteTicketPurchase` tests for a valid quote, zero/fractional/over-limit quantity, closed sales, sold out inventory, and quantity above remaining stock. Assert totals use the server offer price and `calculateTicketFees`, never a submitted client amount. Add catalog tests for unknown event/type, unpublished event, and successful lookup from PostgreSQL and local simulation data.

- [ ] **Step 2: Run focused tests and confirm expected failures**

Run: `npx vitest run tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseCatalog.test.ts`

Expected: FAIL because the domain quote and catalog resolver do not yet exist.

- [ ] **Step 3: Implement offer resolution and quote calculation**

Implement the exact `TicketOffer`, `TicketPurchaseQuoteResult`, `quoteTicketPurchase`, and `getTicketOffer` interfaces above. Synchronize ticket type IDs, prices, and capacities when an authorized event is saved. In local simulation mode, retain the authorized server event snapshot with the existing JSON runtime store instead of trusting each purchase body as a new offer.

- [ ] **Step 4: Add inventory reservation and server-authoritative request handling**

Update `POST /api/tickets/purchase` to require an authenticated session for valid purchase requests, derive the buyer account ID from that session, resolve `eventId`/`ticketTypeId`, calculate price and fees from the offer, reject submitted price/total mismatches before creating a payment intent, and reserve capacity before calling the payment adapter. Keep reservations `pending` until confirmed, preserve expiry behavior, and release expired/failed reservations. Use canonical event and category names in the transaction and issued tickets.

- [ ] **Step 5: Add regression assertions for tampering, stock, and idempotency**

Extend the focused purchase tests to prove that an unauthenticated valid request, invalid policy acceptance, tampered price/category, unknown offer, unavailable stock, and closed sales create no payment intent or valid ticket; two concurrent reservations for the last available ticket allow only one success; same-key retries return the original result without duplicate tickets; a pending simulation reserves capacity but creates no valid ticket.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseCatalog.test.ts tests/unit/ticketPurchaseDelivery.test.ts`

Run: `npm run check`

Expected: PASS; catalog/stock violations stop before simulated payment and the existing typed integration ports remain compatible.

```powershell
git add server/ticketPurchaseDomain.ts server/ticketCatalogService.ts server.ts server/postgresBusinessService.ts server/postgresTicketService.ts server/validationService.ts tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseCatalog.test.ts tests/ticket-purchase-modal.spec.ts
git commit -m "fix: validate ticket offers and inventory server-side" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 2: Make the Confirmed Receipt Complete and Responsive

**Files:**
- Modify: `src/components/TicketPurchaseModal.tsx`
- Modify: `src/components/EventsView.tsx`
- Modify: `src/index.css` only for receipt layout adjustments that cannot be expressed by existing component classes.
- Test: `tests/ticket-purchase-modal.spec.ts`

**Interfaces:**
- Consumes the purchase result's `transaction.id`, `transaction.providerMode`, authoritative `feeBreakdown`, `tickets`, and `delivery` states.
- Produces a receipt state in `EventsView` that retains the server transaction reference, server fee breakdown, issued ticket list, and explicit payment/email/SMS/notification statuses until the receipt closes.
- Preserves existing modal callbacks and the API response shape.

- [ ] **Step 1: Add failing receipt tests**

Update the browser purchase test to assert that a confirmed receipt displays the server transaction reference, event/category, all tickets, authoritative itemized total, and simulated-payment status. Add assertions that the displayed total does not come from stale modal state after selecting a different category or quantity. Keep the pending test asserting that it shows no success receipt.

- [ ] **Step 2: Run the focused browser test and confirm expected failures**

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: FAIL only on missing/stale receipt data; existing pending and modal-layer tests continue to pass.

- [ ] **Step 3: Implement receipt state from the API response**

Store the authoritative response data separately from checkout form state. Render transaction reference, ticket subtotal, platform-fee allocation, buyer total, tickets, and truthful simulation statuses from that state; do not recalculate the receipt total from the currently selected event type or quantity.

- [ ] **Step 4: Verify responsive and accessible receipt behavior**

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: PASS at 320, 768, 1024, and 1440 pixel widths, with visible first content, keyboard focus containment, clear pending/confirmed distinction, and no horizontal overflow.

- [ ] **Step 5: Commit**

```powershell
git add src/components/TicketPurchaseModal.tsx src/components/EventsView.tsx src/index.css tests/ticket-purchase-modal.spec.ts
git commit -m "fix: show authoritative ticket purchase receipt" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: Persist Tickets in the Account and Show Purchase Notifications

**Files:**
- Modify: `server.ts`
- Modify: `server/postgresTicketService.ts`
- Modify: `server/ticketPurchaseDeliveryService.ts` only if a verified gap remains.
- Modify: `src/components/MyTicketsPanel.tsx` only if needed to refresh or present the account ticket state.
- Modify: `src/App.tsx` and `src/services/notificationService.ts` only if the existing transaction-keyed notification does not appear for the buyer.
- Test: `tests/unit/ticketPurchaseDelivery.test.ts`
- Test: `tests/unit/ticketPurchaseNotification.test.ts`
- Test: `tests/ticket-purchase-modal.spec.ts`

**Interfaces:**
- Consumes the confirmed purchase response and authenticated session identity.
- Produces `GET /api/tickets/mine` results for the authenticated buyer from PostgreSQL or the local simulation ticket store.
- Preserves the stable internal notification identifier `notif-ticket-${transactionId}` so local and server copies merge rather than duplicate.
- Keeps email/SMS return states `simulated`, `failed`, or `unavailable`; none may claim sent/delivered.

- [x] **Step 1: Add failing ticket-account and notification regressions**

Add a test for a confirmed simulated purchase without PostgreSQL: tickets are associated with the account, returned by `/api/tickets/mine`, and do not leak to another account. Extend the notification test to assert the ticket destination metadata and stable transaction-derived ID. Extend the browser flow to show the buyer's account notification and tickets after purchase.

- [x] **Step 2: Run focused tests and confirm expected failures**

Run: `npx vitest run tests/unit/ticketPurchaseDelivery.test.ts tests/unit/ticketPurchaseNotification.test.ts`

Expected: FAIL for missing local ticket-account visibility or notification destination behavior; existing transport-isolation assertions remain unchanged.

- [x] **Step 3: Persist the account relationship and return owned tickets**

Attach the authenticated buyer ID to each confirmed ticket record. Keep PostgreSQL as the durable source when configured; in local simulation, store the owner association with the server-managed ticket JSON and make `/api/tickets/mine` filter by the session user. Deduplicate ticket-map aliases by ticket ID before returning results.

- [x] **Step 4: Verify independent notification and delivery outcomes**

Ensure the purchase notification is persisted with transaction, event, ticket ID(s), and a route to “Meus bilhetes”. Keep notification, email, and SMS attempts independent; failures return their own state and do not change issued tickets or suppress remaining delivery attempts. Logs and response objects must not include PINs, message bodies, or recipient PII.

- [x] **Step 5: Run focused regressions**

The authenticated API integration was run against a fresh, isolated simulation-only server. After explicit authorization, `npm run db:migrate` applied all 10 SQL files to the configured local PostgreSQL database. The new `ticket_reservations` table (8 columns) and its active-inventory index were verified, and `/api/health` reports the database connected. No PostgreSQL-backed purchase was submitted during migration verification; payment, email, and SMS integrations remain simulated.

Migration caveat: `003_reviews_schema.sql` backfills legacy reviews with generated IDs, so rerunning the all-files migration script can duplicate those rows if legacy review arrays exist. The pre-migration database had zero such arrays; do not rerun the script against legacy review data until that backfill is made idempotent.

Commit deferred for the same worktree-safety reason noted in Task 4: several required source files are pre-existing untracked content and cannot be staged as a precise task diff.

Run: `npx vitest run tests/unit/ticketPurchaseDelivery.test.ts tests/unit/ticketPurchaseNotification.test.ts`

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: PASS; every confirmed ticket is visible only to its buyer, the account notification is stable and actionable, and simulated email/SMS explicitly say not sent.

```powershell
git add server.ts server/postgresTicketService.ts server/ticketPurchaseDeliveryService.ts src/components/MyTicketsPanel.tsx src/App.tsx src/services/notificationService.ts tests/unit/ticketPurchaseDelivery.test.ts tests/unit/ticketPurchaseNotification.test.ts tests/ticket-purchase-modal.spec.ts
git commit -m "fix: deliver confirmed tickets to buyer accounts" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: Isolate the Purchase Use Case Behind DDD Ports

**Files:**
- Create: `server/ticketPurchaseUseCase.ts`
- Modify: `server.ts`
- Modify: `server/ticketPurchaseDomain.ts`
- Modify: `server/ticketCatalogService.ts`
- Modify: `tests/unit/ticketPurchaseUseCase.test.ts`
- Verify: `tests/unit/simulatedAdapters.test.ts`, `tests/unit/ticketPurchaseDelivery.test.ts`

**Interfaces:**
- Produces `executeTicketPurchase(command, ports): Promise<TicketPurchaseResult>` as the application use case called by the Express route.
- `command` contains authenticated buyer identity, event ID, ticket type ID, quantity, validated holder/contact data, accepted policy version/time, payment method, and optional idempotency key; it does not accept client-authoritative price, event title, category name, or fees.
- `ports` contain `TicketCatalogPort`, `TicketInventoryPort`, `TicketRepositoryPort`, `TicketPurchaseIdempotencyPort`, the payment adapter, and post-confirmation delivery dependencies. `TicketPurchaseIdempotencyPort` exposes `get(key: string): Promise<TicketPurchaseResult | null>` and `store(key: string, result: TicketPurchaseResult): Promise<void>`. `TicketRepositoryPort` exposes `issue(reservationId: string, tickets: TicketForValidation[], buyerUserId: string): Promise<TicketForValidation[]>`. Reuse `PaymentProviderAdapter`, `EmailDeliveryPort`, and `SmsDeliveryPort`; do not create parallel provider abstractions.
- Produces `TicketPurchaseTransaction` with `id`, `providerRef`, `providerMode: PaymentProviderMode`, `amountXOF`, and `status: 'confirmed_api' | 'pending_provider' | 'failed'`; the HTTP adapter maps it to the existing transaction response shape.
- `TicketPurchaseResult` is `{ status: 'confirmed'; transaction: TicketPurchaseTransaction; quote: TicketPurchaseQuote; tickets: TicketForValidation[]; delivery: TicketPurchaseDeliveryResult } | { status: 'pending'; transaction: TicketPurchaseTransaction; reservationExpiresAt: string } | { status: 'rejected'; reason: 'invalid_offer' | 'invalid_policy' | 'inventory_unavailable' | 'payment_failed'; message: string }`. The route maps these states to the existing HTTP response/status contract (`200`, `202`, `400`, `404`, `409`, or `502` as appropriate).

- [x] **Step 1: Add failing use-case tests with fake ports**

Test confirmed simulation calls catalog, quote, reservation, payment, ticket issuance, and delivery in order. Test pending payment returns no valid tickets and skips delivery. Test payment failure releases inventory and returns an explicit failure. Test invalid offer/stock returns before payment. Test delivery/notification failures remain isolated after ticket issuance. Test identical idempotency keys return the stored result without invoking payment or ticket persistence twice.

- [x] **Step 2: Run the focused use-case tests and confirm expected failures**

Run: `npx vitest run tests/unit/ticketPurchaseUseCase.test.ts`

Expected: FAIL because the application use case is not extracted.

- [x] **Step 3: Implement the use case and thin HTTP adapter**

Move purchase orchestration, including idempotency result lookup/storage, from `server.ts` into `executeTicketPurchase`. Leave request parsing, authentication/session lookup, idempotency-key syntax validation, audit transport, and HTTP status mapping in the route. Compose the existing simulated payment/email/SMS adapters at server startup; do not activate transports from environment variables.

- [x] **Step 4: Run end-to-end verification**

Run: `npx vitest run tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseCatalog.test.ts tests/unit/ticketPurchaseUseCase.test.ts tests/unit/ticketPurchaseDelivery.test.ts tests/unit/ticketPurchaseNotification.test.ts`

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Run: `npm run check`

Run: `npm run build`

Expected: PASS; checkout, pending behavior, receipt, account tickets, notifications, and simulated adapter composition remain consistent.

- [ ] **Step 5: Commit**

Commit deferred: the checkout contains pre-existing untracked source files, including application surfaces needed by Task 3. Staging whole files would capture unrelated local content, so only a clean, scoped commit can be made after the baseline is clarified.

```powershell
git add server/ticketPurchaseUseCase.ts server.ts server/ticketPurchaseDomain.ts server/ticketCatalogService.ts tests/unit/ticketPurchaseUseCase.test.ts
git commit -m "refactor: isolate ticket purchase use case" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Dependencies

- Task 1 is prerequisite to Tasks 2, 3, and 4.
- Task 2 depends on Task 1's authoritative response contract.
- Task 3 depends on Task 1's confirmed ticket identity and Task 2's post-purchase flow.
- Task 4 depends on Tasks 1–3 so orchestration is extracted only after the working behavior and response contract are verified.
