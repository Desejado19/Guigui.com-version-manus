# Especificação: migração do backend Guigui.com para Monólito Modular + DDD

**Estado:** aprovado integralmente pelo utilizador em 2026-10-23; arquitetura, sequência e mapa de capacidades revistos em separado
**Data:** 2026-10-22
**Escopo:** migração evolutiva do backend, por contexto de negócio
**Compatibilidade:** preservar os contratos e comportamentos atuais durante cada etapa

## Objetivo

Evoluir o backend do Guigui.com para um monólito modular com DDD pragmático, tornando explícita a propriedade das regras e dados por contexto e reduzindo o acoplamento entre os serviços existentes.

A SPA React, a experiência do utilizador e os contratos HTTP atuais permanecem estáveis durante esta iniciativa. O sistema continua a ser entregue e executado como uma aplicação monolítica; esta especificação não propõe microserviços nem uma reescrita geral.

## Contexto observado

- O backend é Node.js, Express e TypeScript; `server.ts` é o ponto de composição atual das rotas.
- `server.ts` importa diretamente serviços de identidade, pagamentos, bilhetes, comunicação, moderação, persistência e utilitários do frontend.
- Existem adaptadores/serviços PostgreSQL e um armazenamento JSON local.
- Há testes Vitest unitários e de integração, scripts de auditoria funcional e testes Playwright.
- `server/modules/platform-foundation/` e `server/modules/identity-access/` já existem; a fundação está parcialmente extraída e identidade/sessões têm uma extração parcial.
- A SPA, as rotas públicas, PostgreSQL e o armazenamento JSON local têm consumidores existentes que devem permanecer compatíveis.
- O mapa aprovado de módulos e dependências está em [`CAPABILITY-MAP.md`](../../../CAPABILITY-MAP.md). Esta especificação detalha o destino e os critérios e foi aprovada integralmente em 2026-10-23.

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

## Stack, estrutura e estilo

- **Frontend:** React 19, TypeScript e Vite; a SPA não é reorganizada nesta iniciativa.
- **Backend:** Node.js, Express 4 e TypeScript, executado como monólito num processo.
- **Persistência:** PostgreSQL via `pg` e JSON local, selecionados pelo runtime existente.
- **Testes:** Vitest para unitários/integração e Playwright para E2E.

Estrutura relevante atual e destino indicativo:

```text
server.ts                         # composition root atual; reduzido por etapas
server/modules/platform-foundation/
server/modules/identity-access/
server/modules/business-discovery/       # destino
server/modules/payments-monetization/    # destino
server/modules/events-ticketing/         # destino
server/modules/communication-support/    # destino
server/modules/governance-operations/    # destino
tests/unit/                       # Vitest
tests/                            # Playwright e outros testes
docs/superpowers/specs/           # especificações por contexto
```

Seguir o estilo TypeScript existente, com tipos de entrada/saída explícitos e dependências visíveis nas fronteiras:

```typescript
export interface FindBusinessById {
  execute(input: { businessId: string }): Promise<BusinessSummary | null>;
}
```

O exemplo ilustra um contrato de aplicação, não exige este nome ou assinatura para os módulos reais. A implementação de cada caso de uso será definida na especificação do respetivo contexto.

## Comandos de validação

Executar a partir da raiz do projeto:

```powershell
npm run check
npm run test:unit
$env:TEST_DATABASE_URL = "<URL de uma base de teste isolada>"; npm run test:integration
npm run test:e2e
npm run build
```

`npm run test:integration` usa apenas `TEST_DATABASE_URL`; quando a variável não está configurada, o teste de integração PostgreSQL é ignorado. Nunca apontar `TEST_DATABASE_URL` para a base de dados de aplicação ou produção. A execução E2E e quaisquer requisitos adicionais de ambiente serão definidos pelo plano e pelos testes do contexto em causa.

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

As dependências de composição e a ordem aprovadas estão registadas no [`mapa de capacidades`](../../../CAPABILITY-MAP.md). Em particular, `communication-support` e `governance-operations` dependem diretamente da fundação e identidade; quando precisarem de dados ou operações dos restantes contextos, usarão contratos publicados, sem acoplamento à implementação interna.

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

Migrar um contexto de cada vez, começando por completar a fundação e a extração parcial de identidade/sessões. Cada etapa constitui uma fatia independente:

1. Inventariar rotas, consumidores, serviços, dados, permissões e testes do contexto.
2. Estabelecer ou reproduzir testes de compatibilidade antes da extração, observando primeiro a falha dos testes que documentam o comportamento pretendido.
3. Implementar o caso de uso e as regras do módulo com testes unitários.
4. Ligar os adaptadores existentes ao módulo e manter as rotas públicas.
5. Migrar os consumidores para contratos publicados.
6. Executar testes de integração/regressão relevantes, type-check e build.
7. Remover código duplicado apenas quando não houver consumidores e a compatibilidade estiver comprovada.

