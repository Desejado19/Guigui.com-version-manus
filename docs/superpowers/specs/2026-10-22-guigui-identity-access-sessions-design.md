# Especificação: `identity-access` — sessões e autorização

**Estado:** aprovado pelo utilizador em 2026-10-23 para resolução de contexto de sessão e middleware de acesso
**Data:** 2026-10-22
**Escopo:** primeira fatia do módulo `identity-access`
**Compatibilidade:** preservar os contratos HTTP e as políticas de acesso existentes

## Objetivo

Estabelecer a primeira fronteira modular de identidade e acesso, extraindo a resolução do contexto de sessão e os middlewares de autenticação/autorização atualmente definidos em `server.ts`.

Esta etapa reduz o acoplamento do composition root às regras de sessão e role, sem reescrever autenticação ou alterar endpoints, permissões, cookies, dados ou fornecedores de persistência.

## Contexto observado

- `server.ts` extrai o token do cookie `guigui_session`, resolve a sessão através de `server/sessionService.ts` e deriva um contexto com `userId` e `role`.
- As funções locais `requireSession` e `requireRole` protegem múltiplas rotas. Os handlers também chamam `sessionContext` diretamente para obter a identidade do ator.
- `server/sessionService.ts` consulta PostgreSQL quando este está configurado e usa o armazenamento JSON local caso contrário. Este serviço gere criação, consulta e revogação de sessões.
- `requireRole` regista uma auditoria de autorização negada, incluindo recurso, role do ator, request ID e roles requeridas.
- O contrato atual distingue não autenticado (`401`, `AUTHENTICATION_REQUIRED`) de autenticado sem role autorizada (`403`, `PERMISSION_DENIED`).
- A branch contém alterações pendentes de outras tarefas. A execução desta fatia deve selecionar apenas ficheiros e hunks pertencentes a este escopo.

## Abordagem

Adicionar `server/modules/identity-access/` com os componentes estritamente necessários:

```text
server/modules/identity-access/
  application/
    resolveSessionContext.ts
  http/
    sessionAccessMiddleware.ts
```

O serviço de aplicação recebe uma porta de leitura de sessão e transforma o resultado em `SessionContext | null`. Não depende de Express, PostgreSQL, JSON nem do formato do cookie.

O adaptador HTTP recebe o serviço de aplicação e as dependências de transporte/auditoria. Expõe as funções equivalentes a `sessionContext`, `requireSession` e `requireRole`, preservando as respostas atuais.

O composition root liga a função `getSession` existente à porta do serviço, fornece a extração de token já existente, o gerador de request ID e o callback de auditoria. Não será criado um novo adaptador de persistência enquanto o serviço atual satisfizer a porta e não houver necessidade de alterar a sua propriedade.

## Contratos do módulo

Os tipos e funções devem manter o escopo mínimo:

```ts
type SessionRole = 'user' | 'business' | 'admin';

type SessionContext = {
  userId: string;
  role: SessionRole;
};

type SessionReader = {
  getSession(token: string | undefined): Promise<{
    userId: string;
    role?: SessionRole;
  } | null>;
};

resolveSessionContext(
  token: string | undefined,
  reader: SessionReader,
): Promise<SessionContext | null>;
```

O adaptador HTTP recebe:

- `resolveContext(request)`, construído com `SessionReader` e o extrator de token;
- um callback de auditoria de autorização negada, com recurso, role do ator, request ID e roles requeridas;
- um resolvedor de request ID.

O módulo não adiciona estado à requisição Express nesta etapa. As rotas continuam a obter o contexto através do equivalente de `sessionContext`, evitando alterar os handlers consumidores.

## Fluxos e comportamento preservado

### Resolução da sessão

1. Extrair o token com o helper existente de `server.ts`; a semântica do cookie não muda.
2. Consultar `getSession` através da porta injetada.
3. Se a sessão for inexistente ou não possuir role, devolver `null`.
4. Caso contrário, devolver somente `{ userId, role }`.

Não alterar expiração, hash do token, revogação, TTL, armazenamento ou comportamento de contas deactivated nesta fatia.

### Middleware `requireSession`

- Sessão válida: chamar `next()`.
- Sessão ausente, inválida ou sem role: responder `401` com:
  - `error: 'Sessão autenticada necessária.'`
  - `code: 'AUTHENTICATION_REQUIRED'`

### Middleware `requireRole`

