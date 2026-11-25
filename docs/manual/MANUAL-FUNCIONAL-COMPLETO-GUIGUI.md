# Manual Funcional Completo — Guigui.com

**Produto:** Guigui.com — Plataforma Comercial, Cultural e de Bilhética da Guiné-Bissau  
**Proprietário:** Grupo Gorila  
**Versão documentada:** Preview funcional React/TypeScript/Vite + Express  
**Data:** 28 de Agosto de 2026  
**Autor:** Manus AI  
**Estado:** Documento funcional e técnico para operação, demonstração e preparação de produção

> **Resumo executivo.** O Guigui.com reúne directório de empresas, feed social comercial, promoções, agenda cultural, bilhetes digitais, validação por QR/PIN, pagamentos móveis, notificações, mensagens, suporte, moderação, relatórios e administração da plataforma. Este manual descreve o comportamento actualmente implementado no preview, distingue módulos funcionais de áreas preparadas e não apresenta a demonstração local como uma instalação multiutilizador de produção.

## 1. Finalidade e escopo

O Guigui.com foi concebido como um portal digital para descobrir negócios, serviços, eventos culturais e ofertas em Bissau e noutras regiões da Guiné-Bissau. A plataforma combina descoberta pública, comunicação entre cidadãos e empresas, gestão comercial, bilhética e supervisão administrativa.

O produto tem três experiências principais: a experiência pública e cidadã, o painel comercial da empresa e a administração interna do Guigui.com. A operação de bilhetes, compradores, scanner, vendas e reembolsos operacionais pertence à empresa organizadora do evento. O Super Admin governa a plataforma, os acessos, a configuração, a moderação, a auditoria e as finanças da plataforma, mas não substitui a empresa na operação da bilheteira.

| Domínio | Finalidade |
|---|---|
| Descoberta | Pesquisar negócios, categorias, bairros, publicações, promoções e eventos. |
| Relação social | Publicar, reagir, comentar, partilhar, seguir empresas e receber novidades. |
| Gestão comercial | Manter a ficha, publicar conteúdo, gerir promoções, eventos, contactos e métricas. |
| Bilhética | Comprar, guardar, descarregar e validar bilhetes por QR Code ou código/PIN. |
| Pagamentos | Registar subscrições, extras, pagamentos móveis, confirmações, reconciliações e reembolsos de plataforma. |
| Comunicação | Separar mensagens comerciais privadas de tickets de suporte dirigidos à Administração. |
| Administração | Supervisionar empresas, conteúdo, permissões, preços, auditoria, relatórios, segurança e backups. |

## 2. Arquitectura funcional

A interface é uma aplicação React 19 com TypeScript, compilada por Vite e estilizada com Tailwind CSS. O servidor Express fornece autenticação demo, validação de bilhetes, pagamentos, moderação, auditoria, backups, consentimento e health check. A estrutura tecnológica e as capacidades gerais encontram-se descritas no README do projecto [1].

| Camada | Tecnologia e responsabilidade |
|---|---|
| Interface | React 19, TypeScript e Vite; composição de páginas, modais, tabs, guards e estados. |
| Estilos | Tailwind CSS v4; layout responsivo, modo claro/escuro, grelhas e estados de foco. |
| Interacção | Motion para transições; Lucide React para ícones; Recharts para gráficos. |
| Servidor | Node.js, Express e TypeScript através de `tsx`. |
| IA | Google GenAI SDK para moderação de texto/imagem quando `GEMINI_API_KEY` está configurada; existe fallback heurístico. |
| Persistência demo | `localStorage` para sessão e dados da interface; JSON em `data/` para dados do servidor local. |
| Exportação | Utilitários para CSV, Excel nativo em `.xlsx` e folha profissional de impressão/guardar como PDF. |
| Linguagens da interface | Português, Francês e Inglês. |

O fluxo geral de eventos segue esta lógica:

```text
Acção do utilizador ou sistema
        ↓
Handler do módulo
        ↓
Estado/persistência e validação
        ↓
Evento do sistema
        ↓
Motor de notificações
        ↓
Destinatário por papel e identificador
        ↓
Sino, centro de notificações, email/push/SMS quando configurado
```

## 3. Como iniciar o sistema

### 3.1 Requisitos

É necessário Node.js 18 ou superior, preferencialmente Node.js 20 LTS ou superior, e npm. A instalação local usa as dependências declaradas no `package.json`.

### 3.2 Instalação e desenvolvimento

Na raiz do projecto:

```bash
npm install
npm run dev
```

