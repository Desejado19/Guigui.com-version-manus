# Guigui.com DDD Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a reproducible local Guigui.com startup and verification baseline, with honest database health reporting and no changes to existing business contracts.

**Architecture:** Keep the existing Express/Vite deployment as a monolith. First repair the type-check/runtime baseline, then isolate the platform-health classification as a small foundation service used by `/api/health`; defer domain extraction until a separately tested context is specified.

**Tech Stack:** React 19, TypeScript, Vite 6, Express 4, Node.js, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-guigui-ddd-foundation-design.md`

## Global Constraints

- “Sem `DATABASE_URL`, usar o modo JSON local já suportado.”
- “Com `DATABASE_URL` configurado, não alternar silenciosamente para JSON quando o PostgreSQL falhar: esse fallback pode dividir ou perder escritas.”
- “Com o processo a responder e a dependência indisponível, devolver estado `degraded` em vez de declarar estado normal.”
- “Preservar métodos, caminhos, formatos e permissões observáveis existentes, salvo correção aprovada e coberta por teste.”
- “Nenhum teste será removido, ignorado ou enfraquecido para obter um resultado verde.”
- “Não executar migrações, importadores, scripts de seed ou comandos de backup como parte desta fatia.”
- “Pedir aprovação antes: migrações ou mudanças de schema; alterar credenciais ou `.env`; adicionar dependências; mudar formatos públicos da API; alterar dados persistidos; inicializar Git/commitar; trocar fallback ou política de disponibilidade.”
- “Nunca: incluir segredos; alegar pagamento, SMS, email ou IA reais sem confirmação do fornecedor; tratar `localStorage` como autorização backend; permitir acesso direto às tabelas internas de outro contexto; ocultar falhas com resposta de sucesso.”

## Review Focus

- JavaScript auxiliar inválido deve ser reparado sem retirar ficheiros do type-check ou enfraquecer scripts de validação; `node --check check-front.js` e `npm run check` devem passar.
- Uma `DATABASE_URL` configurada com serviço PostgreSQL indisponível não deve ser confundida com modo local sem base configurada; testar `configured=true, connected=false` e esperar `degraded`.
- Modo local JSON sem base configurada deve continuar utilizável e não ser reportado como falha de dependência; testar `configured=false, connected=false` e esperar `ok`.
- A alteração do estado de saúde não deve quebrar o formato existente, o HTTP status da rota ou os consumidores da SPA; verificar campos antigos e execução E2E.
- A aplicação deve compilar os módulos Vite em middleware mode sem abrir um servidor WebSocket standalone em conflito; comprovar o endpoint SPA e um módulo transformado durante o smoke local.

---

### Task 1: Restaurar a verificação TypeScript e a configuração local Vite

**Files:**
- Modify: `check-front.js`
- Modify: `server.ts` — configuração Vite em `startServer()`
- Modify: `src/components/BusinessDashboard.tsx` — identificador do grupo de categoria
- Modify: `tests/system-health.spec.ts` — matcher de unicidade de categorias

**Interfaces:**
- Consumes: scripts `npm run check` e `npm run dev`; tipo `CategoryGroupId` de `src/types.ts`; testes Playwright.
- Produces: `node --check check-front.js` sem erro sintático; `npm run check` sem erros TypeScript; configuração de middleware Vite válida para Vite 6 e compatível com o objetivo existente de não abrir WebSocket standalone.

- [ ] **Step 1: Reproduzir as falhas antes de alterar código**

Run: `node --check check-front.js`
Expected: FAIL apontando a string multilinha inválida no callback `page.evaluate`.

Run: `npm run check`
Expected: FAIL, primeiro pela sintaxe de `check-front.js`; após isolar esse erro localmente, a verificação adicional já observada aponta opção `server.ws` incompatível com o tipo Vite 6, dois usos de `ongs_artes�os` incompatíveis com `CategoryGroupId` e matcher Playwright com argumento excedente.

Run: `npx tsc --noEmit --allowJs false`
Expected: a verificação diagnóstica ignora somente a análise JavaScript e mostra os quatro erros TypeScript já observados; não usar essa opção como correção permanente nem alterar `tsconfig.json` para excluir fontes.

- [ ] **Step 2: Corrigir somente as causas reproduzidas**

Reparar a string passada a `page.evaluate` em `check-front.js` sem remover a verificação do helper. Na configuração Vite em middleware mode, trocar o valor numérico inválido de `server.ws` pela opção Vite 6 suportada que desativa o servidor WS standalone, preservando o comportamento pretendido para HMR. Corrigir os dois IDs corrompidos para o membro tipado `ongs_artesãos`. Colocar a mensagem de diagnóstico do teste de unicidade no primeiro `expect`, deixando `.toBe` com apenas o argumento esperado.

- [ ] **Step 3: Verificar a reparação**

Run: `node --check check-front.js`
Expected: exit code 0.

Run: `npm run check`
Expected: exit code 0, sem erros TypeScript.

- [ ] **Step 4: Commit do baseline**

```bash
git add check-front.js server.ts src/components/BusinessDashboard.tsx tests/system-health.spec.ts
git commit -m "fix: restore local type-check baseline"
```

---

### Task 2: Classificar a saúde de persistência sem esconder degradação

**Files:**
- Create: `server/healthService.ts`
- Create: `tests/unit/healthService.test.ts`
- Modify: `server.ts` — handler existente de `GET /api/health`
- Modify: `tests/unit/securityRoutes.test.ts` — contrato HTTP local sem PostgreSQL
- Modify: `tests/system-health.spec.ts` — expectations compatíveis com os estados documentados

**Interfaces:**
- Consumes: `checkDatabaseConnection()` e `databaseConfigured` de `server/db.ts`; campos de health response existentes.
- Produces:
  - `export type DatabaseHealth = { configured: boolean; connected: boolean }`
  - `export type HealthStatus = 'ok' | 'degraded'`
  - `export function classifyHealth(database: DatabaseHealth): HealthStatus`
  - `GET /api/health` mantém os campos atuais, com `status: 'degraded'` somente quando o PostgreSQL está configurado mas desconectado.

- [ ] **Step 1: Escrever testes unitários que falhem inicialmente**

Em `tests/unit/healthService.test.ts`, adicionar:

```ts
it('reports ok when local JSON mode has no configured database', () => {
  expect(classifyHealth({ configured: false, connected: false })).toBe('ok');
});

