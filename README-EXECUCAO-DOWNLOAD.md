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

Em produção, `DATABASE_URL` e PostgreSQL acessível são obrigatórios; o serviço falha no arranque/readiness em vez de recorrer a JSON. Em desenvolvimento/testes, podem continuar a existir adaptadores locais enquanto a migração por contexto não estiver concluída. A existência de serviços PostgreSQL para alguns domínios não significa que todos os dados duráveis já estejam migrados.

Migrations e importações não executam no arranque:

1. Use uma base PostgreSQL sintética e descartável para validar.
2. Defina `DB_MIGRATION_URL` e execute `npm run db:migrate -- --confirm-target <nome-da-base>`.
3. Defina `IMPORT_DATABASE_URL` e execute primeiro um preview, por exemplo `npm run db:import-users -- --dry-run`.
4. Só uma escrita explícita, com `--apply --confirm-target <nome-da-base>`, pode importar registos; conflitos não sobrescrevem linhas existentes. Nesta iniciativa, não execute importações em produção.
5. Confirme o estado em `GET /api/health` — a resposta indica `database.configured` e `database.connected`.

Os comandos de migrations/import usam apenas as variáveis específicas acima; não carregam `.env` nem recorrem a `DATABASE_URL`. Nunca imprima ou registe URLs de ligação.

> **Separação de credenciais:** `DATABASE_URL` serve o runtime; `DB_MIGRATION_URL` serve migrations; `IMPORT_DATABASE_URL` serve importadores.

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
