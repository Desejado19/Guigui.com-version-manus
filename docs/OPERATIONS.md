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
executado continuamente com `npm run worker` e requer `DATABASE_URL` e uma
ligação PostgreSQL válida em qualquer ambiente. O processo verifica e executa
retenção operacional na inicialização e, depois, de hora a hora; enquanto não
houver handlers registados, não reivindica jobs.

O worker processa um job de cada vez, renova o lease a cada minuto e para de
reivindicar jobs ao receber `SIGINT` ou `SIGTERM`, concluindo o job ativo antes
de fechar a ligação. Falhas de acesso à base usam espera exponencial até 30
segundos; se o lease for perdido, o handler recebe um `AbortSignal` e o job não
é confirmado pelo worker antigo.

A entrega é **at-least-once**: um processo pode cair depois de executar o efeito
e antes de confirmar o job. Cada handler futuro deve usar `idempotencyKey` para
evitar efeitos duplicados. Handlers pertencem aos contextos de negócio e só
devem ser registados quando a integração correspondente estiver implementada e
configurada. Sem handler, o job permanece na fila para um worker compatível.
