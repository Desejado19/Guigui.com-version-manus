# Plano de perfis, permissões e interface de perfil

Data: 31/10/2026 · Âmbito: Guigui.com (cliente + servidor)

Este documento é a referência única para (1) como cada perfil funciona, o que deve
fazer e o que pode ou não pode fazer, e (2) o plano de melhoria da interface de
perfil de cada modo de utilizador.

---

## 1. Os três perfis

| | **Cidadão** (`user`) | **Empresa** (`business`) | **Administração** (`admin`) |
|---|---|---|---|
| Entrada | `feed` | `client` (Painel Comercial) | `admin` (Administração) |
| Missão | Descobrir Bissau, comprar bilhetes, falar com empresas | Gerir ficha, conteúdo, eventos, bilhética e clientes | Governar a plataforma: moderação, diretório, finanças, utilizadores |
| Sessão | `/api/auth/register` (tipo Cidadão) | `/api/auth/register` (tipo Empresa) | conta administrativa |
| Superfície de perfil | `CitizenDashboard` (Minha Conta) | `BusinessDashboard` (Visão Geral) | `AdminDashboard` → `AdminProfilePanel` |

### 1.1 Cidadão — o que pode

- Navegar feed, diretório, mapa, agenda e promoções (rotas públicas/autenticadas de leitura).
- **Comprar bilhetes** — `POST /api/tickets/purchase` exige `role === 'user'` (as outras contas recebem `401`).
- Publicar posts — chave `guigui_user_posts` (`CITIZEN_STATE_KEYS`), sujeita a moderação.
- Ver as stories das empresas e da administração — `guigui_stories` é pública para leitura.
- Abrir conversas e pedidos de suporte **próprios** — `/api/conversations`, `/api/support/tickets` (âmbito da sessão).
- Gerir perfil, privacidade, tema e idioma — `/api/account/*` e `user_language_<userId>` (só o dono pode gravar: `APP_STATE_NOT_OWNER`).

### 1.2 Cidadão — o que não pode

- Publicar stories — `guigui_stories` → `403 STORY_PUBLISH_FORBIDDEN` (empresas e administração) e `/api/stories/assets` recusa o upload com o mesmo código.
- Criar/editar eventos — `resolveEventWrite` → `403 EVENT_WRITE_FORBIDDEN`.
- Alterar fichas de empresas — `resolveBusinessWrite` → `403 BUSINESS_WRITE_FORBIDDEN`.
- Escrever caixas partilhadas (`guigui_conversations`, `guigui_conversation_messages`,
  `guigui_support_requests`), planos, catálogo de monetização ou configuração de
  negócio — `resolveAppStateWrite` → `403 APP_STATE_WRITE_FORBIDDEN`.
- Painel comercial (scanner, marketing, facturação) e painel administrativo —
  bloqueio no cliente (`handleTabChange`) e `requireRole` no servidor.

### 1.3 Empresa — o que pode

- Editar **a sua própria** ficha — `POST|PATCH /api/businesses` com âmbito do
  `businessId` da sessão (as restantes fichas são repostas a partir do servidor).
- Criar e gerir eventos, promoções, campanhas e calendário — `/api/events`,
  `/api/marketing/*` (`requireRole('business')`).
- Validar bilhetes no local — `/api/tickets/scanner-auth`, `/validate`,
  `/validate-batch`, `/offline-manifest` (`requireRole('business')`).
- Gerir equipa e permissões internas, facturação, avaliações e exportação.
- Gravar estado da plataforma nas coleções que lhe pertencem —
  `guigui_businesses`, `guigui_events`, `guigui_promotions`, `guigui_stories`
  (`OWNED_COLLECTIONS`, restantes registos preservados).

### 1.4 Empresa — o que não pode

- Coleções globais: `guigui_subscription_plans`, `guigui_monetization_catalog`,
  `guigui_admin_business_model_config`, conversas e suporte — `DENY_FOR_BUSINESS` → `403`.
- Rotas `/api/admin/*` e `/api/metrics` — `requireRole('admin')` → `403 PERMISSION_DENIED`.
- Comprar bilhetes como cidadão — `401 AUTHENTICATION_REQUIRED`.
-Editar fichas ou eventos de outras empresas — `403 BUSINESS_SCOPE_REQUIRED`.

### 1.5 Administração — o que pode

- Totalidade de `/api/admin/*` (utilizadores, estatísticas, auditoria, pagamentos,
  decisões, destaques), `/api/metrics`, moderação e `/api/monetization/*`.
- Escrever qualquer chave de estado e indicar a empresa organizadora num evento.
- Configurar MFA (`/api/auth/mfa/setup`, `/api/auth/mfa/enable`).
- Supervisionar, configurar e auditar — nunca substituir as regras de âmbito das
  outras contas nos seus próprios dados.

### 1.6 Administração — o que não pode

- Comprar bilhetes — `POST /api/tickets/purchase` exige `role === 'user'` (usa uma conta cidadã).
- Acções reservadas às empresas — `requireRole('business')` em marketing e validação
  de bilhetes nega também a administração (`403 PERMISSION_DENIED`).