it('reports ok when configured PostgreSQL is connected', () => {
  expect(classifyHealth({ configured: true, connected: true })).toBe('ok');
});

it('reports degraded when configured PostgreSQL is disconnected', () => {
  expect(classifyHealth({ configured: true, connected: false })).toBe('degraded');
});
```

- [ ] **Step 2: Verificar RED**

Run: `npx vitest run tests/unit/healthService.test.ts`
Expected: FAIL porque `server/healthService.ts` e `classifyHealth` ainda não existem.

- [ ] **Step 3: Implementar classificador e ligar a rota**

Implementar `classifyHealth` em `server/healthService.ts` com a regra exata definida na interface. Usar o resultado no handler existente. Se `checkDatabaseConnection()` lançar, conservar `{ configured: true, connected: false }`, registar uma mensagem operacional sem credenciais e devolver a rota com HTTP 200 e `status: 'degraded'`; preservar `app`, `timestamp`, `geminiActive`, `database` e `observability`.

- [ ] **Step 4: Cobrir o contrato HTTP e os estados do consumidor E2E**

Em `tests/unit/securityRoutes.test.ts`, no ambiente de teste sem `DATABASE_URL`, afirmar que `/api/health` responde HTTP 200, `status: 'ok'`, `database.configured: false` e `database.connected: false`, mantendo `geminiActive` booleano. Em `tests/system-health.spec.ts`, substituir a exigência fixa de PostgreSQL ligado por assertions coerentes: sem base configurada, `ok`; base configurada e ligada, `ok`; base configurada mas desligada, `degraded`; manter os testes dos campos e do HTTP status.

- [ ] **Step 5: Verificar GREEN e regressões**

Run: `npx vitest run tests/unit/healthService.test.ts tests/unit/securityRoutes.test.ts`
Expected: PASS; três classificações e teste HTTP local aprovados.

Run: `npm run test:unit`
Expected: PASS para todos os testes antes aprovados; nenhum novo teste ignorado.

- [ ] **Step 6: Commit do contrato de saúde**

```bash
git add server/healthService.ts tests/unit/healthService.test.ts server.ts tests/unit/securityRoutes.test.ts tests/system-health.spec.ts
git commit -m "feat: report degraded database health explicitly"
```

---

### Task 3: Demonstrar arranque local e documentar operação degradada

**Files:**
- Modify: `docs/OPERATIONS.md`
- Verify: `server.ts`, `scripts/dev.mjs`, `index.html`, `src/main.tsx`, `tests/home.spec.ts`, `tests/system-health.spec.ts`

**Interfaces:**
- Consumes: classificação de saúde criada na Task 2 e comando de desenvolvimento já existente.
- Produces: instruções locais para modo JSON e PostgreSQL degradado; evidência runtime de SPA, módulo Vite transformado e endpoint de saúde.

- [ ] **Step 1: Atualizar runbook local**

Acrescentar a `docs/OPERATIONS.md` secção “Verificação local” com `npm run dev`, URL local, `npm run check`, `npm run test:unit`, `npm run build`, e a interpretação dos estados de `/api/health`: JSON local sem DB (`ok`, ambos os campos false), PostgreSQL conectado (`ok`), configurado mas desconectado (`degraded`). Não documentar credenciais nem apresentar integrações simuladas como reais.

- [ ] **Step 2: Iniciar desenvolvimento sem reutilizar dados locais**

Na mesma sessão PowerShell, definir `GUIGUI_DATA_DIR` para uma pasta nova sob `$env:TEMP`, `DATABASE_URL` para a string vazia (para impedir que `dotenv` carregue a configuração do `.env`) e `PORT=3000` se estiver livre. Iniciar `npm run dev` e manter o processo em execução. Não ler ou imprimir `.env`; não executar migrações, seed, importadores, backups nem endpoints de escrita.

- [ ] **Step 3: Verificar runtime por HTTP**

Fazer pedidos somente GET:

- `GET /` responde HTTP 200 e contém o elemento raiz da SPA.
- `GET /src/main.tsx` responde HTTP 200 com módulo transformado pelo Vite (não JSX cru).
- `GET /api/health` responde HTTP 200, `status: 'ok'`, `database.configured: false` e `database.connected: false`.

Se a porta 3000 estiver ocupada, iniciar com uma porta livre via `PORT` e definir o mesmo valor em `PW_PORT` na sessão usada pelo Playwright. Esperado: servidor continua estável, sem erro de compilação Vite nem servidor WebSocket standalone em conflito.

- [ ] **Step 4: Executar verificações de entrega**

Com o servidor isolado em execução e `GUIGUI_DATA_DIR`, `DATABASE_URL` e `PW_PORT` configurados para o mesmo ambiente isolado, Run: `npm run test:e2e`.
Expected: os fluxos E2E existentes passam; se algum requer PostgreSQL ou conta externa, reportar a dependência específica sem alterar a base ou enfraquecer o teste.

Run: `npm run build`
Expected: exit code 0 para frontend e bundle de produção do servidor.

- [ ] **Step 5: Limpar somente o processo e a pasta temporária criados pela validação**

Encerrar o processo iniciado no Step 2 e remover apenas o diretório temporário exato criado para `GUIGUI_DATA_DIR`; não tocar em `data/`, `backups/`, `.env` ou outros artefactos preexistentes.

- [ ] **Step 6: Commit da documentação e baseline verificado**

```bash
git add docs/OPERATIONS.md
git commit -m "docs: describe local degraded health verification"
```

---

## Final Verification

- [ ] `node --check check-front.js` passa.
- [ ] `npm run check` passa sem exclusões de ficheiros relevantes.
- [ ] `npm run test:unit` passa; reportar os skips existentes separadamente.
- [ ] `npm run build` passa.
- [ ] Smoke runtime confirma HTML SPA, módulo Vite transformado e estados de saúde esperados.
- [ ] `npm run test:e2e` é executado; reportar claramente quaisquer dependências ambientais.
- [ ] Apenas commits da especificação, das três fatias aprovadas e da documentação aparecem no histórico criado para esta tarefa; arquivos preexistentes continuam fora do staging.
