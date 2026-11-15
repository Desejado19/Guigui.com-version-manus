---
name: multi-tenant-saas
description: Regras de SaaS multi-tenant do Guigui.com — planos definidos pelo administrador, autorizacao por servidor e isolamento de dados por empresa. Usar ao mexer em planos, assinaturas, limites de uso, permissoes ou dados de uma empresa.
---

# SaaS multi-tenant — Guigui.com

## Principio central

**O administrador de sistema define os planos.** O codigo le o que foi definido; nunca assume nomes de plano.

| Proibido | Correto |
|---|---|
| `if (plan === 'PREMIUM')` | `planIncludesFeature(plan, 'promocoes_ilimitadas')` |
| `if (business.tier === 'enterprise')` | `resolvePlan(plans, subscription.planId)` -> `limits` |
| Limite escrito no componente | Limite vindo de `subscriptionPlan.limits` |

Fonte: `src/services/entitlementService.ts`, `src/services/usageAlertService.ts`, `src/data/subscriptionCatalog.ts`.

## Isolamento

1. **Toda a consulta filtra pelo tenant.** O `businessId` vem da sessao no servidor, nunca do corpo do pedido.
2. **IDs do cliente sao suspeitos.** Antes de ler ou escrever um recurso, confirmar que pertence a empresa autenticada.
3. **O papel decide a superficie**: cidadao ve conteudo publico; empresa ve o seu; admin ve tudo o que a governanca permitir.
4. **Personalizacao e por sessao** — respostas com dados privados nao devem ser cacheadas como publicas.

## Planos e contratos

- Alterar um plano cria **versao nova** (`SubscriptionPlanVersion`); assinaturas ja pagas mantem a versao contratada.
- Precos, comissoes e limites de bilhetes vivem em `MonetizationCatalog` / `BusinessModelConfig`.
- Nada reescreve um contrato pago: mudanca aplica-se da proxima renovacao.

## Checklist

- [ ] Zero comparacoes por nome/id de plano no codigo?
- [ ] `businessId` derivado da sessao no servidor?
- [ ] Autorizacao verificada antes de devolver dados?
- [ ] Teste com duas empresas (A nao ve dados de B)?
- [ ] `npm run test:subscriptions` e `npm run test:monetization` passam?
