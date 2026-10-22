# Ticketing Purchase Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the existing ticket purchase flow into `server/modules/ticketing` while preserving HTTP behavior, payment/inventory ordering, and persistence.

**Architecture:** Keep `server.ts` as the composition root. Move purchase rules, orchestration, and ports into the `ticketing` module; add an injectable HTTP adapter for the existing endpoint; connect current PostgreSQL/JSON, payment, fee, and delivery implementations through explicit dependencies.

**Tech Stack:** Node.js, TypeScript, Express 4, Vitest, Playwright.

**Spec:** [2026-10-22-guigui-ticketing-purchase-module-design.md](../specs/2026-10-22-guigui-ticketing-purchase-module-design.md)

## Global Constraints

- Preserve contracts HTTP, regras de compra e persistência.
- `server.ts` continua como composition root.
- Não introduzir microserviços, uma nova API pública, alteração de schema ou novos fornecedores de pagamento e entrega.
- Não alterar seleção, transações, consultas, estados ou estrutura de dados dos adaptadores PostgreSQL e JSON local.
- APIs gerais de pagamentos, webhooks, reconciliação, confirmação e reembolso ficam fora do módulo `ticketing`.
- Cadastro de eventos/tipos de bilhete, consulta de bilhetes próprios, reenvio, lookup, scanner, validação e ciclo de vida ficam fora desta fatia.
- `identity-access` continua responsável pela resolução da sessão; usar os contratos atuais de auditoria.
- Preservar a semântica atual do cache e lock de idempotência em memória; não prometer coordenação distribuída ou durabilidade adicional.
- Falhas operacionais não podem ser convertidas em sucesso; falhas de entrega após emissão não revertem compra nem bilhetes confirmados.
- Não alterar frontend, credenciais, rotas públicas, mensagens/códigos/status HTTP ou formatos de resposta.
- Não incluir alterações de outras worktrees; stage apenas paths explicitamente listados em cada tarefa.
- Sem novas dependências, migrações ou alterações de schema.
- Executar `npm run test:unit`, `npm run check` e `npm run build` antes de concluir a fatia.

## Review Focus

- Corpo ausente, malformado ou com quantidade inválida: preservar validação atual e não criar reserva/intenção de pagamento; cobrir no teste HTTP de validação.
- Oferta alterada entre a validação do checkout e o caso de uso: preservar validação autoritativa e mensagens/códigos de categoria, preço e total; cobrir no teste HTTP de conflito.
- Duas requisições concorrentes com a mesma chave: a segunda deve aguardar e reproduzir o resultado cacheado, sem pagamento/emissão duplicados; cobrir no teste HTTP concorrente.
- Erro operacional ao resolver sessão/conta, persistir transação ou emitir bilhete: preservar o status e corpo operacional atual, libertar lock e não fabricar sucesso; cobrir nos testes HTTP de erro e limpeza.
- Falha ao enviar email/SMS/notificação depois da emissão: compra mantém estado `confirmed`, entrega indica falha e inventário não é libertado; preservar teste do caso de uso e validar resultado confirmado no adaptador.

---

### Task 1: Isolate purchase domain, application, and fee policy

