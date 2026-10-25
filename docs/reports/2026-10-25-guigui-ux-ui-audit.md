# Auditoria UX/UI e funcional — Guigui.com

**Data de início:** 2026-10-25
**Commit base:** `91cccba` — `docs: plan Guigui UX audit execution`
**Branch:** `agents/faz-um-teste-completo-no-sistema-sobre-fluxo`
**Escopo:** inspeção somente de leitura; sem alterações de produto, migrations, seed, deploy ou acesso a base real.

## Resumo executivo

_A preencher após a auditoria das áreas e fluxos._

## Método e classificação de evidência

Cada capacidade será rastreada do ecrã/ação até rota, autorização, serviço e persistência/provedor. Evidência de interface ou teste unitário, isoladamente, não comprova funcionamento ponta a ponta.

| Classificação | Significado |
|---|---|
| `persistida` | Evidência mostra que a operação alcança o destino de persistência autoritativo. |
| `local/sincronizada` | O browser mantém estado local e existe caminho definido de sincronização por API. |
| `simulada` | O fluxo usa simulador, stub, fixture ou adaptador não produtivo. |
| `incompleta` | Falta uma ação ou caminho essencial esperado. |
| `inconsistente` | Camadas ou estados apresentados ao utilizador divergem. |
| `não verificada` | Inspeção e validação local segura não provaram o comportamento. |

Cada linha do inventário deve identificar perfil, ecrã/ação, fonte frontend, rota HTTP ou ação local, autorização no servidor, serviço/caso de uso, persistência/provedor, classificação, evidência e limitações.

## Baseline e limites de validação

- Estado inicial do worktree: limpo; nenhum ficheiro de produto foi alterado.
- O `vitest.config.ts` inclui testes em `tests/unit/**/*.test.ts` e `tests/unit/**/*.test.tsx`.
- `package.json` declara validações unitárias, TypeScript, build, i18n, Playwright, Newman, k6 e OWASP ZAP.
- O alvo da campanha QA existente é `http://127.0.0.1:4313` e a base sintética reservada `guigui_pg18_synthetic_target`. A provisão executa migrations; por isso `qa:full` e `qa:provision` não fazem parte desta auditoria.
- `scripts/qa/run-campaign.ps1` cria diretórios de resultados e um `empty.env` antes da fase de preflight e, depois, prepara ambiente próprio para ferramentas. Não foi executado para evitar artefactos laterais e qualquer sequência de provisão/seed.
- A suíte de operações PostgreSQL usa `PLATFORM_FOUNDATION_TEST_DATABASE_URL` com guardas de loopback, nome e versão; os testes de integração devem permanecer ignorados se a URL estiver vazia.
- A suíte legada lê `TEST_DATABASE_URL`; só poderá ser executada sem acesso ao banco se a URL estiver explicitamente vazia e os guards forem confirmados.
- Nenhum teste foi executado nesta tarefa de baseline.

## Público e cidadão

_Pendente — Task 2._

## Empresas e organizadores

_Pendente — Task 3._

## Administração e permissões

_Pendente — Task 3._

## Rotas, autorização e persistência

_Pendente — Task 4._

## Promoções, pagamentos e bilhetes

_Pendente — Task 5._

## UX, acessibilidade, responsividade e idiomas

_Pendente — Task 6._

## Validação

| Comando/ferramenta | Resultado | Limitação |
|---|---|---|
| `npm run lint` | Não executado | Pendente da verificação segura em Task 6. |
| `npm run test:unit` | Não executado | Pendente; URLs de banco devem ser explicitamente vazias no processo. |
| `npm run test:integration -- --maxWorkers=1 --no-file-parallelism` | Não executado | Só executar se as guardas ignorarem os testes DB antes de criar pool com URLs vazias. |
| `npm run build` | Não executado | Pendente da verificação segura em Task 6. |
| `npm run test:i18n` / `npm run audit:i18n` | Não executados | Pendente de Task 6. |
| Playwright | Não executado | Requer runtime local seguro; não iniciar se puder ler dados de utilizador existentes ou `.env`. |
| Newman / k6 / OWASP ZAP passivo | Não executados | Pendente de verificar alvo local seguro; sem provisionamento, seed, acesso externo ou instalação de ferramentas. |

## Achados priorizados

_Pendente — consolidar após Tasks 2–6. Não listar hipótese como achado confirmado._

## Decisões de negócio e bloqueios

_Pendente — registar políticas, integração ou evidência autoritativa ausentes._

## Projetos de implementação propostos

_Pendente — dependências e prioridade serão definidas após a evidência da auditoria. Nenhum projeto está concluído por este relatório._
