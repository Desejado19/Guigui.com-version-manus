# Especificação: configuração e arranque da plataforma Guigui.com

**Estado:** proposta para revisão do utilizador  
**Data:** 2026-10-22  
**Contexto:** `platform-foundation` — configuração de runtime e preparação de hosting  
**Compatibilidade:** preservar os contratos e efeitos atuais durante a extração

## Objetivo

Tornar explícita e testável a configuração transversal e a preparação de runtime do backend, sem alterar os fluxos de negócio, a persistência ou o comportamento público. A aplicação permanece um monólito Express/Vite num único processo. `server.ts` continua a compor as rotas; a fundação passa a fornecer configuração de runtime tipada e uma preparação Vercel explicitamente invocada antes de importar o servidor.

O público desta fatia é a equipa que desenvolve e opera a aplicação. O resultado pretendido é tornar previsíveis os defaults e precedências de ambiente, reduzir efeitos ocultos de importação e detetar regressões no arranque local e Vercel.

## Contexto observado

- `server.ts` lê configuração transversal (`NODE_ENV`, `PORT`, `APP_URL`, `CORS_ALLOWED_ORIGINS`, `VERCEL`) e também configuração pertencente a domínios e integrações.
- `server/bootstrapVercel.ts` aplica defaults de produção, URL, CORS e diretório de dados, cria esse diretório e copia ficheiros JSON iniciais por efeito colateral da importação.
- `server/db.ts` lê `DATABASE_URL` e instancia o pool PostgreSQL no adaptador de persistência.
- `server/authService.ts` e `server/runtimeStore.ts` capturam `GUIGUI_DATA_DIR` ao serem importados. Portanto, chamar o bootstrap dentro de `server.ts` depois dos imports estáticos pode selecionar o diretório tarde demais.
- Os lançadores observados são `scripts/dev.mjs`, `scripts/start-production.mjs` e `index.mjs` para Vercel; o build atual produz `dist/server.mjs`.
- A extração de `GET /api/health` e do submódulo de observabilidade já está no histórico. Não se repetem essas fatias.
- `server.ts` continua a possuir a composição de rotas e regista tarefas de domínio, incluindo limpeza de reservas, fora do `startServer()`. Esta especificação não move nem redefine esses agendamentos.
- A especificação de migração modular define `platform-foundation` como proprietário de inicialização, configuração, saúde, observabilidade e contratos técnicos comuns; não de regras de negócio.

## Âmbito

### Incluído

- Leitura pura e tipada das definições transversais de runtime.
- Precedência e defaults existentes de ambiente para modo de execução, porta, URL pública, origens CORS e deteção Vercel.
- Um entrypoint fino comum ou coordenado para desenvolvimento, produção e Vercel que carrega `.env`, chama explicitamente a preparação Vercel e só depois importa dinamicamente o módulo do servidor.
- Preparação Vercel explicitamente chamada, preservando defaults e cópia inicial de JSON já suportados.
- Testes de compatibilidade para defaults, precedência, preparação idempotente e ausência de arranque durante a importação dos módulos de configuração/preparação.
- Atualização da documentação para descrever apenas a fronteira efetivamente extraída.

### Excluído

- Mover rotas, casos de uso, regras comerciais, integrações ou persistência para novos módulos.
- Alterar os contratos HTTP, permissões, respostas, política de disponibilidade ou nomes de variáveis de ambiente.
- Alterar a semântica de `DATABASE_URL`, o pool PostgreSQL ou a escolha PostgreSQL/JSON local.
- Mover rate limiting, backups, processamento de bilhetes, itens agendados de domínio ou tarefas de outros contextos.
- Alterar segredos de sessão, scanner, bilhetes, pagamentos, chaves de IA, feature flags ou configuração de fornecedores.
- Reorganizar o ciclo de vida completo do servidor, criar worker/processo adicional, ou alterar comportamento de produção.
- Alterar schema, executar migrações/importações, modificar dados, adicionar dependências ou realizar deploy.

## Fronteira e propriedade

| Configuração ou comportamento | Proprietário nesta fatia |
|---|---|
| `NODE_ENV`, `PORT`, `APP_URL`, `CORS_ALLOWED_ORIGINS` | Contrato de runtime `platform-foundation` |
| `VERCEL`, `VERCEL_URL`, defaults de hosting e `GUIGUI_DATA_DIR` durante preparação Vercel | Adaptador de preparação Vercel de `platform-foundation` |
| `DATABASE_URL` e pool PostgreSQL | Adaptador existente `server/db.ts` |
| Segredos, flags, funcionalidades, integrações e regras de negócio | Consumidores/adaptadores atuais; fora desta extração |
| Rotas e montagem Express/Vite | `server.ts`, como composition root |
| Ordem de preflight e importação do servidor | Entrypoint fino de runtime |