**Files:**
- Add tracked prerequisites: `src/data/monetizationCatalog.ts`, `src/data/initialData.ts`, `src/data/adminStaffData.ts`, `src/data/auditLogsData.ts`, `src/data/notificationsData.ts`, and `src/data/subscriptionCatalog.ts` (currently ignored by `.gitignore`; copied only after user approval and SHA256-verified against the preserved checkout and validated `main` overlay)
- Create: `server/modules/ticketing/domain/ticketPurchaseDomain.ts`
- Create: `server/modules/ticketing/application/ticketPurchasePorts.ts`
- Create: `server/modules/ticketing/application/purchaseTicket.ts`
- Modify: `server.ts` (switch current purchase call sites to the module API and fee-policy port)
- Modify: `server/ticketPurchaseDomain.ts` (remove after its consumers move)
- Modify: `server/ticketPurchasePorts.ts` (remove after its consumers move)
- Modify: `server/ticketPurchaseUseCase.ts` (remove after its consumers move)
- Modify: `server/ticketCatalogService.ts` (consume the module's `TicketOffer` contract)
- Modify: `server/ticketInventoryService.ts` (consume the module's `TicketOffer` and `TicketInventoryPort` contracts)
- Modify: `server/postgresTicketService.ts` (consume the module's `TicketOffer` contract)
- Modify: `tests/unit/ticketPurchaseCatalog.test.ts`
- Modify: `tests/unit/ticketInventoryService.test.ts`
- Modify: `tests/unit/ticketPurchaseDomain.test.ts`
- Modify: `tests/unit/ticketPurchaseUseCase.test.ts`

**Interfaces:**
- Produces `TicketFeeBreakdown` with the current `calculateTicketFees` fields: `grossTicketValue`, `percentageFee`, `fixedFee`, `platformRevenue`, `buyerShare`, `organizerShare`, `buyerTotal`, `organizerNet`, `feePayer`, and `currency`.
- Produces `TicketFeePolicyPort.calculate(input: { unitPriceXOF: number; quantity: number }): TicketFeeBreakdown`.
- Produces `TicketPurchaseQuote` and `quoteTicketPurchase(input: { offer: TicketOffer; quantity: number; feePolicy: TicketFeePolicyPort }): TicketPurchaseQuoteResult`.
- Produces `TicketPurchaseCommand`, `TicketPurchaseResult`, `TicketPurchaseUseCasePorts`, and `executeTicketPurchase(command, ports)` from `server/modules/ticketing/application/purchaseTicket.ts`.
- `TicketPurchaseUseCasePorts` consumes the fee policy port instead of `MonetizationCatalog`; payment, inventory, catalog, ticket repository, transaction, delivery, idempotency and `TicketForValidation` behavior remain structurally compatible.
- Existing `TicketForValidation` remains the compatibility DTO from `server/validationService.ts`; this task does not extract ticket validation or change its persistence format.

- [ ] **Step 1: Record the approved fee-policy source in this branch**

Stage only the six approved copied files despite the existing `data/` ignore rule:

```powershell
git add -f -- src/data/monetizationCatalog.ts src/data/initialData.ts src/data/adminStaffData.ts src/data/auditLogsData.ts src/data/notificationsData.ts src/data/subscriptionCatalog.ts
git diff --cached --check
git diff --cached --name-only
```

Confirm the six staged paths are exactly these prerequisites and their hashes match the values recorded in the execution ledger. Do not stage any other ignored `data/` content.

- [ ] **Step 2: Establish the focused baseline**

Run `npm run test:unit -- tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseUseCase.test.ts`.

Expected: existing domain/use-case tests pass before module extraction. If the runner is unavailable because dependencies are absent, restore exactly from the lockfile with `npm ci`, then rerun; do not change manifests or lockfiles.

- [ ] **Step 3: Move domain and application tests to the module API**

Update existing tests to import `quoteTicketPurchase` and `executeTicketPurchase` from the module paths. Preserve all current assertions for fee totals, stock limits, payment state, operation order, delivery failure, and idempotency. Update the test fixtures to inject a `TicketFeePolicyPort` backed by `calculateTicketFees(DEFAULT_MONETIZATION_CATALOG, unitPriceXOF, quantity)`.

- [ ] **Step 4: Implement the domain fee-policy port**

Create the module domain API listed above. Keep the current quantity ceiling of `100`, the existing rejection reasons, and the current fee arithmetic; do not import `src/types.ts` or `src/data/monetizationCatalog.ts` from the domain.

- [ ] **Step 5: Implement the application use case and ports**

Move the existing use-case behavior with only the fee-policy dependency changed. Update the current `server.ts` import, quote call and `executeTicketPurchase` port object to use the new module API and `TicketFeePolicyPort`. Preserve the order reserve → payment → transaction/fulfillment → ticket issue → reservation confirmation → transaction update → delivery; preserve pending, failed, confirmed, error, and idempotency semantics.

- [ ] **Step 6: Run the focused tests**

Run: `npm run test:unit -- tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseUseCase.test.ts`

Expected: PASS with all existing assertions intact. Then run `npm run check`; expected: PASS with the current route already consuming the new module API.

- [ ] **Step 7: Remove the old implementation files and commit**

Remove the old `server/ticketPurchaseDomain.ts`, `server/ticketPurchasePorts.ts`, and `server/ticketPurchaseUseCase.ts` after all imports have moved. Stage only those paths, `server.ts`, the three service/test consumers listed above, the new module files, the six approved prerequisites, and the updated purchase tests. Commit as `refactor: move ticket purchase rules into ticketing module`, including the required `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer.

---

### Task 2: Add a testable ticket-purchase HTTP adapter

**Files:**
- Create: `server/modules/ticketing/adapters/http/ticketPurchaseHandler.ts`
- Create: `tests/unit/ticketPurchaseHttp.test.ts`

**Interfaces:**
- Produces `createTicketPurchaseHandler(dependencies): RequestHandler`.
- Dependencies inject `validatePurchaseInput(input: PurchaseInput): ValidationResult<NormalizedPurchase>`, `resolveSession(request: Request): Promise<SessionContext | null>`, `findAccount(userId: string): Promise<PublicUser | null>`, `isProduction: boolean`, `ticketSigningSecretConfigured: boolean`, `catalog: TicketCatalogPort`, `feePolicy: TicketFeePolicyPort`, `idempotency: { cleanup(): void; get(key: string): Promise<TicketPurchaseResult | null>; acquire(key: string): Promise<() => void> }`, `executePurchase(command: TicketPurchaseCommand): Promise<TicketPurchaseResult>`, `requestIdFrom(request: Request): string`, and `recordAudit(event: Omit<AuditEntry, 'id' | 'requestId' | 'createdAt'> & { requestId?: string }): void`.
- `PurchaseInput`, `ValidationResult`, `NormalizedPurchase`, `SessionContext`, `PublicUser`, `AuditEntry`, `TicketCatalogPort`, `TicketFeePolicyPort`, `TicketPurchaseCommand`, and `TicketPurchaseResult` are imported from existing module contracts; do not duplicate them.
- `acquire(key)` waits for an in-flight same-key operation and returns a release function; after acquiring, the handler re-reads the cached result before executing the purchase. `cleanup()` preserves the current endpoint's idempotency cleanup call.
- The handler keeps HTTP-specific parsing and response mapping in this adapter. It keeps `POST /api/tickets/purchase` path mounting in the composition root and preserves exact current response status/body contracts.

- [ ] **Step 1: Write failing HTTP contract tests**

Create `tests/unit/ticketPurchaseHttp.test.ts` using the native Express listener/fetch pattern from `tests/unit/identityAccessMiddleware.test.ts`. Cover these named cases and assert exact status and response shape:

1. `rejects an unauthenticated purchase` with status `401`, error `Inicie sessão para comprar bilhetes.`, and code `AUTHENTICATION_REQUIRED`; also cover unavailable account with the existing 401 message.
2. `rejects invalid purchase input before catalog, inventory, or payment calls` with status `400`, code `VALIDATION_ERROR`, and the existing `issues` field.
3. `rejects a stale ticket type, unit price, or checkout total` with status `409` and the existing respective codes `TICKET_TYPE_MISMATCH`, `TICKET_PRICE_MISMATCH`, and `TICKET_TOTAL_MISMATCH`.
4. `rejects an overlong idempotency key with INVALID_IDEMPOTENCY_KEY`.
5. `returns a cached idempotent result without executing the purchase again`.
6. `waits for a concurrent same-key request and replays the stored result`.
7. `maps confirmed, pending, and rejected results to the existing status/body contracts`: confirmed `200`, pending `202`, invalid offer `404/TICKET_OFFER_NOT_FOUND`, invalid policy `400/VALIDATION_ERROR`, invalid quantity `400/INVALID_TICKET_QUANTITY`, inventory/sales closed `409/TICKET_INVENTORY_UNAVAILABLE`, and payment failed `502/TICKET_PAYMENT_FAILED`.
8. `records the existing pending and confirmed audit events`, including action names and request ID.
9. `returns the current operational error response and always releases the idempotency lock`: status `500`, code `TICKET_PURCHASE_FAILED`, and the request ID, without leaking the original error.

For concurrent retries, assert one purchase-use-case invocation and identical semantic transaction/ticket results. For the error case, assert the original error does not appear in the public body and the lock-release callback runs.

- [ ] **Step 2: Run the HTTP tests to verify they fail**

Run: `npm run test:unit -- tests/unit/ticketPurchaseHttp.test.ts`

Expected: FAIL because `ticketPurchaseHandler.ts` does not exist.

- [ ] **Step 3: Implement the injected handler**

Implement `createTicketPurchaseHandler(dependencies): RequestHandler` with dependencies for validation, buyer/session lookup, signing readiness, catalog lookup, fee quote, local idempotency cache/lock, use-case execution, request ID, and auditing. Reuse the established Portuguese messages and status/code mappings in the spec; preserve lock cleanup in `finally`.

- [ ] **Step 4: Run HTTP and existing purchase tests**

Run: `npm run test:unit -- tests/unit/ticketPurchaseHttp.test.ts tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseUseCase.test.ts`

Expected: PASS, including all HTTP contract and existing application cases.

- [ ] **Step 5: Commit the HTTP adapter**

Stage only `ticketPurchaseHandler.ts` and `ticketPurchaseHttp.test.ts`. Commit as `feat: add ticket purchase HTTP adapter` with the required co-author trailer.

---

### Task 3: Compose existing adapters and mount the preserved route

**Files:**
- Modify: `server.ts`
- Modify: `tests/ticket-purchase-modal.spec.ts` only if a regression in the existing flow is demonstrated

**Interfaces:**
- Consumes `createTicketPurchaseHandler`, `TicketPurchaseUseCasePorts`, `quoteTicketPurchase`, and `executeTicketPurchase` from Tasks 1 and 2.
- Produces the existing `app.post('/api/tickets/purchase', createTicketPurchaseHandler(...))` route wired to existing session/account lookup, validation, signing secret, request ID, audit, fee policy and payment adapters.
- Existing `getTicketOffer`, `ticketInventory`, ticket persistence, `paymentAdapters`, `deliverConfirmedTicketPurchase`, `recordMonetizationFulfillment`, `purchaseIdempotency`, `purchaseIdempotencyLocks`, and reservation TTL retain their current backing implementations and semantics.

- [ ] **Step 1: Compose the fee-policy adapter**

In `server.ts`, adapt the current normalized monetization catalog to `TicketFeePolicyPort.calculate` by calling the existing `calculateTicketFees` with the server-owned policy. Do not import frontend types into the ticketing domain/application.

- [ ] **Step 2: Compose purchase use-case ports**

Create `createTicketPurchaseUseCasePorts(): TicketPurchaseUseCasePorts` in `server.ts`, next to the existing ticket-purchase composition. Move the inline adapters for catalog, inventory, ticket issuance, idempotency, payment, transaction persistence/fulfillment, ticket factory, and delivery into that function. The handler's `executePurchase` dependency calls `executeTicketPurchase(command, ticketPurchaseUseCasePorts)`. Preserve current PostgreSQL/JSON writes, signing, identifiers, TTL, and audit behavior.

- [ ] **Step 3: Replace the inline route body with the handler**

Mount `createTicketPurchaseHandler` at the existing route. Remove the duplicated local validation/cache/lock/response-mapping logic only after the adapter tests cover it. Keep unrelated ticket and general payment routes untouched.

- [ ] **Step 4: Run focused tests and type-check**

Run:

```powershell
npm run test:unit -- tests/unit/ticketPurchaseHttp.test.ts tests/unit/ticketPurchaseDomain.test.ts tests/unit/ticketPurchaseUseCase.test.ts tests/unit/ticketPurchaseDelivery.test.ts tests/unit/ticketPurchaseCatalog.test.ts
npm run check
```

Expected: all selected tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit composition**

Stage only `server.ts` and any focused composition file created in this task. Commit as `refactor: compose ticket purchase through ticketing module` with the required co-author trailer.

---

### Task 4: Verify the complete ticket-purchase regression surface

**Files:**
- No product files unless a regression from Tasks 1–3 is found
- Test: `tests/ticket-purchase-modal.spec.ts`

**Interfaces:**
- Verifies the public route and UI remain compatible; no new API or UI interface is produced.

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`

Expected: PASS; no existing tests removed, skipped, or weakened by this extraction.

- [ ] **Step 2: Run the existing browser purchase regression**

Run: `npx playwright test tests/ticket-purchase-modal.spec.ts`

Expected: PASS against the existing setup. If browser/runtime prerequisites are unavailable, report the exact blocker; do not replace this verification with a different test.

- [ ] **Step 3: Run project check and build**

Run:

```powershell
npm run check
npm run build
```

Expected: both commands pass. Existing non-blocking chunk-size warnings may remain.

- [ ] **Step 4: Review scope and Git state**

Run `git diff --check`, `git status --short --branch`, and inspect the complete branch diff. Confirm only ticketing module files, the approved fee-policy prerequisite, directly related tests, and `server.ts` composition changed; no `.env`, ZIP, runtime data, frontend, or general payment route changes were included.

- [ ] **Step 5: Commit any documentation adjustment only if behavior differs**

Update the approved spec only if implementation evidence requires a clarified boundary; otherwise leave it unchanged. Any adjustment must be reviewed and committed separately with the required co-author trailer.
