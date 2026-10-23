# Validação real dos painéis e idiomas

**Data:** 2026-10-06

## Resultado

- Os painéis de **Utilizador, Empresa e Administração** foram percorridos com Playwright real.
- Foram testados os quatro idiomas activos: **pt, en, fr e es**.
- Resultado visual: **3 testes aprovados** (12 combinações de perfil/idioma).
- O painel Admin deixou de apresentar referências visíveis ao idioma GW removido.
- O catálogo passou a validar **4 idiomas e 622 chaves**.
- A suite unitária passou: **237 testes aprovados**, com 21 testes PostgreSQL marcados como skipped por ausência de `TEST_DATABASE_URL`.
- O build frontend/backend passou.

## Persistência e aprovação de empresas

O workflow administrativo continua implementado com:

1. migração `db/migrations/005_company_approval_workflow.sql`;
2. endpoints autenticados para listar, aprovar e rejeitar empresas pendentes;
3. decisão persistida com actor, data, motivo e protecção contra segunda decisão;
4. teste de integração PostgreSQL real disponível em `tests/unit/postgresServices.integration.test.ts`.

Nesta execução o health check confirmou que o servidor está saudável, mas a instância actual está sem PostgreSQL configurado (`database.configured=false`, `database.connected=false`). Por isso, os testes que exigem uma base real ficam correctamente bloqueados/skipped até `TEST_DATABASE_URL` ser fornecida.

## Servidor

- Health local: `GET /api/health` respondeu `status: ok`.
- O servidor foi reiniciado em `0.0.0.0:3000`.
- O bundle foi reconstruído com `npm run build`.
