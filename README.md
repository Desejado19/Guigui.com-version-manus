# Guigui.com - Plataforma Comercial, Cultural e de Bilhética da Guiné-Bissau

> **Guigui.com** é a plataforma digital oficial de divulgação comercial, empresarial, cultural e de bilhética de eventos para a Guiné-Bissau (Bissau e regiões), desenvolvida para o **Grupo Gorila**.

---

## 📌 Visão Geral do Sistema

O sistema unifica a experiência de descoberta local, rede social comercial, bilhética digital com validação na porta do evento via QR Code/PIN, pagamentos móveis em Francos CFA (XOF) com Orange Money e Telecel, moderação inteligente com Inteligência Artificial (Google Gemini) adaptada a Português, Francês e Inglês, e painéis de gestão robustos para comerciantes e administradores.

> **Manual funcional completo:** consulte [MANUAL-FUNCIONAL-COMPLETO-GUIGUI.md](MANUAL-FUNCIONAL-COMPLETO-GUIGUI.md) para a descrição integral de perfis, módulos, fluxos, permissões, API, segurança, validações, operação e limitações.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia / Biblioteca | Descrição |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript + Vite | Interface reativa, modular e de alto desempenho |
| **Estilização** | Tailwind CSS v4 | Design responsivo com visual mobile-first e adaptação desktop |
| **Animações** | Motion (`motion/react`) | Transições fluidas entre abas, modais e listas |
| **Ícones** | Lucide React | Conjunto moderno e consistente de ícones vetoriais |
| **Gráficos** | Recharts | Métricas de vendas, visualizações e distribuição de receitas |
| **Backend / API** | Node.js + Express + TypeScript (`tsx`) | API REST integrada servida na porta `3000`, com autenticação, pagamentos, bilhetes, moderação e auditoria |
| **Inteligência Artificial** | Google GenAI SDK (`@google/genai`) | Moderação multimodal de texto e imagens via `gemini-2.5-flash` |
| **Build & Deploy** | Vite + ESBuild Bundle | Compilação otimizada para Cloud Run / Docker / PWA |
| **Persistência local** | JSON em `data/` + `localStorage` | Sessões, contas, pedidos, empresas, operações e notificações persistem durante o desenvolvimento local |

---

## Arquitetura do backend (em migração)

O backend continua a ser um monólito Express num único processo. Em `server/modules/platform-foundation/`, a aplicação compõe o health check e mantém `GET /api/health`; `config/platformRuntimeConfig.ts` lê a configuração transversal de runtime e `hosting/prepareVercelRuntime.ts` prepara explicitamente o ambiente Vercel. Os lançadores de desenvolvimento, Node em produção e Vercel executam o preflight antes de importar o servidor. O submódulo `observability/` contém o acumulador de métricas HTTP, o adaptador de persistência, o middleware e os handlers de JSON/Prometheus. `server.ts` continua a ser o composition root das rotas e a montar os handlers. Os restantes serviços ainda não foram extraídos para contextos de domínio. O [mapa de capacidades](CAPABILITY-MAP.md) está aprovado; a [especificação da migração](docs/superpowers/specs/2026-10-22-guigui-modular-ddd-migration-design.md) e o roadmap foram aprovados integralmente em 2026-10-23.

## 🌟 Principais Módulos do Sistema

### 0. Base funcional unificada

- **Autenticação funcional**: login de contas demo e registo de cidadãos/empresas através dos endpoints `/api/auth/login` e `/api/auth/register`, com palavras-passe armazenadas com hashing no backend.
- **Sessão persistente**: a sessão ativa, dados de descoberta, pedidos, empresas e conteúdos criados ficam disponíveis após recarregar a aplicação durante o desenvolvimento local.
- **Backend operativo**: pagamentos, compra de bilhetes, validação de porta, moderação, auditoria, backup e consentimento estão expostos por API REST.

### 1. Feed Social & Descoberta Comercial
- **Feed Estilo Social**: Publicação de novidades, promoções e fotos pelos comerciantes cadastrados com suporte a reações (*Gosto*, *Adoro*, *Uau*, *Triste*, etc.), comentários e partilhas.
- **Stories Comerciais**: Barra de stories interativa no topo com anéis coloridos indicando publicações recentes e visualizador imersivo em ecrã inteiro.
- **Filtro por Bairros de Bissau**: Filtragem instantânea por zonas geográficas de Bissau (*Bandim, Bissau Velho, Praça dos Heróis, Santa Luzia, Chapa de Bissau, Cuntum, Aeroporto, Bôr, Pluba, etc.*).
- **Categorias Diversificadas**: Restauração & Bares, Hotelaria, Saúde & Educação, Serviços Corporativos & Bancos, ONGs & Artesãos.
- **Refresh do Feed**: Cada clique no ícone **Feed Bissau** repõe os filtros e roda a ordem do stream, trazendo outra publicação para o topo sem duplicar ou apagar dados persistidos.

