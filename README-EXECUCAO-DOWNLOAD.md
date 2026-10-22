# Guigui.com — pacote descarregável

Este arquivo contém o código atualizado do Guigui.com, preservando a arquitetura React/Vite/Express original e as melhorias de segurança, validação e interface aplicadas durante o desenvolvimento.

## Requisitos

É necessário ter Node.js 18 ou superior e npm instalados. O projeto usa React, Vite, TypeScript e Express.

## Instalação local

Abra um terminal dentro da pasta do projeto e execute:

```bash
npm install
npm run check
npm run build
```

> `npm run check` (o mesmo que `npm run lint`) executa `tsc --noEmit` e é a validação de tipagem usada neste projeto.

Para iniciar a versão de produção localmente:

```bash
NODE_ENV=production PORT=3000 SCANNER_DOOR_CODE=defina-um-codigo TICKET_SIGNING_SECRET=defina-um-segredo-forte npm start
```

Depois abra `http://localhost:3000` no navegador.

Para desenvolvimento, pode executar:

```bash
npm run dev
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores adequados. Nunca utilize os valores de auditoria do ambiente público em produção.

| Variável | Finalidade |
|---|---|
| `NODE_ENV` | Define o ambiente de execução. Use `production` em produção. |
| `PORT` | Porta HTTP do servidor, normalmente `3000`. |
| `APP_URL` | URL pública da aplicação. |
| `CORS_ALLOWED_ORIGINS` | Origens permitidas, separadas por vírgulas, quando o frontend estiver noutro domínio. |
| `DATABASE_URL` | Ligação PostgreSQL. Se estiver ausente, o runtime usa o fallback JSON em `data/`. |
| `DATABASE_POOL_MAX` | Tamanho máximo do pool `pg` (default `10`). |
| `GUIGUI_DATA_DIR` | Pasta dos JSON (default `data`). |
| `GUIGUI_BACKUP_DIR` | Destino dos scripts de backup (default `backups`). |
| `ENABLE_DEMO_ACCOUNTS` | Contas de demonstração. Manter `false` em produção. |
| `SESSION_COOKIE_SECRET` | Assinatura dos cookies de sessão. Obrigatório em produção. |
| `MFA_SECRET` | Segredo da verificação em dois passos. Obrigatório em produção. |
| `TICKET_SIGNING_SECRET` | Segredo HMAC usado para assinar e validar bilhetes. Deve ser forte e privado. |
| `PAYMENT_WEBHOOK_SECRET` | Assinatura dos webhooks de pagamento. Obrigatório em produção. |
| `SCANNER_DOOR_CODE` | Código de autenticação do scanner de bilhetes. |
| `GEMINI_API_KEY` | Chave opcional para moderação Gemini, quando essa integração for ativada. |
| `SMTP_*` / `EMAIL_FROM` | Envio de convites e emails. Sem SMTP, o envio falha de forma controlada. |
| `PAYMENT_SANDBOX_AUTOCONFIRM` | `true` confirma automaticamente os pagamentos sandbox; `false` deixa pendente até webhook assinado. |
| `FEATURE_PRODUCT_ANALYTICS`, `FEATURE_PUBLIC_SEO`, `FEATURE_RECOMMENDATIONS` | Flags de produto. |

## Base de dados (PostgreSQL)

O runtime usa PostgreSQL quando `DATABASE_URL` está definida e mantém um fallback explícito para os repositórios JSON de `data/` quando não está. Estado atual do sistema: domínios principais (utilizadores, sessões, empresas, eventos, bilhetes, pagamentos, auditoria, moderação, comunicações e monetização) já têm serviços PostgreSQL.

Para preparar uma base local:

1. Crie a base vazia (por exemplo `guigui`).
2. Defina `DATABASE_URL` no `.env` ou no ambiente.
3. Aplique as migrações de `db/migrations/` (`001_initial_schema.sql`, `002_communication_schema.sql`, `002_marketing_scheduled_items.sql`) com uma ferramenta de migração controlada.
4. Opcionalmente, importe os JSON existentes com `npm run db:import-users`, `db:import-tickets`, `db:import-payments`, `db:import-audit`, `db:import-moderation`, `db:import-businesses-events`, `db:import-monetization` e `db:import-catalog`.
5. Confirme o estado em `GET /api/health` — a resposta indica `database.configured` e `database.connected`.

> **De onde vem o `DATABASE_URL`.** `server.ts` carrega o `.env` com `dotenv/config` na primeira linha; como o `dotenv` não sobrepõe variáveis já existentes, um `DATABASE_URL` definido no ambiente do sistema (por exemplo, variável de utilizador do Windows) tem prioridade sobre o valor do `.env`. Para confirmar a origem sem expor o segredo: PowerShell `[bool][Environment]::GetEnvironmentVariable('DATABASE_URL','User')` (apenas verifica existência) e `GET /api/health` → `database.configured` / `database.connected`.

## Validação local

```bash
npm run check          # tipagem (tsc --noEmit)
npm run test:i18n      # coerência das 4 línguas
npm run test:e2e       # Playwright (sobe o servidor automaticamente)
npm run test:payments  # e test:subscriptions, test:moderation, test:catalog,
                       # test:monetization, test:spec-integrations, test:follow
npm run test:tickets   # validação de bilhetes + fluxo completo (exige servidor a correr)
npm run test:load      # smoke de carga em LOAD_BASE_URL (default http://127.0.0.1:3013)
```

`npm run test:tickets` e `npm run test:load` são auditorias de integração: precisam de um servidor ativo (`npm run dev`) ou de `TEST_BASE_URL` / `LOAD_BASE_URL` a apontar para o endereço certo.

## Observações importantes

Com `DATABASE_URL` configurada, sessões, utilizadores, empresas, eventos, bilhetes, pagamentos, moderação, comunicações e auditoria ficam persistidos em PostgreSQL. Sem `DATABASE_URL`, o runtime recorre aos JSON de `data/`; nesse modo, ficheiros em falta são recriados e dados não gravados podem perder-se ao reiniciar o processo. A entrega não inclui autenticação de produção completa, pagamentos reais nem envio real de SMS: os adaptadores de pagamento funcionam em sandbox e os emails dependem de SMTP configurado.

O pacote não inclui `node_modules` nem a pasta `dist`; essas pastas são recriadas por `npm install` e `npm run build`. Também não inclui segredos privados nem os ficheiros temporários do ambiente de desenvolvimento.
