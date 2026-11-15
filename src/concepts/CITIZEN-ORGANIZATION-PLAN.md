# Módulo Cidadão — Plano de Organização (Premium)

**Problema atual**
O módulo cidadão funciona bem na demo — carrega perfil, bilhetes, compras, notificações, conversas, suporte e definições. Mas a interface lê-se como um painel administrativo genérico com pequenos blocos empilhados. Não há ritmo visual claro, nem hierarquia de entrada por intenção, nem linguagem de produto. O cidadão entra e vê “itens”, não “coisas que faz sentido para mim hoje”.

**O que este plano propõe**
Transformar a conta num produto com:
1. **Hierarquia de intenção no topo** — o que o cidadão está aqui para fazer hoje.
2. **Níveis de envolvimento** — entrada rápida, detalhe operacional, controlo profundo.
3. **Bilhete como produto, não como linha de lista** — o bilhete tem carácter de emissão oficial.
4. **Navegação que reflete o perfil de usuário**, não uma fatia genérica “Conta”.

---

## 1. Leitura da situação atual

### 1.1 O que já existe e funciona
- `CitizenDashboard` é o centro da área pessoal.
- Sidebar esquerda com grupos `Geral / Atendimento / Gestão da conta`.
- Secções: `overview / tickets / purchases / notifications / messages / support / system-settings / personal-settings / privacy-settings / account-data`.
- Componentes reutilizáveis já prontos: `StatCard`, `Card`, `Panel`, `PanelHeader`, `EmptyState`, `Badge`, `Button`, `IconButton`.
- Bilhete em modal com `QRCodeDisplay` + exportações (txt, png, pdf).
- `TicketPurchaseModal` com passos, política de bilhética e resumo de pagamento.

### 1.2 O que falta de sensação premium
- O “olá, nome” fica numa card escura sem hierarquia de ação.
- Os KPIs gritam igual tudo (bilhetes, compras pendentes, lembretes, por ler).
- “Os meus bilhetes” e “compras” são visualmente próximos demais.
- Notificações e mensagens aparecem como mesmo nível que definições de privacidade.
- Não há pé de página de produto — nada diz ao cidadão “estás a ter experiência da cidade”.
- SaaS-ismo: palavras como “system-settings” e “account-data”oluem de admin, não de produto cidadão.

---

## 2. Organização em três níveis

### Nível 1 — Entrada (o que há hoje para o cidadão)
**Objetivo**: responder em 1 segundo a “o que é relevante para mim agora”.
**Exibição**: dois a quatro itens, por ordem de intenção, não por categoria interna.

Sugestão de itens de entrada:
- Próximo bilhete a apresentar / próximo evento com entrada.
- Compra pendente com ação (ex.: confirmar pagamento pendente, se houver fluxo).
- Novas notificações não lidas relevantes (não todas, só as que têm ação ou contexto).
- Empresas em seguida com novidades recentes (se existirem).

### Nível 2 — Produto (bilhetes, compras, mensagens, suporte)
**Objetivo**: a experiência operacional separada da definição de conta.
**Regra**: estas secções não competem visualmente com as definições.

- **Bilhetes** become o eixo principal da conta.
- **Compras** é o histórico, não o centro.
- **Mensagens e suporte** ficam juntos sob “atendimento”.
- **Notificações** podem aparecer no topo como feed curado, não como “centro de actividade” genérico.

### Nível 3 — Gestão (definições, privacidade, segurança, dados)
**Objetivo**: existir, mas não dominar. Para quando o cidadão procura.
**Regra**: esta zona deve não ganhar cores de produto. Deve ler-se como gestão.

---

## 3. Hierarquia de screens (proposta)

Não precisa de mais ecrãs. Precisa de melhor disposição dos ecrãs já existentes.

