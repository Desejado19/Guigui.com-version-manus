# Internationalização

O Guigui tem dois catálogos de tradução, e `getTranslation` consulta os dois.

1. `src/locales/*.ts` — chaves planas com pontos (`'common.save'`, `'admin.auditTitle'`, `'monetization.title'`), um ficheiro por locale: `pt-BR`, `en`, `fr`, `es` e `gw`. É o local preferido para chaves novas e a paridade entre os cinco ficheiros é verificada por `npm run test:i18n`.
2. `src/utils/i18n.ts` (`TRANSLATIONS`) — chaves em camelCase da primeira versão do frontend (`'heroTitle'`, `'noResults'`). Continua a ser lida por muitos componentes e pelas mensagens do backend.

A ordem de resolução de `getTranslation(lang, key)` é: catálogo do idioma → `TRANSLATIONS` do idioma → catálogo inglês → `TRANSLATIONS` inglês → catálogo `pt-BR` → `TRANSLATIONS` português → a própria chave. Como o último recurso é a chave, uma chave que não exista em lado nenhum aparece escrita no ecrã: `npm run audit:i18n` lista essas chaves (actualmente zero).

Os idiomas são cinco: português (`pt-BR`), Crioulo Guineense (`gw`), inglês, francês e espanhol. O Crioulo é língua oficial da plataforma (secção 11.5 do escopo) e tem de estar completo, não dependente do fallback inglês.

## Uso

```ts
getTranslation(language, 'welcome', { name: user.name });
translateCount(language, 'event.count', total);
formatCurrency(amount, language, 'XOF');
```

Variáveis usam `{{name}}`. Para pluralização, crie as chaves base e `_plural`.
Datas, números, percentuais e moedas devem usar os auxiliares de `src/utils/i18n.ts` (`formatDate`, `formatDateTime`, `formatNumber`, `formatPercent`, `formatCurrency`, `formatCurrencyXOF`). Um componente não deve fixar `toLocaleString('pt-PT')`: o formato tem de seguir o idioma escolhido.

## Adicionar traduções

Adicione a mesma chave semântica aos cinco ficheiros em `src/locales/`, ou a `TRANSLATIONS` quando o componente já lê desse catálogo.
Execute `npm run test:i18n` para verificar paridade, valores vazios e chaves extras, e `npm run audit:i18n` para medir a dívida de tradução (texto visível escrito directamente nos componentes), a paridade por idioma e as chaves usadas no código que não existem em nenhum catálogo.
Para adicionar um idioma, inclua o catálogo em `src/locales/index.ts`, atualize
`LocaleCode`, `Language`, `LANGUAGE_CYCLE` e o seletor do `Navbar`.

Conteúdos vindos da API (nomes, e-mails, URLs, códigos e identificadores) não
devem ser traduzidos. Mensagens de erro devem usar códigos estáveis da API e ser
resolvidas no frontend.

## Alterações mecânicas verificadas

`node scripts/apply-translation-plan.mjs plano.json` aplica uma lista de substituições
`{ file, old, new, expect }` e recusa gravar fosse o que fosse se alguma entrada não
corresponder exactamente ao número de vezes esperado. Foi criado depois de uma
substituição silenciosa ter produzido traduções erradas a partir de texto truncado.