O servidor de desenvolvimento fica disponível em `http://localhost:3000`. O processo combina o servidor Express e a aplicação Vite. A versão publicada deste projecto pode ser aberta no preview: [Guigui.com](https://3000-iku7lz1w9ir0xw5zfd6o1-b3e65758.us3.manus.computer/).

### 3.3 Variáveis de ambiente

O ficheiro `.env` pode conter:

```env
GEMINI_API_KEY=sua_chave_gemini
APP_URL=http://localhost:3000
SCANNER_DOOR_CODE=PORTA2026
TICKET_SIGNING_SECRET=segredo-forte-em-producao
PAYMENT_WEBHOOK_SECRET=segredo-webhook-forte-em-producao
PAYMENT_SANDBOX_AUTOCONFIRM=true
```

Sem chave Gemini, o sistema usa o modo de contingência disponível na aplicação. Em produção, nunca usar os valores demo, nunca expor segredos no cliente e substituir o código de porta e os segredos de bilhetes/webhooks por valores fortes, geridos e rotacionáveis. `PAYMENT_SANDBOX_AUTOCONFIRM=false` permite testar o percurso pendente até confirmação por webhook assinado.

### 3.4 Build e execução

```bash
npm run check
npm run build
npm run start
```

O comando `check` executa o TypeScript sem emitir ficheiros. O `build` cria os assets Vite e o bundle do servidor Express. O aviso do Vite sobre chunks superiores a 500 kB é uma recomendação de code-splitting, não uma falha de compilação.

### 3.5 Comando de testes de seguimento

A suite específica criada para a funcionalidade de empresas seguidas pode ser executada com:

```bash
npm run test:follow
```

O resultado validado foi de 21 asserções unitárias e de integração aprovadas.

## 4. Perfis e regras de acesso

### 4.1 Perfis principais

| Perfil | Identidade | Pode fazer | Não deve fazer |
|---|---|---|---|
| Visitante | Sem sessão | Consultar feed, directório, promoções e agenda pública. | Seguir empresas, comprar em conta pessoal, enviar mensagens ou abrir tickets. |
| Cidadão | `role=user` | Explorar, reagir, comentar, seguir empresas, comprar bilhetes, guardar compras, usar mensagens, suporte e preferências. | Aceder ao painel empresarial, scanner ou administração. |
| Empresa | `role=business` + `businessId` | Gerir a própria ficha, posts, promoções, eventos, bilhetes, pedidos, mensagens, suporte, relatórios e facturação. | Ver dados de outra empresa, gerir a Administração ou assumir o painel de outro negócio. |
| Super Admin | `role=admin` | Administrar empresas, moderação, preços, permissões, equipa, auditoria, relatórios, suporte, backups e finanças da plataforma. | Operar compras, compradores, QR, scanner, vendas ou reembolsos operacionais de bilhetes de empresas. |

### 4.2 Entrada inicial por perfil

A entrada normal numa conta encaminha automaticamente para a área principal adequada:

| Perfil autenticado | Vista inicial |
|---|---|
| Cidadão | Feed principal. |
| Empresa | Painel Comercial com o separador **Dashboard** activo. |
| Super Admin | Administração com o separador **Dashboard** activo. |

Uma notificação com deep link pode abrir uma subsecção específica. Por exemplo, uma mensagem abre a conversa, um ticket abre o suporte, uma notificação de bilhete abre a área correspondente e uma publicação abre o feed/evento com foco no conteúdo.

### 4.3 Guards e redireccionamentos

A navegação central valida o papel antes de abrir Administração, Scanner ou Painel Comercial. Uma tentativa de abrir o scanner por um perfil que não é empresa regressa ao feed. A Administração é reservada ao perfil `admin`; o cidadão e a empresa não recebem essa área no menu normal.

Os guards de interface protegem a experiência do preview, mas uma instalação de produção deve repetir todas as autorizações no backend. Um botão oculto no React não é uma barreira de segurança suficiente.

## 5. Login, registo e sessão

### 5.1 Contas rápidas de demonstração

Todas as contas rápidas usam a password demo `123456`.

| Perfil | Email | Utilização |
|---|---|---|
| João Cidadão | `cidadao@guigui.com` | Feed, compras, bilhetes, seguimento, mensagens e suporte. |
| Restaurante Coqueiros | `empresa@guigui.com` | Ficha, publicações, promoções, eventos, bilhetes, relatórios e mensagens. |
| Administrador | `admin@guigui.com` | Administração, moderação, preços, auditoria, relatórios e suporte. |

### 5.2 Login

O utilizador abre **Sessão**, escolhe **Entrar na Conta** e pode seleccionar uma conta rápida ou preencher email e password. O backend valida a credencial e devolve o perfil público. A aplicação guarda a sessão no estado persistente do preview e actualiza o papel activo.

### 5.3 Registo

O formulário permite criar uma conta de cidadão ou de empresa. O backend valida nome, email e password, rejeita email duplicado e guarda contas persistentes com hashing scrypt. Um novo negócio recebe uma ficha inicial e fica sujeito ao fluxo de verificação empresarial.

### 5.4 Alteração de password

A área de configurações pode chamar `/api/auth/change-password`. A password actual deve ser apresentada correctamente antes de gerar o novo hash. A operação validada devolveu `400` para dados incompletos e `200` para alteração, login com a nova password e reposição da credencial demo.

## 6. Cabeçalho, navegação e tema

O cabeçalho contém marca Guigui.com, pesquisa, Feed Bissau, Directório, Descontos, SMS/Agenda, alternância de tema, sino de notificações e menu de sessão. O conteúdo dos menus varia por papel.

O modo escuro é alternável no cabeçalho e deve manter contraste de texto, botões, cartões, estados activos, modais e tabelas. As acções principais usam grelha ou `flex-wrap`; não dependem de uma barra horizontal obrigatória para descobrir todas as opções.

O rodapé apresenta apenas acessos permitidos ao perfil activo. Cidadãos e visitantes não recebem links administrativos ou de scanner. A empresa recebe o acesso ao scanner associado ao próprio negócio. O Super Admin recebe o acesso à Administração.

## 7. Experiência pública e cidadã

### 7.1 Feed Bissau

O feed é a entrada pública e social da plataforma. Pode apresentar publicações de empresas, cidadãos e sistema, incluindo texto, imagens, vídeo, galerias, hashtags, reacções, comentários e partilhas.

O botão **Feed Bissau** repõe filtros e roda a ordem do stream para trazer outra publicação para o topo sem apagar dados persistidos. As publicações empresariais podem apresentar nome, bairro, plano, selo, conteúdo patrocinado, imagem, vídeo, contadores e acções.

### 7.2 Stories

A barra de Stories apresenta publicações recentes de empresas com anéis visuais. O utilizador pode abrir o visualizador em ecrã completo, ler a legenda, navegar e fechar o modal.

### 7.3 Pesquisa e filtros

A pesquisa aceita negócios, profissionais, restaurantes, serviços e eventos. Existem filtros rápidos por intenção, categoria e bairros de Bissau. Os filtros não alteram os dados, apenas o conjunto visível.

### 7.4 Categorias e bairros

As categorias iniciais incluem restauração e bebidas, hotelaria, turismo e lazer, saúde e bem-estar, educação, serviços profissionais, comércio, automóvel e transportes. Os bairros e zonas incluem, entre outros, Bissau Velho, Bandim, Praça dos Heróis, Santa Luzia, Chapa, Cuntum e zonas do centro.

### 7.5 Directório de empresas

O Directório pode ser apresentado em modo de lista ou grelha. Cada cartão mostra nome, imagem, bairro, classificação qualitativa, plano e acções disponíveis. O cartão permite abrir a ficha, comparar e, para cidadãos autenticados, seguir ou deixar de seguir.

### 7.6 Ficha e modal da empresa

A ficha pública apresenta identidade, capa, logo, galeria, descrição, categoria, subcategoria, bairro, morada, telefone, WhatsApp, email, website, horário, estado de abertura, faixa de preço, avaliação, posts, promoções e eventos.

O modal é fechável pelo botão `X` e apresenta acções separadas: **Mensagem**, que abre a conversa privada dentro do sistema; telefone, que usa `tel:` para iniciar uma chamada normal através da operadora do dispositivo; e seguimento. Depois de seguir, o sino pode ser activado ou silenciado sem remover o seguimento. O mesmo estado aparece no cartão do Directório, na grelha e na Área Pessoal.

### 7.7 Comparação

O comparador permite seleccionar até três empresas e visualizar lado a lado informações relevantes. A comparação não dá acesso a dados privados nem substitui a ficha oficial.

### 7.8 Avaliações

As avaliações usam quatro níveis qualitativos em vez de estrelas:

| Nível | Significado |
|---|---|
| Não gostei | Experiência negativa. |
| Gostei | Experiência satisfatória. |
| Gostei muito | Experiência claramente positiva. |
| Muito bom | Avaliação mais elevada. |

As avaliações podem exigir verificação por SMS, têm estado de moderação e permitem resposta do proprietário. Denúncias ou conteúdo sinalizado entram no fluxo de moderação.

## 8. Seguir empresas

### 8.1 Funcionamento

Só cidadãos autenticados podem seguir empresas. A relação canónica é guardada por utilizador:

```text
userId → [businessId, businessId, ...]
```

O sistema elimina IDs repetidos, permite alternar entre seguir e deixar de seguir e mantém compatibilidade defensiva com dados legados guardados como `businessId → userIds`.

### 8.2 Onde seguir

O cidadão pode usar o botão de seguimento no cartão do Directório, na grelha, na lista e na ficha/modal da empresa. Os rótulos e estados devem ser explícitos: **Seguir**, **A seguir** ou **Deixar de seguir**. Quando está a seguir, surge um controlo de sino independente para **activar** ou **silenciar** os avisos.

### 8.3 Área Pessoal

A Área Pessoal mostra **Empresas seguidas** e lista apenas empresas ligadas ao `userId` activo. Um estado vazio explica que seguir empresas activa avisos de novidades.

### 8.4 Conteúdos que geram avisos

Quando uma empresa seguida publica conteúdo no estado público correcto, cada seguidor recebe um aviso privado:

| Conteúdo | Estado exigido | Categoria de aviso |
|---|---|---|
| Post | Aprovado/publicado | `followed_business` |
| Promoção | Activa/publicada | `promotion` |
| Evento | Activo/publicado | `event` |

Rascunhos, conteúdos pendentes, rejeitados ou removidos não devem notificar seguidores.

## 9. Área Pessoal do cidadão

A Área Pessoal é aberta pelo menu do perfil. A navegação em grelha evita scroll horizontal e contém, conforme o contexto, Resumo, Meus bilhetes, Compras, Notificações, Mensagens e suporte, Empresas seguidas e Preferências de notificações.

### 9.1 Resumo

O resumo apresenta identidade do cidadão, actividade relevante, bilhetes, pedidos, empresas seguidas e atalhos principais.

### 9.2 Meus bilhetes

Mostra apenas bilhetes e pedidos cujo `buyerId` corresponde ao cidadão activo. Cada cartão pode mostrar evento, tipo, valor, data, código, QR e estado.

### 9.3 Compras

A área de compras separa pedidos pessoais de dados operacionais de empresas. Um cidadão não vê pedidos de compradores terceiros.

### 9.4 Notificações

O centro permite filtrar todos, não lidos e importantes; abrir o detalhe; marcar como lido; marcar tudo como lido e limpar os avisos visíveis. Abrir um aviso marca-o como lido antes da navegação e pode activar um deep link.

### 9.5 Preferências de notificações

O separador com ícone de ajustes abre o painel de preferências. As categorias incluem empresas seguidas, suporte administrativo, eventos, promoções, bilhetes, facturação, conta, segurança e sistema. As mensagens comerciais ficam directamente na caixa **Mensagens** e não são encaminhadas para o sino. Os canais de alertas incluem dentro da plataforma, Push, Email e SMS quando configurados.

O sino de cada empresa é independente do acto de seguir: o cidadão pode continuar a seguir uma empresa e silenciar temporariamente os seus avisos. Desligar avisos opcionais não remove alertas de segurança, pagamentos e alterações críticas.

## 10. Mensagens directas e suporte

O sistema separa deliberadamente dois fluxos.

| Fluxo | Participantes | Finalidade | Categoria de notificação |
|---|---|---|---|
| Mensagens | Cidadão e empresa | Dúvidas comerciais, preços, horários, reservas e serviços. | `messages` |
| Suporte | Cidadão/empresa e Administração | Conta, pagamentos, bilhetes, subscrições, verificação e funcionamento da plataforma. | `support` |

### 10.1 Iniciar mensagem comercial

O cidadão escolhe uma empresa, indica assunto e texto e selecciona **Iniciar conversa**. A conversa recebe `userId`, `businessId`, assunto, última mensagem, datas e flags de leitura. A empresa só vê conversas do seu `businessId`.

### 10.2 Responder a mensagem

A empresa ou o cidadão participante escreve no histórico. O sistema actualiza última mensagem, data, estado não lido e notifica apenas o outro participante. A categoria `messages` impede que a preferência de suporte controle indevidamente o chat.

### 10.3 Abrir ticket de suporte

O cidadão ou a empresa abre **Suporte**, preenche assunto e descrição e envia um ticket para a Administração. O pedido guarda requerente, papel, negócio opcional, estado, datas e histórico de respostas.

### 10.4 Atender ticket no Admin

O Super Admin abre **Suporte — Tickets**, filtra por estado, selecciona o pedido, lê o histórico, responde, resolve ou reabre. Uma resposta administrativa notifica apenas o requerente correcto. Conversas comerciais não aparecem neste centro por rotina.

## 11. Promoções, media e publicações

### 11.1 Publicações empresariais

A empresa abre **Publicações**, preenche título e texto e pode carregar imagem, vídeo, galeria ou URL. A acção é apresentada como **Carregar**. Ficheiros locais da demo são convertidos em Data URLs e guardados localmente com limite de 25 MB.

A publicação passa por moderação. O resultado Verde pode publicar automaticamente; Amarelo fica pendente de revisão humana; Vermelho é rejeitado. A empresa recebe o resultado e, quando aprovado, os seguidores recebem aviso.

### 11.2 Promoções

A empresa abre **Promoções**, cria título, descrição, badge de desconto, validade, código opcional, media e categoria. A promoção activa pode aparecer em Ofertas & Descontos e gerar aviso aos seguidores.

### 11.3 Ficheiros e produção

Na demonstração, Data URLs são adequadas para teste local, mas não para produção. Uma instalação real deve usar object storage, URLs assinados, limite por utilizador, antivírus, validação MIME, retenção e remoção segura.

## 12. Painel Comercial da empresa

Ao entrar como empresa, o sistema abre **Painel Comercial → Dashboard**. A empresa só deve operar o negócio associado ao seu `businessId`.

### 12.1 Dashboard

O Dashboard mostra plano, cota mensal de posts, posts restantes, métricas de visualizações, contactos WhatsApp, chamadas, visitas de mapa, lembretes e atalhos.

### 12.2 Área da Minha Empresa

Permite actualizar nome, logo, capa, galeria, descrição, categoria, subcategoria, bairro, morada, telefone, WhatsApp, email, website, horários, serviços, comodidades e redes sociais. As alterações são persistidas no preview.

### 12.3 Publicações

Inclui criação, media local/URL, moderação IA, estado, quota e histórico das publicações. O conteúdo Amarelo fica pendente de moderação humana; a empresa não deve tratar um conteúdo pendente como público.

### 12.4 Promoções

Permite criar, editar e activar promoções com preço, desconto, validade, código e media. Promoções activas entram no Directório/Ofertas e notificam seguidores quando o fluxo de publicação o determinar.

### 12.5 Eventos

A empresa gere título, descrição, data, hora, local, bairro, capa, tipos de bilhete, quantidades, preços e código da porta. Pode submeter evento para aprovação, actualizar ou cancelar conforme o estado.

### 12.6 Bilhetes e levantamentos

A empresa consulta as vendas e os pedidos do próprio negócio, vê detalhes operacionais, procura códigos e usa o scanner. O Super Admin não substitui a empresa neste fluxo.

### 12.7 Scanner

O scanner da empresa valida QR Code, código alfanumérico ou PIN de contingência. O sistema verifica evento, empresa, assinatura quando configurada, estado, validade e reutilização. Um bilhete válido torna-se usado; bilhetes usados, cancelados, expirados ou inválidos são rejeitados.

### 12.8 Estatísticas

Apresenta visualizações, leads, chamadas, visitas e indicadores de eventos/negócio. Estes números são dados de demonstração ou de estado local quando não existe fonte backend de produção.

### 12.9 Facturação

Apresenta subscrição, extras, preços aplicáveis, pagamentos e estado. Os parâmetros comerciais partilhados incluem desconto anual, post extra, promoção extra, banner semanal, comissão de bilheteira e taxa fixa.

### 12.10 Notificações

A empresa recebe avisos do próprio negócio, moderação, avaliações, pagamentos, eventos, mensagens, suporte e operações de pedidos. O centro filtra pelo `businessId` e tem estado lido/não lido.

### 12.11 Mensagens e suporte

A empresa responde a chats de cidadãos que contactaram o próprio negócio e acompanha tickets administrativos associados à própria conta empresarial. Não vê conversas de outras empresas.

### 12.12 Configurações

Inclui opções da conta, notificações, canais, segurança e preferências empresariais. A password é alterada através do endpoint protegido por validação de password actual.

### 12.13 Exportação

O Centro de Exportação da empresa contém três áreas: pedidos/vendas, métricas/leads e catálogo/menu. O selector de período inclui 30 dias, 90 dias, ano corrente e todo o período. Cada área permite CSV, Excel compatível e **PDF / Imprimir**.

## 13. Planos e modelo financeiro

Os escalões previstos são Basic, Professional, Premium e Enterprise. Os benefícios apresentados variam entre perfil simples, quota de posts, galeria, métricas, destaque, histórias prioritárias, selo e personalização para marcas maiores.

O Super Admin abre **Matriz de Preços XOF** para editar:

| Parâmetro | Função |
|---|---|
| Desconto anual antecipado | Reduz o preço anual face a 12 mensalidades. O valor entregue é 15%. |
| Post extra | Preço para publicações além da quota. |
| Promoção extra | Preço para promoções além da quota/regra do plano. |
| Banner semanal | Preço de uma campanha/banner premium semanal. |
| Comissão de bilheteira | Percentagem informativa da plataforma por bilhete. |
| Taxa fixa de bilheteira | Valor XOF por emissão. |
| Matriz por grupo e escalão | Preço mensal por grupo de categoria e plano. |

A matriz é editável por célula e persistida em `guigui_admin_category_groups`; os parâmetros gerais ficam em `guigui_admin_business_model_config`. Um plano de 10 000 XOF/mês com desconto anual de 15% aparece como 102 000 XOF/ano.

A Agenda de Bilhetes apresenta o preço do bilhete separado das taxas informativas da plataforma. A demo partilha esses parâmetros no mesmo navegador; uma cobrança real exige cálculo e autoridade no backend.

## 14. Agenda cultural e bilhética cidadã

### 14.1 Agenda

O cidadão abre **Agenda Cultural & Bilhetes**, pesquisa por evento/categoria e pode consultar data, hora, local, bairro, organização, descrição, capa, tipos de bilhete e preços.

### 14.2 Lembretes

O cidadão pode adicionar lembrete imediato, no início, 1 hora antes, 24 horas antes ou 3 dias antes, conforme a disponibilidade do evento. O sistema apresenta um alerta e possui simulador de SMS. O navegador pode pedir autorização para notificações locais.

### 14.3 Compra

O fluxo normal é:

1. Escolher um evento.
2. Seleccionar tipo de bilhete.
3. Escolher quantidade.
4. Confirmar comprador e telefone.
5. Escolher Orange Money, Telecel ou transferência manual.
6. Confirmar a compra.
7. No sandbox, Orange Money/Telecel podem confirmar automaticamente; transferência manual fica pendente.
8. Depois da confirmação, receber comprovativo, código, QR e PIN.
9. Guardar o bilhete em Área Pessoal.

A compra pública cria um pedido com `buyerId`, `eventId`, `ticketPin`, evento, empresa, valor, método, código e QR. O código é aleatório e não previsível, o PIN tem seis dígitos e o token QR é opaco. O QR contém o payload versionado `GUI-TICKET:v1:<qrToken>:<ticketCode>`, que o servidor normaliza antes da procura. O bilhete recebe `expiresAt` após o evento. A operação é idempotente no endpoint de compra por chave de idempotência; repetir a mesma chave devolve a mesma resposta sem gerar outro bilhete.

### 14.4 Bilhete pessoal

O cidadão pode copiar o código alfanumérico, descarregar o código em TXT e descarregar o QR em PNG. O bilhete apresenta titular, evento, tipo, valor, data, método de pagamento e estado.

### 14.5 Validação na porta

A empresa organizadora autentica o scanner com código de porta e procura o bilhete por QR, PIN ou código. O backend rejeita bilhetes inexistentes, assinaturas inválidas, bilhetes usados, cancelados ou expirados. Uma utilização válida fica registada com data e operador.

## 15. Pagamentos e reconciliação

### 15.1 Operadoras e métodos

O modelo contempla Orange Money, Telecel/Teletaco e transferência/depósito manual. Os dados demo apresentam números e referências de exemplo; não devem ser tratados como contas reais.

### 15.2 Estados de pagamento

| Estado | Significado |
|---|---|
| `pending_provider` | A intenção foi criada e aguarda resposta/callback da operadora. |
| `pending_manual_confirmation` | Aguarda confirmação manual ou prova de transferência. |
| `confirmed_api` | Confirmado por integração/API ou sandbox. |
| `confirmed_manual` | Confirmado por operador autorizado. |
| `reconciled` | Comparado e reconciliado com extrato/fonte de referência. |
| `refunded` | Reembolso processado. |
| `failed` | Falha na tentativa. |

### 15.3 Âmbitos

O Super Admin pode ver e reconciliar finanças da plataforma, subscrições, extras, comissões e pagamentos globais. Operações de `event_tickets` e `event_refund` são excluídas do fluxo operacional do Super Admin e pertencem à empresa organizadora.

### 15.4 Subscrição, renovação e expiração

A confirmação de um pagamento de plano é o marco oficial de activação. Nesse instante são guardados o intervalo comprado (`monthly` ou `annual`), a data de início, a transacção de origem e a data da próxima renovação. O intervalo anual acrescenta um ano à data de confirmação; o intervalo mensal acrescenta um mês, sem usar `Date.now()` como identificador de negócio.

A empresa recebe avisos de facturação nos marcos de **15 dias**, **10 dias**, **5 dias** e **24 horas** antes da renovação. Cada marco é deduplicado por empresa e período, para que re-renderizações ou retries não criem avisos repetidos. O aviso abre a área de facturação, onde a empresa pode seleccionar o período e renovar.

Depois da data de renovação, a empresa entra em **modo de consulta**: consegue ver a conta, histórico, métricas, notificações e facturação, mas não consegue criar ou editar a ficha, publicar posts, criar promoções, gerir eventos, comprar extras ou executar operações empresariais. A suspensão automática por expiração é uma opção editável pelo Super Admin. Se estiver activa, o estado empresarial passa também para `suspended`; se estiver desligada, o bloqueio de subscrição permanece sem retirar a ficha do contexto administrativo.

O escalão de uma subscrição paga e confirmada não pode ser alterado pelo Super Admin. A Administração pode supervisionar/reconciliar o pagamento e suspender a empresa por quebra contratual. Uma renovação não remove uma suspensão manual por contrato; apenas limpa a marca de suspensão automática por expiração.

### 15.5 Auditoria e cautelas

Cada operação sensível deve guardar actor, referência, timestamp, motivo, resultado e request ID, sem expor credenciais. O fluxo real deve exigir sessão backend, autorização RBAC, idempotência, reconciliação transaccional, proteção contra concorrência e webhooks assinados. O preview já expõe adaptadores com `createIntent`, `verifyWebhook` e `parseWebhook`; o endpoint `POST /api/payments/webhook/:provider` valida assinatura HMAC, referência, valor, estado e emissão única do bilhete. A camada é de preparação: não afirma que existe ligação comercial activa às operadoras sem credenciais, contrato e especificação oficial.

## 16. Motor de notificações

Cada notificação contém, conforme o caso, título, mensagem, papel alvo, destinatário, categoria, prioridade, canal, entidade, ID, data, expiração, estado lido/não lido e metadados. Os avisos de renovação pertencem à categoria `billing`; mensagens comerciais não são usadas para comunicar estes prazos.

### 16.1 Categorias

| Categoria | Uso |
|---|---|
| `system` | Novidades do produto e avisos gerais. |
| `account` | Conta e alterações de perfil. |
| `business_approval` | Registo, aprovação e verificação empresarial. |
| `moderation` | Submissão, aprovação, rejeição e alterações de conteúdo. |
| `order_redemption` | Pedidos, vouchers e bilhetes. |
| `billing` | Pagamentos e subscrições. |
| `event_reminder` | Lembretes de eventos. |
| `event` | Eventos, alterações e cancelamentos. |
| `review` | Avaliações e comentários. |
| `followed_business` | Novidades de empresas seguidas. |
| `promotion` | Promoções de empresas seguidas. |
| `messages` | Categoria legada de mensagens directas; o fluxo actual apresenta o chat apenas na caixa Mensagens, sem o encaminhar para o sino. |
| `support` | Tickets e respostas da Administração. |
| `stats` | Marcos e estatísticas. |
| `security` | Segurança e acessos suspeitos. |
| `admin_alert` | Alertas administrativos. |

### 16.2 Preferências e canais

O filtro por contexto compara papel, `userId`, `businessId`, destinatário e expiração. Depois aplica preferências da conta. A plataforma conserva avisos críticos de conta, pagamentos e segurança mesmo quando categorias opcionais são desligadas.

Na demo, `in_app` fica sempre disponível no sino. Push, email e SMS representam canais preparados/simulados quando não existe provider ligado.

### 16.3 Deep links

Abrir uma notificação marca-a como lida e encaminha para o contexto adequado:

| Entidade | Destino |
|---|---|
| Pedido/bilhete | Área pessoal ou bilhetes da empresa conforme o papel. |
| Evento | Agenda com foco no evento. |
| Post | Feed com foco na publicação. |
| Conversa | Mensagens e suporte com a conversa seleccionada. |
| Ticket | Suporte cidadão ou Suporte — Tickets no Admin. |
| Pagamento | Financeiro/conta conforme o papel autorizado. |

## 17. Administração do Guigui.com

Ao entrar como Super Admin, o sistema abre o **Dashboard administrativo**. A grelha administrativa apresenta o mapa completo e os módulos.

### 17.1 Dashboard

Mostra MRR recorrente estimado, empresas activas, crescimento, indicadores financeiros e actividade recente. Os números demo não são uma contabilidade de produção.

### 17.2 Mapa de capacidades

**Guigui Admin — Tudo** apresenta grupos de capacidades integradas ou preparadas: Dashboard, Utilizadores, Empresas, Conteúdo, Moderação, Bilhetes, Financeiro, Subscrições, Publicidade, Notificações, Suporte, Relatórios, Inteligência, Segurança, Configurações e Backup.

O mapa deve ser lido como catálogo de navegação. Quando uma área está preparada mas ainda não possui fonte dedicada, a interface deve identificá-la como preparada, não fingir que contém dados reais.

### 17.3 Empresas e cadastro

O Admin pode consultar empresas, estados pendentes/verificadas/suspensas, categorias, perfil, tier e acções administrativas permitidas. Pode aprovar, suspender, alterar nível ou actualizar registos de acordo com a permissão.

### 17.4 Moderação

A fila mostra conteúdo pendente, resultado da IA, confiança, motivo, estado e trilha de auditoria. O moderador humano pode aprovar, rejeitar, pedir alterações ou tratar recurso.

A política de precaução é:

| Resultado IA | Acção |
|---|---|
| Verde | Aprovação automática quando a confiança e as regras permitirem. |
| Amarelo | `pending_moderation` e revisão humana preventiva. |
| Vermelho | Rejeição e registo da razão. |

### 17.5 Matriz de preços

Inclui edição por célula dos planos e parâmetros financeiros adicionais descritos na secção 13. O Super Admin recebe feedback de gravação e vê recálculo anual no preview.

### 17.6 Categorias

Permite gerir grupos, nomes, descrições e categorias. A estrutura de categorias alimenta Directório, matriz de preços, filtros e relatórios.

### 17.7 Perfis e permissões

A matriz administrativa contempla gestão de empresas, utilizadores, conteúdo, eventos, subscrições, publicidade, finanças, administradores, logs, relatórios, preços, categorias, suporte, segurança, backups e validação de bilhetes. Cada colaborador administrativo pode ter departamento, nível, estado e permissões específicas.

### 17.8 Gestão de administradores

O Super Admin pode adicionar administradores, atribuir departamento/nível, rever permissões e revogar acessos. A revogação gera um log de auditoria com actor, alvo, motivo, IP demo, dispositivo e severidade.

### 17.9 Logs de auditoria

Os logs registam timestamp, actor, papel, acção, categoria, severidade, entidade, ID, IP/dispositivo e detalhes. A versão de demonstração persiste parte dos logs localmente/JSON; produção deve usar armazenamento append-only protegido.

### 17.10 Agenda e bilhética administrativa

O Admin pode supervisionar eventos e configuração, mas a bilhética operacional fica excluída: compradores, validação de QR, scanner, vendas e reembolsos operacionais pertencem à empresa organizadora.

### 17.11 Pagamentos e reconciliação

O Admin pode trabalhar com pagamentos de plataforma, subscrições, extras, comissão e reconciliação. O filtro exclui operações empresariais de bilhetes quando estas são responsabilidade da empresa.

### 17.12 Arquitectura e segurança

Apresenta o estado da infraestrutura, integrações, auditoria, headers, limites e recomendações de produção. A aplicação já define headers de segurança básicos e rate limit geral de API no servidor.

### 17.13 Relatórios

O `AdminReportsHub` organiza relatórios de utilizadores, empresas, eventos, finanças e plataforma. Tem filtros de data inicial/final, categoria, empresa/evento, KPIs, gráfico, tabela e exportação CSV, Excel e PDF / Imprimir.

O relatório administrativo deve declarar sempre período, âmbito, actualização e limitações. Dados de compradores e operação de bilhetes não devem aparecer no escopo do Super Admin.

### 17.14 Suporte — Tickets

O `AdminSupportHub` é separado de mensagens comerciais. Possui contadores por estado, filtros, detalhe, histórico, resposta, resolução, reabertura e deep links vindos do sino.

### 17.15 Notificações e anúncios

O Admin pode configurar preferências administrativas e emitir anúncio para administradores, cidadão específico, empresa específica ou público geral, com prioridade, canais adicionais e expiração.

### 17.16 Backups, restauração e consentimento

O sistema disponibiliza operações de backup manual, histórico, consentimento e validação de token. O backend persiste histórico de backups e auditoria. Restauração de produção deve exigir confirmação forte, privilégio elevado, cópia de segurança anterior e plano de rollback.

## 18. Relatórios e exportações

### 18.1 Formatos

| Formato | Comportamento actual |
|---|---|
| CSV | Ficheiro estruturado com BOM, escape de aspas e colunas. |
| Excel | Ficheiro XLSX nativo (OOXML), com cabeçalho estilizado e colunas dimensionadas. |
| PDF / Imprimir | Abre folha profissional no diálogo de impressão do navegador; o utilizador escolhe imprimir ou Guardar como PDF. |

O sistema não deve afirmar que gera PDF binário no servidor quando o comportamento é impressão do navegador.

### 18.2 Exportação empresarial

A empresa pode exportar pedidos/vendas, métricas/leads e catálogo/menu. O resumo mostra período, quantidade de pedidos, volume e empresa activa. O selector deve alterar os números e as linhas do relatório.

### 18.3 Exportação administrativa

O Admin pode exportar relatórios conforme tipo e filtros. Os filtros devem aplicar-se aos dados disponíveis e o relatório deve avisar quando um tipo é apenas preparado ou deriva de dados demo.

## 19. Modelo de dados principal

| Entidade | Campos funcionais principais |
|---|---|
| `UserProfile` | ID, nome, email, papel, telefone, bairro, avatar, negócio associado. |
| `Business` | ID, nome, slug, logo, capa, galeria, categoria, tier, contactos, horário, estado, avaliações, posts, promoções, métricas. |
| `BusinessPost` | Empresa, título, texto, media, data, estado de moderação, reacções, comentários e partilhas. |
| `Promotion` | Empresa, título, descrição, desconto, validade, código, media, categoria, estado e cliques. |
| `EventItem` | Título, organizador, empresa, categoria, data, hora, local, capa, estado, bilhetes, receita e código de porta. |
| `Ticket` | Código, evento, tipo, preço, comprador, QR, PIN, estado, compra e validação. |
| `PurchaseOrder` | Pedido, empresa, comprador, evento, PIN, cliente, tipo, quantidade, valor, método, data e resgate. |
| `PaymentTransaction` | Caso de uso, negócio, pagador, valor XOF, provider, estado, referências, confirmação, reconciliação e reembolso. |
| `Conversation` | Cidadão, empresa, assunto, última mensagem, datas e flags de leitura. |
| `ConversationMessage` | Conversa, remetente, papel, texto, data e flags de leitura. |
| `SupportRequest` | Requerente, papel, negócio opcional, assunto, descrição, estado, datas e respostas. |
| `AppNotification` | Destinatário, papel, categoria, prioridade, canal, entidade, deep link, data e estado lido. |
| `NotificationPreferences` | Categorias e canais por utilizador, empresa ou administrador. |
| `AuditLogEntry` | Actor, papel, acção, severidade, entidade, alvo, IP/dispositivo, timestamp e detalhes. |

## 20. API REST disponível

A lista abaixo representa as rotas implementadas no servidor Express do preview.

### 20.1 Saúde e autenticação

| Método | Rota | Função |
|---|---|---|
| GET | `/api/health` | Estado do servidor, timestamp e estado Gemini. |
| POST | `/api/auth/login` | Login por email/password. |
| POST | `/api/auth/register` | Registo de cidadão ou empresa. |
| POST | `/api/auth/change-password` | Alteração de password com verificação actual. |

### 20.2 Moderação

| Método | Rota | Função |
|---|---|---|
| POST | `/api/moderate` | Moderação de texto/imagem com IA ou fallback. |
| GET | `/api/moderation/logs` | Logs de moderação. |
| POST | `/api/moderation/review` | Revisão humana de item moderado. |
| GET | `/api/admin/moderation-logs` | Consulta administrativa de logs. |

### 20.3 Bilhetes e scanner

| Método | Rota | Função |
|---|---|---|
| POST | `/api/tickets/purchase` | Compra de bilhete com validação e idempotência. |
| POST | `/api/tickets/scanner-auth` | Autenticação do operador/código de porta. |
| POST | `/api/tickets/validate` | Validação de QR, PIN ou código. |

### 20.4 Pagamentos

| Método | Rota | Função |
|---|---|---|
| GET | `/api/payments/transactions` | Consulta de transacções. |
| GET | `/api/payments/operators` | Consulta de operadoras/configuração. |
| POST | `/api/payments/create` | Criar intenção/transacção e, em bilhetes, emitir apenas após confirmação. Aceita `Idempotency-Key`. |
| POST | `/api/payments/webhook/:provider` | Receber callback assinado da operadora e confirmar/falhar a transacção; pode emitir o bilhete pendente. |
| POST | `/api/payments/confirm` | Confirmar manualmente apenas operações de plataforma autorizadas. |
| POST | `/api/payments/reconcile` | Reconciliar transacção ou lote. |
| POST | `/api/payments/refund` | Solicitar/processar reembolso autorizado. |

### 20.5 Sistema

| Método | Rota | Função |
|---|---|---|
| GET | `/api/system/architecture` | Estado de arquitectura e integrações. |
| POST | `/api/system/backup/trigger` | Iniciar backup manual. |
| POST | `/api/system/gdpr/consent` | Guardar consentimento. |
| POST | `/api/system/security/verify-token` | Verificar token de segurança. |

## 21. Validações de entrada e segurança técnica

O servidor desactiva `x-powered-by`, aplica `nosniff`, `SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` para câmara/microfone e HSTS quando está em produção. Existe rate limit geral da API de 300 pedidos por janela de 60 segundos por endereço observado. O scanner não aceita mais uma cópia local como autorização: a validação online é obrigatória no preview, com evento e empresa em escopo.

O serviço de validação normaliza identidade e telefone, valida payloads de compra/pagamento, assina bilhetes com HMAC quando existe segredo e rejeita bilhetes inválidos, expirados, usados ou cancelados.

A moderação valida tipos e limite de imagem. O upload demo restringe tamanho; uma instalação real deve acrescentar antivírus, storage isolado, URLs assinados e regras de retenção.

### 21.1 Segurança que já existe no preview

- Guards de papel na navegação.
- Filtragem por `userId`, `buyerId`, `requesterId` e `businessId`.
- Assinatura HMAC de bilhetes no servidor de desenvolvimento e obrigatória em produção.
- QR Code real gerado pela biblioteca `qrcode`, com payload versionado e descarga PNG.
- Códigos alfanuméricos e PINs gerados com aleatoriedade criptográfica e verificação de colisão.
- Idempotência de compra e de criação de pagamentos.
- Adaptadores sandbox/manual e endpoint de webhook HMAC para futura integração.
- Validação online obrigatória no scanner, sem aceitar cópias locais como bilhetes válidos.

- Rejeição de bilhete expirado/usado/cancelado.
- Rate limit geral da API.
- Headers HTTP básicos.
- Hashing scrypt para passwords armazenadas.
- Auditoria de operações sensíveis no servidor/local demo.
- Idempotência no fluxo de compra de bilhetes.

### 21.2 Segurança obrigatória antes de produção

A demonstração ainda precisa de sessão autenticada no servidor, cookies seguros ou tokens rotativos, RBAC backend em todas as rotas, CSRF, rate limits por operação, validação de origem, base de dados multiutilizador, concorrência transaccional, webhook assinado, gestão de segredos, logs append-only, alertas e testes de penetração.

A autenticação demo e o `localStorage` não devem ser usados como mecanismo único de autorização em produção. Esta limitação está registada no relatório de segurança do projecto [2].

## 22. Persistência da demonstração

| Dados | Local actual |
|---|---|
| Sessão e papel | `localStorage`. |
| Empresas e conteúdo de interface | `localStorage`. |
| Compras, bilhetes e notificações | `localStorage` no fluxo visual demo; APIs locais para operações específicas. |
| Preferências | `localStorage` por chave de utilizador/contexto. |
| Follows | `guigui_followed_businesses`, indexado por `userId`. |
| Configuração financeira | `guigui_admin_business_model_config`. |
| Matriz de preços | `guigui_admin_category_groups`. |
| Dados de servidor | JSON em `data/`. |
| Tickets e auditoria de servidor | Store JSON/in-memory persistida conforme o módulo. |

O armazenamento local permite recarregar e continuar no mesmo navegador. Não oferece sincronização entre dispositivos, concorrência multiutilizador, controlo de acesso confiável ou contabilidade legal.

## 23. Validação funcional realizada

A validação acumulada incluiu:

| Fluxo | Resultado |
|---|---|
| Entrada como cidadão | Feed e Área Pessoal acessíveis. |
| Entrada como empresa | Painel Comercial abriu com Dashboard activo. |
| Entrada como Super Admin | Administração abriu com Dashboard activo. |
| Seguimento | Cartão, grelha, modal e Área Pessoal sincronizados. |
| Publicação seguida | Post aprovado gerou aviso para seguidores correctos. |
| Promoção/evento seguido | Handlers preparados para conteúdos activos e notificações privadas. |
| Preferências | Painel abriu na Área Pessoal com categorias e canais. |
| Mensagens | Cidadão e empresa trocaram mensagens com isolamento, nomes dos participantes e caixa própria separada do sino. |
| Suporte | Ticket cidadão → Administração → resposta → cidadão validado. |
| Bilhete | Compra demo criou QR, código, PIN e pedido associado ao comprador. |
| Subscrição | Período mensal/anual, próxima renovação, alertas 15/10/5/24h e bloqueio pós-expiração validados por auditoria automatizada. |
| Scanner | Validação de bilhetes próprios da empresa com bloqueio de reutilização. |
| Moderação | Verde publicado; Amarelo pendente; Vermelho rejeitado. |
| Preços | Desconto 15% → 20% testado, recálculo confirmado e restaurado para 15%. |
| Relatórios | Filtros, KPIs, tabela e acções de exportação visíveis. |
| Password | Erro 400 para entrada inválida e fluxo de alteração 200 validado. |
| Build/API | `check`, `build` e `/api/health` aprovados. |

As notas de validação detalhadas estão em [validation-notes-step-2.md](../relatorios/validation-notes-step-2.md) e o relatório de segurança em [GUI-SECURITY-VALIDATION.md](../relatorios/GUI-SECURITY-VALIDATION.md).

## 24. Procedimentos operacionais rápidos

### 24.1 Testar como cidadão

Abrir o preview, seleccionar Sessão, entrar como João Cidadão, abrir Directório, usar Mensagem para abrir a caixa interna com a empresa pré-seleccionada, confirmar o nome do interlocutor, usar o telefone para iniciar a chamada externa, seguir uma empresa e testar o sino separadamente. Depois entrar na Área Pessoal, verificar Empresas seguidas e Preferências, abrir Agenda & Eventos e testar lembrete ou compra demo.

### 24.2 Testar como empresa

Trocar para Restaurante Coqueiros. Confirmar que o Dashboard é a primeira vista. Abrir Área da Minha Empresa, verificar dados, abrir Publicações, criar conteúdo com URL ou ficheiro, observar moderação, abrir Mensagens e responder ao cidadão, consultar bilhetes e testar Exportação.

### 24.3 Testar como Super Admin

Trocar para Administrador. Confirmar Dashboard administrativo. Abrir Matriz de Preços, Relatórios, Logs, Suporte — Tickets, Moderação e Pagamentos & Reconciliação. Nunca utilizar o painel Admin para validar QR, comprador, vendas ou reembolsos operacionais de bilhetes.

### 24.4 Diagnóstico inicial

Se a aplicação não abrir, confirmar `npm run dev`, a porta 3000 e `GET /api/health`. Se o conteúdo antigo aparecer, fazer recarga completa e confirmar que o `localStorage` não contém dados de teste incompatíveis. Se uma acção não aparecer, confirmar o papel, o `businessId` e o separador adequado.

## 25. Limitações conhecidas

O preview é uma demonstração funcional de navegador único, com dados locais e credenciais demo. Push, email e SMS podem estar simulados. O PDF usa impressão do navegador. Algumas capacidades administrativas estão catalogadas mas dependem de backend ou de fontes de dados dedicadas. Os números de dashboard, relatórios e pagamentos demo não devem ser tratados como indicadores reais.

A autenticação demo ainda não representa uma sessão de produção com autorização backend completa. Antes de disponibilizar o sistema a utilizadores reais, executar a migração de persistência, hardening de API, revisão legal de pagamentos e RGPD, testes de carga, testes de penetração, observabilidade e recuperação de desastre.

## 26. Referências do projecto

[1]: [README funcional e técnico](../../README.md)  
[2]: [Relatório de validação funcional e segurança](../relatorios/GUI-SECURITY-VALIDATION.md)  
[3]: [Notas detalhadas de validação browser](../relatorios/validation-notes-step-2.md)  
[4]: [Tipos globais do domínio](../../src/types.ts)  
[5]: [Servidor Express e rotas REST](../../server.ts)  
[6]: [Relatório de testes de seguimento](../relatorios/FOLLOW-BUSINESS-TEST-REPORT.md)


## Pipeline de Segurança & Auditoria Humana — estados e filtros

O Pipeline de Segurança & Auditoria Humana funciona como um quadro de workflow com três colunas visíveis: **Em revisão humana**, **Aprovados / Publicados** e **Rejeitados / Recursos**. A coluna é calculada a partir do estado final do processo humano. A classificação automática da IA continua a ser mostrada como diagnóstico (`verde`, `amarelo` ou `vermelho`), mas não substitui a decisão final.

Quando o revisor aprova um item, o estado passa para `approved`, o conteúdo é tratado como autorizado e a tarjeta aparece imediatamente em **Aprovados / Publicados**. Quando rejeita, o estado passa para `rejected` e a tarjeta aparece imediatamente em **Rejeitados / Recursos**. Se o autor submeter contestação, o estado passa para `appealed` e continua na coluna de rejeitados/recursos até nova decisão. Cada mudança guarda no trilho de auditoria o actor, timestamp, acção e motivo.

O quadro pode ser filtrado por estado final, classificação de risco da IA, tipo de conteúdo — publicação, promoção, avaliação ou perfil empresarial —, empresa, pesquisa por empresa/autor/conteúdo e intervalo de datas. Os contadores das colunas são recalculados a partir do conjunto filtrado e os estados vazios explicam como ajustar os filtros. A lógica está centralizada em `src/utils/moderationWorkflow.ts` e é validada por `scripts/audit-moderation-pipeline.ts`, executável com `npm run test:moderation`.


## Catálogo configurável de Planos, Funcionalidades e Limites

A Administração conserva a matriz existente de preços por grupo de categoria e escalão e passa a ter, no mesmo separador **Matriz de Preços XOF**, um editor completo de planos. Esta extensão não elimina a matriz anterior, a configuração de receitas, as taxas de bilheteira, a suspensão automática ou os fluxos de pagamentos.

O editor permite criar e editar planos com nome, slug, descrição, preço, moeda, periodicidade, posts/mês, promoções/mês, máximo de categorias, prioridade, rotação na homepage, badge, ficha expandida, estatísticas, gestor de conta, relatórios mensais, banner, branding, contrato anual, condições especiais, visibilidade e status. Cada plano também possui limites genéricos para permitir futura extensão a imagens, eventos, campanhas, produtos, utilizadores, localizações e armazenamento.

As features são independentes dos planos. O administrador pode activar ou desactivar uma feature existente, associá-la através de caixas de selecção no editor visual e criar novas features com nome e descrição. Os limites numéricos são acompanhados por dois estados especiais: **Ilimitado** e **Negociado**. Assim, o motor não confunde um limite real com um valor numérico arbitrário.

O motor de entitlements em `src/data/subscriptionCatalog.ts` responde às perguntas de negócio comuns: qual é o plano efectivo, se uma feature está disponível, se a empresa pode criar uma publicação, se pode criar uma promoção, qual é a utilização do período corrente e qual é a quota restante. O App contabiliza posts e promoções por período mensal e o painel empresarial bloqueia a criação quando o limite do plano é atingido, mantendo a possibilidade já existente de comprar extras.

A compra de subscrição passa a consultar o catálogo partilhado, em vez de possuir uma tabela de preços fixa no componente. O pagamento anual aplica o desconto configurado na Administração. Depois de confirmado, o negócio guarda `planId`, nome, versão, período, data de renovação e `subscriptionPlanSnapshot`. A fotografia contratada protege assinaturas pagas contra alterações acidentais do catálogo. Edições futuras geram versões e guardam autor, hora, política de aplicação e campos modificados.

No preview, os dados são persistidos nas chaves `guigui_subscription_plans`, `guigui_subscription_features` e `guigui_subscription_plan_versions`. Esta persistência é adequada à demonstração funcional no navegador; para produção é necessária uma API com banco transaccional, autorização por papel, auditoria append-only, idempotência e validação backend de utilizador → empresa → assinatura → plano → feature → limite → acção.

A auditoria automatizada pode ser executada com `npm run test:catalog`. O teste valida os quatro planos iniciais, preço anual, limites ilimitados, features, quotas, reinício mensal e versionamento.


## 22. Extensões de bilhética integradas na auditoria

O checkout público aceita agora comprador com ou sem conta. Quando há uma sessão autenticada, o pedido guarda o `buyerId`; quando não há sessão, são exigidos apenas nome e telemóvel para emissão e recuperação. O comprador pode indicar um titular diferente, com `holderName` e `holderPhone`. O par é opcional, mas os dois campos devem ser preenchidos em conjunto. Quando existe titular separado, o envio previsto de QR/link e PIN é dirigido ao telemóvel do titular; caso contrário, ao comprador.

A consulta de convidado está disponível na Agenda Cultural através de telemóvel + código/PIN. O endpoint `POST /api/tickets/lookup` normaliza o telefone, procura apenas a combinação correspondente, aplica protecção contra enumeração e limita cinco tentativas por dez minutos. A resposta não inclui assinatura criptográfica nem dados desnecessários.

O reenvio controlado está disponível depois de uma consulta válida. O endpoint `POST /api/tickets/resend-sms` aplica cooldown de 60 segundos, limite diário de três pedidos por bilhete/telefone e regista auditoria. No preview, o pedido é simulado e não deve ser interpretado como ligação real a uma operadora SMS. Em produção, deve ser substituído por um provedor contratado, com estados de envio, entrega e falha e armazenamento mínimo de conteúdo.

A especificação também prevê reservas temporárias, operadores individuais, modo offline criptograficamente sincronizado, cancelamento e reembolso em massa e payout retido. Estes pontos não foram activados como falsos fluxos no preview: o projecto não possui ainda uma fonte transaccional de inventário/eventos, credenciais individuais de operador, serviço de SMS real ou ledger de payout multiutilizador. O scanner mantém validação online obrigatória para não introduzir um bypass local inseguro. A implementação de produção deve acrescentar essas capacidades no backend transaccional, com locks, eventos de domínio, filas, reconciliação e políticas administrativas configuráveis.