### 3.1 Ecrã de entrada da conta
Caminho: `Conta → Minha Conta`
- Saudação + contexto humano (bairro, tipo de conta).
- Micro-resumo de valor ou situação (não só “olá”.
- 1 a 2 ações reais (ex.: explorar, abrir bilhete).
- KPIs integrados ao contexto, não isolados como vitrine.

### 3.2 Ecrã do produto “Bilhetes”
Caminho: `Conta → Meus Bilhetes`
- Lista de bilhetes com estado claro.
- Bilhete aberto é modal de emissão, com código gritado, QR, holder, validade.
- Versão premium: se houver, exibir próximo a apresentar com destaque.
- Versão normal: lista operacional com estado, sem misturar com compras.

### 3.3 Ecrã do histórico “Compras”
Caminho: `Conta → Compras`
- Histórico de pedidos não-ticket.
- Mensagem clara quando vazio (“ainda não há compras”).
- Sem estatística que leve a confundir com bilhetes.

### 3.4 Ecrã de atendimento
Caminho: `Conta → Mensagens` ou `Conta → Suporte`
- Hub unificado com abide por contexto (empresa, pedido, suporte).
- Badge de unread no menu, e entry limpa dentro.

### 3.5 Ecrã de gestão
Caminho: `Conta → Definições / Privacidade / Dados`
- Agrupar por intenção: terá? / comunicação? / privacidade? / segurança?
- Evitar separar definições em demasiados ecrãs antes de precisar.

---

## 4. Navegação proposta

Mantém a barra inferior com as 6 primárias actuais (`feed, descobrir, eventos, mapa, mensagens, conta`). Isso não muda. O que muda é o **interior da conta**.

### 4.1 Dentro da conta
Sidebar pode virar **menu de intenção** em vez de lista rígida de grupos.

Grupos propostos:
- **Hoje** — entrada, próximos bilhetes, notificações relevantes.
- **Bilhetes** — o produto.
- **Compras** — histórico.
- **Mensagens e suporte** — atendimento.
- **Definições** — gestão.

Neste modelo, “Conta” deixa de ser um espaço plano e passa a ser um produto com primeiro plano.

---

## 5. Decisões visuais principais

1. **Hierarquia de cor**
   - Verde como cor de ação e confiança (ou emissão).
   - Cores de estado para bilhetes: válido / pendente / usado.
   - Cores editoriais para eventos e lembretes.
   - Zona de gestão com tom mais neutro.

2. **Hierarquia tipográfica**
   - Não gritar todos os números.
   - Um título de secção por intenção.
   - Usar estado de badge apenas quando comunica algo real.

3. **Presente de produto**
   - Topo da conta com contexto humano + convite a explorar.
   - Não cansativo.
   - Cada screen responde a “o que isto é para ti”.

---

## 6. Escolha rápida entre os dois conceitos

- **Conceito 1 — Residência verde**: ideal se o objetivo é retenção e perceção de cidadão ativo, com experiência humana no topo.
- **Conceito 2 — Bilhete como centro**: ideal se o diferencial é validação em porta, emissão de bilhete e prestígio visual.

Recomendação inicial: começar pelo **Conceito 2** como detalhe de produto (modal de bilhete, destaque de próximo, código gritado) e usar elementos do **Conceito 1** no topo da conta (contexto humano, convite a explorar). Isso evita construir do zero e respeita o módulo já existente.

---

## 7. Implementação em ordens da própria demo

1. Ajustar hierarquia do topo da `CitizenDashboard` (olá + contexto + convite).
2. Reorganizar secções para intenção: Hoje, Bilhetes, Compras, Atendimento, Definições.
3. Melhorar `MyTicketsPanel` e o modal de bilhete para leitura de produto (código, QR, holder, validade).
4. Separar visualmente notificações de mensagens/suporte de definições.
5. Revisar copy das secções para evitar SaaS-ismo.

---

Se quiser, esta análise pode virar um plano executável com ficheiros a tocar, em ordem curta e verificável.