### 2. Diretório de Empresas & Avaliações Qualitativas
- **Planos de Subscrição (Tiers)**:
  - *Básico (Gratuito)*: Perfil simples no diretório.
  - *Profissional*: 3 posts mensais, galeria alargada, métricas e botão WhatsApp direto.
  - *Premium*: Destaque no topo, histórias prioritárias, crachá de verificação dourado.
  - *Enterprise*: Personalização para grandes marcas, bancos e redes hoteleiras.
- **Sistema de Avaliações Qualitativas**: Substituição do modelo tradicional de estrelas por 4 níveis claros de satisfação (*Não gostei, Gostei, Gostei muito, Muito bom*) com validação por SMS para prevenir bots.

### 3. Bilhética de Eventos & Scanner de Porta (Gate Control)
- **Compra de bilhetes**: Disponível ao cidadão no fluxo público, com bilhetes normais, VIP e mesas e cálculo de taxas/comissões da plataforma (10% + 200 XOF).
- **Responsabilidade empresarial**: a empresa organizadora gere eventos, vendas, compradores, códigos e reembolsos operacionais; o Super Admin não acede a estes dados.
- **Scanner de Porta PWA**: disponível exclusivamente à conta empresarial associada ao evento, com câmara/QR, validação manual, PIN de staff, feedback sonoro e bloqueio de reutilização.
- **Dupla autenticação de entrada**: token QR de uso único e PIN de contingência são processados pelo scanner autenticado da empresa, não por ferramentas do Super Admin.
- **Conta pessoal do comprador**: cada compra pública fica associada ao `buyerId` da conta activa; a área pessoal separa bilhetes, compras e pedidos de terceiros.
- **Comprovativo descarregável**: o titular pode abrir o bilhete, copiar o código alfanumérico, descarregar o código em TXT e descarregar o QR escaneável em PNG.
- **Lembretes SMS de Eventos**: notificações programadas (24h antes, 1h antes ou no início do evento) com simulador de envio por SMS.

### 4. Sistema de Pagamentos & Reconciliação Mobile Money (XOF)
- **Operadoras Locais da Guiné-Bissau**:
  - **Orange Money Guiné-Bissau** (`+245 955 00 00`)
  - **Telecel Guiné-Bissau / Teletaco** (`+245 966 00 00`)
  - **Transferência / Depósito Balcão** com upload de comprovativo e número de transação.
- **Estados de Transação**: `confirmed_api` (confirmação instantânea por push/sandbox), `pending_manual_confirmation` (aguarda validação de operador), `confirmed_manual`, `reconciled` (reconciliado com extrato bancário) e `refunded`.
- **Exportação de Relatórios Financeiros**: Geração em CSV, Excel e PDF com totais brutos, taxas e comissões.

### 5. Moderação Inteligente com IA (Google Gemini 2.5 Flash)
- **Análise Semântica Multilíngue**: Moderação em Português, Francês e Inglês.
- **Semáforo de Moderação**:
  - 🟢 **Verde**: Conteúdo seguro aprovado automaticamente.
  - 🟡 **Amarelo**: Conteúdo ambíguo ou potencialmente sensível que aciona a **Regra de Precaução Automática da Secção 9.3** para revisão humana preventiva.
  - 🔴 **Vermelho**: Rejeição imediata por discurso impróprio, nudez, fraude ou ofensas.
- **Trilha de Auditoria e Recurso**: Registro de decisões da IA e possibilidade de aprovação manual por moderadores humanos ou contestação pelo autor.

### 6. Gestão de Administradores & Controlo de Acesso (RBAC)
- Perfis com permissões configuráveis:
  - **Super Administrador** (Acesso total à plataforma, definições e equipa).
  - **Moderador de Conteúdo / IA** (Aprovação de posts, anúncios e resolução de denúncias).
  - **Gestor Financeiro / Mobile Money** (Reconciliação de subscrições, extras, comissões e pagamentos da plataforma).
  - **Operador de Suporte** (Atendimento a comerciantes e verificação documental).
  - **Administrador de Eventos da Empresa** (Compras, compradores, QR, scanner, vendas e reembolsos do próprio negócio).
- Convidar novos administradores, suspender acessos e registo de logs de auditoria detalhados.

### 7. Logs de Auditoria & Conformidade
- Registo imutável de ações sensíveis na plataforma com Timestamp, Utilizador, Endereço IP, Categoria e Nível de Severidade (`info`, `warning`, `critical`).
- Exportação em CSV, Excel e PDF para auditorias externas.
- Conformidade com proteção de dados e RGPD para a diáspora guineense na Europa/Américas.

### 8. Notificações segmentadas por evento

