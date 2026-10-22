# Runbooks operacionais

Todos os incidentes devem preservar o `X-Request-Id`, horário UTC, versão e
ações executadas. Não copiar tokens, palavras-passe ou dados pessoais para
tickets de incidente.

## API indisponível ou latência elevada

1. Confirmar `/api/health`, logs estruturados e métricas por rota.
2. Verificar processo, CPU, memória, conexões PostgreSQL e dependências externas.
3. Reduzir tráfego ou pausar rollout; não reiniciar repetidamente sem registar.
4. Reverter para a última versão aprovada se a falha veio do deploy.
5. Validar login, compra, emissão e scanner após recuperação.

## Base de dados indisponível

1. Confirmar conectividade e estado do PostgreSQL sem expor a `DATABASE_URL`.
2. Pausar operações financeiras e de bilhetes se a consistência não puder ser garantida.
3. Restaurar apenas em ambiente aprovado, usando o procedimento de backup.
4. Validar contagens, referências, pagamentos e bilhetes antes de reabrir tráfego.

## Fila parada ou jobs acumulados

1. Consultar estados `pending`, `processing` e `dead_letter` em `async_jobs`.
2. Verificar worker e dependências do tipo de job.
3. Corrigir a causa, executar `npm run worker` de forma controlada e observar retries.
4. Não reprocessar sem `idempotency_key`; investigar dead-letter antes de reencaminhar.

## Pagamento falhado ou webhook atrasado

1. Confirmar assinatura, `providerRef`, estado e `requestId`.
2. Não confirmar manualmente sem prova no provedor.
3. Reprocessar somente com idempotência e auditoria.
4. Confirmar que refund, comissão e bilhete mantêm estados consistentes.

## Conta comprometida ou suspeita de fraude

1. Revogar todas as sessões e preservar evidências de auditoria.
2. Bloquear operações de pagamento relacionadas enquanto se investiga.
3. Forçar alteração de password e MFA quando aplicável.
4. Comunicar ao responsável de segurança e seguir o procedimento de incidente de dados.

## Backup falhado ou recuperação total

1. Não declarar o backup válido apenas porque o ficheiro existe.
2. Executar `npm run backup:postgres:verify`.
3. Restaurar numa base isolada, validar schema, contagens e fluxos críticos.
4. Registar RPO, RTO, perda de dados e aprovação do DBA.
