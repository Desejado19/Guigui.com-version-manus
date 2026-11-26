---
name: software-architecture
description: Decisoes de arquitetura do Guigui.com (React 19 + Vite no browser, Express + PostgreSQL no servidor). Usar ao criar modulos, mover responsabilidades entre camadas, ou avaliar se uma alteracao pertence ao cliente ou ao servidor.
---

# Arquitetura — Guigui.com

## Forma atual

- **Browser**: `src/` — React 19, Vite 6, Tailwind 4. Estado da aplicacao em `src/App.tsx` (grande, centralizador) e servicos em `src/services/`.
- **Servidor**: `server.ts` (arranque e rotas) + `server/*.ts` (servicos concretos, muitos `postgres*Service.ts`).
- **Modulos de dominio**: `server/modules/` (ex.: `platform-foundation/`), com portas, casos de uso e adaptadores separados.
- **Base de dados**: PostgreSQL via `pg`, acesso por servico; sem ORM.
- **Tips**: `src/types.ts` e a fonte de verdade dos contratos partilhados entre browser e servidor.

## Regras

1. **Regra de negocio no servidor.** O cliente apresenta e pede; nunca decide precos, permissoes, planos, stock de bilhetes ou estados de moderacao.
2. **Autorizacao no servidor.** Toda a rota que altera dados verifica sessao e permissao antes de escrever. Ver `server/platformWriteAccess.ts` como referencia.
3. **Camadas com direccao unica**: rota -> caso de uso -> porta -> adaptador Postgres. Uma rota nao fala SQL diretamente quando ja existe servico.
4. **Sem dependencias circulares** entre `src/components` e `src/services`. Utilitarios puros vivem em `src/utils/`.
5. **Um componente, uma responsabilidade visual.** Se um ficheiro passa de ~600 linhas e mistura dados e apresentacao, extrair.
6. **Nada de `if` por nome de plano, categoria ou empresa.** Ver `ddd-architecture` e `multi-tenant-saas`.

## Antes de aceitar uma alteracao

- [ ] A regra ficou no servidor?
- [ ] O cliente trata o erro (estado vazio, mensagem, retry)?
- [ ] Os tipos em `src/types.ts` foram atualizados em vez de usar `any`?
- [ ] `npm run check` passa?
- [ ] Nenhum ficheiro novo duplica um servico existente (procurar antes de criar)?

## Anti-padroes vistos neste projeto

- Copias orfas de componentes (ha um `AdminDashboard` em `.quarantine/`, resultado de uma duplicacao anterior).
- Paginacao caseira (`.slice(0, 50)`) em vez de `usePaginatedList` + `AdminPagination`.
- Navbar horizontal reimplementada por modulo em vez de `SubmoduleNavbar`.
- Ecrãs que mostram chaves de traducao cruas por nao existir a chave.
