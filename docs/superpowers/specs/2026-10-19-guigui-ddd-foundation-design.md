# Especificação: fundação local e arquitetura DDD do Guigui.com

**Estado:** proposta para revisão do utilizador
**Data:** 2026-10-19
**Primeira fatia:** `platform-foundation` — funcionamento local verificável
**Limite:** esta especificação não autoriza implementação; o plano de execução será escrito após a aprovação deste documento.

## Objetivo

Restaurar e tornar reproduzível a validação e execução local do Guigui.com e estabelecer limites para evoluir o backend como um monólito modular orientado por domínios (DDD pragmático).

O público desta fatia é a equipa que desenvolve, testa e opera a aplicação localmente. O utilizador final deve continuar a poder aceder à SPA e aos fluxos existentes. O trabalho não promete funcionamento de fornecedores externos sem credenciais, nem certifica o sistema para produção.

### Evidência inicial observada

- O serviço esperado em `http://127.0.0.1:3000` não estava ativo durante a verificação.
- `npm run test:unit` passou: 22 ficheiros, 258 testes aprovados e 21 ignorados.
- `npm run check` falhou ao analisar `check-front.js`, que contém uma string JavaScript inválida.
- Uma verificação TypeScript adicional, desativando temporariamente a inclusão de JavaScript, revelou erros existentes na configuração do servidor Vite, em identificadores de categoria e na chamada usada pelo teste `system-health`.
- Os relatórios locais divergem quanto a persistência e estado operacional; devem ser tratados como histórico, não como prova do runtime atual.
- A pasta de trabalho não tem metadados Git detetáveis. Não foi criada uma cópia, branch ou histórico Git.

## Mapa de capacidades

Os identificadores abaixo são estáveis para a iniciativa. As dependências descrevem contratos publicados, não autorização para importar modelos ou persistência interna de outro contexto.

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `platform-foundation` | Inicialização, configuração, saúde, persistência e contratos comuns | — |
| `identity-access` | Contas, sessões e autorização | `platform-foundation` |
| `business-discovery` | Empresas, diretório, feed, ofertas e avaliações | `platform-foundation`, `identity-access` |
| `payments-monetization` | Pagamentos, subscrições, taxas, reconciliação e reembolsos | `platform-foundation`, `identity-access` |
| `events-ticketing` | Eventos, inventário, reservas, bilhetes e scanner | `platform-foundation`, `identity-access`, `business-discovery`, `payments-monetization` |
| `communication-support` | Mensagens, suporte e notificações | `platform-foundation`, `identity-access`, `business-discovery`, `events-ticketing` |
| `governance-operations` | Moderação, auditoria, operação e relatórios administrativos | Contratos publicados pelos módulos anteriores |

Ordem de evolução: `platform-foundation` → `identity-access` → `business-discovery` → `payments-monetization` → `events-ticketing` → `communication-support` → `governance-operations`.

O trabalho imediato cobre apenas `platform-foundation`. A ordem posterior orienta especificações próprias e não constitui autorização para uma reescrita dos restantes módulos.

## Tech stack e arquitetura

- Frontend: React 19, TypeScript, Vite 6 e Tailwind CSS 4.
- Backend: Node.js, Express 4 e TypeScript executado com `tsx`.
- Persistência atualmente suportada: PostgreSQL via `pg` e armazenamento JSON local.
- Testes: Vitest, Testing Library e Playwright.
- Entrega: aplicação monolítica; não adicionar microserviços ou dependências nesta fatia.

`server.ts` atua progressivamente como composition root: configura middleware, conecta adaptadores e monta routers. Nos contextos extraídos, manter camadas simples:

1. **Domínio:** regras e invariantes próprias do contexto; sem dependência de Express, SQL ou interface visual.
2. **Aplicação:** casos de uso e coordenação de operações; dependências externas entram por contratos pequenos e explícitos.
3. **Adaptadores:** HTTP, persistência e fornecedores externos.