O Guigui.com possui um motor central baseado no fluxo **Ação → Evento do sistema → Motor de notificações → Destinatários → Canais**. Cada aviso guarda destinatário, papel (`USER`, `BUSINESS` ou `ADMIN`), evento de origem, prioridade, categoria, entidade relacionada, canais, expiração opcional e estado lido/não lido. O centro filtra sempre por utilizador, empresa e papel, evitando que notificações privadas sejam expostas a outros perfis.

O cidadão recebe avisos da própria conta, compras, pagamentos, lembretes, suporte e empresas relacionadas; a empresa recebe avisos do próprio negócio, moderação, avaliações, eventos, clientes, estatísticas, facturação e operação de portaria; o administrador recebe apenas alertas operacionais da plataforma, segurança, moderação, subscrições e configuração. Os quatro níveis visuais são **Informação**, **Sucesso**, **Atenção** e **Crítico**. As notificações dentro da plataforma ficam sempre disponíveis, enquanto email, push e SMS respeitam preferências; segurança, pagamentos da plataforma, alterações críticas, cancelamentos e falhas graves permanecem obrigatórios.

Os fluxos actualmente ligados ao motor incluem login/bem-vindo, criação de empresa, submissão/aprovação/rejeição de publicações, novas avaliações e denúncias, submissão e cancelamento de eventos, operações empresariais de bilhetes, pagamentos e lembretes, backup e falhas de segurança. Cada notificação abre um detalhe profissional, marca o aviso como lido e encaminha para o bilhete/pedido, evento, publicação, conversa ou suporte relacionado; eventos e publicações recebem foco visual no destino. O Super Admin também pode emitir um anúncio com público explícito — administradores, cidadão específico, empresa específica ou anúncio geral — definindo prioridade, canais adicionais e expiração. A versão em pré-visualização é uma demonstração funcional de navegador único: o estado de notificações, conversas, suporte, empresas e pedidos é persistido no `localStorage`; uma instalação multiutilizador deverá substituir esse armazenamento por tabelas backend e por entrega real de email, push e SMS.

### 9. Administração Executiva, Mapa de Capacidades, Relatórios e Exportação

O painel do Super Admin abre no **Mapa completo de capacidades**, acessível também directamente pelo menu do perfil através de **Guigui Admin — todas as capacidades**. O mapa apresenta os 16 grupos e 61 subfunções da administração: Dashboard, Utilizadores, Empresas, Conteúdo, Moderação, Bilhetes, Financeiro, Subscrições, Publicidade, Notificações, Suporte, Relatórios, Inteligência, Segurança, Configurações e Backup. Cada item é clicável, abre o módulo integrado correspondente quando existe e identifica honestamente as áreas preparadas que ainda precisam de dados dedicados.

O Dashboard executivo continua disponível como separador próprio com KPIs, gráficos de crescimento, desempenho financeiro, visão de eventos e actividade recente. Os separadores de empresas, moderação, preços, categorias, perfis, equipa administrativa, auditoria, agenda, pagamentos, arquitectura, notificações e relatórios estão navegáveis. O `AdminReportsHub` permite escolher relatórios de utilizadores, empresas, eventos, finanças e plataforma, aplicar período/categoria e filtrar por empresa ou evento, exportando em **CSV**, **Excel** e **PDF**. Os KPIs, gráficos e linhas financeiras/empresariais/eventos são derivados do âmbito seleccionado; a operação de bilhetes e os dados de compradores ficam fora do Super Admin.

### 10. Limites de acesso, media e persistência de demonstração

A navegação é protegida por papel no App, Navbar e Footer. Cidadãos e visitantes não vêem scanner, painel empresarial ou Administração; empresas autenticadas vêem apenas o próprio negócio e o scanner dos seus eventos; o Super Admin vê governação, tiers Basic/Professional/Premium/Enterprise, permissões, auditoria, configuração e finanças de plataforma. Qualquer tentativa de abrir scanner fora da empresa é desviada para o feed.

Publicações e promoções empresariais aceitam imagem, vídeo ou galeria através de ficheiro local no PC/telemóvel/dispositivo ou URL; a acção é apresentada simplesmente como **Carregar**. No preview, os ficheiros locais são convertidos em **Data URLs** e persistidos no `localStorage`, com validação de tipo e limite de 25 MB; em produção devem ser enviados para object storage/backend, com URLs assinados, antivírus e políticas de retenção.

A Área da Minha Empresa é aberta directamente pelo perfil empresarial e permite actualizar dados comerciais, contactos, redes sociais, horários, serviços, comodidades, logo, capa e galeria. Colaboradores e operadores são guardados por empresa. A alteração de password usa `/api/auth/change-password`, com hashing scrypt para contas armazenadas e overrides hashados para contas demo; a versão demo continua sem sessão JWT e deve receber autenticação de sessão/CSRF antes de produção.

### 11. Exportações e Impressão de Relatórios

