# Relatório Completo do Sistema Guigui.com

**Data:** 13/09/2026  
**Versão funcional:** 2026.09  
**Ambiente validado:** desenvolvimento local  
**URL:** http://127.0.0.1:3000  
**Estado geral:** operacional para desenvolvimento, demonstração e validação funcional

## 1. Resumo executivo

O Guigui.com é uma plataforma digital para a Guiné-Bissau que reúne descoberta comercial, rede social, comunicação, eventos, bilhetes, pagamentos, moderação, suporte e gestão administrativa.

O sistema é uma SPA React servida por um backend Express. A aplicação possui três perfis principais:

- **Cidadão:** descobre empresas, acompanha eventos, compra bilhetes, comunica com empresas e usa suporte.
- **Empresa:** gere o perfil comercial, conteúdo, promoções, eventos, vendas, bilhetes, equipa e comunicação.
- **Administração:** gere a operação, empresas, eventos, finanças, moderação, equipa, segurança, relatórios e suporte.

O funcionamento principal está implementado e foi validado por type-check, build, testes E2E e endpoint de saúde. As integrações externas continuam dependentes de configuração real de fornecedores antes de uma entrada em produção.

## 2. Estado atual

| Área | Estado | Observação |
|---|---|---|
| Frontend React | Operacional | SPA responsiva com Vite |
| Backend Express | Operacional | API REST e servidor integrado |
| Banco de dados | Conectado no ambiente atual | Confirmado por `/api/health` |
| Persistência local JSON | Operacional | Usada como fallback e para domínios locais |
| Autenticação | Operacional em desenvolvimento | Login, registo, sessão e logout |
| Conta cidadão | Operacional | Perfil, compras, mensagens e suporte |
| Conta empresa | Operacional | Painel comercial e gestão de eventos |
| Conta admin | Operacional | Painel administrativo e auditoria |
| Bilhetes e scanner | Implementado | QR/token, PIN e validação empresarial |
| Pagamentos | Sandbox/adaptadores | Orange Money e Telecel requerem credenciais reais |
| SMS | Simulador | Requer fornecedor para envio real |
| Email | Preparado | Requer SMTP |
| Moderação IA | Preparada | Gemini ativo quando `GEMINI_API_KEY` está configurada |
| Navegação e scroll | Corrigidos | Entradas de empresa/admin/cidadão centralizadas |
| Testes E2E | Passaram | 2 testes Playwright executados com sucesso |

## 3. Arquitetura técnica

### 3.1 Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Node.js
- Express 4
- `tsx`
- Recharts
- Lucide React
- Motion
- PostgreSQL via `pg`
- Persistência JSON em `data/`
- Playwright para testes E2E
- Google GenAI para moderação opcional
- Nodemailer para convites por email
- QR Code e assinatura HMAC para bilhetes

### 3.2 Organização principal

```text
src/
  App.tsx                    Estado global e navegação principal
  components/                Interface e módulos funcionais
  components/admin/          Painel e módulos administrativos
  data/                      Dados iniciais e catálogos
  locales/                   Traduções
  services/                  Serviços de notificação e integrações
  utils/                     Persistência, permissões, moderação e navegação
server.ts                    API Express e runtime local
server/                      Bootstrap e suporte de produção
db/migrations/               Migrações SQL
scripts/                     Auditorias, backups, workers e importadores
tests/                       Testes Playwright
public/                      Recursos públicos
dist/                        Artefactos de build
```

## 4. Módulos funcionais

### 4.1 Feed e descoberta

- Feed social com publicações, reações, comentários e partilhas.
- Stories comerciais.
- Pesquisa e filtros por categoria, bairro e empresa.
- Diretório comercial com cartões e comparação.
- Perfil público de empresa com informações, contactos, promoções, publicações e avaliações.
- Suporte a Português, Inglês, Francês e Espanhol.

### 4.2 Empresas

O painel empresarial inclui:

- Visão Geral;
- Perfil da empresa;
- Publicações;
- Promoções;
- Eventos;
- Bilhetes e vendas;
- Scanner;
- Estatísticas;
- Faturação e planos;
- Equipa e permissões;
- Mensagens;
- Clientes;
- Marketing;
- Suporte;
- Notificações;
- Definições;
- Exportações.

### 4.3 Cidadãos

A conta pessoal permite:

- editar perfil e preferências;
- seguir empresas;
- receber notificações;
- guardar lembretes de eventos;
- consultar compras e bilhetes;
- abrir mensagens privadas;
- abrir e acompanhar pedidos de suporte;
- alterar palavra-passe;
- desativar ou eliminar a conta.

### 4.4 Eventos e bilhetes

O fluxo de bilhetes contempla:

1. seleção do evento;
2. escolha do tipo e quantidade;
3. pagamento;
4. criação do bilhete;
5. geração de QR/token e código;
6. consulta e reenvio;
7. validação na entrada pelo scanner da empresa.

O scanner suporta QR, código manual, PIN de contingência, feedback de validação e bloqueio de reutilização.

### 4.5 Pagamentos

Foram previstos:

- Orange Money;
- Telecel;
- transferência ou depósito com comprovativo;
- confirmação automática em sandbox;
- confirmação manual;
- reconciliação;
- reembolso;
- relatórios CSV, Excel e PDF.

As taxas, comissões e preços são configuráveis no catálogo administrativo.

### 4.6 Moderação

O sistema possui:

- análise de conteúdo;
- classificação verde, amarela e vermelha;
- revisão humana;
- denúncias;
- histórico de decisões;
- auditoria de ações;
- integração opcional com Gemini.

Sem credencial Gemini, o runtime utiliza as regras locais previstas pela aplicação.

### 4.7 Administração

O painel administrativo inclui:

- Visão Geral;
- empresas e negócios;
- eventos e bilhetes;
- finanças;
- moderação;
- suporte;
- equipa administrativa;
- permissões;
- auditoria;
- relatórios;
- arquitetura e saúde do sistema;
- notificações;
- planos e monetização;
- categorias.
- utilizadores;
- notificações em massa;
- configurações globais.

As listas de módulos estão centralizadas em `src/config/navigation.ts`. A entrada de cada perfil é
controlada por `src/utils/navigationBehavior.ts`, enquanto a navegação mobile do cidadão e os
componentes reutilizáveis de sidebar ficam em `src/components/navigation/`.

## 5. Navegação e comportamento de entrada

A navegação global é controlada por `currentTab` em `src/App.tsx`.

As regras atuais são:

- perfil público de empresa abre no topo e começa em informações;
- conta empresa entra sempre em **Visão Geral**;
- conta admin entra sempre em **Visão Geral**;
- conta cidadão entra no feed definido para a experiência pública;
- logout limpa o histórico de entrada autenticada;
- trocar de página reposiciona o documento no topo;
- mudar de módulo interno reposiciona o painel no topo;
- abrir outra empresa reinicia o scroll interno do perfil;
- o botão Voltar preserva o contexto de navegação pública;
- login não reutiliza a secção anterior do painel empresarial ou administrativo.

A política está centralizada em [src/utils/navigationBehavior.ts](../../src/utils/navigationBehavior.ts).

## 6. APIs principais

### Autenticação e conta

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
POST /api/auth/change-password
POST /api/auth/request-password-reset
POST /api/auth/reset-password
POST /api/account/deactivate
POST /api/account/delete
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

### Moderação e auditoria

```text
POST /api/moderate
GET  /api/moderation/logs
POST /api/moderation/review
GET  /api/admin/moderation-logs
```

### Sistema

```text
GET  /api/health
GET  /api/system/architecture
POST /api/system/backup/trigger
POST /api/system/gdpr/consent
```

## 7. Persistência

### PostgreSQL

O ambiente atual possui `DATABASE_URL` configurada e a ligação foi confirmada pelo endpoint de saúde:

```json
{
  "status": "ok",
  "database": {
    "configured": true,
    "connected": true
  }
}
```

As migrações encontram-se em:

- `db/migrations/001_initial_schema.sql`
- `db/migrations/002_communication_schema.sql`

### JSON e armazenamento local

O runtime mantém persistência complementar em `data/`, incluindo autenticação, tickets, pagamentos, auditoria, moderação, monetização e sessões.

O frontend usa `localStorage` para preferências, estado visual, dados de demonstração e alguns domínios de produto. Esses valores não devem ser considerados prova de autorização de segurança.

## 8. Segurança e conformidade

Existem mecanismos para:

- sessão server-side;
- cookies HttpOnly;
- expiração e logout;
- hashing de palavras-passe;
- assinatura de tickets;
- rate limiting;
- idempotência;
- logs de auditoria;
- consentimento GDPR;
- separação de papéis no frontend;
- validações de permissões empresariais.

### Pontos que exigem preparação para produção

- substituir segredos de exemplo por valores aleatórios e exclusivos;
- ativar HTTPS;
- configurar domínio e cookies seguros;
- validar autorização server-side em todas as operações administrativas;
- substituir contas demo;
- configurar MFA real;
- usar PostgreSQL como fonte principal transacional;
- configurar backups externos e restauração testada;
- configurar fornecedores reais de pagamento, SMS, email e armazenamento;
- executar teste de carga e teste de recuperação.

## 9. Configuração de ambiente

Variáveis essenciais:

```text
NODE_ENV
PORT
APP_URL
DATABASE_URL
SESSION_COOKIE_SECRET
MFA_SECRET
TICKET_SIGNING_SECRET
PAYMENT_WEBHOOK_SECRET
SCANNER_DOOR_CODE
```

Integrações opcionais:

```text
GEMINI_API_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
EMAIL_FROM
PAYMENT_SANDBOX_AUTOCONFIRM
```

Nunca devem ser usadas credenciais reais no `.env.example` ou em ficheiros versionados.

## 10. Operação

### Desenvolvimento

```powershell
npm install
npm run dev
```

Abrir:

```text
http://127.0.0.1:3000
```

### Build de produção

```powershell
npm run build
npm start
```

### Verificação de saúde

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health
```

### Backups e manutenção

```powershell
npm run backup:json
npm run backup:postgres
npm run backup:postgres:verify
npm run worker
```

## 11. Validação executada

### Type-check

```text
npm run lint
Resultado: concluído sem erros
```

### Build

```text
npm run build
Resultado: concluído com sucesso
```

O build gerou o frontend em `dist/` e o servidor compilado `dist/server.mjs`.

### Testes E2E

```text
npm run test:e2e
Resultado: 2 testes passaram
```

Testes confirmados:

- abertura da página inicial;
- troca e persistência dos idiomas suportados.

### Saúde do runtime

```text
GET /api/health
HTTP 200
database.configured: true
database.connected: true
geminiActive: true
observability.persistent: true
```

## 12. Limitações conhecidas

O sistema está pronto para desenvolvimento e demonstração integrada, mas os seguintes pontos devem ser concluídos antes de produção comercial:

1. validar todos os fornecedores externos com credenciais de produção;
2. executar auditoria de autorização server-side;
3. migrar domínios críticos para transações PostgreSQL;
4. configurar monitorização externa, alertas e retenção de logs;
5. definir política de backup, RPO e RTO;
6. executar testes de carga, concorrência e recuperação;
7. remover ou desativar contas demo;
8. configurar domínio, HTTPS, CORS e cookies de produção;
9. confirmar requisitos legais, fiscais e de pagamentos locais;
10. executar validação final com utilizadores reais.

## 13. Conclusão

O Guigui.com encontra-se funcionalmente operacional no ambiente atual. A aplicação inicia, o backend responde, o banco está conectado, o frontend compila, os fluxos principais estão implementados e os testes E2E existentes passam.

O produto pode ser apresentado e utilizado em ambiente de desenvolvimento/homologação. Para lançamento público, a prioridade deve ser a preparação de produção indicada nas limitações: segurança server-side completa, integrações reais, backups restauráveis, observabilidade externa, testes de carga e configuração dos segredos.