Uma falha de integração deve ser explícita e diagnosticável. Não substituir erros por respostas de sucesso vazias, não esconder falhas com capturas genéricas e não alterar silenciosamente a persistência escolhida.

As rotas delegam gradualmente nos módulos; não manter regras duplicadas nem escritas paralelas. Cada fatia deve ser reversível por alteração de código, sem migrações destrutivas de dados.

## Critérios de conclusão por etapa

- Regras e dados têm um contexto proprietário identificável.
- O domínio não depende de Express, SQL, React ou fornecedor externo.
- Casos de uso recebem dependências por interfaces/portas explícitas.
- Não existem importações de modelos, serviços ou adaptadores internos de outro contexto.
- Os endpoints, permissões e fluxos cobertos pela linha de base continuam compatíveis.
- Testes unitários cobrem invariantes e casos de erro; testes de integração cobrem adaptadores e contratos relevantes.
- A documentação da etapa descreve os limites e as dependências efetivamente implementados.
- `npm run check` e `npm run build` passam; `npm run test:unit` e os testes de integração/E2E aplicáveis ao contexto passam sem enfraquecer verificações existentes.

## Estratégia de testes

- **Unitários:** invariantes do domínio, casos de uso, resultados e erros relevantes; usar dependências reais sempre que praticável.
- **Integração:** contratos entre aplicação e adaptadores, incluindo PostgreSQL apenas com uma base de teste isolada e JSON local quando aplicável.
- **Compatibilidade HTTP:** preservar caminhos, métodos, formatos de resposta, permissões e efeitos observáveis das rotas afetadas.
- **E2E:** executar nos fluxos de utilizador afetados, sem substituir a cobertura unitária ou de integração.
- **Regressão:** manter os testes existentes; não apagar, ignorar ou reduzir asserções para obter aprovação.

## Limites de decisão

- **Fazer sempre:** preservar o monólito e contratos existentes; migrar um contexto por vez; aplicar TDD; manter erros explícitos; validar com testes, `npm run check` e build.
- **Pedir aprovação antes:** alterar rotas ou comportamento; mudar schema ou dados; trocar persistência; adicionar dependências; configurar fornecedores reais; alterar CI, credenciais, `.env` ou fazer deploy.
- **Nunca:** introduzir microserviços ou reescrita geral neste escopo; criar fallback silencioso ou sucesso fictício; expor segredos; enfraquecer/remover testes para fazer a validação passar.

## Critérios de sucesso da iniciativa

- Os sete módulos do mapa têm responsabilidade e dependências documentadas, sem ciclos ou acesso direto à implementação interna de outro contexto.
- Regras e dados têm um proprietário claro; os domínios não dependem de Express, SQL, React ou fornecedores externos.
- A composição permanece num único processo e a SPA, rotas, permissões e contratos HTTP continuam compatíveis, salvo alteração aprovada em separado.
- PostgreSQL e JSON local continuam suportados, sem mudança de schema, importação de dados ou escrita dupla como consequência da extração.
- Cada contexto cumpre os critérios de conclusão por etapa antes de se iniciar a implementação do seguinte.
- A linha de base de testes e as verificações de tipos/build relevantes passam sem redução de cobertura ou asserções.
- A documentação final corresponde aos limites efetivamente implementados.

## Questões em aberto

Não há decisões arquiteturais bloqueadoras após as aprovações das secções e do mapa de capacidades. A escolha de rotas, casos de uso, testes e ficheiros concretos será feita no plano de cada contexto, após a aprovação integral desta especificação.

## Fora do escopo

- Reescrever o backend de uma só vez ou migrar para microserviços.
- Reorganizar a SPA ou alterar experiência visual.
- Alterar contratos HTTP, regras comerciais, permissões ou comportamento sem aprovação própria.
- Alterar schema, executar migrações/importações, mudar dados existentes ou trocar persistência sem aprovação própria.
- Adicionar dependências, alterar credenciais/`.env`, configurar fornecedores reais ou alegar prontidão para produção.
- Inicializar um repositório Git ou criar commits sem autorização explícita.

## Aprovação e decomposição

Esta especificação e o roadmap de implementação foram aprovados integralmente em 2026-10-23. Essa aprovação não substitui a revisão e aprovação da especificação e do plano próprios de cada contexto antes da respetiva implementação; cada fatia mantém testes e revisão próprios.

## Revisão de consistência

- O escopo mantém o frontend e os contratos HTTP atuais estáveis.
- A sequência respeita o mapa de dependências aprovado; eventos/bilhetes só é migrado após os contratos de empresas e pagamentos.
- PostgreSQL e JSON permanecem adaptadores; não há instrução contraditória para migrar dados ou schema.
- A especificação distingue os módulos já existentes das extrações ainda por fazer e não afirma que testes ou mudanças propostas já foram executados.
