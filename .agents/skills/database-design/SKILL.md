---
name: database-design
description: Modelacao e normalizacao de dados do Guigui.com (PostgreSQL). Usar ao criar tabelas, relacoes, chaves, ou ao decidir entre normalizar e desnormalizar.
---

# Modelacao de dados — Guigui.com

## Entidades centrais

`businesses` · `users` · `events` · `ticket_types` · `tickets` · `purchase_orders` · `payments` · `promotions` · `subscription_plans` · `plan_versions` · `subscriptions` · `moderation_items` · `audit_logs` · `notifications`

## Regras de normalizacao

1. **1FN** — um valor por coluna. Listas (galeria, categorias detectadas) vao para tabela propria ou `jsonb` **quando sao documento**, nao quando sao pesquisaveis.
2. **2FN** — cada atributo depende da chave completa. Tabelas de juncao (`plan_features`, `ticket_types`) levam chave composta.
3. **3FN** — nenhum atributo depende de outro nao-chave. Evitar guardar `business_name` dentro de `tickets` **exceto** quando e uma fotografia historica intencional (recibo deve preservar o nome no momento da compra).
4. **Desnormalizar de proposito e documentar.** Se copiar um valor para leitura rapida, escrever no comentario da migracao por que motivo.

## Convencoes

- Chaves: `id` texto quando vem do cliente (`biz-...`, `evt-...`), `uuid` quando e interno.
- FKs com `ON DELETE RESTRICT` por omissao; `CASCADE` so em filhos puros (ex.: `ticket_types` de um evento).
- Dinheiro: inteiro em XOF (`price_xof`, `gross_amount`), moeda em coluna propria.
- Datas: `timestamptz`, nunca texto.
- Estados: `text` + `CHECK` com a lista de literais, espelhando o tipo em `src/types.ts`.
- Toda a tabela tem `created_at` e `updated_at`.

## Perguntas antes de modelar

- [ ] Este valor e documento ou e dado pesquisavel? (decide `jsonb` vs tabela)
- [ ] Preciso de historico (versao) ou so do estado atual?
- [ ] A regra de negocio exige integridade referencial? -> FK + `CHECK`
- [ ] Vai crescer sem limite? -> planear particao ou purga com prazo
- [ ] O `src/types.ts` tem o tipo correspondente?

## Migracao

```bash
npm run db:migrate          # aplica migracoes
npm run backup:postgres     # antes de mudancas destrutivas
```
Alteracoes destrutivas seguem expand/contract: adicionar coluna nova, preencher, migrar codigo, so depois remover a antiga.
