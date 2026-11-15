# 📖 Manual Técnico & Guia de Continuidade de Desenvolvimento para o Guigui.com

> **Documento Destinado a Manus / Engenheiros de Software / Grupo Gorila**  
> **Versão:** 2.4.0  
> **Localização:** Bissau, Guiné-Bissau  
> **Ambiente:** Node.js + Express + React 19 + TypeScript + Vite + Tailwind CSS v4

---

## 🎯 1. Objetivo & Contexto do Projeto

O **Guigui.com** é uma plataforma digital multifacetada desenhada especificamente para a realidade comercial, cultural e tecnológica da **Guiné-Bissau**. O projeto foi concebido pelo **Grupo Gorila** para resolver desafios críticos locais:

1. **Visibilidade Comercial**: Permitir que micro, pequenas, médias e grandes empresas de Bissau (e regiões) divulguem os seus negócios, cardápios, serviços e promoções.
2. **Engajamento Comunitário**: Feed social interativo onde empresas publicam novidades e os cidadãos interagem com reações e comentários em Português e Crioulo Guineense (*Kriol*).
3. **Bilhética Digital Segura para Eventos**: Venda de ingressos com validação na porta via **QR Code criptografado** ou **código PIN de 4 dígitos via SMS** (garantindo funcionamento mesmo em zonas com instabilidade de rede ou falta de bateria em smartphones).
4. **Pagamentos em Francos CFA (XOF)**: Integração e reconciliação com as duas principais carteiras digitais locais: **Orange Money** (`+245 955 00 00`) e **Telecel / Teletaco** (`+245 966 00 00`).
5. **Moderação por IA com Sensibilidade Cultural**: Moderação de conteúdos e imagens via Google Gemini com regra de precaução para expressões em Crioulo da Guiné-Bissau.
6. **Resiliência a Conexões Instáveis**: Design otimizado para redes móveis 3G/4G, suporte a cache local PWA, e persistência em `localStorage` com sincronização no servidor.

---

## 🏗️ 2. Arquitetura do Sistema & Fluxo de Dados

