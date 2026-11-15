`# Relatório de Evolução — Guigui.com

Este documento é o diagnóstico atual do sistema e o plano estruturado de melhoria. Não é um pedido de decisão; é o ponto de partida para as mudanças.

## 1. Leitura atual do sistema

O Guigui.com é uma plataforma de divulgação comercial e cultural inspirada num feed social e mercado local, com três arquétipos de perfil, um sistema de comunicação e uma capa de monetização. A base técnica é React 19 + TypeScript no frontend, Express no servidor local, persistência local via localStorage/JSON e uma camada de serviços e portas que já separa lógica de acesso. O projeto inclui testes unitários, especificações Playwright e migrações do catálogo de monetização.

O estado do frontend é denso mas organizado: o App mantém estado global de sessão, rota, comunicação, notificações, contraste e, para o admin, staff e auditoria. As ações principais (conversas, suporte, notificações, bilhetes, publicações, eventos e promoções) emitem eventos de sistema que alimentam notificações e polimórficos de UI. Esse desenho já é sólido para um produto em fase de consolidação.

## 2. Diagnóstico: o que já funciona bem

- Arquitetura de perfil clara: cidadão, empresa e administração têm interfaces e ações distintas.
- Sistema de comunicação coeso: conversas e suporte partilham hub, podem ter estado local, optimistic UI e emissão de evento.
- Notificações centralizadas: emitidas por ações do sistema, filtradas por contexto e preferências.
- Monetização já extraída para catálogo administrável, com painéis de produtos, anúncios, extras, serviços, bilheteira, livro-razão e pedidos.
- Explorabilidade da plataforma: feed, diretório, mapa, promoções, eventos, scanner, área pessoal, mensagens, suporte, administração e páginas institucionais.
- Internacionalização presente em várias línguas e com chaves organizadas.
- Componentização de UI com cards, painéis, botões, badges, cabeçalhos, estados vazios e esqueletos.

## 3. Diagnóstico: o que deve melhorar

### 3.1 Organização e estrutura
- O App concentra muita responsabilidade: roteamento, ações operacionais, efeitos de sincronização, política de notificação e decisões de navegação. Isso vai funcionar até o produto crescer, momento em que vira gargalo de leitura e de mudança.
- Muitos contextos de estado global são independentes, mas alguns fluxos cruzam estado local e estado sincronizado (conversas, suporte, notificações, compras, lembretes). Essa interseção é onde surgem comportamentos difíceis de prever.

### 3.2 Iconeação e linguagem visual
- Vários destinos e ações são identificados por texto puro ou por texto dominante sobre ícone secundário. Em painéis administrativos e na navegação cidadã isso gera leitura mais lenta e menos reconhecimento imediato.
- O catálogo de ícones usado (lucide-react) é adequado, mas está disperso: alguns painéis definem ícones locais, outros dependem de rotas ou labels. Faltam padrões de mapeamento ícone/destino a nível de sistema.

### 3.3 Responsividade e profissionalismo
- A apresentação é funcional, mas há chance de elevar o ritmo visual, a hierarquia e a consistência entre modos escuro/claro, especialmente em cards de destaque, painéis administrativos, listas cursores e estados de carga/vazio.
- Ainda há oportunidade para endurecer a qualidade em telas médias e pequenas, com escada de tipografia mais controlada, espaçamento por escalas e componentes mais previsíveis.

### 3.4 Latência e tempo de resposta
- Alguns fluxos carregam dados em paralelo de forma eficaz; outros dependem de múltiplas chamadas consecutivas ou de sincronizações que podem ser melhor aditadas.
- É possível ganhar sensação de velocidade com:
  - estados de carga mais granulares,
  - cache local mais inteligente para dados que mudam pouco,
  - reutilização de respostas já carregadas no mesmo ciclo,
  - separação entre o que atualiza a UI e o que sobe para o servidor,
  - redução de trabalho desnecessário em reconciliações de lista.

### 3.5 Manutenabilidade
- O catálogo de traduções e workspace é extenso; isso é positivo, mas favorece duplicação de frases e inconsistência de tom quando se adiciona funcionalidade rapidamente.
- A comunicação entre frontend e servidor usa convenções mistas em alguns endpoints; convenção única ajuda manutenção e testes.

## 4. Plano estruturado

A ideia geral é: primeiro estabilizar o que pode ser mais previsível, depois tornar a plataforma mais agradável e rápida. Não é necessário carregar tudo em simultâneo; é possível ir por frentes com visibilidade.

### Frente A — Clareza de arquétipo e gestão de estado
- Reduzir a pressão sobre o App separando responsabilidades transversais: política de notificações, roteamento, efeitos de sincronização e decisões de entrada.
- Unificar regras de preferência de notificação numa origem mais óbvia.
- Tornar mais legível o que cada ação emite e como a UI responde.

### Frente B — Iconeação e padrão de navegação
- Definir um catálogo central de ícones por destino, tab e módulo.
- Adotar ícone primário + label secundário em lugares estratégicos, especialmente administração e navegação cidadã.
- Padronizar ícones de status de mensagem/suporte/categoria para leitura mais rápida.

### Frente C — Responsividade e produto visual
- Elevar a hierarquia e o ritmo em pontos de entrada: feed, banner principal, painéis administrativos, listas e modal de detalhe de empresa.
- Ajustar espaçamentos e tipografia para manter contraste e densidade sem parecer genérico.
- Reforçar estados vazios, de carga e de erro com apresentação mais acostumada a produto, não a painel interno.

### Frente D — Velocidade e latência
- Priorizar paralelismo onde existem chamadas independentes.
- Evitar reprocessamento de DOM e estado quando a navegação repetir módulos parecidos.
- Adicionar UX de velocidade: preenchimento parcial, feedback imediato para ações que já podem ser otimizadas localmente, e melhor tratamento de listas com alta frequência de atualização.
- Comparar comportamento local com base real de rede em desenvolvimento para entender onde a percepção de lentidão vem de renderização frente de volta do servidor.

### Frente E — Consistência de interfaces e texto
- Reduzir frases espalhadas e padronizar rótulos entre módulos, com traduções consistentes.
- Unificar o estilo de labels de status e ações para que o produto fale com uma voz só.

## 5. Síntese

O sistema já tem a estrutura certa para evoluir para algo mais polido, mais rápido e mais fácil de manter. O investimento mais valioso agora é reduzir o peso sobre o App, criar padrões de ícone e estado mais claros, melhorar a qualidade visual da interface e deixar os fluxos mais sensíveis à velocidade. Esses quatro movimentos, em ordem, costumam entregar a maior parte do ganho perceptível para quem usa e para quem continua o código depois.
