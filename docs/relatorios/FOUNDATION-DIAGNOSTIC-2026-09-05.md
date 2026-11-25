# Guigui.com — Diagnóstico da fundação

**Fase:** 0 — diagnóstico técnico  
**Data:** 05/09/2026  
**Validação:** inspeção do código + Playwright em `http://127.0.0.1:3000`

## 1. Stack confirmada

- React 19 + TypeScript.
- Vite 6 + Tailwind CSS 4.
- Express 4 + `tsx`.
- JSON persistido em `data/` para vários domínios backend.
- `localStorage` para sessão visual, dados de produto e preferências do frontend.
- Nodemailer para convites de equipa.
- Gemini para moderação quando `GEMINI_API_KEY` está configurada.
- Adaptadores sandbox para Orange Money e Telecel.
- QR Code e HMAC para bilhetes.
- Playwright para E2E.

Scripts existentes:

```text
npm run dev
npm run build
npm run check
npm run lint
npm run test:e2e
npm run test:payments
npm run test:tickets
npm run test:moderation
npm run test:spec-integrations
```

## 2. Rotas backend encontradas

### Autenticação e conta

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/change-password
POST /api/auth/request-password-reset
POST /api/auth/reset-password
POST /api/account/deactivate
POST /api/account/delete
```

### Convites

```text
POST /api/business/team/invitations
GET  /api/business/team/invitations/:token
POST /api/business/team/invitations/accept
```

### Moderação

```text
POST /api/moderate
GET  /api/moderation/logs
POST /api/moderation/review
GET  /api/admin/moderation-logs
```

### Bilhetes

```text
POST /api/tickets/purchase
POST /api/tickets/lookup
POST /api/tickets/resend-sms
POST /api/tickets/scanner-auth
POST /api/tickets/validate
POST /api/system/security/verify-token
```

### Pagamentos

```text
GET  /api/payments/transactions
GET  /api/payments/operators
POST /api/payments/create
POST /api/payments/webhook/:provider
POST /api/payments/confirm
POST /api/payments/reconcile
POST /api/payments/refund
```

### Monetização e sistema

```text
GET  /api/monetization/catalog
PUT  /api/monetization/catalog
GET  /api/monetization/ledger
GET  /api/monetization/requests
POST /api/monetization/requests
GET  /api/monetization/wallet/:businessId
GET  /api/system/architecture
POST /api/system/backup/trigger
POST /api/system/gdpr/consent
GET  /api/health
```

## 3. Persistência atual

### Persistência já existente

Os seguintes dados backend são carregados e gravados em ficheiros JSON:

- `data/auth.json`;
- `data/tickets.json`;
- `data/payments.json`;
- `data/audit-logs.json`;
- `data/moderation-logs.json`;
- `data/monetization-catalog.json`;
- `data/monetization-ledger.json`;
- `data/monetization-wallets.json`;
- `data/monetization-requests.json`.

Isto evita que todos os dados desapareçam ao reiniciar o processo, mas ainda não é uma base relacional com transações, concorrência, índices, chaves estrangeiras ou migrações.

### Dados ainda locais ao navegador

- utilizador atual;
- estado de sessão visual;
- empresas e conteúdo inicial;
- mensagens;
- suporte;
- notificações;
- pedidos;
- preferências;
- estado aberto/recolhido dos menus.

Este modelo não sincroniza vários dispositivos e não pode ser usado como autorização de segurança.

### Estado em memória

- janelas de rate limit;
- idempotência de compras;
- idempotência de pagamentos;
- limites de consulta e reenvio de SMS;
- cliente Gemini;
- caches e mapas carregados pelo processo.

Esses valores são perdidos quando o processo reinicia.

## 4. Riscos críticos encontrados

### Autenticação

- Foi adicionada uma sessão server-side intermediária em `data/sessions.json`,
  com cookie HttpOnly, expiração e revogação no logout.
- A sessão depende de `SESSION_COOKIE_SECRET`; sem essa variável em
  desenvolvimento é gerado um segredo temporário e as sessões não sobrevivem
  a um reinício.
- O frontend ainda guarda o perfil visual em `localStorage`; isso não é usado
  como prova de autorização no backend.
- Existem contas demo hardcoded com a palavra-passe `123456`.
- A função `verifyDemoPassword` ainda aceita a palavra-passe fixa caso não exista override.
- MFA ainda não é uma proteção real do login.

### Autorização

- Existem guards no frontend para Admin, empresa e scanner.
- As APIs sensíveis não possuem um middleware global consistente que derive o papel de uma sessão backend.
- Alguns endpoints administrativos aceitam operações sem comprovar no servidor que o chamador é Admin.
- Permissões enviadas pelo frontend não devem ser consideradas confiáveis.

### Persistência

- JSON é persistente, mas não garante atomicidade multioperação.
- Idempotência é perdida no restart.
- Não há migrações nem esquema relacional.
- Não há transações para compra, confirmação e validação concorrente.

### Integrações

- Orange Money e Telecel estão em sandbox/adaptadores.
- SMS é simulado.
- Email depende de SMTP.
- Backup cria registo operacional, mas não garante cópia externa restaurável.

## 5. Fases de implementação aprovadas

A ordem a seguir evita construir funcionalidades novas sobre uma base insegura:

1. Persistência relacional e migrações.
2. Autenticação server-side.
3. RBAC e autorização por escopo.
4. Pagamentos com máquina de estados.
5. Bilhetes transacionais.
6. Auditoria persistente.
7. Backups verificáveis.
8. Observabilidade.
9. Testes unitários, integração e E2E.
10. Performance e code splitting medidos.

## 6. Bloqueios de infraestrutura

Antes da Fase 1 é necessário escolher e fornecer:

- PostgreSQL de desenvolvimento/teste/staging/produção;
- `DATABASE_URL` por ambiente;
- política de migrações;
- armazenamento externo para backups;
- credenciais sandbox oficiais de Orange Money/Telecel;
- SMTP de teste e produção;
- provedor MFA;
- política de retenção e eliminação de dados.

Sem esses recursos, é possível preparar o código e um sandbox controlado, mas não declarar a plataforma pronta para produção.

## 7. Validação Playwright da baseline

Executado em `http://127.0.0.1:3000`:

- página inicial carregada;
- `/api/health` respondeu HTTP 200;
- frontend reportou `status: ok`;
- menu Admin abriu;
- atalhos Admin foram renderizados;
- atalhos testados abriram Perfil, Equipa, Arquitetura, Relatórios, Auditoria e Suporte;
- Diretório, Ofertas e Agenda foram acessíveis pelo cabeçalho;
- sem overflow horizontal em 390px;
- sem overflow horizontal em 768px;
- sem overflow horizontal em 1440px.

## 8. Critério para avançar

O próximo passo de código deve ser a Fase 1: criar o esquema relacional, migrações, adaptador de conexão e repositórios sem remover o armazenamento atual até existir migração e fallback explicitamente sinalizado.

Não é seguro substituir todo o backend numa única alteração. Cada domínio deve ser migrado e testado separadamente, começando por utilizadores, sessões, empresas, eventos, pedidos, pagamentos e auditoria.
