# Guigui.com Modular DDD Migration Implementation Plan

> **For agentic workers:** Before implementation, use `executing-plans` or `subagent-driven-development` as selected by the user. This document is the migration roadmap; implementation checklists live in the separately approved plan for each context.

**Goal:** Evolve the Guigui.com backend into a modular monolith one bounded context at a time, preserving current routes, SPA behavior, persistence options, and deployment model.

**Architecture:** Keep Express and `server.ts` as the composition root while responsibilities move into the seven modules in the approved capability map. Existing routes and persistence adapters remain in place as compatibility boundaries; each context gets its own reviewed specification and small implementation plan before code changes. No module is implemented in parallel with another context.

**Tech Stack:** Node.js, TypeScript, Express 4, PostgreSQL via `pg`, local JSON persistence, Vitest, Playwright, Vite.

**Status:** Approved by the user on 2026-10-23; implementation of each context still requires approval of its context-specific specification and plan.

**Spec:** [`docs/superpowers/specs/2026-10-22-guigui-modular-ddd-migration-design.md`](../specs/2026-10-22-guigui-modular-ddd-migration-design.md)

**Capability map:** [`CAPABILITY-MAP.md`](../../../CAPABILITY-MAP.md)

## Global Constraints

- "Manter o monólito num único processo."
- "Preservar PostgreSQL e JSON local como adaptadores suportados, sem fallback silencioso quando tal puder ocultar falha ou dividir escritas."
- "Preservar endpoints, formatos de resposta, permissões e comportamento observável, salvo mudança aprovada separadamente."
- "A extração não implica mudança de schema, migração de dados, alteração de identificadores ou troca de fornecedor de persistência."
- "A SPA e os seus componentes não são reorganizados nesta iniciativa."
- "Uma falha de integração deve ser explícita e diagnosticável. Não substituir erros por respostas de sucesso vazias, não esconder falhas com capturas genéricas e não alterar silenciosamente a persistência escolhida."
- "Não introduzir um barramento genérico de eventos ou transações distribuídas sem necessidade comprovada e decisão aprovada."
- Não alterar rotas, schema, dados, credenciais, `.env`, dependências, CI ou fornecedores reais sem aprovação específica.
- Aplicar TDD em cada fatia: escrever o teste, observar a falha esperada, implementar o mínimo e voltar a validar.
- Não marcar tarefas de planos anteriores como concluídas sem confirmar a implementação e as verificações.
- Cada contexto requer especificação e plano próprios, aprovação do utilizador e validação antes do contexto seguinte.
- Não criar commits sem autorização explícita; preservar todas as alterações preexistentes fora do escopo.

## Review Focus

- **Modo JSON e PostgreSQL configurado:** o estado local sem base continua saudável; PostgreSQL configurado mas indisponível não vira fallback silencioso. Cada plano de plataforma/persistência deve fixar esses casos com testes de saúde e integração isolada.
- **Sessão ausente, role não autorizada ou falha de leitura:** conservar os contratos `401`/`403`, os dados de auditoria e propagar falhas operacionais. Fixar em testes de aplicação, middleware e rotas `identity-access`.
- **Rotas, permissões e formatos de resposta:** manter os consumidores existentes durante a extração. Fixar os contratos das rotas afetadas e executar regressão E2E aplicável em cada contexto.
- **Compra, pagamento, reserva e emissão:** preservar a semântica transacional existente sem escrita dupla ou eventos distribuídos introduzidos por conveniência. Fixar em testes de integração dos contextos de pagamento e bilhetes.
- **Acesso entre contextos:** consumidores usam contratos publicados, não tabelas, ficheiros ou módulos internos alheios. Cada plano deve testar ou inspecionar explicitamente as dependências permitidas e a ausência de ciclos.

---

## Roadmap e tarefas

As tarefas abaixo coordenam a migração. Os passos de código, ficheiros concretos, testes nomeados e critérios detalhados pertencem aos planos de contexto indicados ou a criar antes da implementação. O checklist deste roadmap não substitui esses planos.

