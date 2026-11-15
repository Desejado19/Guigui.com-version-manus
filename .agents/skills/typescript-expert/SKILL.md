---
name: typescript-expert
description: TypeScript neste repositorio (ES2022, React 19, Express, modulos ESM, `tsc --noEmit`). Usar ao modelar tipos de dominio, refinar unioes, escrever genericos ou corrigir erros de compilacao.
---

# TypeScript — Guigui.com

## Configuracao real (`tsconfig.json`)

- `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
- `jsx: react-jsx`, `isolatedModules: true`, `moduleDetection: force`
- `noEmit: true`, `allowImportingTsExtensions: true`
- Alias `@/*` -> raiz do projeto

## Regras

1. **`strict` nao esta ligado — compense com disciplina.** Nao depender de `strictNullChecks`; tratar `undefined` explicitamente quando o valor vem da API.
2. **Sem `any`.** Para dados externos: `unknown` + funcao de validacao que devolve o tipo (`normaliseMonetizationCatalog`, `normaliseSubscriptionPlans` sao o padrao).
3. **Unioes de literais para estados de dominio**, como em `src/types.ts`: `'draft' | 'pending_moderation' | 'scheduled' | 'active' | 'failed' | 'cancelled' | 'expired'`.
4. **Discriminated unions** para resultados: `{ ok: true; data } | { ok: false; error: string }`.
5. **`satisfies`** em vez de `as` para mapas de configuracao.
6. **Tipos derivados** em vez de duplicados: `Pick<>`, `Omit<>`, `Parameters<typeof fn>[0]`.
7. **Exportar tipos do componente** quando outro modulo precisa das props.

## Erros comuns neste repositorio

| Sintoma | Causa tipica |
|---|---|
| `Property does not exist on type` | campo novo nao adicionado em `src/types.ts` |
| `Type 'string' is not assignable to type '"a" \| "b"'` | falta `as const` no array de literais ou cast do `event.target.value` |
| `Cannot find name` | import em falta apos mover componente |
| JSX invalido | bloco inserido fora do `return` — ja aconteceu no `AdminDashboard` |

## Verificacao

```bash
npm run check     # tsc --noEmit — obrigatorio antes de terminar
```

Corrigir a causa. Nunca `@ts-ignore`, `as any` ou `// @ts-expect-error` para silenciar.
