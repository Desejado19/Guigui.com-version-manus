# Guigui.com — Plano de Execução

**Âmbito:** (1) padrão de módulos/submódulos + paginação configurável, (2) Glassmorphism seletivo, (3) filtro "Todas → tipo específico" em todo o site, (4) motor SaaS de planos/funcionalidades/direitos/limites (DDD), (5) verificação integral em modo Cidadão, Empresa e Admin.

**Estado:** plano aprovado, Fase 0 concluída. Fases 1–8 por executar por ordem.

---

## Fase 0 — Desbloqueio (CONCLUÍDA)

Correções aplicadas nesta sessão, com `npm run check` verde:

| Problema | Resolução |
|---|---|
| Bloco JSX de governança inserido **dentro do corpo do componente** em `AdminDashboard.tsx` (sintaxe inválida) | Bloco removido do local errado |
| Módulos de governança sem import | `AdminSubscriptionGovernance`, `AdminPricingUsageGovernance`, `AdminFeatureCatalog` importados |
| Tipos `SubscriptionPlan`, `SubscriptionPlanVersion`, `SubscriptionFeature` ausentes | Adicionados ao import de `../types` |
| Sem props para planos no `AdminDashboardProps` | `plans?`, `planVersions?`, `planFeatures?` com defaults do catálogo |
| Cópia órfã e corrompida `src/components/admin/AdminDashboard.tsx` a quebrar o `tsc` global | Movida para `.quarantine/AdminDashboard.orphan.bak` |
| Governança não renderizada | Renderizada na aba **architecture** dentro de fragmento, com dados reais (`normaliseSubscriptionPlans(subscriptionPlans)` vindo de `App.tsx`) |

---

## Fase 1 — Auditoria e inventário funcional

Objetivo: inventário real, sem assumir que "existe botão ⇒ existe funcionalidade".

1. Mapear módulos/submódulos a partir de `src/config/navigation.ts` (`ADMIN_NAVIGATION`) e das tabs de `CitizenDashboard`, `BusinessDashboard`, `AdminDashboard`.
2. Para cada módulo, registar: submódulos, componente, fonte de dados (PostgreSQL via `/api/*`, `usePersistentState` ou mock), presença de paginação, presença de filtro por tipo.
3. Classificar cada funcionalidade do catálogo em: **implementada**, **parcial**, **planeada**, **desativada**.
4. Produzir `docs/INVENTARIO-FUNCIONALIDADES.md` com essa matriz.

**Constatação inicial já verificada:**

- `SubmoduleNavbar` (barra horizontal de submódulos) só é usado em **3** sítios: `CitizenDashboard`, `EventsView`, `SoldTicketsPanel`.
- `AdminPagination` só é usado nos **2** módulos de governança novos.
- `MonetizationAdmin` e `SubscriptionPlansAdmin` cortam listas com `.slice(0, 50)` / `.slice(0, 30)` sem paginação — exatamente o padrão "lista interminável silenciosa" proibido.
- `AdminDashboard` já tem ~20 tabs; várias partilham o mesmo tipo de conteúdo (tabelas) sem submódulos nem paginação.

**Critério de saída:** matriz completa, com nomes de ficheiro por módulo.

---

## Fase 2 — Componentes reutilizáveis (base única)

Regra: nenhum módulo implementa a sua própria barra de submódulos nem a sua própria paginação.

1. `src/components/navigation/SubmoduleNavbar.tsx` — consolidar como **único** componente de navegação horizontal:
   - tabs lado a lado, scroll horizontal em mobile (`overflow-x-auto`, `scrollbar-none`);
   - `role="tablist"` + `aria-selected` + navegação por teclado (←/→/Home/End);
   - destaque visual no ativo (anel índigo + fundo translúcido);
   - badge opcional por tab (contagens reais).
2. `src/components/admin/AdminPagination.tsx` — generalizar para `DataPagination`:
   - "Mostrando X–Y de Z registos";
   - Anterior/Seguinte, números com elipse;
   - seletor 10/20/50/100, **preferência persistida** (`usePersistentState('guigui_page_size')`);
   - estados desativados corretos na primeira/última página.
3. Hook `usePaginatedList<T>(items, { pageSize, resetKey })`:
   - devolve `pageItems`, `page`, `setPage`, `pageSize`, `setPageSize`, `totalPages`, `rangeLabel`;
   - **volta à página 1** sempre que `resetKey` (pesquisa/filtros) muda;
   - nunca perde filtros ao navegar.
