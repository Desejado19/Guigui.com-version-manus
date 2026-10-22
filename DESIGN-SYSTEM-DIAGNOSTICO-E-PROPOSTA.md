nao removeu a parte # Guigui.com — Diagnóstico e proposta do Design System

**Data:** 13/09/2026  
**Escopo:** identidade visual, tokens, componentes base e ordem de implementação  
**Estado:** proposta de fundação para o próximo ciclo de produto

## 1. Diagnóstico executivo

O Guigui.com já possui uma identidade visual reconhecível e adequada ao posicionamento local:

- verde profundo como cor de confiança e pertença;
- dourado como energia, destaque e ação;
- coral como acento de comunicação;
- superfícies quentes e textura discreta;
- cantos arredondados, cartões e navegação mobile-first;
- foco visível e suporte inicial a tema escuro.

Contudo, a implementação atual ainda é uma camada visual distribuída, não um Design System governado. O principal risco não é falta de estética, mas inconsistência crescente entre os módulos.

### Evidências observadas

- Os tokens base vivem em [src/index.css](src/index.css), mas vários componentes usam cores Tailwind e hexadecimais próprios.
- A folha global já possui mais de 250 declarações CSS específicas e regras de componentes com prefixo `guigui-*`.
- Foram encontrados milhares de ocorrências de utilitários visuais nos componentes, com forte concentração em [BusinessDashboard.tsx](src/components/BusinessDashboard.tsx), [AdminDashboard.tsx](src/components/AdminDashboard.tsx) e [LoginModal.tsx](src/components/LoginModal.tsx).
- O `font-serif` é sobrescrito para usar a mesma família sans, portanto ainda não existe uma hierarquia tipográfica real.
- O tema escuro existe principalmente como overrides globais, sem uma escala semântica completa para superfícies, texto, bordas e estados.
- O PWA já possui [manifest.json](public/manifest.json) e [sw.js](public/sw.js), mas esses artefactos ainda não fazem parte de uma fundação visual/operacional integrada.
- Não existe uma biblioteca explícita de componentes base em `src/components/ui/`.

## 2. Direção de identidade

### Princípio

**Guigui é a camada digital de descoberta e orgulho local da Guiné-Bissau.**

A interface deve combinar:

1. **Confiança:** verde profundo, composição estável e linguagem clara.
2. **Vitalidade:** dourado e coral aplicados como acentos, não como preenchimento indiscriminado.
3. **Pertença:** referências cromáticas e texturas subtis inspiradas na bandeira e no território, evitando folclorização.
4. **Utilidade:** informação de negócio, eventos, bilhetes e pagamentos sempre acima da decoração.
5. **Calor humano:** tipografia legível, estados vazios encorajadores e microcopy localmente natural.

### Regra cromática

- Verde: navegação, confiança, confirmação e identidade primária.
- Dourado: ação principal, descoberta, destaque e recompensa.
- Coral/vermelho: erro, urgência e ações destrutivas; nunca usar vermelho da bandeira como estado de erro por defeito sem contexto.
- Amarelo: aviso e atenção.
- Preto/carvão: texto forte, scanner e superfícies de alto contraste.
- Neutros quentes: fundos e divisores.

## 3. Arquitetura de tokens proposta

A recomendação é separar tokens em três camadas:

1. **Primitivos:** valores puros de cor, escala e dimensão.
2. **Semânticos:** significado na interface.
3. **Componente:** decisões locais de um componente usando tokens semânticos.

### 3.1 Primitivos de cor

```css
:root {
  --color-green-950: #071f1d;
  --color-green-900: #0b3b37;
  --color-green-800: #0f4a44;
  --color-green-700: #176158;
  --color-green-600: #2f9e68;
  --color-green-100: #dceae6;
  --color-green-50: #eef7f4;

  --color-gold-700: #a86516;
  --color-gold-600: #c9852a;
  --color-gold-500: #e8a23a;
  --color-gold-400: #f0b65b;
  --color-gold-100: #fff1d5;

  --color-coral-700: #b9361e;
  --color-coral-600: #e5572b;
  --color-coral-100: #ffe4dc;

  --color-red-700: #b42318;
  --color-red-100: #fee4e2;
  --color-yellow-700: #a15c07;
  --color-yellow-100: #fff3cd;
  --color-blue-700: #175cd3;
  --color-blue-100: #dbeafe;

  --color-neutral-0: #ffffff;
  --color-neutral-25: #fcfbf8;
  --color-neutral-50: #f7f5f1;
  --color-neutral-100: #eeeae2;
  --color-neutral-200: #e4dfd4;
  --color-neutral-300: #dcd6c8;
  --color-neutral-500: #71807b;
  --color-neutral-700: #34423e;
  --color-neutral-900: #16221f;
  --color-neutral-950: #091b1e;
}
```