- Sessão ausente, inválida ou sem role: responder com o mesmo `401` de `requireSession`.
- Role não autorizada: registar a auditoria atual e responder `403` com:
  - `error: 'Não possui permissão para esta operação.'`
  - `code: 'PERMISSION_DENIED'`
- Role autorizada: chamar `next()`.

O valor de `actorRole` na auditoria continua a mapear `user` para `citizen`, mantendo `business` e `admin`. `resource` continua a usar `req.path`, e a lista `requiredRoles` continua a conter as roles recebidas pelo middleware.

Erros operacionais de leitura de sessão não devem ser convertidos em `null`, `401` ou resposta de sucesso vazia. O middleware deve encaminhá-los para o tratamento de erros Express (`next(error)`), sem capturas genéricas ou silenciosas.

## Integração e compatibilidade

- `server.ts` continua como composition root.
- Substituir apenas as implementações locais de `sessionContext`, `requireSession` e `requireRole` pela composição do novo módulo.
- Manter os nomes locais ou aliases necessários para não alterar os call sites dos handlers nesta etapa.
- Preservar a ordem dos middlewares, a lista de roles de cada rota e todos os endpoints.
- Continuar a usar `server/sessionService.ts` para operações de sessão; este plano não extrai `createSession`, `revokeSession` nem `revokeAllUserSessions`.
- Não alterar login, registo, MFA, mudança/recuperação de palavra-passe, convites, desativação ou eliminação de conta, exceto testes de regressão existentes desses fluxos.
- Não alterar auditoria, schema, migrações, cookies, credenciais, frontend ou formatos de resposta.

## Testes e critérios de aceitação

1. Testes unitários do serviço de aplicação cobrem:
   - token ausente e sessão inexistente;
   - sessão sem role;
   - sessão válida com `userId` e role corretos;
   - propagação de erro do leitor de sessão.
2. Testes unitários do adaptador HTTP cobrem:
   - `requireSession` com sessão válida e inválida;
   - `requireRole` para role permitida e não permitida;
   - formatos exatos das respostas `401` e `403`;
   - auditoria com recurso, role do ator, request ID e roles requeridas;
   - encaminhamento de erro de leitura para `next(error)`.
3. `tests/unit/securityRoutes.test.ts` continua a cobrir autorização e isolamento reais, sem remover ou enfraquecer casos existentes.
4. Os fluxos existentes de conta e sessão permanecem compatíveis, incluindo revogação de sessões após desativação/eliminação da conta.
5. `npm run test:unit`, `npm run check` e `npm run build` passam.
6. A documentação descreve apenas o limite efetivamente implementado.

## Fora do escopo

- Extrair login, registo, MFA, recuperação de palavra-passe ou convites.
- Extrair a persistência ou alterar a implementação de `server/sessionService.ts`.
- Reorganizar as rotas ou os handlers consumidores.
- Alterar roles, permissões, políticas de autorização ou associações de empresa.
- Mudar a política de falhas de PostgreSQL/JSON ou reconciliar os dois armazenamentos.
- Criar novas tabelas, migrações, dependências ou APIs públicas.
- Corrigir problemas preexistentes que não sejam necessários para esta extração.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Uma role, mensagem ou detalhe de auditoria diverge durante a extração | Regressão de autorização ou de observabilidade operacional | Testes unitários do middleware e regressões existentes de rotas |
| Falha de PostgreSQL é tratada como sessão inválida | Resposta 401 enganadora e erro operacional oculto | Propagar erro para `next(error)` e testar a fronteira |
| Alterações alheias em `server.ts` são incluídas | Mistura de escopos e risco de regressão | Selecionar apenas os hunks de composição de autenticação |
| Serviço continua com responsabilidade de persistência fora do módulo | Fronteira incompleta nesta primeira etapa | Documentar explicitamente a porta e reservar a extração do repositório para uma etapa própria |

## Revisão de consistência

- O escopo é uma fatia única: resolução de contexto de sessão e middleware de acesso.
- Login, registo e persistência de sessões permanecem fora do escopo, conforme a decisão de começar pela fronteira mais reutilizada.
- A composição mantém as rotas e os handlers consumidores, evitando uma migração horizontal de endpoints.
- O contrato de erro operacional está separado da resposta de credenciais inválidas e da resposta de sessão ausente.
- A proposta não implica alteração de dados, schema, permissões nem comportamento HTTP.
