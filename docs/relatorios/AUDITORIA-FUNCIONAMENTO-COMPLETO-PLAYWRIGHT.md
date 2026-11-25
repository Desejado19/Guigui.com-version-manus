# Guigui.com — Auditoria completa de funcionamento

**Data da auditoria:** 05/09/2026  
**Ambiente analisado:** desenvolvimento local em `http://127.0.0.1:3000`  
**Tecnologia:** React + TypeScript + Vite + Express  
**Método:** leitura da implementação, inspeção das rotas e validação visual/interativa com Playwright

## 1. Resumo executivo

O Guigui.com é uma plataforma digital para a Guiné-Bissau que reúne:

- feed social e publicações;
- diretório de empresas;
- ofertas e descontos;
- agenda cultural e bilhetes;
- comunicação entre cidadãos e empresas;
- suporte entre utilizadores e Administração;
- painel empresarial;
- painel administrativo;
- pagamentos, bilhética, moderação, notificações e auditoria.

A aplicação está organizada como uma SPA. O utilizador permanece no mesmo endereço e a interface troca o módulo ativo de acordo com o menu escolhido. O servidor Express fornece a aplicação, APIs de autenticação, bilhetes, pagamentos, moderação, convites e operações de sistema.

O funcionamento visual principal foi confirmado. Os pontos que dependem de serviços externos — email SMTP, pagamentos reais, SMS, push, Gemini e armazenamento de produção — estão preparados por adaptadores, mas não devem ser considerados integrações de produção sem configuração e testes com os fornecedores.

## 2. Como a aplicação inicia

### Desenvolvimento

```text
npm run dev
```

O servidor Express inicia o Vite em modo middleware e disponibiliza:

```text
http://127.0.0.1:3000
```

### Produção

```text
npm run build
```

O Vite gera os ficheiros frontend em `dist/` e o esbuild gera o servidor compilado. O Express serve os ficheiros estáticos e aplica fallback SPA para que a navegação do React continue a funcionar.

### Verificação de saúde

```text
GET /api/health
```

Esta rota confirma que o processo backend está ativo.

## 3. Estrutura geral de navegação

O estado global `currentTab`, mantido em `src/App.tsx`, controla a área principal:

| Área | Função |
|---|---|
| Feed | Publicações, stories, reações, comentários e pesquisa |
| Diretório | Empresas, categorias, filtros e fichas |
| Ofertas | Promoções, cupões e campanhas |
| Eventos | Agenda, bilhetes e lembretes |
| Scanner | Validação empresarial de bilhetes |
| Área pessoal/comercial | Painel de cidadão ou empresa |
| Mensagens | Conversas privadas cidadão–empresa |
| Suporte | Pedidos dirigidos à Administração |
| Administração | Operação interna da plataforma |
| Institucional | Informação sobre o Guigui.com |

O cabeçalho continua disponível como navegação global. O menu lateral de cada painel é específico do papel e pode ser aberto, fechado ou recolhido.

## 4. Cabeçalho e menu de conta

O botão **Menu Principal** abre um drawer lateral. O botão **Fechar Menu** encerra o drawer. O conteúdo é adaptado ao papel ativo.

### Atalhos Admin confirmados

Os cartões do cabeçalho são atalhos para os módulos completos dentro da Administração:

| Atalho no cabeçalho | Módulo Admin aberto |
|---|---|
| Minha conta | Perfil |
| Governança | Equipa e utilizadores |
| Plataforma | Arquitetura e saúde do sistema |
| Análises | Relatórios |
| Segurança | Auditoria e logs |
| Suporte | Suporte administrativo |

O cabeçalho não duplica o conteúdo dos módulos. Ele apenas altera o separador inicial do `AdminDashboard`.

### Comportamento de sessão

- O perfil atual aparece no drawer.
- O utilizador pode trocar de conta.
- O tema pode ser alterado.
- O idioma pode ser alterado.
- O logout pede confirmação antes de terminar a sessão.
- O Admin não recebe uma caixa privada de mensagens comerciais; pedidos administrativos são encaminhados para Suporte.

## 5. Fluxo do cidadão

### 5.1 Navegação pública

Sem sessão, o visitante pode:

1. consultar o feed;
2. pesquisar empresas;
3. abrir o diretório;
4. consultar promoções;
5. consultar eventos;
6. consultar informação institucional;
7. abrir o login quando tenta executar uma operação privada.

### 5.2 Conta pessoal

Depois do login, o cidadão pode:

- gerir perfil e preferências;
- seguir empresas;
- silenciar notificações de empresas seguidas;
- reagir, comentar e partilhar publicações;
- consultar mensagens;
- abrir suporte;
- guardar lembretes de eventos;
- consultar compras e bilhetes;
- alterar palavra-passe;
- desativar ou eliminar a conta.

### 5.3 Mensagens

Mensagens são conversas privadas entre cidadão e empresa. Cada conversa mantém:

- cidadão participante;
- empresa participante;
- assunto;
- mensagens;
- estado de leitura;
- última atividade.

Quando uma mensagem é criada, o destinatário recebe um evento `NEW_MESSAGE`. A Administração não deve visualizar essas conversas comerciais.

### 5.4 Suporte

O cidadão pode abrir pedidos dirigidos à Administração nas categorias:

- conta;
- pagamentos;
- bilhetes;
- técnico;
- denúncia empresarial;
- outros.

Um pedido passa por:

```text
open -> in_progress -> resolved
```

O requerente pode responder ao próprio pedido. A Administração responde, altera o estado e acompanha a resolução.

### 5.5 Compra de bilhetes

O fluxo de bilhete é:

1. cidadão escolhe o evento;
2. escolhe o tipo e quantidade de bilhetes;
3. informa os dados de contacto;
4. escolhe o provedor de pagamento;
5. o backend cria a transação;
6. após confirmação, são gerados os bilhetes;
7. cada bilhete recebe QR/token, código e PIN;
8. o cidadão pode consultar ou reenviar o bilhete.

Rotas relacionadas:

```text
POST /api/tickets/purchase
POST /api/tickets/lookup
POST /api/tickets/resend-sms
```

## 6. Fluxo da empresa

O papel `business` representa uma empresa associada a um `businessId`.

### 6.1 Módulos empresariais

O painel empresarial cobre:

- visão geral;
- perfil da empresa;
- publicações;
- promoções;
- eventos;
- bilhetes;
- scanner;
- pedidos e vendas;
- faturação;
- planos e assinatura;
- equipa;
- mensagens;
- suporte;
- notificações;
- definições e segurança.

### 6.2 Conteúdo e moderação

Publicações, promoções e eventos podem passar por moderação antes de ficarem públicos. A empresa acompanha o estado e recebe notificações de aprovação, rejeição ou necessidade de revisão.

O endpoint de moderação aceita texto e imagem. Quando Gemini está configurado, a análise usa o serviço externo; sem Gemini, são aplicadas heurísticas locais.

### 6.3 Equipa da empresa

O proprietário pode convidar colaboradores com funções:

| Função | Escopo principal |
|---|---|
| Manager | perfil, conteúdo, eventos, tickets e faturação |
| Editor | perfil e conteúdo |
| Finance | tickets e faturação |
| Support | tickets e atendimento |

O menu e as ações são filtrados conforme as permissões. A função não deve ser tratada apenas como texto visual: as ações do painel também consultam o utilitário central `businessPermissions.ts`.

### 6.4 Convite por email

O fluxo real é:

1. empresa informa email, nome, função e permissões;
2. backend gera token;
3. apenas o hash é persistido;
4. o convite recebe validade de 48 horas;
5. email contém `/?team_invite=<token>`;
6. destinatário abre o link;
7. backend valida token e validade;
8. colaborador cria palavra-passe;
9. convite é marcado como usado;
10. colaborador entra com a conta criada.

Variáveis necessárias para envio SMTP:

```text
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
EMAIL_FROM
APP_URL
```

Sem SMTP configurado, o sistema deve mostrar erro explícito e não fingir que o email foi enviado.

### 6.5 Scanner

O scanner é restrito ao papel empresarial. A validação verifica:

- evento;
- empresa autorizada;
- código de portaria;
- assinatura HMAC;
- validade;
- estado do bilhete;
- se o bilhete já foi utilizado;
- escopo de evento e empresa.

Rotas:

```text
POST /api/tickets/scanner-auth
POST /api/tickets/validate
```

## 7. Fluxo administrativo

O painel Admin é reservado a `role=admin`. A navegação lateral está organizada assim:

### Dashboard

- **Visão Geral** — KPIs, estado executivo e resumo da plataforma.

### Gestão

- **Empresas & Negócios** — lista, aprovação, verificação e estatísticas.
- **Capacidades** — capacidades e integrações ativas.
- **Categorias** — categorias e subcategorias do diretório.
- **Eventos & Bilhetes** — agenda, emissão e validação operacional.

### Financeiro

- **Financeiro** — vendas, transações, comissões, confirmações e reconciliação.
- **Planos & Assinaturas** — pricing, planos e subscrições.

### Controlo