### 3.2 Tokens semânticos

```css
:root {
  --color-bg-canvas: var(--color-neutral-50);
  --color-bg-surface: var(--color-neutral-0);
  --color-bg-subtle: var(--color-neutral-25);
  --color-bg-brand: var(--color-green-900);
  --color-bg-brand-soft: var(--color-green-50);
  --color-bg-accent: var(--color-gold-500);
  --color-bg-danger: var(--color-red-700);

  --color-text-strong: var(--color-neutral-900);
  --color-text-default: var(--color-neutral-700);
  --color-text-muted: var(--color-neutral-500);
  --color-text-on-brand: var(--color-neutral-0);
  --color-text-on-accent: #28210a;
  --color-text-link: var(--color-green-800);
  --color-text-danger: var(--color-red-700);

  --color-border-default: var(--color-neutral-200);
  --color-border-subtle: rgba(16, 41, 35, 0.08);
  --color-border-strong: var(--color-green-900);
  --color-focus-ring: rgba(232, 162, 58, 0.52);

  --color-state-success: var(--color-green-600);
  --color-state-warning: var(--color-yellow-700);
  --color-state-danger: var(--color-red-700);
  --color-state-info: var(--color-blue-700);
}

.dark {
  --color-bg-canvas: #071d1b;
  --color-bg-surface: #0d2725;
  --color-bg-subtle: #102d2b;
  --color-text-strong: #f4fbf8;
  --color-text-default: #dceae6;
  --color-text-muted: #a9c0b9;
  --color-border-default: rgba(220, 234, 230, 0.18);
  --color-border-subtle: rgba(220, 234, 230, 0.1);
}
```

### 3.3 Tipografia

Prioridade: manter uma família sans legível para produto e adicionar uma família de display quente apenas onde contribui para identidade.

```css
:root {
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Consolas, monospace;

  --text-xs: 0.6875rem;
  --text-sm: 0.8125rem;
  --text-md: 0.9375rem;
  --text-lg: 1.125rem;
  --text-xl: 1.375rem;
  --text-2xl: 1.75rem;
  --text-3xl: clamp(2rem, 4vw, 3rem);
  --text-display: clamp(2.25rem, 5vw, 4rem);

  --leading-tight: 1.1;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;
  --tracking-tight: -0.025em;
  --tracking-label: 0.1em;
}
```

Regra de uso:

- `font-display`: hero, campanhas e títulos institucionais.
- `font-sans`: navegação, dashboards, formulários e dados.
- `font-mono`: códigos QR, referências de pagamentos e métricas técnicas.

