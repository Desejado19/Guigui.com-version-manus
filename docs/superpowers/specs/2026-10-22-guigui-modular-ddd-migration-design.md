# Especificação: migração do backend Guigui.com para Monólito Modular + DDD

**Estado:** proposta para revisão do utilizador
**Data:** 2026-10-22
**Escopo:** migração evolutiva do backend, por contexto de negócio
**Compatibilidade:** preservar os contratos e comportamentos atuais durante cada etapa

## Objetivo

Evoluir o backend do Guigui.com para um monólito modular com DDD pragmático, tornando explícita a propriedade das regras e dados por contexto e reduzindo o acoplamento entre os serviços existentes.

A SPA React, a experiência do utilizador e os contratos HTTP atuais permanecem estáveis durante esta iniciativa. O sistema continua a ser entregue e executado como uma aplicação monolítica; esta especificação não propõe microserviços nem uma reescrita geral.

## Contexto observado

- O backend é Node.js, Express e TypeScript; `server.ts` é o ponto de composição atual e contém mais de 1.200 linhas.
- `server.ts` importa diretamente serviços de identidade, pagamentos, bilhetes, comunicação, moderação, persistência e utilitários do frontend.
- Existem adaptadores/serviços PostgreSQL e um armazenamento JSON local.
- Há testes Vitest unitários e de integração, scripts de auditoria funcional e testes Playwright.
- `docs/superpowers/specs/2026-10-19-guigui-ddd-foundation-design.md` propõe uma primeira fatia de fundação. Esta especificação alarga o destino arquitetural, mas não assume que essa fatia ou os seus critérios estejam implementados.
- O workspace não contém metadados Git detetáveis; esta especificação não autoriza inicializar Git nem criar commits.

## Abordagem arquitetural

Adotar uma migração evolutiva por contexto. As rotas atuais permanecem como adaptadores compatíveis enquanto os casos de uso e regras migram para os módulos de domínio. Cada contexto é extraído e validado antes de alterar os seus consumidores ou remover a implementação anterior.

O backend usa camadas simples:

1. **Domínio:** entidades, value objects, invariantes e regras sem dependência de Express, SQL ou interface.
2. **Aplicação:** casos de uso e coordenação; dependências externas entram por portas explícitas.
3. **Adaptadores:** HTTP, PostgreSQL, JSON local e integrações externas.
4. **Composição:** o ponto de entrada instancia os módulos e conecta as portas aos adaptadores.

Estrutura indicativa:

```text
server/
  http/                         # montagem HTTP e composição de rotas
  modules/
    platform-foundation/
    identity-access/
    business-discovery/
    payments-monetization/
    events-ticketing/
    communication-support/
    governance-operations/
```

Cada módulo mantém `domain`, `application` e `adapters` apenas onde houver necessidade real. Evitar estruturas vazias, abstrações genéricas sem consumidor e uma camada comum que acumule regras de negócio.

## Contextos e propriedade

| Contexto | Responsabilidade e dados/regras próprios |
|---|---|
| `platform-foundation` | Inicialização, configuração, saúde, observabilidade e contratos técnicos comuns. Não é proprietário de regras de negócio. |
| `identity-access` | Contas, credenciais, sessões, autenticação e autorização. |
| `business-discovery` | Empresas, diretório, feed, ofertas e avaliações. |
| `payments-monetization` | Pagamentos, subscrições, catálogo comercial, taxas, reconciliação e reembolsos. |
| `events-ticketing` | Eventos, inventário, reservas, emissão de bilhetes, acesso e scanner. |
| `communication-support` | Conversas, mensagens, suporte e notificações. |
| `governance-operations` | Moderação, denúncias, auditoria e operações/relatórios administrativos. |

Um contexto é a única autoridade sobre as suas regras e operações. Consumidores usam IDs, DTOs e casos de uso publicados; não importam tipos internos, consultam tabelas ou escrevem diretamente nos ficheiros de outro contexto.

## Dependências entre contextos

Dependências de contratos publicados, não de implementação interna:

```text
platform-foundation
  └─ identity-access
       ├─ business-discovery
       ├─ payments-monetization
       ├─ events-ticketing ── usa contratos de business-discovery e payments-monetization
       └─ communication-support ── usa contratos relevantes de identity, business e events

governance-operations ── consome contratos publicados dos contextos operacionais
```

