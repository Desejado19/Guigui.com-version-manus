# Validação do tema escuro

## Diagnóstico

Algumas superfícies legadas dos dashboards utilizavam `bg-white`, `bg-white/*` e cores de fundo personalizadas sem uma variante dark equivalente. Isso criava cartões, modais e áreas laterais brancas quando o utilizador seleccionava o tema escuro.

## Correcção

Foram adicionados overrides no sistema visual global para:

- superfícies brancas com transparência (`bg-white/60`, `bg-white/75`, `bg-white/80`, `bg-white/90` e semelhantes);
- fundos personalizados em dashboards (`bg-[#...]`);
- cartões, formulários, painéis laterais e modais dentro dos workspaces;
- superfícies escuras consistentes com a paleta Guigui verde/dourado.

A correcção mantém botões e elementos de destaque com contraste adequado, sem alterar a lógica funcional.

## Validação

- `npm run check`: aprovado.
- `npm run build`: aprovado.
- `npm run test:components`: 39 testes aprovados.
- Inspecção visual Playwright em tema escuro: `body` com `rgb(6, 20, 17)` e zero superfícies grandes com `rgb(255, 255, 255)` na página inicial.
