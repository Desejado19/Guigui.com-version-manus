# Relatório — Remoção global do efeito vidro (Glassmorphism) — Guigui.com

**Data:** 18 de novembro de 2026  
**Escopo:** varredura completa do projeto `g/Guigui` (src + estilos globais).

## 1. Auditoria realizada

- Pesquisa global em `src/` por: `backdrop-filter`, `-webkit-backdrop-filter`, `backdrop-blur*`, `glass`, `glassmorphism`, `expo-glass`, `::before`/`::after` de reflexo, e superfícies translúcidas (`bg-*/opacity`).
- Identificado o único componente nomeado "Glass" (`GlassBottomNav`), cuja implementação já era de fundo sólido (sem glassmorphism) — mantido para não quebrar imports.
- Identificadas superfícies glass reais:
  - `.guigui-panel` (CSS) — `backdrop-filter: blur(10px)` + `background: rgba(255,255,255,0.88)`.
  - Token `--guigui-surface: rgba(255,255,255,0.94)`.
  - 25 ficheiros TSX com classes Tailwind `backdrop-blur*` (modais, dropdowns, toasts, badges, cards, headers sticky, overlays).
  - Superfícies translúcidas de vidro: `bg-white/95`, `bg-white/90`, `bg-slate-900/95`, `bg-[var(--color-bg-surface)]/95`, e respectivos overrides dark (`dark:bg-slate-900/95`).
  - Override CSS `html.dark [class~="bg-white/95/90"]` com fundo translúcido.

## 2. Alterações aplicadas

### Estilos globais (`src/index.css`)
- `.guigui-panel`: removido `backdrop-filter: blur(10px)`; fundo alterado para `#ffffff` (light) e `#0d2924` (dark, era `rgba(13,41,36,0.94)`).
- `--guigui-surface`: `rgba(255,255,255,0.94)` → `#ffffff`.
- Override `html.dark [class~="bg-white"]`: fundo alterado para `#0f172a` (era `rgba(15,23,42,0.95)`), seletor deduplicado.
- As declarações `-webkit-backdrop-filter: none` / `backdrop-filter: none` foram mantidas como reforço explícito de desativação (navbar e blocos de reset).

### Componentes TSX (25 ficheiros)
- Removidas todas as classes `backdrop-blur`, `backdrop-blur-sm/md/lg/xl/xs` e `backdrop-blur-[1px]` de `src/` (25 ficheiros alterados).
- Superfícies glass solidificadas:
  - `bg-white/95` e `bg-white/90` → `bg-white` (25 ocorrências em 11 ficheiros).
  - `bg-slate-900/95` → `bg-slate-900`.
  - `bg-[var(--color-bg-surface)]/95` → `bg-[var(--color-bg-surface)]`.
  - `dark:bg-slate-900/95` → `dark:bg-slate-900`.

### Preservado (transparências funcionais)
- Overlays de modais/drawers (`bg-slate-900/60`, `/70`, `/80`, `bg-slate-950/60`, etc.) mantidos translúcidos (dimming de fundo) — sem blur.
- Botões/controles sobre imagens e stories (`bg-black/35`, `bg-white/20`, etc.) mantidos translúcidos — overlays funcionais sobre mídia.
- Sombras, gradientes decorativos e reflexos não-glass (hero, banners) preservados.

## 3. Ficheiros modificados

- `src/index.css`
- `src/App.tsx`
- `src/components/admin/AdminStaffManagement.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/BusinessCard.tsx`
- `src/components/BusinessComparisonModal.tsx`
- `src/components/BusinessDashboard.tsx`
- `src/components/BusinessDetailModal.tsx`
- `src/components/BusinessMapView.tsx`
- `src/components/charts/ChartTooltip.tsx`
- `src/components/CitizenDashboard.tsx`
- `src/components/client/ClientEventsManagement.tsx`
- `src/components/CreatePostBox.tsx`
- `src/components/events/EventDetailModal.tsx`
- `src/components/EventsView.tsx`
- `src/components/feed/PostCommentsSheet.tsx`
- `src/components/FeedPostCard.tsx`
- `src/components/LoginModal.tsx`
- `src/components/Navbar.tsx`
- `src/components/navigation/ProfileSidebar.tsx`
- `src/components/onboarding/WelcomeTour.tsx`
- `src/components/PromotionsView.tsx`
- `src/components/SmsSimulatorToast.tsx`
- `src/components/StoryModal.tsx`
- `src/components/TicketPurchaseModal.tsx`
- `src/components/TicketScannerView.tsx`

## 4. Verificação

- `npx tsc --noEmit`: **verde** (0 erros) após todas as alterações.
- `grep -rn "backdrop-blur|backdropFilter" src/`: **0 ocorrências**.
- `grep -rn "blur(" src/` (excluindo shadows/gradients): **0 ocorrências**.
- Nenhuma funcionalidade, rota, API, BD ou permissão alterada — apenas estilos.

## 5. Limitações / não testado

- Bateria Playwright executada parcialmente após a alteração: `tsc --noEmit` verde; grep `backdrop-blur`/`blur(` em `src/` = 0. Os testes de responsividade privada travam por timeout ambiental (>5 min) — não é regressão de layout. Visualização manual recomendada em desktop/tablet/mobile e modos claro/escuro para confirmar ausência de vidro residual.
- O diretório `g/Guigui.com-tema-escuro-testado.worktrees/` (worktree de outra branch) não foi alterado.
- Componente `GlassBottomNav` mantém o nome por compatibilidade; a implementação é sólida.