4. `src/components/ui/SectionHeader.tsx` — título + descrição contextual de cada submódulo (hierarquia do ponto 6 do pedido).

**Critério de saída:** os 3 componentes + hook com uso comprovado em ≥ 2 módulos e `npm run check` verde.

---

## Fase 3 — Submódulos com conteúdo próprio (aplicação por módulo)

Ordem de execução (do mais visível para o menos arriscado). Para cada módulo: definir submódulos, dar a cada um filtro próprio + pesquisa própria + ações próprias + paginação, e garantir que dados de submódulos diferentes nunca se misturam.

| # | Módulo | Submódulos propostos | Ficheiro |
|---|---|---|---|
| 1 | Bilhetes (empresa) | Todos / Próximos / Utilizados / Expirados / Cancelados | `SoldTicketsPanel.tsx` (já tem navbar — validar filtragem real por estado) |
| 2 | Eventos | Todos / Publicados / Rascunhos / Pendentes / Encerrados | `EventsView.tsx` (já tem navbar — validar) |
| 3 | Área do Cidadão | Início / Bilhetes / Compras / Notificações / Perfil | `CitizenDashboard.tsx` |
| 4 | Empresas & Negócios (admin) | Pendentes / Ativas / Rejeitadas / Suspensas | `AdminDashboard.tsx` (tab `businesses`) |
| 5 | Moderação | Fila / Aprovados / Rejeitados / Amarelo / Vermelho | `AdminDashboard.tsx` (tab `moderation`) |
| 6 | Financeiro / Pagamentos | Transações / Faturação / Monetização / Ledger | `AdminDashboard.tsx` + `MonetizationAdmin.tsx` |
| 7 | Participantes | Por evento / Check-in / Exportações | conforme componente existente |
| 8 | Relatórios | Operacionais / Financeiros / Marketing | `AdminReportsHub.tsx` |
| 9 | Administração | Equipa / Permissões / Auditoria / Suporte / Configurações | `AdminDashboard.tsx` |
| 10 | Governança SaaS | Visão Geral / Planos / Catálogo / Configurador / Limites / Subscrições / Preços / Auditoria / Config | `AdminSubscriptionGovernance.tsx` |

Regras por módulo:

- Cada submódulo renderiza **exclusivamente** os seus registos (sem `filter` partilhado a vazar).
- Pesquisa e filtros são locais ao submódulo e resetam a página.
- Estado vazio explícito (`EmptyState`) por submódulo, com texto próprio.
- Remover `slice(0, N)` usado como paginação disfarçada.

**Critério de saída:** nenhuma lista no site sem paginação quando `totalItems > 20`.

---

## Fase 4 — Padrão "Todas → tipo específico"

Já implementado em **categorias**; replicar em todo o site onde há um seletor de tipo.

1. Identificar todos os pontos: `Eventos` (categorias de evento), `Empresas` (categoria/setor), `Bilhetes` (tipo/lote), `Moderação` (tipo de conteúdo), `Participantes` (tipo de bilhete), `Relatórios` (tipo), pesquisa pública.
2. Padrão único: opção **Todas** por omissão + chips/botões do tipo específico; ao escolher um tipo, a lista (e as contagens dos chips) refletem só esse tipo; "Todas" volta ao conjunto completo.
3. Componente partilhado `TypeFilterChips` para não duplicar comportamento.
4. Preferência de filtro não persistida (é contextual), mas **a página volta a 1**.

**Critério de saída:** grep sem padrões antigos (`activeType === 'all'` duplicado localmente) — todos usam `TypeFilterChips`.

---

## Fase 5 — Glassmorphism seletivo

1. **Tokens** em `src/index.css`, para os dois temas:
   `--glass-blur`, `--glass-bg`, `--glass-border`, `--glass-shadow`, `--glass-highlight`, `--radius-glass`.
   Tema claro: vidro branco translúcido + blur subtil. Tema escuro: vidro escuro + borda luminosa discreta.