### Registo de baseline (preencher durante a Task 1)

| Verificação | Resultado | Evidência |
|---|---|---|
| `npm run check` | Passou | `tsc --noEmit`, exit code 0 |
| `npm run test:unit` | Passou | 57 ficheiros; 422 testes passaram e 21 foram ignorados. O log também contém avisos React `act(...)` e mensagens de erro emitidas por testes de falha. |
| `npm run test:integration` com base isolada, quando disponível | Não executado nesta baseline | `TEST_DATABASE_URL` não estava configurada; não se usou a base de aplicação. A execução PostgreSQL anterior registada no histórico não foi usada como substituto desta baseline. |
| `npm run build` | Passou com aviso | Vite, bundle do servidor e preflight gerados; permaneceu o aviso existente de chunk frontend acima de 500 kB. |
| Estado dos módulos e planos anteriores | Parcialmente extraídos | `platform-foundation` contém health, runtime, hosting e observabilidade; `identity-access` contém resolução de sessão e middleware já compostos por `server.ts`. As quatro listas de tarefas verificadas (health, runtime, observabilidade e sessões) continuam abertas; não foram alteradas. |
| Inventário inicial de rotas | Registado | `server.ts` ainda compõe as rotas: fundação (`/api/health`, `/api/metrics`, `/metrics`); identidade (`/api/auth/*`, `/api/account/*`, convites); empresas/descoberta (`/api/businesses/*`, `/api/marketing/*`, reviews); pagamentos/monetização (`/api/payments/*`, `/api/monetization/*`); eventos/bilhetes (`/api/events`, `/api/tickets/*`); comunicação/suporte (`/api/conversations/*`, `/api/notifications/*`, `/api/support/*`); governança (`/api/moderate`, `/api/moderation/*`, rotas administrativas). A propriedade final e os consumidores serão detalhados no plano de cada contexto. |

### Fase 1: Confirmar a fundação e identidade existentes

### Task 1: Establish the migration baseline and reconcile existing plans

**Files:**
- Review: `server/modules/platform-foundation/`
- Review: `server/modules/identity-access/`
- Review: `docs/superpowers/plans/2026-10-22-guigui-platform-foundation-health.md`
- Review: `docs/superpowers/plans/2026-10-22-guigui-platform-runtime-configuration.md`
- Review: `docs/superpowers/plans/2026-10-22-guigui-http-observability.md`
- Review: `docs/superpowers/plans/2026-10-22-guigui-identity-access-sessions.md`

**Acceptance criteria:**
- [ ] Record which foundation and identity slices are implemented by comparing their code, tests, and plans; leave unverified checkboxes untouched.
- [ ] Establish a green baseline for `npm run check`, `npm run test:unit`, and `npm run build`; use `npm run test:integration` only with an isolated `TEST_DATABASE_URL`.
- [ ] Confirm the current HTTP contracts and identify remaining module-owned routes, rules, persistence, and consumers before planning additional extraction.
- [ ] Make no production-code, schema, data, environment, or unrelated working-tree changes in this task.

**Dependencies:** None.

**Verification:** Registar os resultados na tabela de baseline deste plano e comparar cada afirmação com o teste ou código relevante, não apenas com um plano antigo.

### Task 2: Complete any remaining `platform-foundation` work

**Files:**
- Use the existing health, runtime-configuration, and HTTP-observability plans listed in Task 1.
- Create a new foundation plan only if the baseline identifies an uncovered requirement in the approved migration spec.

**Acceptance criteria:**
- [x] Each platform-foundation requirement in the approved migration spec is backed by existing code/tests or a focused task in an approved foundation plan.
- [x] Preserve the health, startup, and observability contracts; do not extract business rules into the foundation.
- [x] Focused checks pass; the broader `system-health` E2E limitation is documented in the ledger and was explicitly accepted by the user before proceeding.

**Dependencies:** Task 1.

**Verification:** Use the exact test commands in the existing foundation plan(s), then run `npm run check` and `npm run build`.