Ordem de extração:

1. levantamento e baseline de compatibilidade;
2. fundação;
3. identidade e acesso;
4. empresas e descoberta;
5. pagamentos e monetização;
6. eventos e bilhetes;
7. comunicação e suporte;
8. governança e operações.

As integrações entre módulos começam por contratos síncronos explícitos. Preservar a semântica transacional existente, particularmente entre compra, pagamento, reserva e emissão de bilhetes. Não introduzir um barramento genérico de eventos ou transações distribuídas sem necessidade comprovada e decisão aprovada.

## Persistência e compatibilidade

- Manter o monólito num único processo.
- Preservar PostgreSQL e JSON local como adaptadores suportados, sem fallback silencioso quando tal puder ocultar falha ou dividir escritas.
- Preservar endpoints, formatos de resposta, permissões e comportamento observável, salvo mudança aprovada separadamente.
- A extração não implica mudança de schema, migração de dados, alteração de identificadores ou troca de fornecedor de persistência.
- O módulo proprietário encapsula consultas e gravações; a reorganização física do schema pode continuar a ser partilhada inicialmente, sem tornar as tabelas um contrato entre módulos.
- Integrações simuladas continuam identificadas como simuladas; não alegar que pagamentos, SMS, email ou IA estão ativos sem confirmação dos adaptadores e credenciais.
- A SPA e os seus componentes não são reorganizados nesta iniciativa.

## Estratégia de execução

Cada etapa constitui uma fatia independente:

1. Inventariar rotas, consumidores, serviços, dados, permissões e testes do contexto.
2. Estabelecer ou reproduzir testes de compatibilidade antes da extração.
3. Implementar o caso de uso e as regras do módulo com testes unitários.
4. Ligar os adaptadores existentes ao módulo e manter as rotas públicas.
5. Migrar os consumidores para contratos publicados.
6. Executar testes de integração/regressão relevantes, type-check e build.
7. Remover código duplicado apenas quando não houver consumidores e a compatibilidade estiver comprovada.

Uma falha de integração deve ser explícita e diagnosticável. Não substituir erros por respostas de sucesso vazias, não esconder falhas com capturas genéricas e não alterar silenciosamente a persistência escolhida.

## Critérios de conclusão por etapa

- Regras e dados têm um contexto proprietário identificável.
- O domínio não depende de Express, SQL, React ou fornecedor externo.
- Casos de uso recebem dependências por interfaces/portas explícitas.
- Não existem importações de modelos, serviços ou adaptadores internos de outro contexto.
- Os endpoints, permissões e fluxos cobertos pela linha de base continuam compatíveis.
- Testes unitários cobrem invariantes e casos de erro; testes de integração cobrem adaptadores e contratos relevantes.
- `npm run check` e `npm run build` passam; os testes de regressão pertinentes passam sem remover, ignorar ou enfraquecer verificações.
- A documentação da etapa descreve os limites e as dependências efetivamente implementados.

## Fora do escopo

- Reescrever o backend de uma só vez ou migrar para microserviços.
- Reorganizar a SPA ou alterar experiência visual.
- Alterar contratos HTTP, regras comerciais, permissões ou comportamento sem aprovação própria.
- Alterar schema, executar migrações/importações, mudar dados existentes ou trocar persistência sem aprovação própria.
- Adicionar dependências, alterar credenciais/`.env`, configurar fornecedores reais ou alegar prontidão para produção.
- Inicializar um repositório Git ou criar commits sem autorização explícita.

## Aprovação e decomposição

Esta especificação define o destino arquitetural e a sequência, não autoriza a implementação de todas as etapas num único bloco. Após a revisão desta especificação, deve ser criado um plano de implementação com tarefas e critérios verificáveis. A execução pode então começar pela linha de base e pela fundação; cada contexto posterior deve ser tratado como uma fatia com testes e revisão próprios.

## Revisão de consistência

- O escopo mantém o frontend e os contratos HTTP atuais estáveis.
- A sequência respeita as dependências entre contextos e prioriza bilhetes/pagamentos somente depois de contratos e testes.
- PostgreSQL e JSON permanecem adaptadores; não há instrução contraditória para migrar dados ou schema.
- A especificação não afirma que testes ou mudanças propostas já foram executados.
