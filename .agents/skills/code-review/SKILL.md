---
name: code-review
description: Revisao de codigo no Guigui.com antes de fechar uma alteracao. Usar ao revisar o proprio diff, um PR, ou codigo de outro agente — com foco em correcao, seguranca, consistencia com o design system e verificacao real.
---

# Revisao de codigo — Guigui.com

## Ordem de revisao

1. **Correcao** — faz o que diz? Cobre os casos vazios, erro e repeticao?
2. **Seguranca** — autorizacao no servidor? validacao? dados de outro tenant?
3. **Regras de negocio** — alguma regra foi movida para a UI para "facilitar"?
4. **Consistencia** — usa `AdminPagination`, `SubmoduleNavbar`, `SectionHeader`, `BusinessLogo`, tokens de cor?
5. **i18n** — texto novo traduzido nos 4 idiomas?
6. **Simplicidade** — codigo a mais, abstracao prematura, duplicacao?

## Sinais de alerta neste repositorio

- `.slice(0, N)` a fingir de paginacao.
- `<img src={...}>` sem fallback (empresas sem logotipo).
- Comparacao por nome de plano/categoria.
- Chave de traducao usada sem existir (aparece crua no ecra).
- Ficheiro temporario (`tmp-*.cjs`, `.tmp-*`) deixado para tras.
- Componente duplicado (ha historico de copias orfas).
- `any`, `@ts-ignore`, teste desactivado para ficar verde.

## Como se prova que funciona

| Tipo de alteracao | Verificacao minima |
|---|---|
| Tipo/refactor | `npm run check` |
| Texto novo | `npm run audit:i18n` |
| Dominio (bilhetes, planos, pagamentos) | script de auditoria do dominio |
| UI | abrir no browser e confirmar comportamento e dados reais |
| Consulta SQL | `npm run test:integration` |

## Formato do comentario

- **Bloqueante**: quebra regra, seguranca ou dados. Explicar o cenario concreto.
- **Sugestao**: melhoria sem risco. Dizer o ganho.
- **Pergunta**: quando a intencao nao e clara; nao reescrever por suposicao.

Nunca aprovar sem executar as verificacoes da tabela acima. "Compila" nao e "funciona".
