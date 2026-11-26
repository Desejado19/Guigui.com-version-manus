# Operação de produção

## Verificação local

Inicie a aplicação integrada (Express + Vite) com:

```text
npm run dev
```

Por padrão, a interface e a API ficam disponíveis em `http://127.0.0.1:3000`.
Verifique a compilação TypeScript, os testes unitários e o build de produção
com:

```text
npm run check
npm run test:unit
npm run build
```

`GET /api/health` responde com HTTP 200 e distingue o estado do processo do
estado da persistência:

| Estado | `status` | `database.configured` | `database.connected` |
|---|---|---:|---:|
| Modo local JSON, sem `DATABASE_URL` | `ok` | `false` | `false` |
| PostgreSQL configurado e ligado | `ok` | `true` | `true` |
| PostgreSQL configurado, mas indisponível | `degraded` | `true` | `false` |

O estado `degraded` não ativa silenciosamente a persistência JSON: operações
que dependem da base de dados indisponível podem falhar e devem ser
diagnosticadas pela respetiva resposta ou log.

## Rollback

1. Pare o tráfego para a versão nova.
2. Reponha a imagem ou artefacto da última versão aprovada.
3. Não reverta migrações destrutivas; migrações deste projeto são aditivas.
4. Execute `npm run backup:postgres:verify` antes de reabrir tráfego.
5. Confirme `/api/health`, login, compra e validação de bilhetes.

## Jobs assíncronos

`async_jobs` suporta notificações, webhooks, exportações, backups e reconciliação.
Cada job pode usar `idempotency_key`, tem cinco tentativas por padrão, backoff
exponencial e estado `dead_letter` após esgotar as tentativas. O worker é
executado com `npm run worker`; handlers de integração devem ser ativados apenas
quando o respetivo fornecedor estiver configurado.