- **Moderação** — conteúdo pendente, decisões e revisão.
- **Notificações** — avisos e preferências administrativas.

### Suporte

- **Suporte** — tickets enviados por cidadãos e empresas.

### Relatórios

- **Relatórios** — estatísticas, indicadores e exportação.

### Administração

- **Equipa** — administradores, staff, funções e estado.
- **Permissões** — matriz de acessos e permissões.

### Segurança

- **Auditoria** — ações, eventos e logs de segurança.

### Sistema

- **Arquitetura e saúde do sistema** — API, integrações, armazenamento, backups e saúde operacional.

### Minha Conta

- **Perfil** — perfil do administrador, sessão, preferências e segurança.

### Regras de acesso

- cidadão não entra no Admin;
- empresa não entra no Admin;
- Admin não usa o scanner empresarial;
- Admin é encaminhado para Suporte quando tenta abrir mensagens;
- atalhos de cabeçalho apenas selecionam módulos já existentes;
- menu recolhido continua acessível pelos ícones e tooltips.

## 8. Financeiro, pagamentos e monetização

### Pagamentos

Estados previstos:

```text
pending -> confirmed -> reconciled
pending -> failed
confirmed -> refunded
```

Rotas principais:

```text
GET  /api/payments/transactions
GET  /api/payments/operators
POST /api/payments/create
POST /api/payments/webhook/:provider
POST /api/payments/confirm
POST /api/payments/reconcile
POST /api/payments/refund
```

### Monetização

O Admin pode gerir catálogo e pedidos de serviços pagos:

```text
GET  /api/monetization/catalog
PUT  /api/monetization/catalog
GET  /api/monetization/ledger
GET  /api/monetization/requests
POST /api/monetization/requests
GET  /api/monetization/wallet/:businessId
```

O catálogo inclui preços, comissões, taxas fixas, extras de conteúdo, publicidade e regras de faturação.

## 9. Notificações

As notificações cobrem:

- conta;
- eventos;
- lembretes;
- empresas seguidas;
- promoções;
- moderação;
- pagamentos;
- bilhetes;
- avaliações;
- mensagens;
- suporte;
- segurança;
- estatísticas;
- alertas administrativos.

Canais modelados:

```text
in_app, push, email, SMS
```

Os eventos são criados quando ocorre uma ação relevante. Exemplos:

- nova mensagem;
- novo pedido de suporte;
- resposta de suporte;
- aprovação de conteúdo;
- venda de bilhete;
- alteração de pagamento;
- alerta de segurança.

O SMS atual é um simulador local. A entrega externa requer gateway real.

## 10. APIs disponíveis

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

### Sistema

```text
GET  /api/system/architecture
POST /api/system/backup/trigger
POST /api/system/gdpr/consent
POST /api/system/security/verify-token
```

## 11. Persistência de dados

O frontend usa `usePersistentState`, que serializa dados em `localStorage`.

Principais chaves:

| Chave | Conteúdo |
|---|---|
| `guigui_current_user` | utilizador atual |
| `guigui_current_lang` | idioma |
| `guigui_theme_mode` | tema |
| `guigui_businesses` | empresas |
| `guigui_events` | eventos |
| `guigui_promotions` | promoções |
| `guigui_user_posts` | publicações |
| `guigui_conversations` | conversas |
| `guigui_conversation_messages` | mensagens |
| `guigui_support_requests` | suporte |
| `guigui_system_notifications` | notificações |
| `guigui_purchase_orders` | pedidos e bilhetes |
| `guigui_admin_staff` | equipa Admin |
| `guigui_audit_logs` | auditoria |
| `guigui_subscription_plans` | planos |
| `guigui_monetization_catalog` | catálogo financeiro |
| `guigui_business_team_<businessId>` | equipa empresarial |
| `guigui-admin-sidebar-collapsed` | estado do menu Admin |
| `guigui-business-sidebar-collapsed` | estado do menu empresarial |
| `guigui-citizen-sidebar-collapsed` | estado do menu cidadão |

Esta persistência é adequada para protótipo e desenvolvimento local. Não substitui uma base de dados multiutilizador.

## 12. Segurança implementada

Existem mecanismos para:

- validação de email, telefone e montantes;
- hashing de palavra-passe com scrypt;
- HMAC-SHA256 em bilhetes;
- expiração de tokens;
- bloqueio de bilhetes usados ou cancelados;
- idempotência de operações de pagamento;
- rate limit geral;
- limites de imagens de moderação;
- headers HTTP de segurança;
- logs de ações sensíveis;
- confirmação de webhooks;
- isolamento de bilhete por empresa e evento.

## 13. Limitações importantes antes de produção