- Utilitário dedicado (`/src/utils/exportHelpers.ts`) para exportar dados em **CSV**, **Excel (.xls)** e **PDF** com layout institucional do Guigui.com / Grupo Gorila.

---

## 📂 Estrutura de Ficheiros do Projeto

```text
├── .env.example                     # Variáveis de ambiente requeridas
├── index.html                       # HTML raiz e montagem React
├── metadata.json                    # Metadados e permissões da aplicação
├── package.json                     # Dependências e scripts de execução
├── server.ts                        # Servidor Express, endpoints REST e IA Gemini
├── tsconfig.json                    # Configuração do TypeScript
├── vite.config.ts                   # Configuração do Vite e Tailwind CSS v4
│
└── src/
    ├── App.tsx                      # Componente central, roteamento de abas e estado global
    ├── main.tsx                     # Ponto de entrada React
    ├── types.ts                     # Definições de tipos TypeScript unificadas
    ├── index.css                    # Estilos globais e importação Tailwind CSS
    │
    ├── components/                  # Componentes de interface do utilizador
    │   ├── AdminDashboard.tsx       # Painel de Administração Geral
    │   ├── BusinessCard.tsx         # Cartão de empresa no diretório
    │   ├── BusinessComparisonModal.tsx # Comparador lado a lado de comércios
    │   ├── BusinessDashboard.tsx    # Painel de Gestão do Comerciante
    │   ├── BusinessDetailModal.tsx  # Modal de detalhes e contacto da empresa
    │   ├── CreatePostBox.tsx        # Caixa de publicação com validação IA
    │   ├── EventAlertsManager.tsx   # Gestor de alertas e lembretes de eventos
    │   ├── EventsView.tsx           # Vista pública de eventos e bilhética
    │   ├── FacebookLeftSidebar.tsx  # Navegação lateral esquerda estilo social
    │   ├── FacebookRightSidebar.tsx # Barra lateral direita (eventos, contactos rápidos)
    │   ├── FeedPostCard.tsx         # Cartão interativo de publicação no feed
    │   ├── Footer.tsx               # Rodapé institucional
    │   ├── HeroHeader.tsx           # Cabeçalho hero com filtros e busca rápida
    │   ├── InstitutionalPages.tsx   # Páginas sobre nós, termos, privacidade e RGPD
    │   ├── LoginModal.tsx           # Modal de autenticação e troca de perfil
    │   ├── Navbar.tsx               # Barra de navegação principal
    │   ├── NotificationBell.tsx     # Central de notificações com menu dropdown
    │   ├── PromotionsView.tsx       # Vista de promoções e cupões
    │   ├── QRCodeDisplay.tsx        # Renderizador de QR Code e código PIN
    │   ├── SmsSimulatorToast.tsx    # Notificação simulada de SMS no telemóvel
    │   ├── StoriesBar.tsx           # Barra horizontal de Stories
    │   ├── StoryModal.tsx           # Visualizador de Story em ecrã completo
    │   ├── TicketScannerView.tsx    # Scanner de bilhetes para portas de eventos
    │   │
    │   ├── admin/                   # Subcomponentes do Painel Admin
    │   │   ├── AdminAuditLogsHub.tsx      # Hub de Logs de Auditoria
│   │   ├── AdminOverview.tsx          # Resumo executivo de métricas
│   │   ├── AdminCapabilityHub.tsx     # Mapa completo de capacidades Super Admin
│   │   ├── AdminReportsHub.tsx        # Hub de relatórios e exportações
│   │   └── AdminStaffManagement.tsx   # Gestão de Administradores e papéis
    │   │
    │   └── client/                  # Subcomponentes do Painel do Comerciante
    │       ├── ClientBusinessProfile.tsx  # Edição de perfil da empresa
    │       ├── ClientEventsManagement.tsx # Gestão de eventos e bilhetes
    │       ├── ClientExportHub.tsx        # Exportação de relatórios da empresa
    │       ├── ClientNotificationsHub.tsx # Notificações para o comerciante
    │       └── ClientSettingsHub.tsx      # Configurações da conta empresarial
    │
    ├── data/                        # Dados iniciais e mock data representativa
    │   ├── adminStaffData.ts        # Equipa de administradores inicial
    │   ├── auditLogsData.ts         # Registos de auditoria iniciais
    │   ├── initialData.ts           # Empresas, categorias, posts e eventos
    │   └── notificationsData.ts     # Notificações de demonstração segmentadas
    │
    ├── services/                    # Serviços externos
    │   └── smsService.ts            # Serviço de simulação e envio de SMS
    │
    └── utils/                       # Utilitários e funções auxiliares
        ├── exportHelpers.ts         # Exportação CSV, Excel e PDF
        ├── i18n.ts                  # Dicionário de tradução da interface (PT, FR, EN)
        ├── moderation.ts            # Heurísticas e verificação de moderação
        ├── reviews.ts               # Cálculo de classificação qualitativa
        └── useDragScroll.ts         # Scroll arrastável com rato/toque para stories
```

