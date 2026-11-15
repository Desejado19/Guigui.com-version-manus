---
name: postgresql-expert
description: PostgreSQL no Guigui.com via driver `pg` (sem ORM). Usar ao escrever consultas, indices, transaccoes, migracoes ou diagnosticar lentidao e bloqueios.
---

# PostgreSQL — Guigui.com

## Acesso

- Driver: `pg` (`Pool`), configuracao em `server/db.ts`.
- Servicos: um ficheiro por area (`postgresTicketService.ts`, `postgresPaymentService.ts`, `postgresModerationService.ts`, ...).
- Migracoes: `db/` + `scripts/migrate-db.ts` (`npm run db:migrate`).
- Backup: `npm run backup:postgres` e `npm run backup:postgres:verify`.

## Regras

1. **Sempre parametrizado** (`$1`, `$2`). Concatenacao de strings em SQL e proibida.
2. **Transacao para operacoes compostas** (compra de bilhete = debitar stock + criar bilhete + registar pagamento). Usar `BEGIN/COMMIT/ROLLBACK` com `client` do pool.
3. **`SELECT ... FOR UPDATE`** ao reservar stock, para evitar venda dupla em concorrencia.
4. **Indices para os filtros reais**: estado, `business_id`, datas (`created_at`), `event_id`, e pesquisa textual quando usada.
5. **Dinheiro em inteiros** (XOF) — nunca `float`. Guardar moeda e valor separados quando aplicavel.
6. **`timestamptz`** para datas; comparar sempre em UTC e formatar no cliente.
7. **Paginar no servidor** em listas que crescem (bilhetes, ledger, auditoria): `LIMIT`/`OFFSET` com `ORDER BY` deterministico, ou keyset pagination.
8. **Sem `SELECT *`** em tabelas largas; listar colunas.

## Diagnostico

```sql
-- consultas lentas
SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
-- indices em falta numa tabela
SELECT relname, seq_scan, idx_scan FROM pg_stat_user_tables WHERE seq_scan > idx_scan;
-- bloqueios
SELECT pid, state, wait_event_type, query FROM pg_stat_activity WHERE state <> 'idle';
```

## Checklist

- [ ] Consulta parametrizada
- [ ] Transacao quando ha mais de uma escrita
- [ ] Indice para o filtro novo
- [ ] `npm run test:integration` (servicos Postgres) passa
- [ ] Migracao reversivel ou com plano de rollback
