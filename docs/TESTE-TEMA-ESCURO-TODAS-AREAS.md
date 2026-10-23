# Teste real do tema escuro

Foi criado o teste Playwright `tests/dark-theme.spec.ts`. O teste autentica contas reais de Utilizador, Empresa e Administração, activa `guigui_theme_mode=dark`, abre cada painel e percorre os botões de navegação lateral para visitar as secções disponíveis.

A verificação inspecciona as superfícies visíveis e falha quando encontra elementos grandes com fundo efectivamente branco. Transparências intencionais como `bg-white/10` não são consideradas superfícies brancas.

Resultado final: **3 testes aprovados**. Não foram encontradas superfícies brancas grandes nas secções navegadas dos três perfis.

A causa encontrada foi o token legado `.guigui-light-dashboard`, que continuava a definir `--color-bg-surface: #fff` e `--color-bg-subtle: #f8fafc` mesmo no modo escuro. A correcção passou a substituir estes tokens dentro de `html.dark`, garantindo que os componentes que usam `var(--color-bg-surface)` também respeitam o tema.

Validações adicionais: `npm run check`, `npm run build` e `npm run test:components` passaram; os testes de componentes totalizaram 39 testes aprovados.