---

## 🚀 Como Executar o Projeto Localmente

### 1. Requisitos
- **Node.js**: Versão 18+ (recomendado 20 LTS ou superior)
- **npm** ou **bun**

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
Crie ou verifique o arquivo `.env` na raiz (a lista completa está em `.env.example`):
```env
NODE_ENV=development
PORT=3000
APP_URL=http://127.0.0.1:3000
CORS_ALLOWED_ORIGINS=http://127.0.0.1:3000
GEMINI_API_KEY=sua_chave_gemini_aqui
DATABASE_URL=postgresql://user:password@localhost:5432/guigui
```
> *Nota: O sistema possui heurísticas de contingência integradas; mesmo que a chave do Gemini não esteja presente no momento do desenvolvimento, a moderação e todas as funcionalidades continuam operacionais em modo de fallback.*

Em desenvolvimento, `ENABLE_DEMO_ACCOUNTS=true` (o default fora de produção) mantém as contas de demonstração ativas. Em produção defina `SESSION_COOKIE_SECRET`, `MFA_SECRET`, `TICKET_SIGNING_SECRET`, `PAYMENT_WEBHOOK_SECRET` e `SCANNER_DOOR_CODE` com valores fortes e privados, e mantenha `ENABLE_DEMO_ACCOUNTS=false`.

### 3.1 Base de dados (opcional mas recomendada)

O backend usa PostgreSQL quando `DATABASE_URL` existe e cai explicitamente para os JSON de `data/` quando não existe. Para usar PostgreSQL:

1. Crie uma base vazia (ex.: `guigui`).
2. Aplique as migrações de `db/migrations/` (`001_initial_schema.sql`, `002_communication_schema.sql`, `002_marketing_scheduled_items.sql`).
3. Importe os dados existentes, se necessário: `npm run db:import-users`, `db:import-tickets`, `db:import-payments`, `db:import-audit`, `db:import-moderation`, `db:import-businesses-events`, `db:import-monetization`, `db:import-catalog`.
4. Confirme no endpoint de saúde: `GET /api/health` devolve `database.configured` e `database.connected`.

**Perfis empresariais têm um adaptador próprio.** Com PostgreSQL, os registos e a ordem dos destaques usam a tabela `companies`; sem PostgreSQL, o adaptador grava em `businesses.json` dentro de `GUIGUI_DATA_DIR` (por omissão, `data/`). Esta distinção não representa uma migração global dos restantes dados. O email da conta não é público: só o campo empresarial explicitamente definido como `publicEmail` pode aparecer na ficha pública. A ordem dos destaques da página inicial é guardada separadamente do campo legado `featured` e do escalão; só empresas activas escolhidas pela Administração são apresentadas, antes das campanhas activas.

> **De onde vem o `DATABASE_URL`.** `server.ts` carrega o `.env` com `dotenv/config`; como o `dotenv` não sobrepõe variáveis já definidas, um `DATABASE_URL` presente no ambiente do sistema (ex.: variável de utilizador do Windows) tem prioridade sobre o valor do `.env`. Para verificar a origem sem expor o segredo: PowerShell `[bool][Environment]::GetEnvironmentVariable('DATABASE_URL','User')` e `GET /api/health` → `database.configured` / `database.connected`.

### 4. Iniciar Servidor de Desenvolvimento
```bash
npm run dev
```
O aplicativo iniciará em `http://localhost:3000` (com o backend Express e o Vite montados no mesmo processo). Sem `DATABASE_URL`, o servidor cria e mantém a pasta `data/` para contas, bilhetes, pagamentos, moderação e auditoria persistentes; com `DATABASE_URL`, essas entidades vivem no PostgreSQL (ver 3.1). Confirmar o arranque com `GET http://localhost:3000/api/health`. Em produção, configure `GEMINI_API_KEY`, `SCANNER_DOOR_CODE`, `TICKET_SIGNING_SECRET` e `PAYMENT_WEBHOOK_SECRET`. O preview usa `PAYMENT_SANDBOX_AUTOCONFIRM=true`; para testar pagamentos pendentes e confirmação por callback, defina-o como `false`.

### 5. Compilação para Produção
```bash
npm run build   # vite build + bundle do servidor em dist/server.mjs
npm start       # arranca dist/server.mjs com NODE_ENV=production
```

