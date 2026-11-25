# Entrega do sistema Guigui.com

Guia único para receber este repositório noutra conta/organização GitHub e pôr o
sistema a correr do zero. O README descreve o produto; este documento descreve o
que é preciso para o operar.

---

## 1. O que vai neste pacote

- Aplicação completa: React 19 + Vite (frontend) e Express + TypeScript
  (API, sessões, pagamentos, bilhética, moderação, auditoria) no mesmo processo.
- Esquema e dados de base de dados: `db/migrations/` (44 ficheiros, migrações e
  seeds) e `db/seeds/` (conjuntos sintéticos de 1 000 e 10 000 registos).
- Scripts operacionais: migração, importações, backups, auditorias de domínio,
  testes unitários (Vitest) e E2E (Playwright).
- Documentação: `docs/manual/` (manual funcional e de execução), `docs/relatorios/`
  (auditorias e validações), `docs/` (arquitectura, segurança, operações, deploy),
  `docs/openapi.json` (contrato da API).
- Configuração de deploy: `render.yaml` (Render), `vercel.json` (Vercel) e
  `.github/workflows/ci.yml` (CI em todas as branches).

## 2. Requisitos

| Componente | Versão | Notas |
| :--- | :--- | :--- |
| Node.js | 20 LTS ou superior | o CI usa 24, o blueprint do Render usa 22 |
| npm | 10+ | `package-lock.json` é o lockfile oficial (`npm ci` no CI) |
| PostgreSQL | 14+ | opcional em desenvolvimento, obrigatório em produção |
| Playwright | instalado por `npx playwright install` | só para `npm run test:e2e` |

O sistema também arranca **sem base de dados**: sem `DATABASE_URL` o backend usa
JSON em `data/` (`GUIGUI_DATA_DIR`) e mantém sessões, contas e conteúdo em ficheiro.
É o modo de demonstração; não usar assim em produção.

## 3. Arranque em cinco passos

```bash
git clone <url-do-repositorio> guigui && cd guigui
npm ci
cp .env.example .env          # Windows: copy .env.example .env
npm run dev                   # http://127.0.0.1:3000
curl -s http://127.0.0.1:3000/api/health | head -c 400
```

`GET /api/health` deve devolver `status: ok`, `database.configured` e
`database.connected` coerentes com a configuração usada.

Para produção:

```bash
npm run build                 # vite build + dist/server.mjs
NODE_ENV=production npm start # corre o preflight e o servidor compilado
```

`npm start` executa `npm run db:migrate` antes de arrancar (`prestart`), por isso
uma base vazia com `DATABASE_URL` válido fica migrada no primeiro arranque.

## 4. Variáveis de ambiente

A lista completa, comentada, está em `.env.example` (152 linhas). Mínimo para
desenvolvimento local:

```env
NODE_ENV=development
PORT=3000
APP_URL=http://127.0.0.1:3000
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000
ENABLE_DEMO_ACCOUNTS=true
```

Obrigatórias em produção (gerar valores próprios, nunca reutilizar os de exemplo):

| Variável | Para que serve | Como gerar |
| :--- | :--- | :--- |
| `DATABASE_URL` | ligação directa ao PostgreSQL | string do fornecedor da base |
| `APP_URL` | origem pública (cookies, convites, sitemap) | URL final do serviço |
| `SESSION_COOKIE_SECRET` | assinatura do cookie de sessão | `openssl rand -hex 32` |
| `MFA_SECRET` | segredo do segundo factor | `openssl rand -hex 32` |
| `TICKET_SIGNING_SECRET` | assinatura dos QR/PIN dos bilhetes | `openssl rand -hex 32` |
| `PAYMENT_WEBHOOK_SECRET` | autenticação dos callbacks de pagamento | `openssl rand -hex 32` |
| `SCANNER_DOOR_CODE` | código da equipa de porta | valor privado escolhido |
| `GUIGUI_BACKUP_ENCRYPTION_KEY` | cifra das cópias de segurança | `openssl rand -hex 32` |

