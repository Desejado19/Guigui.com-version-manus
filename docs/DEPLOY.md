# Deploy do Guigui.com — Render (recomendado) e Vercel

Este sistema é um servidor Express monolítico (frontend + API no mesmo processo,
com sessões em cookie, uploads e estado em ficheiros JSON ou PostgreSQL).
Por isso, a plataforma mais adequada é o **Render** (servidor de longa duração).
A Vercel funciona em modo serverless e é uma alternativa possível, mas menos ideal.

---

## Opção A — Render (recomendado)

O repositório já contém o blueprint `render.yaml`, que define o serviço web
(`npm install && npm run build` → `npm run start`), health check em
`/api/health` e as variáveis de ambiente necessárias.

### Passo 1 — Colocar o código no GitHub

O Render faz deploy a partir de um repositório Git. Crie um repositório e faça
push do conteúdo desta pasta (a pasta do projeto é `Guigui.com-tema-escuro-testado/`):

```bash
cd Guigui.com-tema-escuro-testado
git init
git add .
git commit -m "Deploy inicial Guigui.com"
git branch -M main
git remote add origin https://github.com/SEU_UTILIZADOR/guigui.git
git push -u origin main
```

### Passo 2 — Criar a base de dados PostgreSQL (importante)

Sem `DATABASE_URL`, o sistema guarda tudo em ficheiros JSON na pasta `data/`,
que **se perdem a cada reinício** no plano gratuito do Render. Para um sistema
acessível ao público, crie uma base de dados:

- No Render: "New +" → "PostgreSQL" (plano free existe, mas expira; o plano
  starter é melhor para produção), OU
- No [Neon.tech](https://neon.tech) (free e estável): copie a connection string.

Aplique as migrações e o catálogo de categorias depois do primeiro deploy
(o projeto tem scripts prontos):

```bash
npm run db:migrate
npm run db:seed-demo   # se quiser dados de demonstração
```

### Passo 3 — Criar o serviço web

1. No painel do Render: "New +" → **"Blueprint"** → escolha o repositório.
   O Render deteta o `render.yaml` e cria o serviço automaticamente.
2. Preencha as variáveis marcadas com `sync: false` no painel:
   - `APP_URL` → ex.: `https://guigui.onrender.com` (a URL que o Render atribuir)
   - `CORS_ALLOWED_ORIGINS` → a mesma URL
   - `DATABASE_URL` → a connection string do passo 2
   - `SCANNER_DOOR_CODE` e `GUIGUI_BACKUP_ENCRYPTION_KEY` → valores privados
     (gere com `openssl rand -hex 32`)
3. Clique em "Apply". O Render faz build e start e dá-lhe uma URL pública
   tipo `https://guigui-xxxx.onrender.com` — é essa URL que partilha com as
   pessoas.

### Passo 4 — Migrar a base de dados (se usar PostgreSQL)

Com o serviço criado e o `DATABASE_URL` no painel, execute uma vez a partir
da sua máquina (ou via Render Shell no plano pago):

```bash
DATABASE_URL="postgres://..." npm run db:migrate
```

### Notas sobre o plano free do Render

- O serviço "dorme" após ~15 min sem tráfego e demora ~30-60 s a acordar.
- Disco efémero: qualquer dado em JSON `data/` é perdido a cada deploy/restart.
- Para um sistema público sério, considere o plano Starter ($7/mês) + Postgres.

---

## Opção B — Vercel (alternativa)

O projeto já tem `vercel.json` com `framework: express` e um adaptador
(`prepareVercelRuntime.ts`) que prepara o runtime para a Vercel.

1. Instale a CLI: `npm i -g vercel`
2. Na pasta do projeto: `vercel` (segue o assistente) e depois `vercel --prod`
3. Configure as variáveis de ambiente no dashboard da Vercel (Settings →
   Environment Variables): as mesmas do Render (`DATABASE_URL`, segredos, etc.).
   A `APP_URL` é preenchida automaticamente a partir de `VERCEL_URL`.

**Limitações importantes na Vercel:**
- Funções serverless: cada request pode correr num processo novo; ficheiros
  escritos em `data/` vivem em `/tmp` e **não persistem** entre invocações.
  O PostgreSQL passa a ser obrigatório.
- O servidor faz `app.listen(PORT)` — funciona com o adaptador Express da
  Vercel, mas qualquer funcionalidade de longa duração (scheduler de backups,
  workers) não se comporta bem.
- Timeouts de 10 s-60 s nos planos normais podem cortar operações pesadas
  (backups, uploads grandes).

**Conclusão:** use o Render (ou um VPS/Railway/Fly.io) para este projeto;
a Vercel só é recomendável se o backend for totalmente migrado para Postgres
e rotas sem estado.

---

## Checklist de produção

- [ ] `NODE_ENV=production`
- [ ] `ENABLE_DEMO_ACCOUNTS=false` (não expor contas demo ao público)
- [ ] `SESSION_COOKIE_SECRET`, `MFA_SECRET`, `TICKET_SIGNING_SECRET`,
      `PAYMENT_WEBHOOK_SECRET` — valores únicos e privados
- [ ] `GUIGUI_BACKUP_ENCRYPTION_KEY` definido (obrigatório em produção)
- [ ] `DATABASE_URL` de um Postgeress gerido (Render/Neon) — não JSON em disco
- [ ] `APP_URL` e `CORS_ALLOWED_ORIGINS` apontando para o domínio final
- [ ] Health check: `https://SEU-DOMINIO/api/health` deve responder com JSON
- [ ] Correr `npm run db:migrate` contra a base de dados de produção