### 6. Validação antes de publicar
```bash
npm run check          # tipagem TypeScript (tsc --noEmit)
npm run test:i18n      # coerência das 4 línguas (pt, en, fr, es)
npm run test:e2e       # Playwright: sobe o servidor e corre tests/home.spec.ts
npm run test:follow    # auditorias unitárias/integração de módulos
npm run test:payments
npm run test:subscriptions
npm run test:moderation
npm run test:catalog
npm run test:monetization
npm run test:spec-integrations
npm run test:tickets   # exige servidor a correr (integração HTTP)
npm run test:load      # smoke de carga (default http://127.0.0.1:3013, ou LOAD_BASE_URL)
```
As auditorias `test:tickets` e `test:load` falam com a API: necessitam de `npm run dev` ativo, ou de `TEST_BASE_URL` / `LOAD_BASE_URL` (default `http://127.0.0.1:3013`) a apontar para um servidor a responder. Os comandos de backup são `npm run backup:json` e `npm run backup:postgres` (este último escreve em `GUIGUI_BACKUP_DIR`, default `backups/`).

---

## ⚙️ Configuração financeira, relatórios e suporte

O **Super Admin** pode abrir “Matriz de Preços XOF” e editar o desconto anual antecipado, os preços da venda avulsa de posts e promoções, o banner premium semanal, a comissão percentual de bilheteira e a taxa fixa por emissão. A matriz de preços por grupo de categoria e escalão é editável por célula, fica persistida no navegador em `guigui_admin_category_groups`, e o modelo financeiro partilhado fica em `guigui_admin_business_model_config`. O valor de demonstração entregue é **15%**, pelo que um plano de 10 000 XOF/mês apresenta 102 000 XOF/ano.

O mesmo modelo financeiro é lido pela Área da Empresa e pela Agenda de Bilhetes quando esses ecrãs são abertos no mesmo navegador. O resumo de compra mantém o preço do bilhete separado das **taxas informativas da plataforma** (comissão + taxa fixa); a emissão de bilhetes e a validação QR continuam a ser operações da empresa organizadora, não do Super Admin.

A Área da Empresa e o Centro de Relatórios administrativo apresentam filtros de período e âmbito, indicadores, tabelas e exportação estruturada para **CSV**, **Excel compatível (.xls)** e **PDF / Imprimir**. O último abre uma folha profissional no diálogo de impressão do navegador, onde o utilizador pode imprimir ou escolher “Guardar como PDF”; não é apresentado como um PDF binário gerado no servidor.

A confirmação de um plano pago é imutável para o Super Admin: o plano e o escalão pertencem à empresa durante o período comprado. A Administração pode supervisionar e reconciliar o pagamento e pode suspender a empresa quando existir quebra de contrato, mas não pode alterar o escalão pago. A opção **Suspensão automática após expiração** é configurável no próprio Super Admin. Quando activa, o vencimento coloca a empresa em suspensão; quando desligada, a empresa fica em modo de consulta até intervenção manual.

Depois da confirmação do pagamento de uma subscrição, o backend e a Área da Empresa guardam o instante de activação, o intervalo mensal/anual, o identificador da transacção e a data exacta da próxima renovação. O sistema cria avisos de renovação quando faltam 15 dias, 10 dias, 5 dias e 24 horas. Após a data final, a empresa pode consultar a conta, histórico, métricas e facturação, mas as mutações comerciais ficam bloqueadas até renovar.

O checkout de bilhetes cria uma intenção de pagamento no backend. Orange Money e Telecel funcionam no preview através de adaptadores sandbox e devolvem uma confirmação de teste controlada; a transferência manual fica pendente. Em ambiente futuro, cada operadora poderá receber um adaptador próprio para iniciar o pagamento e um webhook assinado para confirmar o estado. O bilhete só é emitido depois da confirmação; o pedido usa chave de idempotência para evitar cobranças duplicadas.

A caixa de comunicação separa **Mensagens directas** e **Suporte administrativo**. Mensagens é o chat comercial privado entre cidadão e empresa e fica exclusivamente na caixa **Mensagens**, nunca no sino de notificações. Suporte é um ticket dirigido à Administração para problemas de conta, pagamentos, bilhetes, verificação ou funcionamento. A Administração não lê conversas comerciais por rotina. Ao iniciar uma mensagem a partir do Directório, o estabelecimento fica pré-seleccionado; cada conversa e cada mensagem guardam o nome do participante para identificação. A empresa só vê mensagens do seu `businessId` e tickets administrativos associados à própria conta.

Os cidadãos autenticados podem **seguir empresas** através do botão de seguir no Directório ou na ficha pública. Depois de seguir, aparece um botão separado de sino para activar ou silenciar as novidades dessa empresa. A relação é guardada por utilizador em `guigui_followed_businesses`, aparece na Área Pessoal como “Empresas seguidas” e pode ser cancelada a qualquer momento. Quando uma empresa publica um post aprovado, uma promoção activa ou um evento activo, cada seguidor com o sino activo recebe uma notificação privada com ligação para o conteúdo. A Área da Empresa apresenta o número de seguidores e um **alcance estimado** baseado nas visualizações e interacções públicas disponíveis no preview. O botão de telefone usa `tel:` e abre a aplicação de chamadas normal do dispositivo, fora do Guigui.com. Visitantes e contas empresariais/administrativas não conseguem criar relações de seguimento de cidadão.

