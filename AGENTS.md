# Guigui.com — instruções para agentes

Plataforma de divulgação comercial e cultural (Bissau): React 19 + Vite 6 + Tailwind 4 no browser, Express + PostgreSQL no servidor.

## Skills do projeto

Ler a skill relevante **antes** de trabalhar na área. Ficam em `.agents/skills/<nome>/SKILL.md`.

| Skill | Quando usar |
|---|---|
| `software-architecture` | criar módulos, mover responsabilidades entre cliente e servidor |
| `ddd-architecture` | regras de domínio, casos de uso, políticas configuráveis |
| `senior-fullstack-developer` | qualquer tarefa de ponta a ponta |
| `typescript-expert` | modelar tipos, corrigir erros de compilação |
| `postgresql-expert` | consultas, índices, transações, migrações |
| `database-design` | novas tabelas, relações, normalização |
| `multi-tenant-saas` | planos, assinaturas, limites, isolamento por empresa |
| `owasp-security` | revisão de autenticação, rotas de escrita, uploads |
| `secure-coding` | validação de entrada, dinheiro, sessões |
| `code-review` | revisão do próprio diff antes de fechar |
| `playwright-testing` | testes E2E, unitários e de componente |

## Regras invioláveis

1. **O administrador define os planos.** Proibido `if (plan === 'PREMIUM')` — usar `entitlementService`.
2. **Autorização no servidor.** O cliente nunca decide permissões, preços ou stock.
3. **Não alterar regras de negócio para acomodar a interface.**
4. **Cores só da paleta** em `src/index.css` (`--color-green-*`, `--color-coral-*`, `--color-gold-*`, neutros quentes).
5. **Texto novo traduzido nos 4 idiomas** (`src/utils/i18n.ts`) e `npm run audit:i18n` limpo.
6. **Componentes únicos**: `AdminPagination` + `usePaginatedList`, `SubmoduleNavbar`, `SectionHeader`, `BusinessLogo`.
7. **Sem segredos no repositório.** Chaves em `.env` (não versionado).

## Verificação antes de terminar

```bash
npm run check                       # tsc --noEmit
npm run audit:i18n                  # chaves em falta
npm run test:unit                   # quando mexeu em lógica
npx playwright test tests/<x>.spec.ts   # quando mexeu em fluxo
```

Confirmar no browser o que é visual. "Compila" não é "funciona". Remover ficheiros temporários (`tmp-*.cjs`, `.tmp-*`) no fim.

## Contexto útil

- Desenvolvimento na porta 3000 (`npm run dev`; no Windows usar `node -r tsx/esm scripts/dev.mjs` se `GUIGUI_DEV_REEXEC` falhar no cmd).
- Documentos de referência: `docs/PLANO-MODULOS-PAGINACAO-GLASS-SAAS.md`, `DESIGN-SYSTEM-DIAGNOSTICO-E-PROPOSTA.md`, `MANUAL-FUNCIONAL-COMPLETO-GUIGUI.md`.
- Estado local guardado com `usePersistentState` (`src/utils/persistentState.ts`).
- Expiração de eventos/descontos: `src/utils/expiry.ts`.

## Cores

Paleta canonica em `src/index.css` (`PALETA CANONICA GUIGUI.COM`); regras completas
em `docs/PALETA-CORES-GUIGUI.md`.

- Nunca escrever hex em componentes: usar `var(--token)` ou classe da paleta.
- Graficos usam apenas `#1570EF`, `#2F9E68`, `#C9852A`, `#EC6640`.
- Validar com `npm run audit:colors`; `-- --strict` falha se houver violacoes.