2. **Utilitários já criados** (`.glass-subtle`, `.glass-strong`, `.glass-sidebar`, `.glass-card-soft`, `.glass-input-dashboard`, `.glass-button-dashboard`, `.glass-select-dashboard`, `.glass-chip-dashboard`, `.glass-badge-dashboard`, `.glass-panel-header`) — consolidar e documentar.
3. **Componentes do sistema** (ponto 8 do pedido): `GlassNavbar`, `GlassSidebar`, `GlassButton`, `GlassTabs`, `GlassCard`, `GlassInput`, `GlassDropdown`, `GlassModal`, `GlassFilter`. Nenhum CSS novo por módulo.
4. **Fallback**: `@supports not (backdrop-filter: blur(1px))` → fundo sólido com opacidade alta.
5. **Acessibilidade e desempenho**: contraste ≥ 4.5:1 em texto normal; `@media (prefers-reduced-motion: reduce)` sem transições; blur desativado em superfícies grandes em mobile.
6. Aplicação gradual: navegação → botões/filtros → cartões → modais. Tabelas e listas mantêm superfície sólida (legibilidade).

**Critério de saída:** nenhum módulo com `backdrop-filter` ad-hoc; tudo via utilitário/token.

---

## Fase 6 — Motor SaaS (DDD)

Ordem: modelo → serviços → API → UI → autorização → testes.

1. **Bounded contexts** em `server/modules/`:
   `plan-catalog`, `feature-catalog`, `subscription`, `entitlement`, `usage`, `billing`.
2. **Modelo de dados** (PostgreSQL, migrations com rollback):
   `plans`, `plan_versions`, `feature_catalog`, `feature_dependencies`, `plan_entitlements`, `plan_limits`, `subscriptions`, `subscription_history`, `usage_records`, `plan_change_history`, `audit_logs`.
3. **Regra dura**: **zero** `if (plan === 'premium')` no código. Toda a decisão passa por:
   `canUseFeature(orgId, featureKey)`, `getFeatureLimit`, `getFeatureUsage`, `canPerformAction(orgId, featureKey, qty)`.
4. **Distinção obrigatória** entre: direito comercial do plano, permissão RBAC do colaborador, estado da subscrição, disponibilidade técnica da funcionalidade.
5. **Limites**: `0` = bloqueado, `n` = limite, `unlimited` = sem limite; alertas 70/90/100%; verificação **no backend** com proteção contra concorrência (transação + `SELECT ... FOR UPDATE`).
6. **Versionamento**: alteração de plano cria nova versão, guarda autor/data, e define política explícita (só novas subscrições vs. também existentes). Downgrade nunca apaga dados.
7. **Frontend**: funcionalidade fora do plano → bloqueada com CTA de upgrade; limite atingido → mostra consumo/limite e impede a ação. O frontend nunca é a única proteção.
8. **Admin global**: acesso à governança independente do plano, protegido por RBAC + auditoria.

**Critério de saída:** criar plano → associar features/limites → publicar → contratar → testar autorização → atingir limite → upgrade/downgrade → suspender/renovar, tudo com testes automatizados.

---

## Fase 7 — Paginação server-side para grandes volumes

1. Endpoints de listagem passam a aceitar `?page&pageSize&q&…filtros` e devolver `{ items, page, pageSize, total }`.
2. `pageSize` validado a 10/20/50/100; `page` limitado a `ceil(total/pageSize)`.
3. Migrar primeiro: `businesses`, `events`, `tickets`, `moderation`, `audit_logs`, `usage_records`.
4. UI consome a mesma `DataPagination`, agora com `total` do servidor.

**Critério de saída:** nenhum endpoint devolve a tabela inteira para listas grandes.

---

## Fase 8 — Verificação integral (Cidadão / Empresa / Admin)

1. `npm run check` (tsc) verde.
2. `npm run test:unit` e suítes de domínio (`test:subscriptions`, `test:catalog`, `test:payments`, `test:moderation`, `test:tickets`).
3. Reiniciar o servidor e confirmar `/api/health` = 200.
4. Percorrer cada modo:
   - **Cidadão:** navegação, bilhetes por estado, compras, paginação, estados vazios.
   - **Empresa:** eventos, bilhetes, participantes, limites do plano aplicados no backend (403 quando excede).
   - **Admin:** todas as tabs, governança SaaS, catálogo, versionamento, auditoria.
5. Isolamento multi-tenant: empresa A nunca vê dados de B; admin vê tudo.
6. Responsivo: desktop / tablet / mobile (scroll horizontal dos submódulos sem sobreposição).
7. Temas claro e escuro: contraste e legibilidade.
8. Relatório final: o que existia, o que foi corrigido, o que é novo, dependências externas, migrations, testes executados, pendências reais.