O contrato de runtime não deve copiar variáveis de domínio nem converter `platform-foundation` num repositório genérico de configuração para toda a aplicação.

## Arquitetura e fluxo

1. O entrypoint fino carrega `.env`.
2. O entrypoint chama explicitamente a preparação Vercel, quando aplicável.
3. Depois do bootstrap, o entrypoint importa dinamicamente o módulo do servidor; assim os módulos que capturam `GUIGUI_DATA_DIR` só são avaliados depois de o diretório ser definido.
4. `server.ts` chama uma função pura, por exemplo `loadPlatformRuntimeConfig(env)`, para receber os valores transversais tipados; a função não muta `process.env`, inicia timers ou abre portas.
5. A preparação Vercel mantém a responsabilidade pelos defaults atuais:
   - definir `NODE_ENV=production` quando `VERCEL` está ativo;
   - derivar `APP_URL` de `VERCEL_URL` apenas quando não existe URL explícita;
   - usar `APP_URL` para `CORS_ALLOWED_ORIGINS` apenas quando não existe configuração explícita;
   - usar `/tmp/guigui-data` como diretório Vercel predefinido, salvo `GUIGUI_DATA_DIR` explícito;
   - copiar apenas ficheiros `.json` em falta do diretório inicial, sem substituir ficheiros existentes.
6. `server.ts` usa a configuração transversal para compor middleware e iniciar o servidor, mantendo as rotas e tarefas de domínio no local atual. Os lançadores existentes delegam para o preflight sem duplicar a lógica Vercel.

Valores explícitos continuam a ter precedência sobre defaults derivados; defaults locais só se aplicam quando a configuração relevante está ausente. A interpretação atual da porta (`Number(PORT) || 3000`), a separação de origens CORS por vírgulas e os fallbacks de URL específicos de cada consumidor são preservados nesta extração. Não se unificam fallbacks diferentes de `APP_URL`, pois isso poderia alterar links ou endpoints observáveis.

## Erros e segurança operacional

- Falhas durante a preparação Vercel ou a construção de configuração são propagadas e impedem o arranque que depende delas; não são convertidas em sucesso vazio nem em mudança silenciosa de persistência.
- Regras atuais de configuração de produção permanecem sem alteração; esta especificação não adiciona nem remove validações de segredos.
- Mensagens de erro não devem incluir valores secretos do ambiente.
- A cópia Vercel é idempotente e não destrutiva: ficheiros existentes não são sobrescritos e ficheiros que não sejam JSON não são copiados.
- Não se promete que a falha posterior de Vite impeça todo e qualquer timer de domínio atualmente registado em `server.ts`; essa mudança de ciclo de vida é deliberadamente fora de âmbito.

## Tech stack

- Node.js, TypeScript, Express 4 e Vite 6.
- Vitest para testes unitários e de integração.
- Playwright para o smoke E2E existente.
- Nenhuma dependência nova.

## Estrutura proposta

```text
server/
  modules/
    platform-foundation/
      config/                 # contrato e leitura pura da configuração transversal
      hosting/                # preparação explícita específica de Vercel
      application/            # health existente
      observability/          # observabilidade existente
  bootstrapVercel.ts          # migrado para preparação explícita específica de hosting
  entrypoint.ts               # preflight e importação tardia do servidor, se necessário
server.ts                     # composition root; continua a montar rotas
scripts/dev.mjs               # delega ao entrypoint de runtime
scripts/start-production.mjs  # executa preflight antes de carregar o bundle
index.mjs                     # entrada Vercel; executa preflight antes de carregar o bundle
tests/unit/                   # testes de configuração e preparação Vercel
docs/superpowers/specs/       # especificações arquiteturais
docs/superpowers/plans/       # planos executáveis por fatia
```

As pastas só serão criadas quando houver código real para elas. Não se cria uma camada `common` genérica nem estruturas vazias.

## Convenções de código

- TypeScript estrito, nomes explícitos e dependências visíveis.
- A leitura pura recebe o ambiente como argumento; os testes não dependem de alterar o ambiente global.
- Efeitos de sistema de ficheiros ficam no adaptador de hosting e são exercitados com diretório temporário isolado.
- Seguir as convenções atuais de formatação, Vitest, Express e respostas REST.