Um contexto é proprietário das suas regras e dados. Outros contextos consomem IDs e contratos publicados, não tabelas, ficheiros ou tipos internos. Em particular, o contexto de pagamentos não depende do domínio de eventos; o checkout de eventos usa o contrato oferecido por pagamentos. Evitar barramentos genéricos e abstrações sem mais de um uso real.

Nesta primeira fatia, estabilizar a execução e a verificação sem extrair regras de negócio. A extração começa somente numa especificação posterior, com consumidores e contratos existentes identificados.

## Contratos de runtime

### Inicialização local

- `npm run dev` inicia Express e Vite no mesmo processo, conforme configuração existente.
- Sem `DATABASE_URL`, usar o modo JSON local já suportado.
- Com `DATABASE_URL` configurado, não alternar silenciosamente para JSON quando o PostgreSQL falhar: esse fallback pode dividir ou perder escritas.
- Se a aplicação consegue servir localmente durante uma indisponibilidade do PostgreSQL, deve continuar disponível e expor estado degradado. Operações que exijam a base indisponível devem falhar de forma explícita; não responder sucesso fictício.

### Saúde

`GET /api/health` mantém o contrato existente aditivamente, incluindo `database.configured` e `database.connected`.

- O estado deve distinguir processo ativo, persistência local sem PostgreSQL configurado e PostgreSQL configurado mas indisponível.
- Com o processo a responder e a dependência indisponível, devolver estado `degraded` em vez de declarar estado normal.
- A falha de conexão não deve ser escondida como `database.connected: false` sem qualquer indicação de degradação.
- Não alterar o comportamento de disponibilidade de produção nem introduzir um novo endpoint de readiness nesta fatia.

### Interfaces e erros

- Preservar métodos, caminhos, formatos e permissões observáveis existentes, salvo correção aprovada e coberta por teste.
- Validar dados externos nas rotas; os casos de uso recebem tipos já validados.
- Falhas de configuração, inicialização ou dependência devem ser visíveis em logs e respostas apropriadas; não usar sucesso vazio ou captura silenciosa.
- SMS, pagamentos, email e moderação por IA só são apresentados como reais quando o adaptador e credenciais confirmam essa capacidade; os modos simulados devem continuar explicitamente simulados.

## Comandos

Executar na raiz `Guigui.com-tema-escuro-testado`:

```text
npm run check
npm run test:unit
npm run build
npm run dev
npm run test:e2e
```

`npm run test:e2e` depende de um servidor acessível em `127.0.0.1:3000` por configuração padrão; iniciá-lo separadamente com `npm run dev`. Não executar migrações, importadores, scripts de seed ou comandos de backup como parte desta fatia.

## Estrutura do projeto

Estrutura existente relevante:

```text
server.ts                 → composição HTTP e arranque atuais
server/                   → serviços backend existentes; não é ainda uma fronteira DDD uniforme
src/App.tsx               → aplicação React e navegação
src/components/           → componentes e painéis
src/services/             → integrações e sincronizações do frontend
src/utils/                → utilitários e regras partilhadas existentes
tests/                    → Playwright e testes unitários Vitest
docs/                     → documentação operacional e funcional
docs/superpowers/specs/   → especificações arquiteturais aprovadas
```

Na evolução DDD, colocar novos módulos dentro do backend e manter os adaptadores existentes até haver testes de compatibilidade. Não mover `App.tsx`, todos os serviços ou dados apenas para fazer a árvore parecer modular.

## Estilo e contratos de código

- TypeScript estrito no limite dos módulos; evitar coerções não verificadas.
- Nomes de domínio explícitos, entradas separadas de resultados e funções com dependências visíveis.
- Usar as convenções já presentes no repositório, incluindo respostas REST existentes, até uma especificação de API aprovar mudanças.

Exemplo ilustrativo de um contrato aditivo para a primeira fatia:

```ts
interface HealthResponse {
  status: 'ok' | 'degraded';
  app: string;
  timestamp: string;
  database: {
    configured: boolean;
    connected: boolean;
  };
}
```