---

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `AdminDashboard.tsx` com ~4.000 linhas e 20 tabs | Extrair tabs para ficheiros próprios por fase, um de cada vez, com `check` entre cada extração |
| `slice(0, N)` espalhado | Fase 3 remove todos; grep de verificação no fim |
| Blur em tabelas prejudica leitura | Superfícies de dados ficam sólidas; blur só em chrome |
| Alterar planos afeta empresas existentes | Versionamento + política explícita, nunca silenciosa |
| Migrations em base com dados | Uma migration por tabela, com rollback testado localmente |

## Definição de pronto (global)

- Nenhum módulo com lista longa sem paginação.
- Nenhum submódulo a mostrar dados de outro.
- Um único componente de navbar e um de paginação em todo o site.
- Glassmorphism só via tokens/utilitários, nos dois temas, com fallback.
- Motor de planos decide tudo; nenhuma regra comercial hardcoded.
- `npm run check` + testes verdes, servidor reiniciado e os três modos validados.

---

## Estado de execução (atualizado)

| Fase | Estado | Evidência |
|---|---|---|
| 0 — Desbloqueio | **Concluída** | `tsc` verde, servidor 200, CSS corrigido |
| 1 — Auditoria | **Concluída** | `npm run audit:i18n`: 884 chaves no código, 0 em falta; navbar em 3 componentes, paginação em 2 |
| 2 — Componentes únicos | **Concluída** | `hooks/usePaginatedList.ts`, `ui/SectionHeader.tsx`, `AdminPagination` reescrita, `SubmoduleNavbar` reescrita |
| 3 — Submódulos por módulo | **Em curso (3/10)** | Bilhetes, Eventos e Empresas (admin) feitos; verificado no browser: Eventos (81 registos) e Empresas admin (108) |
| 4 — "Todas → tipo" | **Parcial** | Categorias (já existia) e nova barra de agenda/submódulos seguem o padrão |
| 5 — Glassmorphism | **Parcial** | Tokens e utilitários existem em `index.css`; falta migrar módulos para eles |
| 6 — Motor SaaS | **Parcial** | Módulos de governança e serviços criados; persistência/API ainda não ligada |
| 7 — Paginação server-side | **Por fazer** | Endpoints ainda devolvem listas completas |
| 8 — Verificação integral | **Parcial** | Cidadão/Admin verificados por API + browser parcial; Empresa (bilhetes) por verificar |

### Correções de defeitos reais encontradas durante a execução

1. **18 chaves de tradução inexistentes** (mostravam o nome da chave no ecrã, ex. `admin.pricingUsageTitle`): adicionadas em pt/en/fr/es. Auditoria passou de 18 em falta para **0**.
2. **`EventsView` com estado morto** (`submoduleTab`, `TAB_LABELS` de bilhetes, `submoduleTabChangeHandler`) que nunca era renderizado: substituído por sub-módulos de agenda reais (Todos / Esta semana / Este mês / Já passaram).
3. **`SoldTicketsPanel` importava a navbar mas nunca a usava**: passou a ter submódulos por estado com pesquisa e paginação próprios.
4. **`AdminPagination` mostrava chaves cruas** (`admin.pageSize`, `admin.showing`, …) e não persistia a preferência: reescrita com namespace `pagination.*` e persistência em `localStorage`.

### Verificação no browser (dados reais)

- **Eventos**: 4 sub-módulos (Todos 81 · Esta semana 2 · Este mês 2 · Já passaram 55), cartões 20 por página, "Mostrando 1–20 de 81 registos", 5 páginas, troca de sub-módulo isola o conteúdo (55 registos / 3 páginas).
- **Empresas (admin)**: 5 sub-módulos (Todas 108 · Pendentes 8 · Ativas 57 · Rejeitadas 1 · Suspensas 42 — soma coerente), pesquisa, "Mostrando 1–50 de 108 registos" após escolher 50, preferência mantida depois de recarregar.

### Segunda vaga de execução