---

## 🔑 Credenciais e Perfis de Demonstração

Para testar todos os níveis de acesso, utilize o modal de login ou os botões de troca rápida:

| Perfil | Nome / Identificador | Acessos |
| :--- | :--- | :--- |
| **Cidadão / Utilizador** | João Cidadão (`cidadao@guigui.com`) | Navegação, feed, reações, compra de bilhetes, bilhetes pessoais, mensagens e suporte |
| **Comerciante (Restaurante)** | Restaurante Coqueiros (`empresa@guigui.com`) | Área da Minha Empresa, criação de posts, gestão de bilhetes, mensagens e suporte |
| **Super Administrador** | Administrador Guigui System (`admin@guigui.com`) | Governação da plataforma, empresas, tiers, permissões, auditoria, configuração e finanças de plataforma; sem compras/QR/compradores |
| **Equipa de Porta do Evento** | Código demo do Scanner: `PORTA2026` | Acesso através da empresa organizadora para validar QR/PIN dos próprios eventos |

---

## 📄 Licença & Propriedade
Projeto desenvolvido para a plataforma **Guigui.com** — Todos os direitos reservados ao **Grupo Gorila**, Guiné-Bissau.


### 12. Mensagens comerciais e Suporte administrativo

O Guigui.com separa deliberadamente duas comunicações com objectivos diferentes. **Mensagens** é um chat privado entre cidadão e empresa para dúvidas sobre serviços, preços, horários, reservas e informações comerciais; apenas os participantes vêem o histórico. **Suporte** é um ticket privado dirigido à Administração do Guigui.com para problemas da conta, pagamentos, bilhetes, verificação, subscrições ou funcionamento da plataforma. Cidadãos e empresas podem abrir tickets; a Administração responde, acompanha o estado, resolve ou reabre o caso.

O painel administrativo possui um centro próprio de **Suporte — Tickets**, com filtros por estado, contadores, detalhe do pedido, histórico, resposta, resolução e reabertura. O Super Admin não lê conversas comerciais privadas por rotina. Notificações de nova mensagem ficam com os participantes da conversa; notificações de abertura e resposta de suporte ficam com o requerente e a Administração, com deep link para o ticket correspondente.


### Teste do fluxo de pagamentos

Para verificar os adaptadores sandbox/manual, a assinatura HMAC e a interpretação de estados de webhook, execute:

```bash
npm run test:payments
```

Para observar o percurso de uma compra de bilhete, use o cidadão `cidadao@guigui.com` / `123456`, abra **Agenda Cultural & Bilhetes**, seleccione um evento e escolha Orange Money ou Telecel. O preview apresenta um QR Code descarregável em PNG e um código alfanumérico único. Para testar o modo pendente, defina `PAYMENT_SANDBOX_AUTOCONFIRM=false`; nesse modo o endpoint `/api/payments/webhook/:provider` só deve ser chamado pela operadora ou por um serviço backend autorizado, com `X-Payment-Signature` HMAC válida.


### Pipeline de Segurança & Auditoria Humana

O painel Super Admin apresenta agora um quadro de workflow com três colunas: **Em revisão humana**, **Aprovados / Publicados** e **Rejeitados / Recursos**. A coluna usa exclusivamente o estado final da revisão (`pending_human`, `approved`, `rejected` ou `appealed`); a classificação da IA (`verde`, `amarelo` ou `vermelho`) permanece visível como informação de risco e não consegue manter um item numa coluna antiga depois da decisão humana.

Ao aprovar ou rejeitar, o item muda imediatamente para a coluna correspondente e recebe registo de auditoria com autor da decisão, hora, motivo e estado. O pipeline permite filtrar por estado final, classificação IA, tipo de conteúdo, empresa, pesquisa textual e intervalo de datas. A auditoria pode ser executada com `npm run test:moderation`.


### 13. Catálogo configurável de Planos, Features e Limites

A área **Administração → Matriz de Preços XOF** mantém a matriz histórica por grupo de categoria e agora inclui um catálogo adicional de planos configuráveis. O Super Admin pode criar, editar, duplicar, activar/desactivar e consultar assinantes dos planos, além de gerir preço, moeda, periodicidade, posts por mês, promoções por mês, categorias, prioridade, destaque na homepage, badges, relatórios, branding, condições especiais e funcionalidades.

As funcionalidades são mantidas como **Features/Entitlements** independentes do nome do plano. O editor visual permite activar/desactivar features existentes e adicionar novas features, que podem ser associadas a qualquer plano. Os limites suportam números, `unlimited` e `negotiated`; não é utilizado um número artificial como `999999` para representar ilimitado.

