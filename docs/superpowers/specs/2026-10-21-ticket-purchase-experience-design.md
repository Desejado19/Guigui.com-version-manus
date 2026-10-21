# Ticket Purchase Experience and DDD Boundaries

**Status:** Approved in conversation; awaiting user review of this document
**Date:** 2026-10-21

## Goal

Make the ticket purchase flow reliable and professional from checkout through
ticket delivery, while keeping payment, email, and SMS integrations simulated
and preserving clear DDD boundaries for future providers.

## User-approved behavior

- Orange Money and Telecel remain simulated payment methods.
- Simulated payment confirmation is automatic by default.
- A pending payment never issues tickets or reports successful delivery.
- A confirmed purchase gives the buyer an organized receipt and keeps issued
  tickets accessible in the buyer's account.
- The buyer's account receives an internal purchase notification.
- Email and SMS remain simulations and must be reported as not sent.
- A delivery or notification failure must not undo tickets already issued
  after payment confirmation.
- The work is performed in this order: checkout; post-purchase experience;
  ticket inbox and notifications; DDD boundaries and simulated adapters.

## Starting point

The existing system already contains significant parts of this behavior:
ticket categories and quantity selection, a client-side fee summary, a
purchase endpoint with an idempotency key, simulated payment and delivery
ports, a post-purchase ticket receipt, account ticket retrieval, and internal
notification persistence. The implementation must first verify these flows
and tests, then make only the changes needed to close verified gaps. Existing
working behavior must not be replaced wholesale.

## Scope

### 1. Checkout and simulated payment

- Present the selected event, ticket category, availability, quantity,
  applicable fees, total, buyer information, payment method, and ticketing
  policy before submission.
- Orange Money and Telecel remain the only selectable payment methods.
- The server is authoritative for event and ticket type, current price,
  availability, fees, buyer identity and contact, and policy acceptance.
  Client-provided totals are display data and must not authorize a charge.
- Enforce the existing purchase idempotency contract so retries do not create
  duplicate orders or tickets.
- The simulated adapter returns an explicit simulated mode and state.
  Automatically confirmed simulations proceed to ticket issuance.
- If a payment is pending, keep the order pending, disclose that it is
  simulated, and do not issue or expose valid tickets.
- Do not sell beyond available inventory or alter purchase terms after
  confirmation.

### 2. Post-purchase experience

- Show a responsive, accessible confirmation/receipt after a confirmed
  purchase.
- Present event, ticket category, quantity, itemized price/fees, final total,
  payment simulation state, transaction reference, and every issued ticket.
- Make the issued tickets reachable from the user's account and receipt.
- Make simulated email/SMS states explicitly say that no external message was
  sent; do not imply delivery.
- Present pending payment as a separate state, not as a successful purchase.

### 3. Ticket account inbox and notifications

- Persist confirmed tickets against the authenticated buyer so they appear in
  the buyer's ticket list.
- Persist an internal notification for the buyer that links or directs them
  to their tickets and identifies the purchase.
- Treat internal notification persistence, simulated email, and simulated SMS
  as independent post-issuance actions; failure in any of them must not
  roll back the issued tickets or suppress the other actions.
- Surface notification or delivery failure states clearly. Do not expose
  contact data, message bodies, or ticket PINs in logs or status responses.
- Do not claim that an email or SMS was sent or delivered.

### 4. DDD and integration boundaries

- Retain the existing typed ports and simulated adapters where they already
  satisfy the requirements.
- Keep ticket purchase rules in the domain/application boundary rather than
  coupling them to React, HTTP request details, provider APIs, or database
  implementation details.
- Extract only purchase orchestration that is necessary to make the flow
  testable and maintainable; do not conduct a repository-wide refactor.
- Keep the server composition root on simulated payment, email, and SMS
  adapters only. Environment variables must not activate external providers.
- Preserve existing API response compatibility where practical and retain
  historical records without destructive data migrations.

## Error handling

- Invalid, stale, or tampered checkout input returns an explicit error and
  creates no ticket.
- Insufficient inventory and duplicate submission are handled deterministically.
- Pending payment responses identify the simulated state and never return
  valid issued tickets.
- Failures persisting a notification or simulating email/SMS are reported in
  their respective delivery states and do not roll back confirmed tickets.
- Logs may contain transaction/reference identifiers and error class only;
  never include buyer PII, ticket PINs, or message content.

## Verification

- Unit tests cover server-authoritative price and fee calculation, invalid
  policy acceptance, stock limits, idempotent retries, simulated confirmation,
  pending payment without ticket issuance, and isolated delivery/notification
  failures.
- Component tests cover checkout totals and receipt/pending state.
- Browser tests cover the complete purchase flow, tickets in the account,
  notification visibility, truthful simulated delivery copy, and responsive
  receipt behavior.
- Run focused tests first, followed by TypeScript checking and the production
  build for changed surfaces.
- Preserve existing ticket, payment, notification, and integration tests.

## Out of scope

- Activating or implementing real Orange Money, Telecel, email, or SMS
  providers.
- Reworking unrelated messaging, business-highlight, or general application
  architecture.
- Deleting or rewriting historical ticket/payment records.
- Adding payment or notification features not required for the approved
  purchase flow.
