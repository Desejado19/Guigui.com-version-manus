---
name: playwright-testing
description: Testes end-to-end e de componente no Guigui.com (Playwright + Vitest + Testing Library). Usar ao escrever ou corrigir testes, cobrir um fluxo (login, compra de bilhete, admin) ou investigar um spec que falha.
---

# Testes — Guigui.com

## Ferramentas

| Ferramenta | Comando | Onde |
|---|---|---|
| Playwright (E2E) | `npm run test:e2e` / `npx playwright test tests/<ficheiro>.spec.ts` | `tests/*.spec.ts` |
| Vitest (unit) | `npm run test:unit` | `tests/unit/**` |
| Componentes | `npm run test:components` | `tests/unit/components` |
| Integracao Postgres | `npm run test:integration` | `tests/unit/postgresServices.integration.test.ts` |
| Responsivo | `npm run test:responsive` | `tests/responsive.spec.ts` |

## Regras

1. **Um teste prova comportamento, nao implementacao.** Preferir texto visivel e papeis ARIA a seletores CSS fragil.
2. **Dados reais**: o projeto tem dados de demonstracao em PostgreSQL; nao inventar mocks quando o objetivo e provar o fluxo.
3. **Contas de demonstracao**: admin `admin.teste@guigui.com`, empresa `empresa.seed01@guigui.test`, cidadao `cidadao.seed01@guigui.test` (password `Guigui2026!`).
4. **Cada teste limpa o que criou** (publicacao, evento, pedido) para nao contaminar execucoes seguintes.
5. **Esperas deterministicas**: esperar por elemento/estado, nunca `sleep` fixo.
6. **Falha deve dizer o que faltou**: usar `expect(...).toBeVisible()` com mensagem clara, nao `expect(count).toBeGreaterThan(0)` generico.

## Fluxos que importam

- Login e restauro de sessao (cookie) por papel.
- Compra de bilhete: selecao de tipo, quantidade, total, pagamento, QR emitido.
- Validacao na porta: bilhete usado nao passa duas vezes.
- Admin: empresas (aprovacao/suspensao), moderacao, planos.
- Expiracao: evento/desconto passado nao aparece ao publico (`src/utils/expiry.ts`).

## Checklist

- [ ] Falha reproduzida antes da correcao
- [ ] Teste cobre o caso de erro, nao so o caminho felizmente verde
- [ ] Sem `sleep` fixo nem seletor por posicao
- [ ] Corrida isolada (`npx playwright test tests/x.spec.ts`) verde
- [ ] Nenhum teste ignorado para obter verde (`test.skip` exige justificacao)