O motor em `src/data/subscriptionCatalog.ts` é a fonte comum para resolução de plano, features, utilização mensal, quota restante, preço anual antecipado, permissões de criação de post e permissões de criação de promoção. O painel empresarial já usa esse catálogo para mostrar o comparativo e o checkout de subscrição. Os valores administrativos são persistidos no preview pelas chaves `guigui_subscription_plans`, `guigui_subscription_features` e `guigui_subscription_plan_versions`.

Cada edição cria uma nova versão com autor, data, política de aplicação e campos alterados. A subscrição paga guarda uma fotografia do plano em `subscriptionPlanSnapshot`, pelo que a alteração do catálogo não reescreve automaticamente as condições já contratadas. A política pode ser **apenas novas adesões**, **próxima renovação** ou **imediata**; em produção esta decisão deve ser aplicada por transacção backend e contrato comercial.

Os quatro planos iniciais do catálogo são Básico, Profissional, Premium e Enterprise, com valores iniciais editáveis de 5.000, 10.000, 20.000 e preço negociado em XOF, respectivamente. Estes valores são dados de demonstração, não regras permanentes do código. A auditoria pode ser executada com:

```bash
npm run test:catalog
```

A persistência usada no preview é local ao navegador e não substitui um banco de dados multiutilizador. Antes de produção, o catálogo, versões, assinaturas, contadores e validações devem migrar para backend transaccional com RBAC, locks, auditoria append-only e validação de entitlements em todas as rotas de mutação.


### 12. Motor de Monetização & Receitas Configurável

A implementação mantém a Matriz de Preços legada e acrescenta um centro administrativo de **Monetização & Receitas**, cuja fonte central é `src/data/monetizationCatalog.ts`, com contratos em `src/types.ts` e interface em `src/components/admin/MonetizationAdmin.tsx`.

O catálogo suporta produtos comerciais, pacotes de posts e promoções, publicidade por período, campanhas com orçamento, serviços de produção de conteúdo, política configurável de comissão e taxa de bilhética, carteira de créditos e ledger. A Administração pode activar/desactivar produtos, editar preços, períodos, modelos de cobrança e condições sem alterar o código. O histórico do catálogo guarda versão, autor, data, motivo e áreas alteradas; campos de cupões e futuras fontes de receita ficam preparados sem substituir os fluxos existentes.

Na área empresarial, a Facturação preserva subscrições, renovação, matriz e compra de extras, acrescentando publicidade com preço directo e pedidos de orçamento para serviços ou campanhas. Pedidos marcados como orçamento não criam uma cobrança automática: são registados para negociação administrativa. O backend recalcula e valida preços antes de criar pagamentos, rejeita valores manipulados pelo navegador, credita posts/promos apenas uma vez após confirmação e regista a receita de bilhética no ledger com preço base, comissão, taxa fixa, pagador e total.

A validação reproduzível usa `npm run test:monetization`, `npm run test:catalog` e os restantes testes funcionais. O preview conserva persistência local/JSON para demonstração; produção requer autenticação de sessão, RBAC backend, base de dados transaccional, locks, outbox, rate limiting, storage seguro e integrações oficiais de pagamento.


### 14. Lacunas integradas a partir da especificação funcional

A homepage passou a consumir campanhas publicitárias activas do catálogo, em vez de depender apenas de conteúdo visual fixo. Cada campanha pode ter empresa, produto, placement, título, descrição, imagem, link, público, prioridade, início, fim, estado, impressões e cliques. A área Super Admin permite criar e editar campanhas na aba **Publicidade**; os espaços continuam sujeitos à disponibilidade e ao limite de simultaneidade configurado.

A pesquisa no portal apresenta agora uma leitura unificada de publicações, empresas, promoções e eventos, com contadores separados e acesso rápido às respectivas áreas. Promoções fora da validade deixam automaticamente de aparecer na listagem activa, embora os dados possam permanecer no histórico administrativo.

Os cliques de telefone, WhatsApp, direcções e website da ficha pública e do Directório são ligados às métricas persistidas da empresa. Os destinos externos continuam externos: `tel:` abre a chamada do dispositivo, WhatsApp abre a aplicação/website externo e direcções abrem o mapa.

A compra de bilhetes deixou de exigir conta obrigatória. Quando existe sessão, a compra fica associada ao utilizador; sem sessão, o bilhete é emitido com nome e telemóvel e pode ser recuperado na Agenda através de telemóvel + código/PIN. A rota `POST /api/tickets/lookup` aplica limite dedicado de cinco tentativas por dez minutos, devolve resposta genérica para falhas e nunca expõe a assinatura do bilhete.

O modo offline do scanner continua deliberadamente desactivado no preview. Uma validação offline real exige pacote assinado por evento/dispositivo, registo local de utilizações, fila de sincronização e resolução explícita de conflitos; aceitar um simples estado local criaria risco de duplicação e falsificação. A validação online mantém escopo de evento/empresa, assinatura, validade e bloqueio atómico de reutilização.