- Gravar fora das chaves `PLATFORM_STATE_KEYS` — `400 APP_STATE_KEY_NOT_ALLOWED`.

### 1.7 Onde está garantido

| Camada | Mecanismo | Ficheiro |
|---|---|---|
| Rotas | `requireSession`, `requireRole(...)`, `sessionContext` | `server.ts`, `server/modules/identity-access/http/sessionAccessMiddleware.ts` |
| Escopo de negócio | `resolveBusinessWrite`, `resolveEventWrite` | `server/platformWriteAccess.ts` |
| Estado partilhado | `resolveAppStateWrite`, `resolveAppStateValue` | `server/platformWriteAccess.ts` |
| Compras | `role === 'user'` + conta da sessão | `server.ts` (`/api/tickets/purchase`) |
| Navegação | guarda de tabs (`admin`, `client`, `scanner`, `support`) | `src/App.tsx` (`handleTabChange`) |
| Menus | entradas filtradas por papel | `src/components/FacebookLeftSidebar.tsx`, `Footer.tsx`, `src/config/navigation.ts` |
| Equipa interna | permissões por membro | `src/utils/businessPermissions.ts` |

**Fonte única no cliente:** `src/config/roleCapabilities.ts` (missão, `can`,
`cannot` por papel) — consumida pelo cartão de permissões de cada perfil.

---

## 2. Plano da interface de perfil por modo

Objetivo: cada perfil com a mesma estrutura, visual premium e **texto legível em
qualquer tema** (claro, escuro e sistema).

### 2.1 Princípios

1. **Tokens, nunca cores fixas.** Fundos com `--color-bg-canvas` /
   `--color-bg-surface`; texto com `--color-text-strong` (títulos),
   `--color-text-default` (corpo) e `--color-text-muted` (apoio), com variante
   `dark:` apenas onde o token não cobre.
2. **Contraste mínimo 4.5:1** para texto normal e 3:1 para títulos grandes,
   verificado nos três temas.
3. **Mesma hierarquia** em todos os modos: *eyebrow* (papel) → título →
   identidade → cartões → acções → permissões.
4. **Permissões visíveis:** cartão "O que este perfil pode fazer" com chips
   `Pode`/`Reservado`, para o utilizador perceber os limites sem errar.

### 2.2 Execução

| # | Alteração | Ficheiro | Estado |
|---|---|---|---|
| 1 | Matriz de capacidades por papel (missão, âmbito, tom, pode/não pode) | `src/config/roleCapabilities.ts` | feito |
| 2 | Cartão partilhado de permissões, premium e só com tokens | `src/components/profile/RoleCapabilitiesCard.tsx` | feito |
| 3 | Cartão no perfil do cidadão (Minha Conta) | `src/components/CitizenDashboard.tsx` | feito |
| 4 | Cartão no painel da empresa (Visão Geral) | `src/components/BusinessDashboard.tsx` | feito |
| 5 | Cartão e cabeçalho de identidade no perfil de administração | `src/components/admin/AdminProfilePanel.tsx` | feito |
| 6 | Fundos de página fixos (`#f3efe9`, `#f7f2ec`, `#f7f5f3`) trocados por `--color-bg-dashboard-canvas` | `AdminDashboard.tsx`, `BusinessDashboard.tsx` | feito |
| 7 | Verificação de contraste claro/escuro + `tsc` + testes | — | feito |

### 2.3 O que fica visível em cada perfil

Cada modo abre o perfil com a mesma anatomia: *eyebrow* do papel → título →
identidade → **"O que esta conta pode fazer"** → cartões de conta (dados,
sessão, preferências, segurança).

- **Cidadão** — acento verde; âmbito "Feed, diretório, agenda e a sua conta".
- **Empresa** — acento dourado; âmbito "Painel comercial da sua empresa".
- **Administração** — acento azul; âmbito "Administração global da plataforma".

O cartão de permissões mostra a contagem de acções permitidas e reservadas, o
âmbito de acesso e a nota de que os limites são impostos também pelo servidor.

### 2.4 Regras de cor (obrigatórias em trabalho futuro)

- Texto em `--color-text-strong` / `--color-text-default` / `--color-text-muted`.
- Acentos por `--color-green/gold/blue-*`; nunca `#hex` fixo em texto.
- Estados (subida/descida) em `--color-text-positive` / `--color-text-negative`.
- `dark:` só quando o token não cobre o caso; nunca para inverter texto claro
  sobre fundo escuro já resolvido por token.
- Verificação: contraste ≥ 4.5:1 (texto normal) e ≥ 3:1 (títulos ≥ 24px ou
  ≥ 18.66px a negrito) nos temas claro e escuro, em cada ecrã de perfil.

### 2.5 Fora do âmbito

- Redesenho das telas internas de cada módulo (facturação, moderação, bilhética).
- Novos papéis ou alteração das regras do servidor (o modelo actual está correto).