### Task 3: Complete the `identity-access` context plan

**Files:**
- Review: `docs/superpowers/specs/2026-10-22-guigui-identity-access-sessions-design.md`
- Review: `docs/superpowers/plans/2026-10-22-guigui-identity-access-sessions.md`
- Create an additional identity-access specification/plan only for capabilities outside the approved sessions slice.

**Acceptance criteria:**
- [x] Verify the existing session/application/HTTP extraction and route compatibility before closing any related plan items.
- [x] Inventory remaining identity-owned authentication and authorization behavior without assuming that login, registration, MFA, or account lifecycle work is included in the sessions slice.
- [x] Approve the session specification and plan before changing that slice; require separate approval before changing any additional identity flows.
- [ ] Complete and validate the approved identity work before moving to `business-discovery`.

**Dependencies:** Tasks 1–2.

**Verification:** Run the focused identity application/middleware tests and `tests/unit/securityRoutes.test.ts`, then `npm run test:unit`, `npm run check`, and `npm run build`.

### Checkpoint: Foundation and identity

- [ ] Baseline results and implementation status are recorded without altering unrelated files.
- [ ] Platform-foundation and identity-access meet the migration spec or have explicit, approved remaining plans.
- [ ] Existing tests and route contracts remain intact.
- [ ] User review confirms readiness to migrate the next context.

### Fase 2: Migrar os contextos de negócio sequencialmente

For every context below, first inventory routes, consumers, rules, data ownership, permissions, and relevant tests. Then create and obtain approval for that context's specification and detailed implementation plan. Implement only from the approved plan, with its own TDD cycle and review checkpoint.

### Task 4: Specify and migrate `business-discovery`

**Files:**
- Reuse as relevant: `docs/superpowers/specs/2026-10-20-business-profile-completeness-design.md` and `docs/superpowers/plans/2026-10-23-guigui-business-profile-completeness.md`.
- Create: a context-wide `business-discovery` specification and implementation plan under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Source/test file list: determine in the approved context plan after route and consumer inventory.

**Acceptance criteria:**
- [ ] Distinguish existing business-profile feature work from the full `business-discovery` module boundary.
- [ ] Document ownership of companies, directory/feed, offers, and reviews, and the published contracts needed by consumers.
- [ ] Get approval for the context specification and implementation plan before changing code.
- [ ] Complete the approved plan and verify business routes, permissions, JSON/PostgreSQL behavior, `npm run check`, and `npm run build`.

**Dependencies:** Task 3.

**Verification:** Focused unit/integration tests and the affected HTTP/E2E regressions named in the approved context plan.

### Task 5: Specify and migrate `payments-monetization`

**Files:**
- Reuse relevant existing payment, subscription, and monetization specs/plans after verifying their implementation status.
- Create: a context-wide `payments-monetization` specification and implementation plan under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Source/test file list: determine in the approved context plan after auditing payment routes, services, storage, and consumers.

**Acceptance criteria:**
- [ ] Define ownership of payments, subscriptions, commercial catalog, fees, reconciliation, and refunds.
- [ ] Preserve current payment modes and clearly identify simulations; do not configure real providers as part of extraction.
- [ ] Get approval for the context specification and implementation plan before changing code.
- [ ] Verify payment routes and persistence behavior, with no schema change or silent adapter fallback.

**Dependencies:** Task 4.

**Verification:** Focused payment/subscription/monetization tests plus relevant integration tests, `npm run check`, and `npm run build`.

### Task 6: Specify and migrate `events-ticketing`

**Files:**
- Reuse: `docs/superpowers/specs/2026-10-21-ticket-purchase-experience-design.md` and `docs/superpowers/plans/2026-10-21-ticket-purchase-experience.md` where their scope applies.
- Create: a context-wide `events-ticketing` specification and implementation plan under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Source/test file list: determine in the approved context plan after auditing event, inventory, reservation, ticket, access, and scanner flows.