Exemplo ilustrativo:

```ts
export function loadPlatformRuntimeConfig(env: NodeJS.ProcessEnv) {
  return {
    port: Number(env.PORT) || 3000,
    isProduction: env.NODE_ENV === 'production',
    allowedOrigins: (env.CORS_ALLOWED_ORIGINS || env.APP_URL || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
```

O exemplo fixa o comportamento já observado; o tipo de retorno final deve ser explícito e preservar os fallbacks específicos de cada consumidor.

## Estratégia de testes

1. **Unitários de configuração:** modo local, modo produção, defaults, valores explícitos, precedência Vercel e origens CORS múltiplas/vazias.
2. **Preparação Vercel isolada:** diretório temporário; defaults Vercel derivados de `VERCEL_URL`; `GUIGUI_DATA_DIR` explícito; cópia apenas de JSON ausentes; ficheiros existentes preservados; segunda execução sem efeitos destrutivos.
3. **Ordem de importação:** um teste do entrypoint, com preparação e carregamento da aplicação substituídos por funções controladas, confirma que a preparação Vercel ocorre antes de carregar módulos que capturam o diretório de dados; importar os módulos puros de configuração/preparação não abre listener nem inicia timers.
4. **Regressão:** manter testes atuais de health e observabilidade, garantindo o contrato local sem PostgreSQL e o comportamento existente de produção.
5. **Verificação do projeto:** suite unitária completa, type-check, build e teste E2E focado de arranque local.
6. Não usar credenciais reais, serviços PostgreSQL reais, dados de produção, deploy ou migrações para estes testes.

## Comandos de verificação

Executar na raiz do projeto:

```text
npm run test:unit -- tests/unit/platform-foundation-config.test.ts tests/unit/platform-foundation-vercel.test.ts
npm run test:unit -- --maxWorkers=1 --no-file-parallelism
npm run check
npm run build
npm run dev
PW_PORT=3102 npm run test:e2e -- tests/system-health.spec.ts --grep "health: API reports the process and persistence state accurately"
```

No PowerShell, definir `PW_PORT` com `$env:PW_PORT='3102'` antes do comando Playwright. O smoke E2E deve usar diretório JSON temporário e PostgreSQL desativado; parar apenas o processo iniciado para o teste e remover apenas o diretório temporário criado.

## Limites

- **Sempre:** preservar contratos e defaults observáveis; manter o monólito num processo; testar configuração por injeção do ambiente; registar falhas sem expor segredos; manter preparação Vercel repetível e não destrutiva.
- **Pedir aprovação antes:** alterar nomes/defaults de variáveis, regras de produção, fallbacks de URL, política CORS, comportamento de persistência, schema, dependências, deploy ou dados.
- **Nunca:** incluir segredos no código/logs; esconder erros de inicialização; usar fallback JSON quando PostgreSQL foi escolhido e falhou; alterar rotas ou regras de domínio como efeito colateral; afirmar que um deploy real foi validado sem o executar.

## Critérios de sucesso

- Existe uma função pura e tipada para ler a configuração transversal acordada, e a composição deixa de duplicar essa interpretação.
- Os valores explícitos vencem defaults Vercel; os defaults Vercel e locais preservam a precedência observada.
- Os entrypoints de desenvolvimento, produção Node e Vercel fazem a preparação explícita antes da importação do servidor, mantendo `APP_URL`, CORS e diretório de dados compatíveis, sem sobrescrever JSON existentes.
- Configuração/preparação podem ser importadas em testes sem abrir listener ou iniciar timers.
- Erros de configuração/preparação não são ocultados nem permitem que a parte do arranque dependente deles reporte sucesso.
- Persistência, health, observabilidade, contratos HTTP, permissões e fluxos de domínio permanecem compatíveis.
- Os testes unitários focados e completos, `npm run check`, `npm run build` e o smoke E2E focado passam sem reduzir as verificações existentes.
- A documentação descreve apenas a fronteira realmente extraída.

## Aprovação e trabalho subsequente

Esta especificação propõe a fronteira e os critérios; não autoriza a implementação. Após aprovação do documento, será criado um plano de implementação independente para esta fatia de `platform-foundation`. Os contextos de negócio continuam a exigir os seus próprios levantamentos de rotas, dados, consumidores e testes antes de qualquer extração.

## Questões em aberto

- Nenhuma decisão de âmbito ficou em aberto após a aprovação da fronteira incremental, do tratamento de Vercel e dos critérios de fiabilidade. A revisão escrita do utilizador continua necessária antes de criar o plano.