### 3.4 Espaçamento e layout

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;

  --container-sm: 40rem;
  --container-md: 56rem;
  --container-lg: 72rem;
  --container-xl: 90rem;
  --gutter-mobile: 1rem;
  --gutter-desktop: clamp(1.5rem, 4vw, 3.5rem);
}
```

### 3.5 Radius, elevação e motion

```css
:root {
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.375rem;
  --radius-2xl: 1.75rem;
  --radius-pill: 999px;

  --shadow-xs: 0 1px 2px rgba(11, 59, 55, 0.06);
  --shadow-sm: 0 8px 20px -16px rgba(11, 59, 55, 0.3);
  --shadow-md: 0 18px 40px -26px rgba(11, 59, 55, 0.38);
  --shadow-lg: 0 30px 80px -38px rgba(7, 33, 30, 0.58);
  --shadow-focus: 0 0 0 3px var(--color-focus-ring);

  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --duration-fast: 140ms;
  --duration-normal: 200ms;
  --duration-slow: 320ms;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
  }
}
```

## 4. Componentes prioritários

Os componentes devem ser criados em `src/components/ui/`, com APIs tipadas, variantes explícitas e suporte a `className`, `aria-*` e estados de interação.

### Fase A — fundação

1. `Button`
   - variantes: `primary`, `secondary`, `accent`, `outline`, `ghost`, `danger`;
   - tamanhos: `sm`, `md`, `lg`, `icon`;
   - estados: loading, disabled, pressed;
   - foco WCAG AA.
2. `IconButton`
   - tooltip/label obrigatório;
   - tamanho de toque mínimo de 44px.
3. `TextField`, `Textarea`, `Select`
   - label, hint, erro, obrigatório e estado disabled;
   - associação correta por `id`/`htmlFor`.
4. `Badge`
   - `verified`, `success`, `warning`, `danger`, `info`, `neutral`, `premium`.
5. `Card`, `Panel`, `SectionHeader`
   - superfície, borda, heading e ações consistentes.
6. `Avatar`, `LogoMark`, `StatusDot`
   - estados de fallback, online, aberto/fechado e verificado.
7. `Skeleton`, `EmptyState`, `ErrorState`
   - essenciais para perceção de qualidade em rede instável.

### Fase B — navegação e feedback

1. `Navbar` e `MobileNav`;
2. `Sidebar`;
3. `Tabs`;
4. `Breadcrumbs`;
5. `Modal`, `Drawer`, `Popover`;
6. `Toast`, `Alert`, `ConfirmationDialog`;
7. `Pagination` e `FilterChips`;
8. `DataTable` com versão mobile em cartões.

### Fase C — domínio Guigui

1. `BusinessCard`;
2. `BusinessProfileHeader`;
3. `EventCard`;
4. `TicketCard` e `TicketStatus`;
5. `PaymentMethodCard`;
6. `ScannerFrame` e `ScannerResult`;
7. `MetricCard`;
8. `NotificationItem`;
9. `ConversationList` e `SupportTicket`;
10. `ModerationStatus`.

## 5. Regras de acessibilidade

- Contraste mínimo WCAG AA para texto normal e componentes.
- Foco visível em todos os elementos interativos.
- Alvo de toque mínimo de 44 × 44px.
- Modais e drawers com `role`, foco inicial e retorno de foco.
- Navegação completa por teclado.
- Mensagens de erro associadas ao campo.
- `aria-live` para validação de scanner, pagamento e notificações.
- Não depender apenas de cor para estados.
- `prefers-reduced-motion` respeitado.
- Texto alternativo específico para imagens comerciais e eventos.

## 6. Estratégia de migração sem regressão

### Passo 1 — congelar a direção

- aprovar os tokens semânticos;
- definir nomenclatura;
- mapear cores atuais para equivalentes;
- não mudar layouts de negócio nesta etapa.

### Passo 2 — criar a fundação

- introduzir tokens em `src/index.css`;
- criar `src/components/ui/`;
- adicionar tipos de variantes;
- criar uma página interna de showcase apenas em desenvolvimento.

### Passo 3 — migrar por superfície

Ordem recomendada:

1. Navbar e login;
2. cartões públicos, diretório e eventos;
3. CitizenDashboard;
4. BusinessDashboard;
5. AdminDashboard;
6. modais, scanner e fluxos de pagamento.

Cada migração deve substituir valores visuais, não alterar regras de negócio, dados ou navegação.

### Passo 4 — validação

- `npm run lint`;
- `npm run build`;
- testes E2E de login, navegação, detalhe de empresa, bilhete e scanner;
- verificação visual em 320px, 768px, 1024px e 1440px;
- contraste automatizado e revisão por teclado;
- comparação visual antes/depois por superfície.

## 7. Componentes que não devem ser generalizados cedo demais

Não transformar imediatamente em abstrações genéricas:

- tabelas financeiras com regras específicas;
- gráficos Recharts;
- layouts completos dos dashboards;
- formulários de compra e moderação;
- scanner de porta;
- cards com regras específicas de plano e monetização.

Esses módulos devem consumir componentes base, mas conservar lógica de domínio até os padrões se estabilizarem.

## 8. Próximo ciclo prioritário

### Entrega recomendada

Implementar a **Fase A — fundação visual**, nesta ordem:

1. consolidar tokens semânticos light/dark;
2. criar `Button`, `IconButton`, `Badge`, `Card`, `TextField`, `Skeleton` e `EmptyState`;
3. migrar Navbar e LoginModal;
4. validar acessibilidade, build e E2E;
5. só depois iniciar o redesign dos três dashboards.

### Critério de conclusão

A fase está concluída quando:

- nenhum componente novo precisar de hex direto para uma decisão já coberta por token;
- os estados light/dark funcionarem nos componentes base;
- todos os componentes base tiverem foco, disabled, loading e labels adequados;
- Navbar e LoginModal usarem a mesma linguagem visual;
- testes existentes continuarem a passar;
- a equipa puder compor novas telas sem copiar blocos de classes extensos.

## 9. Decisão de produto

O Guigui.com não precisa de uma ruptura visual. Precisa de **consolidação, semântica e escala**:

- preservar o verde/dourado/coral já reconhecível;
- reduzir a dispersão de valores;
- criar componentes pequenos e confiáveis;
- aplicar a identidade primeiro nos pontos de maior frequência;
- manter dados, fluxos e modelo de negócio estáveis;
- usar o sistema como base para segurança, PWA, performance e acessibilidade.