**Acceptance criteria:**
- [ ] Place the already-extracted ticket-purchase use case behind the approved `events-ticketing` boundary without duplicating its business rules.
- [ ] Define how published contracts with `business-discovery` and `payments-monetization` preserve purchase and issuance semantics.
- [ ] Get approval for the context specification and implementation plan before changing code.
- [ ] Verify purchase, reservation, payment, issuance, check-in/scanner, and authorization regressions; change no schema without separate approval.

**Dependencies:** Tasks 4–5.

**Verification:** Focused ticket and payment-flow tests, PostgreSQL integration tests only against an isolated test database, relevant E2E tests, `npm run check`, and `npm run build`.

### Checkpoint: Discovery, monetization, and tickets

- [ ] All three contexts have approved ownership boundaries and plans.
- [ ] Existing business, payment, and ticket workflows remain compatible.
- [ ] Cross-context dependencies follow the approved capability map and contain no cycles.
- [ ] User review confirms readiness to continue.

### Task 7: Specify and migrate `communication-support`

**Files:**
- Create: a `communication-support` specification and implementation plan under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Source/test file list: determine in the approved context plan after auditing conversations, messages, support, notifications, and their consumers.

**Acceptance criteria:**
- [ ] Define communication-owned data/rules and its limited published-contract integrations.
- [ ] Preserve delivery modes, permissions, and current route response behavior; simulated integrations remain explicitly simulated.
- [ ] Get approval for the context specification and implementation plan before changing code.
- [ ] Complete focused tests and regression checks before proceeding to governance.

**Dependencies:** Task 6.

**Verification:** Focused communication/support tests and affected HTTP/E2E tests named in the approved plan, plus `npm run check` and `npm run build`.

### Task 8: Specify and migrate `governance-operations`

**Files:**
- Create: a `governance-operations` specification and implementation plan under `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Source/test file list: determine in the approved context plan after auditing moderation, reports, audit records, and administrative operations.

**Acceptance criteria:**
- [ ] Define ownership of moderation, reports, audit, and administrative operations.
- [ ] Integrate other modules only through approved contracts; preserve administrative permissions and audit behavior.
- [ ] Get approval for the context specification and implementation plan before changing code.
- [ ] Complete focused tests, relevant integration/E2E regressions, `npm run check`, and `npm run build`.

**Dependencies:** Task 7.

### Checkpoint: Migration complete

- [ ] All seven modules satisfy the approved capability map and context completion criteria.
- [ ] No unapproved route, permission, response, schema, data, provider, or frontend changes were introduced.
- [ ] The full relevant unit, integration, E2E, type-check, and build validation passes.
- [ ] Documentation reflects the implementation, and the user has reviewed the final architecture.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing plans or checklists do not match the current implementation | Duplicate work or falsely closed tasks | Task 1 verifies code and tests before any checklist is updated |
| `server.ts` changes cause route or permission regressions | Existing clients or user flows break | Characterization/regression tests precede each extraction; preserve route composition |
| PostgreSQL and JSON adapters diverge | Lost or inconsistent writes | Keep explicit adapter selection; test configured/unconfigured behavior; prohibit dual writes |
| Payment and ticket boundaries split a transaction | Incorrect reservations, charges, or issuance | Keep the purchase transaction semantics explicit and test the whole relevant flow |
| Domain modules import one another's internals | Modular structure remains nominal | Define contracts in each context spec and verify dependency direction before completion |
| Scope becomes too broad to review | Regressions become difficult to isolate | Require separate approved spec/plan and checkpoint per context; no parallel context migrations |

## Open Questions

- None block this roadmap. Exact file lists, interfaces, routes, and named tests are intentionally decided in each context-specific spec and plan after its inventory, then reviewed by the user before implementation.

## Execution Handoff

The user approved this roadmap and its specification on 2026-10-23 and selected in-place execution on the current feature branch. Task 1 and Task 2 are complete; Task 3's approved session slice is validated, while broader identity-access scope still needs its own approved specification and plan. Do not commit without explicit authorization.