### 2.1 Visão Geral da Arquitetura
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENTE / NAVEGADOR                             │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌───────────────┐  │
│  │   Feed Social & Posts   │  │  Diretório & Comércio │  │ Bilhética/PIN │  │
│  └────────────┬────────────┘  └───────────┬───────────┘  └───────┬───────┘  │
│               │                           │                      │          │
│               ▼                           ▼                      ▼          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │               React 19 + Motion + Tailwind CSS v4                     │  │
│  │           Estado Global Centralizado em App.tsx (LocalStorage)        │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │ Chamadas REST (/api/*)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (server.ts - Porta 3000)                      │
│  ┌─────────────────────────┐  ┌───────────────────────┐  ┌───────────────┐  │
│  │  Gemini AI Moderation   │  │  Tickets & Scanner DB │  │ Mobile Money  │  │
│  │  (gemini-2.5-flash)     │  │  (HMAC Token / 4-PIN) │  │  Transactions │  │
│  └────────────┬────────────┘  └───────────┬───────────┘  └───────┬───────┘  │
│               │                           │                      │          │
│               ▼                           ▼                      ▼          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │     Express Router / Vite SSR Middleware / DigitalOcean Cloud Nodes    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Estrutura de Diretórios
```
/
├── server.ts                           # Ponto de entrada do backend Express
├── package.json                        # Dependências e scripts de execução
├── vite.config.ts                      # Configuração do Vite e Tailwind v4
├── tsconfig.json                       # Configuração TypeScript
├── metadata.json                       # Metadados e permissões da plataforma
├── .env.example                        # Variáveis de ambiente
├── README.md                           # Documentação pública
├── INSTRUCTIONS_FOR_MANUS.md           # Este manual técnico
│
└── src/
    ├── main.tsx                        # Ponto de entrada do React
    ├── App.tsx                         # Gestor do estado principal e roteamento
    ├── types.ts                        # Interfaces e tipos do TypeScript
    ├── index.css                       # Regras CSS globais e Tailwind v4
    │
    ├── components/                     # Componentes React
    │   ├── Navbar.tsx                  # Navegação principal e troca de perfis
    │   ├── NotificationBell.tsx        # Central de notificações
    │   ├── HeroHeader.tsx              # Pesquisa e filtros por bairro
    │   ├── FeedPostCard.tsx            # Card de post do feed social
    │   ├── StoriesBar.tsx              # Barra horizontal de stories
    │   ├── StoryModal.tsx              # Visualizador imersivo de stories
    │   ├── CreatePostBox.tsx           # Caixa de criação de posts com IA
    │   ├── BusinessCard.tsx            # Card de empresa no diretório
    │   ├── BusinessDetailModal.tsx     # Modal de perfil completo da empresa
    │   ├── BusinessComparisonModal.tsx # Comparador lado a lado
    │   ├── BusinessDashboard.tsx       # Painel do Comerciante
    │   ├── AdminDashboard.tsx          # Painel de Administração Geral
    │   ├── EventsView.tsx              # Vista pública de eventos e bilhetes
    │   ├── TicketScannerView.tsx       # Validador de porta via câmara/PIN
    │   ├── EventAlertsManager.tsx      # Gestor de alertas de eventos
    │   ├── PromotionsView.tsx          # Vista de promoções
    │   ├── QRCodeDisplay.tsx           # Exibição de QR Code e código PIN
    │   ├── SmsSimulatorToast.tsx       # Simulador visual de SMS
    │   ├── FacebookLeftSidebar.tsx     # Sidebar esquerda
    │   ├── FacebookRightSidebar.tsx    # Sidebar direita
    │   ├── InstitutionalPages.tsx      # Termos, Privacidade, RGPD
    │   └── Footer.tsx                  # Rodapé
    │
    ├── components/admin/               # Módulos específicos do Admin
    │   ├── AdminOverview.tsx           # Resumo executivo de métricas
    │   ├── AdminStaffManagement.tsx    # Gestão de Administradores & Papéis
    │   ├── AdminAuditLogsHub.tsx       # Hub de Logs de Auditoria do Sistema
    │   └── AdminReportsHub.tsx         # Exportações e relatórios executivos
    │
    ├── components/client/              # Módulos específicos do Comerciante
    │   ├── ClientBusinessProfile.tsx   # Edição de perfil da empresa
    │   ├── ClientEventsManagement.tsx  # Criação e gestão de eventos
    │   ├── ClientExportHub.tsx         # Exportação de relatórios da empresa
    │   ├── ClientNotificationsHub.tsx  # Central de notificações do negócio
    │   └── ClientSettingsHub.tsx       # Definições da conta empresarial
    │
    ├── data/                           # Dados estruturados iniciais
    │   ├── initialData.ts              # Empresas, categorias, posts, eventos
    │   ├── adminStaffData.ts           # Equipa de administradores inicial
    │   ├── auditLogsData.ts            # Histórico de auditoria inicial
    │   └── notificationsData.ts        # Notificações iniciais
    │
    ├── services/                       # Serviços
    │   └── smsService.ts               # Serviço de envio/simulação de SMS
    │
    └── utils/                          # Utilitários
        ├── exportHelpers.ts            # Exportação para CSV, Excel (.xlsx) e PDF
        ├── i18n.ts                     # Tradução (PT, Kriol, FR, EN)
        ├── moderation.ts               # Heurísticas de moderação
        ├── reviews.ts                  # Classificação qualitativa
        └── useDragScroll.ts            # Scroll arrastável com rato
```

---

## 📡 3. Endpoints da API REST (`server.ts`)

Todos os endpoints estão implementados em `server.ts` e escutam na porta `3000`.

### 3.1 Sistema & Saúde
- `GET /api/health`
  - Retorna o estado do servidor, identificador da aplicação e se a chave do Gemini AI está ativa.
- `GET /api/system/architecture`
  - Retorna metadados da arquitetura, status dos nós na nuvem (DigitalOcean Frankfurt + Hetzner Amsterdão), conformidade RGPD e histórico de backups.
- `POST /api/system/backup/trigger`
  - Aciona manualmente uma rotina de backup com replicação em região secundária.
- `POST /api/system/gdpr/consent`
  - Regista o consentimento explícito aos termos de proteção de dados com IP do utilizador.

### 3.2 Moderação com Inteligência Artificial (Gemini 2.5 Flash)
- `POST /api/moderate`
  - **Body**: `{ text: string, author?: string, type?: string, imageBase64?: string }`
  - **Processamento**:
    1. Chama o modelo `gemini-2.5-flash` via `@google/genai`.
    2. Avalia conformidade cultural e classifica como `verde`, `amarelo` ou `vermelho`.
    3. **Regra de Precaução do Crioulo (Secção 9.3)**: Se o texto contém termos em Crioulo Guineense (*kuri, mancebo, fasi, pabu, djintis, frikundam, kumpu, etc.*), é classificado preventivamente como `amarelo` para revisão humana.
    4. Grava na lista de auditoria `moderationLogs`.
- `GET /api/moderation/logs`
  - Lista todos os registos de moderação com trilha de auditoria.
- `POST /api/moderation/review`
  - **Body**: `{ id: string, action: 'approve' | 'reject' | 'appeal', reviewerName: string, notes: string }`
  - Atualiza o status do item após revisão humana.

### 3.3 Bilhética de Eventos & Validação na Porta
- `POST /api/tickets/purchase`
  - **Body**: `{ eventId, eventTitle, ticketTypeName, priceXOF, buyerName, buyerPhone, paymentMethod }`
  - Gera:
    - `ticketCode` (ex: `GUI-4821`)
    - `qrToken` (ex: `QR-GUI-1740000000-4821`)
    - `pinCode` (código de 4 dígitos offline, ex: `7492`)
  - Cria transação de pagamento correspondente e retorna os dados do bilhete e a mensagem de SMS formatada.
- `POST /api/tickets/validate`
  - **Body**: `{ codeOrToken: string, doorCode?: string }`
  - **Respostas**:
    - `status: "success"` (Entrada permitida, marca o bilhete como `used` com timestamp).
    - `status: "already_used"` (Bilhete já foi lido anteriormente — bloqueio de fraude).
    - `status: "invalid"` (Código inexistente).

### 3.4 Pagamentos & Mobile Money (Orange Money & Telecel)
- `GET /api/payments/transactions`
  - Retorna todas as transações registadas.
- `GET /api/payments/operators`
  - Retorna o estado das operadoras em Bissau (números de telemóvel dedicados, status de integração, volume transacionado).
- `POST /api/payments/create`
  - Cria uma nova transação (`confirmed_api` para push automático ou `pending_manual_confirmation` para comprovativo manual).
- `POST /api/payments/confirm`
  - Confirmação manual de pagamento por um administrador financeiro.
- `POST /api/payments/reconcile`
  - Marca transações como reconciliadas com os extratos das operadoras.
- `POST /api/payments/refund`
  - Emite reembolso de um bilhete ou subscrição.

---

## 💾 4. Gestão de Estado & Persistência

O frontend armazena e sincroniza o estado utilizando React State + `localStorage` para garantir persistência entre recarregamentos e navegação:

| Chave no `localStorage` | Descrição |
| :--- | :--- |
| `guigui_businesses` | Lista completa de empresas do diretório, categorias e planos |
| `guigui_posts` | Publicações do feed social com comentários e reações |
| `guigui_events` | Eventos culturais e bilhetes vendidos |
| `guigui_reminders` | Lembretes de eventos guardados pelo utilizador |
| `guigui_orders` | Pedidos de compra e bilhetes emitidos |
| `guigui_admin_staff` | Equipa de administradores e permissões operacionais |
| `guigui_audit_logs` | Histórico de ações de auditoria do sistema |
| `guigui_system_notifications` | Central de notificações segmentadas |
| `guigui_active_user` | Utilizador autenticado atualmente |
| `guigui_lang` | Idioma selecionado (`pt`, `kriol`, `fr`, `en`) |

---

## 🖨️ 5. Utilitário de Exportação (`src/utils/exportHelpers.ts`)

O sistema disponibiliza 3 métodos utilitários independentes de bibliotecas pesadas:

1. `downloadCSV(filename, headers, rows)`: Gera um arquivo `.csv` codificado em UTF-8 com BOM (suporta caracteres especiais do Português e Crioulo).
2. `downloadExcel(filename, sheetName, headers, rows)`: Gera uma folha de cálculo XML compatível com Microsoft Excel, LibreOffice e Google Sheets com estilização nos cabeçalhos.
3. `downloadPDFReport(title, subtitle, summaryCards, headers, rows)`: Abre uma janela de impressão com folha de estilo tipográfica profissional com o cabeçalho oficial do **Guigui.com / Grupo Gorila**, cartões de resumo estatístico e tabela zebrada.

---

## 👥 6. Perfis de Utilizador & Controlo de Acesso (RBAC)

Definidos em `src/types.ts` e gerenciados em `src/components/admin/AdminStaffManagement.tsx`:

```typescript
export type AdminRole = 
  | 'super_admin'       // Acesso total a todas as áreas
  | 'moderator'         // Gestão de moderação IA, denúncias e conteúdo
  | 'financial_manager' // Transações, reconciliação Mobile Money e extratos
  | 'support_agent';    // Atendimento, verificação de comércios e empresas
```

Cada membro da equipa possui um conjunto granular de permissões booleanas:
- `canManageBusinesses`
- `canModerateContent`
- `canManageFinances`
- `canManageStaff`
- `canManageEvents`
- `canExportData`
- `canConfigureArchitecture`

---

## 🚀 7. Como Continuar o Desenvolvimento (Guia para Manus)

Se fores o Manus ou um novo desenvolvedor a continuar este projeto, segue este roteiro para as próximas etapas:

### 📌 Tarefa 1: Migração do Armazenamento para Base de Dados Relacional (PostgreSQL / Cloud SQL)
- Atualmente, os dados em desenvolvimento utilizam `localStorage` no frontend e `Map`/`Array` em memória no `server.ts`.
- **Passo a seguir**: Configurar o Drizzle ORM ou Prisma conectado a uma instância PostgreSQL. Os esquemas relacionais já foram estruturados em `src/types.ts` (`Business`, `Review`, `EventItem`, `Ticket`, `PurchaseOrder`, `PaymentTransaction`, `AdminStaffMember`, `AuditLogEntry`).

### 📌 Tarefa 2: Conexão Real com Webhooks das Operadoras de Mobile Money
- Em `server.ts`, a simulação do Push OTP da Orange Money e Telecel já está pronta.
- **Passo a seguir**: Adicionar os endpoints de webhook das operadoras:
  - `POST /api/webhooks/orange-money/callback`
  - `POST /api/webhooks/telecel/callback`
  - Validar a assinatura de segurança enviada no cabeçalho das operadoras antes de atualizar a transação para `confirmed_api`.

### 📌 Tarefa 3: Integração do Gateway Real de SMS (SMPP / Twilio / Operadora Local)
- Em `src/services/smsService.ts`, o serviço emite as mensagens e dispara o `SmsSimulatorToast`.
- **Passo a seguir**: Adicionar chamada HTTP para o gateway de SMS local da Guiné-Bissau ou provedor global para entrega real das mensagens de PIN de 4 dígitos nos telemóveis dos clientes.

### 📌 Tarefa 4: Notificações Push PWA (Service Worker)
- A aplicação já está estruturada como PWA instalável.
- **Passo a seguir**: Registrar o Service Worker para receber notificações push mesmo quando o ecrã do telemóvel estiver bloqueado, informando o comerciante sobre novos pedidos ou o cidadão sobre lembretes de eventos.

---

## ⚙️ 8. Comandos Úteis

```bash
# Executar servidor de desenvolvimento (Frontend Vite + Backend Express)
npm run dev

# Validar tipagem TypeScript (Linter)
npm run lint

# Compilar para produção (Gera dist/ e empacota server.cjs)
npm run build

# Iniciar servidor em produção
npm run start
```

---

## 🛡️ 9. Políticas de Segurança e Boas Práticas

1. **Nunca expor a `GEMINI_API_KEY` no frontend**: Todas as chamadas de IA devem passar exclusivamente pelo endpoint seguro `/api/moderate` em `server.ts`.
2. **Tokens de Bilhetes Imutáveis**: Os códigos QR gerados utilizam padrão de token assinado e devem ser invalidados imediatamente na primeira leitura com sucesso no scanner de porta.
3. **Respeito pelo Crioulo Guineense**: Sempre que forem adicionadas novas palavras-chave ou regras ao moderador semântico, garantir que expressões típicas não sejam rejeitadas indevidamente, mas sim direcionadas para a fila amarela de verificação humana amigável.
