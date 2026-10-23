# Fundação PostgreSQL

Esta pasta contém a primeira migração relacional do Guigui.com.

## Estado atual

O runtime usa PostgreSQL quando `DATABASE_URL` está configurada e mantém
fallback explícito para os repositórios JSON durante desenvolvimento e migração.
Os domínios principais (utilizadores, sessões, empresas, eventos, bilhetes,
pagamentos, auditoria, moderação, comunicações e monetização) já têm serviços
PostgreSQL; preferências de interface continuam no `localStorage`.

## Preparação local

1. Copie `.env.example` para `.env`.
2. Substitua `DATABASE_URL` por uma ligação PostgreSQL local ou de teste.
3. Crie a base de dados vazia.
4. Execute `db/migrations/001_initial_schema.sql` com uma ferramenta de
   migração controlada.
5. Só depois migre um domínio por vez: utilizadores, sessões, empresas,
   eventos, pedidos, pagamentos, bilhetes e auditoria.

Em produção, defina também `SESSION_COOKIE_SECRET`, `TICKET_SIGNING_SECRET`,
`PAYMENT_WEBHOOK_SECRET` e `SCANNER_DOOR_CODE`. As contas demo só ficam
disponíveis fora de produção ou quando `ENABLE_DEMO_ACCOUNTS=true` é definido
explicitamente; mantenha essa variável como `false` em produção.

## Testes de integração
Os serviços PostgreSQL (`postgresAuthService`, `postgresPaymentService`,
`postgresModerationService`, entre outros) têm testes de integração que correm
contra uma base de dados real:

1. Crie uma base de dados vazia para testes.
2. Defina `TEST_DATABASE_URL` (por exemplo
   `postgres://user:pass@localhost:5432/guigui_test`).
3. Execute `npm run test:integration`.

Os testes criam o subconjunto de schema que precisam, limpam as tabelas entre
casos e cobrem os caminhos CRUD e de erro. Sem `TEST_DATABASE_URL`, estes testes
são ignorados automaticamente, pelo que `npm run test:unit` continua a passar sem
base de dados.

## Regras

- Nunca coloque credenciais reais em `.env.example`.
- Não apague os JSON atuais durante a migração.
- Faça backup antes de cada migração de dados.
- Valide contagens e referências depois de cada importação.
- O fallback para JSON deve ser explícito e observável, nunca silencioso.

## Operação, RPO e RTO

- RPO alvo local: 24 horas até existir backup externo automatizado.
- RTO alvo local: 4 horas, condicionado à disponibilidade de PostgreSQL e do snapshot JSON.
- Antes de uma migração, executar `npm run backup:json` e guardar o diretório gerado fora do processo da aplicação.
- Restaurar primeiro a base PostgreSQL num ambiente de teste, aplicar a migração SQL e importar os snapshots por domínio.
- Validar `/api/health`, contagens por domínio e os fluxos de pagamento/bilhete antes de reabrir tráfego.
- Backups externos, encriptação em repouso e teste automatizado de restauração ainda são requisitos de produção pendentes.