1. A sessão principal ainda é representada no frontend por `localStorage`.
2. As APIs administrativas precisam de middleware de autenticação/RBAC consistente no backend.
3. A persistência é híbrida entre JSON, memória e `localStorage`.
4. Não existe ainda uma base relacional com transações e concorrência real.
5. Orange Money e Telecel ainda dependem de integração real com os provedores.
6. SMTP só funciona com variáveis configuradas.
7. SMS é simulado localmente.
8. Push real, filas, retries e workers ainda não estão completos.
9. O 2FA aparece no modelo visual, mas precisa de implementação criptográfica efetiva.
10. O backup cria registo de operação, mas não garante cópia física externa.
11. Consentimento/GDPR precisa de política de retenção, exportação e eliminação completa.
12. Uploads precisam de storage isolado, antivírus e URLs assinadas.
13. Credenciais demo não podem ser usadas em produção.
14. É necessário separar rate limits para login, reset, scanner, convites e webhooks.
15. É necessário testar carga, concorrência, recuperação de desastre e segurança ofensiva.

## 14. Auditoria Playwright realizada

### Verificações concluídas

- aplicação abriu em `http://127.0.0.1:3000`;
- feed principal carregou;
- sessão Admin existente foi reconhecida;
- menu principal abriu e fechou;
- cartões Admin foram renderizados;
- atalhos Admin foram ligados aos módulos;
- Governança abriu Equipa;
- Plataforma abriu Arquitetura;
- Análises abriu Relatórios;
- Segurança abriu Auditoria;
- Suporte abriu Suporte;
- Minha conta abriu Perfil após estabilização da navegação;
- Diretório, Ofertas e Agenda foram acessíveis pelo cabeçalho;
- não foi encontrado overflow horizontal em 390px;
- não foi encontrado overflow horizontal em 768px;
- não foi encontrado overflow horizontal em 1440px.

### Validações automatizadas do projeto

```text
npm run check
```

Resultado: aprovado.

```text
npm run build
```

Resultado: aprovado. O aviso de chunks grandes do Vite é informativo e não bloqueou o build.

```text
npm run test:e2e
```

Resultado: 2 testes Playwright aprovados:

- abertura da página inicial;
- troca de idioma e persistência após reload.

### Interpretação dos resultados

Os testes confirmam o funcionamento da camada visual e dos fluxos de navegação exercitados. Eles não substituem:

- testes com provedores de pagamento reais;
- entrega SMTP real;
- testes de múltiplos utilizadores simultâneos;
- auditoria de autorização no backend;
- testes de carga;
- recuperação de backup;
- testes de segurança ofensiva.

## 15. Recomendações de evolução

### Prioridade crítica

1. Introduzir sessão server-side ou JWT com cookies seguros.
2. Aplicar autenticação e RBAC em todas as rotas sensíveis.
3. Migrar dados funcionais para PostgreSQL ou equivalente.
4. Integrar Orange Money e Telecel em ambiente sandbox oficial.
5. Substituir credenciais demo e segredo de portaria.

### Prioridade alta

1. Criar workers para email, SMS, push e notificações.
2. Implementar retries e idempotência por operação.
3. Transformar backup em cópia real, cifrada e verificável.
4. Implementar 2FA efetivo.
5. Adicionar testes de integração para convites, pagamentos, scanner e suporte.

### Prioridade média

1. Dividir o bundle frontend por módulos com `dynamic import`.
2. Adicionar métricas de erro e observabilidade.
3. Criar políticas de retenção e eliminação de dados.
4. Adicionar testes de acessibilidade e navegação por teclado.
5. Documentar contratos OpenAPI das APIs.

## 16. Referências técnicas

- `src/App.tsx` — composição global, navegação, sessão, notificações e persistência.
- `src/components/Navbar.tsx` — cabeçalho, drawer e atalhos por papel.
- `src/components/CitizenDashboard.tsx` — painel cidadão.
- `src/components/BusinessDashboard.tsx` — painel empresarial.
- `src/components/AdminDashboard.tsx` — painel administrativo.
- `src/components/CommunicationHub.tsx` — mensagens e suporte.
- `src/components/admin/AdminSupportHub.tsx` — suporte administrativo.
- `src/utils/businessPermissions.ts` — permissões empresariais.
- `src/services/notificationService.ts` — eventos e notificações.
- `server.ts` — APIs Express e servidor.
- `server/emailService.ts` — envio SMTP.
- `server/authService.ts` — convites e autenticação.
- `server/validationService.ts` — validações e segurança de bilhetes.
- `src/utils/persistentState.ts` — persistência local.