O tipo final deverá preservar os campos existentes da resposta de saúde; este exemplo não autoriza remover `geminiActive` ou `observability`.

## Estratégia de testes

1. **Regressão do verificador:** reproduzir primeiro a falha atual e corrigir a causa, sem retirar verificações de ficheiros relevantes.
2. **Unitários:** manter todos os testes existentes aprovados; acrescentar testes determinísticos para estados de saúde e classificação de indisponibilidade, sem exigir credenciais ou PostgreSQL real.
3. **Build e tipos:** `npm run check` e `npm run build` devem passar após a fatia.
4. **Integração local:** iniciar o servidor de desenvolvimento, verificar HTML da SPA, carregamento dos módulos compilados e `GET /api/health`.
5. **PostgreSQL:** cobrir configuração ausente e falha de ligação em teste isolado; nunca alterar uma base de dados real como parte da validação local.
6. **E2E:** executar o conjunto Playwright existente contra o servidor local apenas depois dos checks menores passarem; relatar testes ignorados e falhas ambientais separadamente.

Nenhum teste será removido, ignorado ou enfraquecido para obter um resultado verde. Cada correção de comportamento seguirá teste de regressão primeiro.

## Limites

- **Sempre:** preservar os contratos atuais; executar testes antes de declarar sucesso; testar fronteiras de contexto; reportar degradação e limitações de serviços externos com honestidade; manter alterações incrementais.
- **Pedir aprovação antes:** migrações ou mudanças de schema; alterar credenciais ou `.env`; adicionar dependências; mudar formatos públicos da API; alterar dados persistidos; inicializar Git/commitar; trocar fallback ou política de disponibilidade.
- **Nunca:** incluir segredos; alegar pagamento, SMS, email ou IA reais sem confirmação do fornecedor; tratar `localStorage` como autorização backend; permitir acesso direto às tabelas internas de outro contexto; ocultar falhas com resposta de sucesso.

## Critérios de sucesso da primeira fatia

- [ ] `npm run check` termina com zero erros, incluindo tratamento correto do script JavaScript inválido sem simplesmente excluir fontes da verificação.
- [ ] `npm run test:unit` passa com todos os testes atualmente não ignorados; nenhum teste é silenciado ou removido.
- [ ] `npm run build` termina com sucesso.
- [ ] `npm run dev` inicia numa instalação existente sem exigir serviços externos não documentados.
- [ ] A SPA serve HTML e módulos transformados do frontend localmente; não basta a porta aceitar TCP.
- [ ] `GET /api/health` diferencia operação local sem PostgreSQL e operação degradada com PostgreSQL configurado mas indisponível, sem ocultar erro ou anunciar saúde normal.
- [ ] Falhas de uma dependência não geram respostas de sucesso fictícias nem mudança silenciosa entre PostgreSQL e JSON.
- [ ] O fluxo de produção e as rotas de domínio existentes permanecem compatíveis.
- [ ] A documentação de execução descreve apenas o comportamento comprovado e os comandos de verificação atualizados.

## Fora de escopo nesta fatia

- Extrair todos os contextos DDD ou reescrever `server.ts`/`App.tsx`.
- Mudar schema, provedor de persistência, importar/alterar dados locais ou executar migrações.
- Configurar produção, credenciais reais, domínio, SMS, pagamentos, SMTP ou push.
- Redesenhar telas ou alterar políticas de negócio ainda pendentes.
- Inicializar repositório Git ou criar commits sem autorização explícita.

## Questões em aberto

- Nenhuma decisão de produto bloqueia a fatia de fundação.
- O comportamento exato de cada rota quando PostgreSQL está configurado mas indisponível deve ser confirmado pelos testes atuais antes de qualquer ajuste; não se assume fallback automático.
- O documento não pôde ser commitado: a pasta de trabalho não contém metadados Git e inicializar um repositório requer autorização separada.