Opcionais relevantes: `GEMINI_API_KEY` (moderação por IA; sem ela tudo funciona em
modo heurístico), `EMAIL_PROVIDER` + `BREVO_API_KEY`/`SMTP_*` (envio real de email),
`VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (login Google),
`RLS_ENABLED` (Row Level Security por pedido), `DATABASE_POOLER_URL` e os limites
`DATABASE_POOL_*`.

> `.env` está no `.gitignore` e nunca foi versionado neste repositório. Não há
> credenciais em código, em histórico Git ou em ficheiros de configuração.

## 5. Base de dados

```bash
# 1. criar a base (exemplo local)
createdb guigui

# 2. migrar (idempotente; --check só relata)
npm run db:migrate
npm run db:check

# 3. semear dados de demonstração (contas, empresas, eventos, bilhetes)
npm run db:seed-demo

# 4. (opcional) carregar o conjunto sintético de 10 000 registos
psql "$DATABASE_URL" -f db/seeds/guigui-synthetic-10000.sql
```

Migrações vivem em `db/migrations/` e são aplicadas por `scripts/migrate-db.ts`;
cada ficheiro corre uma vez e fica registado na tabela de controlo. Os dados JSON
em `data/` podem ser importados para PostgreSQL com `npm run db:import-users`,
`db:import-tickets`, `db:import-payments`, `db:import-audit`,
`db:import-moderation`, `db:import-businesses-events`, `db:import-monetization`
e `db:import-catalog`.

## 6. Acessos de demonstração

As contas do painel estão descritas no README (secção “Credenciais e Perfis de
Demonstração”) e usam `ENABLE_DEMO_ACCOUNTS=true`. As contas criadas por
`npm run db:seed-demo` estão em [DADOS-SEED-DEMO.md](manual/DADOS-SEED-DEMO.md),
com password única `Guigui2026!` — **trocar ou desactivar antes de produção**
(`ENABLE_DEMO_ACCOUNTS=false`).

## 7. Verificação antes de publicar

```bash
npm run check        # tsc --noEmit em app, servidor e scripts
npm run build        # build de produção + verificação de dist/
npm run test:unit    # Vitest (unitários e componentes)
npm run test:e2e     # Playwright (semeia dados antes, precisa de base)
npm run test:i18n    # coerência das traduções
npm run test:payments
npm run test:tickets
```

O CI (`.github/workflows/ci.yml`) corre `npm ci`, `check`, `build`, `test:unit`,
`test:payments`, `scripts/audit-ticket-validation.ts` e `npm audit` em cada push.

## 8. Estrutura do repositório

```text
.
├── src/                     React (componentes, serviços, i18n, estilos)
├── server/                  módulos do backend (domínio, observabilidade, plataforma)
├── shared/                  tipos e utilitários partilhados entre app e servidor
├── scripts/                 migração, seeds, importações, backups, auditorias
├── db/
│   ├── migrations/          esquema versionado (001…0xx)
│   └── seeds/               conjuntos sintéticos
├── tests/                   Vitest (unitários/componentes) e Playwright (E2E)
├── audit/                   specs de auditoria de API e autorização
├── docs/
│   ├── manual/              manual funcional, execução, dados demo, instruções técnicas
│   ├── relatorios/          auditorias, validações e relatórios de estado
│   ├── superpowers/         especificações e planos de migração
│   └── *.md                 arquitectura, segurança, operações, deploy, i18n
├── public/                  assets estáticos e uploads públicos
├── .github/workflows/       CI
├── render.yaml, vercel.json configuração de deploy
├── server.ts                composition root do Express
├── index.mjs                entrada serverless (Vercel)
└── package.json             scripts e dependências
```

Ficheiros de entrada: `npm run dev` → `scripts/dev.mjs`; produção →
`scripts/start-production.mjs`; Vercel → `index.mjs`.

## 9. Publicar noutra conta GitHub

O repositório actual está em `Desejado19/Guigui.com-version-manus`. Para o mover
ou duplicar:

**Opção A — histórico completo** (mantém todos os commits, ~120 MB de histórico
por causa de binários antigos como `.tools/node.exe`):

```bash
git clone --mirror https://github.com/Desejado19/Guigui.com-version-manus.git guigui.git
cd guigui.git
git remote set-url --push origin https://github.com/<nova-conta>/<novo-repo>.git
git push --mirror
```

**Opção B — histórico limpo** (recomendada para uma entrega nova: um único commit
com a árvore actual, sem os binários antigos):

```bash
git clone https://github.com/Desejado19/Guigui.com-version-manus.git guigui-entrega
cd guigui-entrega
git checkout entrega/historico-limpo
git push https://github.com/<nova-conta>/<novo-repo>.git HEAD:main
```

A branch `entrega/historico-limpo` existe exactamente para isto: um commit
“Entrega inicial do Guigui.com”, sem `.tools/`, sem zips e sem lixo de diagnóstico.
Depois de o repositório novo existir, ajuste a URL do remoto (`git remote set-url`)
e o `render.yaml`/Vercel para o novo endereço.

Em qualquer das opções: crie o repositório **vazio** na conta nova (sem README,
sem `.gitignore`, sem licença) para o primeiro push não colidir.

## 10. Deploy

- **Render** (recomendado, servidor de longa duração): `render.yaml` já define
  build (`npm install && npm run build`), start (`npm run start`), health check em
  `/api/health` e as variáveis base. Passos detalhados em [DEPLOY.md](DEPLOY.md).
- **Vercel** (serverless, alternativa): `vercel.json` + `index.mjs`; limitações de
  sistema de ficheiros e de sessões em memória estão descritas em `DEPLOY.md`.
- Base de dados gerida: qualquer PostgreSQL 14+ (Neon, Supabase, RDS, Render
  Postgres). Se usar pooler, defina `DATABASE_POOLER_URL` e deixe `DATABASE_URL`
  na ligação directa (migrações e backups precisam dela).

## 11. Segurança e segredos

- Nenhum segredo está versionado. `.env` está ignorado desde o primeiro commit.
- Antes de publicar: gerar todos os segredos da tabela do ponto 4, definir
  `ENABLE_DEMO_ACCOUNTS=false`, `NODE_ENV=production`, `TRUST_PROXY` conforme o
  proxy, e `CORS_ALLOWED_ORIGINS` apenas com as origens reais.
- `npm audit --omit=dev --audit-level=moderate` corre no CI; o repositório usa
  `overrides` para forçar versões corrigidas de `qs` e `esbuild`.
- Backups: `npm run backup:postgres` (cifrado com `GUIGUI_BACKUP_ENCRYPTION_KEY`),
  verificação com `backup:postgres:verify` e réplica opcional em
  `GUIGUI_BACKUP_REPLICA_DIR`.

## 12. O que foi limpo nesta preparação

Removido do versionamento (continua no histórico antigo, não na árvore):

- `.tools/` — runtime Node empacotado (83 MB) e `temp_opt/`.
- `Guigui.com-sistema-completo.zip` e `--whitespace=nowarn` (artefactos acidentais).
- Dumps de Playwright e diagnóstico: `pw-*.txt`, `diag-out.txt`, `build-output.txt`,
  `_msg-sample.json`, `__vitest_probe*.txt`, `escopo.txt`.
- Scripts de depuração sem qualquer referência no código (`debug-*.mjs`,
  `diag-*.mjs`, `check-front.*`, `qa-*.mjs`, `test-db*.js`, `list-*.mjs`, …).
- Lockfiles redundantes: `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `bun.lock`
  (o projecto é npm; o CI usa `npm ci` com `package-lock.json`).

Organização: relatórios e auditorias passaram para `docs/relatorios/`, manuais
para `docs/manual/`; os links relativos foram reescritos e verificados.

## 13. Limitações conhecidas

- O backend continua monolítico (Express num processo); a migração modular está
  especificada em `docs/superpowers/specs/` e ainda não concluída.
- Sem `DATABASE_URL`, o modo JSON não é multi-instância nem adequado a produção.
- A moderação por IA depende de `GEMINI_API_KEY`; sem chave usa heurísticas.
- `.tools/` removido: se algum script local antigo apontava para esse Node
  empacotado, use o Node do sistema (20+).
