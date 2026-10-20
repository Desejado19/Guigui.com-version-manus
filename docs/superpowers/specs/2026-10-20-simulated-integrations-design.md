# Simulated Integrations and Provider Boundaries

**Status:** Design approved; awaiting user review before implementation planning  
**Date:** 2026-10-20

## Goal

Keep ticket purchases and related account communications usable while payment,
SMS, and email provider APIs are unavailable. The application must be ready to
accept real provider adapters later, while this phase guarantees that those
external services are never contacted.

## Approved scope

- Run Orange Money and Telecel payments through simulated adapters only.
- Simulate ticket email, team-invitation email, ticket-holder SMS, and ticket
  resend SMS. No SMTP or SMS gateway request may be made, even if credentials
  or endpoint variables are present.
- Preserve real application behavior for ticket creation, internal
  notifications, and database persistence.
- Remove `manual_transfer` from the purchase UI, payment provider contracts,
  and routes that create or accept new manual payments.
- Keep historical transaction records; do not delete them. No new manual
  transfers are accepted or processed.
- Leave unrelated external integrations, such as content moderation, outside
  this change.

## Architecture

Use ports-and-adapters boundaries rather than coupling purchase workflows to
provider SDKs, SMTP, or HTTP details:

- Payment, email, and SMS ports expose typed, asynchronous operations and
  explicit result states.
- Simulated adapters are the only adapters composed by the running
  application in this phase. They create deterministic simulation references
  and perform no outbound network I/O.
- The application services depend on those ports. The server composition
  root selects the simulated adapters explicitly; environment variables cannot
  switch the running system to a real provider.
- Real provider adapters are a future implementation behind the same
  contracts; they are not built or activated in this phase.
- Internal notifications remain an application capability and are not modeled
  as an external delivery provider.

The existing SMTP implementation may remain isolated as a future adapter, but
ticket, invitation, and resend use cases must not call it directly. SMS resend
and purchase delivery must likewise go through the composed SMS port.

## Purchase and delivery behavior

1. The purchase use case validates the request and creates the transaction
   using the payment port.
2. Orange Money and Telecel simulation results retain the existing configurable
   pending/confirmed behavior, but are always identified as simulated. A
   simulated confirmation may issue tickets; it must never be presented as a
   real provider payment.
3. Manual transfer is no longer an accepted provider for new transactions.
4. After a simulated payment confirmation, the application issues tickets,
   persists its internal notification, and invokes email/SMS ports.
5. Email and SMS return `simulated` states and stable references. They do not
   claim that a message was sent or delivered. The receipt clearly explains
   that no external message was sent and that tickets remain available in the
   account.
6. A delivery failure does not undo an already-confirmed simulated purchase.
   Payment failure or pending status does not issue tickets.

Only status and reference metadata are returned or recorded for simulated
communications. Message bodies, PINs, credentials, and provider secrets must
not be written to logs.

## Compatibility and migration

- Remove manual transfer from client-side choices, request validation, payment
  adapter registration, and server routes accepting new manual payment
  operations.
- Preserve stored historical transactions and ticket records; no destructive
  data migration is part of this change.
- Keep unrelated email/SMS formatting and ticket content generation reusable
  where appropriate, but move delivery behind the ports.
- Update environment documentation so SMTP and SMS credentials cannot be
  mistaken for active delivery configuration during simulation-only operation.

## Error handling

- A simulated payment result includes its mode and state in the API response.
- A simulated email/SMS result is displayed as simulated/not sent, never
  successful delivery.
- Unexpected delivery failures are reported with transaction/reference
  identifiers and error class only; they do not expose recipient PII or
  message contents.
- Failure to persist an internal notification is surfaced as a notification
  failure without rolling back already-issued tickets.
- Provider selection rejects unsupported methods, including
  `manual_transfer`, before issuing tickets.

## Verification

- Unit tests prove that payment, email, and SMS simulation adapters return
  deterministic results and perform no outbound network requests.
- Tests set SMTP/SMS credentials and endpoints deliberately, then verify the
  application still selects only simulation adapters.
- Purchase tests cover pending and confirmed simulated payments, delivery
  statuses, failure isolation, and internal notification persistence.
- Tests verify that `manual_transfer` is absent from supported providers and
  rejected by request handlers, while historical records are untouched.
- Playwright verifies that the purchase receipt labels payment and
  communications as simulated/not sent and that tickets remain accessible.
- Run TypeScript checks, unit tests, locale checks, focused Playwright tests,
  and the production build.

## Out of scope

- Implementing or selecting real Orange Money, Telecel, SMTP, or SMS providers.
- Changing unrelated third-party integrations.
- Deleting historical manual-payment data.
