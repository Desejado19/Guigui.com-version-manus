---
name: senior-fullstack-developer
description: Fluxo de trabalho full stack neste repositorio (React 19 + Vite no cliente, Express + PostgreSQL no servidor, scripts de auditoria proprios). Usar em qualquer tarefa de implementacao de ponta a ponta.
---

# Full stack — Guigui.com

## Mapa rapido

| Zona | Onde |
|---|---|
| Entrada do cliente | `src/main.tsx`, `src/App.tsx` |
| Componentes | `src/components/**`, UI base em `src/components/ui/**` |
| Estado persistente | `src/utils/persistentState.ts` (`usePersistentState`) |
| Chamadas a API | `fetch('/api/...')` dentro dos componentes/servicos |
| Servidor | `server.ts` + `server/*.ts` |
| Esquema e migracoes | `db/`, `scripts/migrate-db.ts` |
| Tipos partilhados | `src/types.ts` |

## Ciclo de trabalho

1. **Ler antes de escrever**: procurar implementacao existente (`rg` por nome de componente/rota) para nao duplicar.
2. **Tipos primeiro** em `src/types.ts`, depois servidor, depois UI.
3. **Alteracoes pequenas** com verificacao entre blocos.
4. **Verificar**: `npm run check`; se tocou dados, o script de auditoria do dominio.
5. **Confirmar no browser** quando o comportamento e visual.

## Regras do projeto

1. **Porta 3000** em desenvolvimento. Arranque: `npm run dev` (no Windows, se o `cmd` reclamar de `GUIGUI_DEV_REEXEC`, correr `node -r tsx/esm scripts/dev.mjs`).
2. **Nunca commitar segredos.** `.env` fica fora do repositorio; chaves de API vao para variaveis de ambiente.
3. **Nao usar `any`** para calar o compilador; alinhar `src/types.ts`.
4. **Cores so da paleta** definida em `src/index.css` (`--color-green-*`, `--color-coral-*`, `--color-gold-*`, neutros quentes). Ver `frontend` em `DESIGN-SYSTEM-DIAGNOSTICO-E-PROPOSTA.md`.
5. **Textos novos precisam de traducao** nos 4 idiomas (`src/utils/i18n.ts`: pt, en, fr, es) e passar `npm run audit:i18n`.
6. **Componentes partilhados obrigatorios**: `AdminPagination` + `usePaginatedList` para paginacao; `SubmoduleNavbar` para submódulos; `SectionHeader` para cabecalhos; `BusinessLogo` para logotipos (nunca `<img src="">`).

## Antes de dizer que esta pronto

- [ ] `npm run check` limpo
- [ ] `npm run audit:i18n` sem chaves em falta (se houve texto novo)
- [ ] Script de auditoria do dominio relevante
- [ ] Fluxo exercitado no browser com dados reais (nao so compilado)
- [ ] Nenhum ficheiro temporario deixado no repositorio