| Item | Estado | Detalhe |
|---|---|---|
| Moderação — tipo | **Corrigido** | O `<select>` abria em branco: `modTypeFilter` começa em `'all'` mas não existia `<option value="all">`. Adicionado "Todos os tipos" + "Publicações". |
| Moderação — voltar a "Todas" | **Corrigido** | A fila de chips começava em "Em revisão"; só se saía com "Limpar filtros" (que apagava também pesquisa e datas). Adicionado chip "Todas". |
| Ledger de monetização | **Corrigido** | `.slice(0, 50)` cortava o ledger em silêncio. Agora usa `usePaginatedList` + `AdminPagination`: "Mostrando 1–20 de 89 registos". |
| Histórico de planos (SubscriptionPlansAdmin) | **Corrigido** | `.slice(0, 30)` escondia versões antigas. Removido; o painel já tem scroll próprio. |
| Governança SaaS — versões | **Corrigido** | `AdminSubscriptionGovernance` e `AdminPricingUsageGovernance` mostravam "N versão(ões)" mas cortavam em 50. Agora paginam (verificado: "1–4 de 4 registos"). |
| Logotipos sem imagem | **Corrigido** | 3 de 108 empresas não têm `logo`, o que produzia `<img src="">` (o browser volta a descarregar a página). Criado `components/ui/BusinessLogo.tsx`, usado em 7 sítios (directório, admin, comparador, barra de comparação, feed, perfil empresarial). |
| Avatares de utilizador | **Corrigido** | `currentUser.avatarUrl` podia vir vazio; aplicado o fallback que o `Navbar` já usava (Navbar ×2, CitizenDashboard, FeedPostCard). |
| Aviso `src=""` residual | **Aberto** | Depois das correcções, nenhum elemento do DOM tem `src` vazio; o aviso ainda aparece uma vez no arranque, o que indica um componente que renderiza a imagem e logo a substitui. Sem impacto visível. |
| HMR do dev server | **Aberto** | WebSocket em `ws://localhost:24678` recusado; o servidor foi arrancado por script e o browser não liga ao HMR (recarregar à mão resolve). Não afecta o código da aplicação. |

### Expiração automática de eventos e descontos

Regra nova, num único sítio (`src/utils/expiry.ts`), para que nenhum ecrã invente a sua:

| Regra | Comportamento |
|---|---|
| `isPromotionLive` | Desconto visível só com `isActive`, sem `status` terminal e com `validUntil` no futuro (e depois de `startsAt`, quando existe). |
| `isEventUpcoming` | Evento visível só com `status === 'active'` e data+hora ainda não passadas. Data inválida **não** conta como passada, para não esconder conteúdo por erro de formato. |

Aplicado em: `PromotionsView` (lista de ofertas), `EventsView` (agenda), listas do `App` (promoções/eventos públicos), pesquisa global e pré-visualização.

A agenda perdeu o sub-módulo "Já passaram" (era o oposto da regra pedida). Verificado no browser: Eventos passou de 81 para **22 registos**, com tabs "Todos 22 / Esta semana 0 / Este mês 0"; Ofertas mostra **16 cartões, 0 expirados**.

Os registos **não são apagados**: continuam no estado para bilhetes vendidos, relatórios e auditoria. O painel da empresa continua a ver o histórico dos seus eventos e promoções.

### Bilhetes: cartão e detalhe na estrutura aprovada

- `components/events/EventCard.tsx`: imagem com bloco de data (dia da semana / dia / mês), categoria em pílula verde, título, local com pino, hora com relógio, rodapé com "desde X XOF" em verde e botão laranja "Comprar bilhete". Preço mínimo calculado a partir dos tipos de bilhete; mostra "Esgotado" quando nenhum tipo tem stock.
- `components/events/EventDetailModal.tsx`: hero com imagem e gradiente, categoria em pílula, título grande, data longa e local; "Sobre o evento"; cartão do organizador com iniciais; cartão de localização com "Ver no Google Maps"; painel "Bilhetes" com "Compra segura", tipos com disponibilidade e preço, seletor de quantidade, total e CTA coral. Sem sessão, o CTA passa a "Entrar para comprar".
- A compra continua a passar pelo fluxo oficial (`TicketPurchaseModal`): pagamento, taxas e QR Code. O modal passou a aceitar `initialTicketTypeId`/`initialQuantity`, para respeitar o que foi escolhido no detalhe.
- Cores só com tokens Guigui: `--color-green-700/800`, `--color-coral-500/600`, `--color-gold-400`, `--color-neutral-50/200/600/900`.

Verificado no browser: 20 cartões com bloco de data e preço "desde 5000 XOF"; detalhe abre com "Sobre o evento / Localização / Bilhetes"; total do painel acompanha a quantidade (5 000 → 10 000 XOF); "Comprar bilhete" abre o fluxo com "2 x Entrada Geral Pista".
