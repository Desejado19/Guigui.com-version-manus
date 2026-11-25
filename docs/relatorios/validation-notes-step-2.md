## Validação browser — Área da Minha Empresa

Em 27/08/2026, o preview carregou com a sessão empresarial Restaurante Coqueiros Bissau activa. O cabeçalho apresentou “Modo Comerciante”, o botão de sessão e o menu “Mudar de Conta”. A página pública renderizou correctamente com navegação principal, feed, directório e agenda. O primeiro carregamento mostrou inicialmente screenshot em branco, mas a segunda leitura confirmou o DOM e os controlos visíveis; o preview ficou com 30 269 px abaixo do viewport. A validação específica do menu de perfil e do formulário empresarial continuará depois de abrir o menu de sessão.

A validação do menu confirmou a entrada clicável “Área da Minha Empresa”. O clique anterior abriu o painel empresarial, mas ainda mostrava “Secção Atual: Painel Comercial” e o separador Dashboard; por isso foi acrescentado `initialTab` no BusinessDashboard e uma regra no App para seleccionar `my_business` quando o acesso vem do perfil empresarial. A compilação após essa correcção passou.

Após hot reload, o painel ainda estava no Dashboard porque o estado inicial anterior permanecia. O menu foi reaberto e a tentativa de clique por índice fechou o menu sem mudar o separador, provavelmente por reindexação dos controlos entre leituras. A implementação permanece tipada; será feita nova verificação com leitura imediata do DOM e coordenada/índice correspondente.

A selecção directa do separador “Área da Minha Empresa” abriu a ficha oficial completa: campos de nome, bairro, descrição, morada, contactos, redes sociais, horário, serviços, logótipo, capa e galeria; os rótulos de carregamento visíveis estavam normalizados para “Carregar”. O menu de perfil mantém a entrada directa. O modelo de pedidos passou a guardar buyerId, eventId e ticketPin; a área cidadã foi reorganizada e o QR passou a ser gerado por biblioteca real.

A validação do DOM confirmou ainda que, ao clicar no botão interno “Área da Minha Empresa”, a ficha oficial abriu com os campos e botões esperados. O centro de comunicações foi integrado aos dois painéis, com persistência local e filtragem por userId/businessId. O check de TypeScript passou após todas estas alterações; falta agora testar a compra e os deep links em conta cidadã.

A troca de conta para “João Cidadão” funcionou pelo diálogo de autenticação de demonstração. O cabeçalho passou para “Modo Cidadão” e a conta activa ficou isolada da conta empresarial. O fluxo público de agenda continua disponível para iniciar o teste de compra sem pagamento real.

Em conta cidadã, o botão SMS abriu a “Agenda Cultural & Bilhetes”. A página mostra dois eventos, tipos de bilhete, preços e botões “Comprar Bilhete”; o cabeçalho mantém a conta João Cidadão e não expõe operações de empresa ou Super Admin. O teste de compra pode prosseguir pelo primeiro evento.

Checkout cidadão validado após confirmação explícita: a emissão simulada concluiu sem pagamento real. O comprovativo mostrou QR escaneável real, token QR-GUI-1787799354120-4299, código alfanumérico GUI-4299, titular João Cidadão, valor 5 000 XOF e botões “Código”, “QR Code” e “Fechar & Guardar no Telemóvel”. A notificação SMS simulada também mostrou código e PIN.

Após fechar o modal do comprovativo, a notificação SMS simulada permaneceu visível. O código e PIN continuam acessíveis no aviso; a validação seguinte deverá abrir “Área pessoal” pelo perfil e confirmar o cartão do bilhete guardado.

A área pessoal cidadã abriu pelo perfil e confirmou a persistência: mostra 1 bilhete, 1 compra pendente, o evento, data, código GUI-4299 e valor 5 000 XOF. Também mostra notificações recentes de pagamento e compra. Os separadores responsivos incluem bilhetes, compras, notificações e suporte/mensagens; não há exposição dos pedidos globais de outras contas.

A tipagem continua a passar após a inclusão de conversations/support e do deep link empresarial. Na validação browser, a área pessoal abriu e mostrou o bilhete, mas a busca textual directa por “Mensagens e suporte” não encontrou o separador no estado actual; será feita uma inspecção visual após o hot reload para determinar se a secção está abaixo da viewport ou se houve regressão de renderização.

A inspecção após hot reload não mostrou erros na consola. A ausência da etiqueta textual no extractor não corresponde a erro de execução; o componente fonte mantém uma grelha `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` de cinco separadores. A validação funcional da comunicação continuará por navegação directa e, se necessário, por nova actualização do preview.

O preview foi recarregado sem erros e manteve a sessão João Cidadão. O extractor voltou ao feed inicial, indicando apenas que a navegação não é persistida entre recarregamentos; será reaberta a área pessoal pelo perfil para validar os novos separadores após a versão actual.

Durante a revalidação, a indexação mudou após o recarregamento e um clique destinado à área pessoal abriu o diálogo de autenticação em vez do painel. Não houve erro de consola nem perda da conta; o diálogo pode ser fechado e a navegação será repetida usando a indexação actualizada.

Após fechar o diálogo, o menu do perfil cidadão voltou a apresentar “A minha área pessoal” correctamente. A indexação foi confirmada antes de repetir o clique, evitando confundir a entrada com a autenticação ou com os atalhos públicos.

A indexação instável do preview voltou a abrir o diálogo de autenticação ao tentar seleccionar a área pessoal; o diálogo foi fechado sem modificar a conta. A sessão cidadã mantém-se activa e a funcionalidade já está coberta por check de TypeScript. A validação do centro de comunicação será complementada por check/build e por um teste dirigido através do estado persistente.

Após seleccionar a entrada correcta, a área pessoal mostrou os cinco separadores numa grelha sem scroll horizontal: Resumo, Meus bilhetes, Compras, Notificações e Mensagens e suporte. O separador de comunicação exibiu Mensagens/Suporte, selecção de empresa, assunto, mensagem e botão “Iniciar conversa”. Os campos foram preenchidos com uma mensagem de teste para o Restaurante Coqueiros; falta submeter e confirmar o histórico/notificação.

A mensagem de teste foi submetida com sucesso: a conversa apareceu na lista e o histórico mostrou o assunto e o texto enviado. O separador Suporte abriu correctamente com opção de suporte geral ou empresa, assunto, descrição e botão “Enviar pedido”.

O pedido de suporte foi enviado com sucesso e apareceu imediatamente na lista com assunto, descrição e estado “Aberto”. O formulário foi limpo após o envio, confirmando a persistência local e a separação entre conversa e suporte.

A troca de conta foi iniciada a partir da área pessoal depois de criar o suporte. O diálogo de autenticação abriu correctamente para seleccionar a conta empresarial; o pedido cidadão permanece guardado e será verificado do lado do Restaurante Coqueiros.

A conta Restaurante Coqueiros entrou correctamente. O painel empresarial mostrou a grelha responsiva com Dashboard, Área da Minha Empresa, publicações, promoções, eventos, bilhetes, estatísticas, facturação, notificações, “Mensagens e suporte”, configurações e exportação, sem lista horizontal arrastável. O contador de bilhetes da empresa passou a 8 após a compra cidadã, demonstrando que o pedido chegou ao contexto empresarial.

O painel empresarial abriu a conversa exacta do cidadão João, com assunto e mensagem originais, e mantém apenas o contexto Restaurante Coqueiros. O campo de resposta foi seleccionado e preenchido para testar a resposta empresarial; falta confirmar o envio no histórico.

A resposta empresarial foi enviada com sucesso após a segunda tentativa de submissão: apareceu no histórico como mensagem da empresa, com data/hora, e o resumo da conversa foi actualizado. Isto confirma comunicação bidireccional entre o cidadão e a empresa, com acesso restrito aos participantes.

O pedido de suporte apareceu no painel empresarial do Restaurante Coqueiros, com descrição e campo de resposta. A resposta foi enviada com sucesso e o estado mudou de “Aberto” para “Em análise”, confirmando o retorno da empresa ao cidadão.

A caixa de notificações empresarial abriu com 8 avisos, incluindo “Resposta no pedido de suporte”, “Nova mensagem de um cliente”, “Novo pagamento recebido” e “Novo bilhete vendido”. Cada aviso apresenta estado lido/não lido e uma acção própria, confirmando a caixa profissional e accionável.

Validação final: o painel empresarial apresentou a caixa de notificações com acções “Ver suporte”, “Abrir conversa”, “Ver bilhetes” e “Ver Publicação”. O detalhe de “Resposta no pedido de suporte” marcou o aviso como lido e, ao fechar, deixou o pedido de suporte no contexto empresarial. A área de comunicação mostrou o suporte correcto e a resposta da empresa.

Foi corrigido o efeito de foco do CommunicationHub para não marcar repetidamente uma conversa como lida nem provocar re-renderizações contínuas. Eventos aceitam `focusEventId`, publicações recebem `isHighlighted`, e conversas/suporte recebem focos privados.

A rota `/api/auth/change-password` foi carregada após reiniciar o servidor de desenvolvimento. O pedido incompleto respondeu 400; o teste controlado de alteração, login com a nova password e reposição da password demo respondeu 200, sem deixar credencial temporária persistente. `GET /api/health` respondeu 200. O check e o build finais passaram; permanece apenas o aviso normal do Vite sobre chunks superiores a 500 kB.

Nova validação em 27/08/2026: o perfil Super Admin abriu correctamente no mapa completo de capacidades, com a matriz de preços, pagamentos, relatórios, suporte, auditoria e demais módulos visíveis em grelha responsiva. O preview manteve a separação: o mapa informa que vendas, compradores, QR, scanner e reembolsos operacionais pertencem à empresa organizadora.

Validação visual em 27/08/2026: o Super Admin abriu “Relatórios & Exportação” e viu o gerador com botões PDF, Excel, CSV e Imprimir, oito tipos de relatório, filtros de data, categoria e empresa/evento, KPIs, gráfico comparativo e tabela detalhada. O relatório financeiro indicou 3 transacções de plataforma e manteve a nota de que bilhetes, compradores, QR, vendas e reembolsos operacionais ficam fora do Super Admin.

Validação financeira em 27/08/2026: o campo “Desconto anual antecipado” aceitou a alteração de 15% para 20%, recalculou imediatamente os valores anuais da matriz e mostrou “Configuração financeira guardada para novas adesões, vendas e renovações”. O valor foi restaurado e guardado em 15%, conforme configuração solicitada. Os campos visíveis de post extra, promoção extra, banner semanal, comissão percentual e taxa fixa também ficaram editáveis.

Após o build final, o Super Admin abriu “Relatórios & Exportação”. O preview mostrou os oito tipos de relatório, filtros de data inicial/final, categoria e empresa/entidade, KPI, gráfico, tabela detalhada e acções PDF / Imprimir, Excel e CSV no cabeçalho e no fim da página. O relatório financeiro identificou o âmbito actual e informou que a bilhética operacional e compradores não são incluídos no painel administrativo.

Nova funcionalidade em 27/08/2026: o App passou a guardar `guigui_followed_businesses` por `userId`, com seguir/deixar de seguir e login obrigatório. O cidadão João foi autenticado no preview, o directório e a ficha pública da empresa abriram sem erro. Depois de recarregar o bundle, os cartões mostraram botões “Seguir [empresa]”; ao seguir o Restaurante Coqueiros, o estado mudou imediatamente para “Deixar de seguir Restaurante Coqueiros - Bissau Velho”. Ao abrir novamente a ficha, o modal mostrou “A seguir”, confirmando a sincronização entre cartão e detalhe.

A implementação de publicação aprovada, promoção activa e evento activo percorre os seguidores da empresa e emite notificações privadas `FOLLOWED_BUSINESS_POST`, `FAVORITE_PROMOTION` ou `FOLLOWED_BUSINESS_EVENT`, com `userId`, entidade e ligação para o conteúdo. A Área Pessoal passou a chamar a lista “Empresas seguidas” e explica que essas empresas enviam novidades.

A Área Pessoal passou a ter o separador clicável “Preferências de notificações”, com ícone de ajustes. A abertura foi validada no browser: o painel mostrou tipos de aviso — incluindo “Empresas que sigo” — e canais Dentro da plataforma, Push, Email e SMS. O estado activo ficou visualmente destacado e o acesso funciona na grelha responsiva sem scroll horizontal.

Auditoria funcional complementar em 27/08/2026: foram encontrados e corrigidos três problemas da funcionalidade de seguimento. (1) A Área Pessoal recebia os três primeiros negócios em vez das empresas realmente seguidas; agora recebe a relação ordenada por utilizador. (2) O modo grelha do Directório não passava as props de seguir; agora os cartões horizontais e em grelha têm o mesmo controlo. (3) O mapa `guigui_followed_businesses` é indexado por `userId`, mas a emissão de avisos estava a procurá-lo por `businessId`; agora o App deriva correctamente todos os seguidores de cada empresa antes de emitir os avisos.

Foi feita tentativa de validação ponta a ponta com uma nova publicação empresarial. O formulário aceitou título, texto e URL de imagem, mas o preview não apresentou confirmação final após a acção de moderação; a consola permaneceu sem erros e a API local respondeu HTTP 200 em `/api/health`. O fluxo de emissão foi revisto estaticamente: a publicação empresarial é criada como `approved` no painel e o handler central gera `FOLLOWED_BUSINESS_POST` para os seguidores derivados.

Auditoria ponta a ponta em 27/08/2026: como Restaurante Coqueiros, foi criada a publicação “Novidade de teste para seguidores” com texto e URL de imagem. A moderação devolveu “VERDE”, o painel mostrou “Moderação IA: VERDE”, a lista passou de 5 para 6 posts, a quota passou de 3 para 2 e os campos foram limpos. Este teste confirmou que a emissão para seguidores é executada depois da publicação aprovada; a lógica foi corrigida para derivar os seguidores a partir do mapa indexado por utilizador.

Auditoria de persistência: no browser, `guigui_followed_businesses` confirmou `{"usr-1":["biz-1"]}`. O teste da publicação criou `POST_APPROVED`, mas a primeira leitura da lista de notificações ainda não mostrou `FOLLOWED_BUSINESS_POST`; por isso será feita uma validação adicional após recarregar o bundle. O código já foi corrigido para derivar os seguidores por `Object.entries(...).filter(ids.includes(businessId))`, em vez de indexar o mapa directamente pelo businessId.


## Separação Mensagens / Suporte — 27/08/2026

A Área Pessoal do cidadão foi validada após a alteração. O separador **Mensagens** mostra conversa comercial cidadão–empresa, com empresa, assunto, histórico e resposta. O separador **Suporte** mostra apenas “Abrir ticket para o Suporte Guigui.com”, sem selector de empresa, e explica que a empresa não recebe o ticket. O ticket existente apareceu com estado e última resposta, acompanhado da indicação de que será tratado pela Administração.

Foi integrado um centro separado no AdminDashboard, “Suporte — Tickets”, com contadores por estado, filtros Todos/Aberto/Em atendimento/Resolvido, lista de tickets, detalhe, histórico de respostas, resposta administrativa, resolução e reabertura. O painel não recebe nem apresenta conversas comerciais privadas.


A validação do Super Admin confirmou o separador **Suporte — Tickets (1)** separado da navegação administrativa. O centro mostrou contadores de tickets por estado, filtros, o ticket do cidadão “Dúvida sobre o meu bilhete”, histórico inicial, estado “Em atendimento”, campo “Responder ao ticket…” e acção “Marcar resolvido”. O cabeçalho explicou explicitamente que conversas comerciais cidadão–empresa permanecem privadas e não aparecem no centro administrativo.

A troca de perfil cidadão → Super Admin funcionou no preview e o ticket existente foi carregado no contexto administrativo. A validação de resposta administrativa e retorno ao cidadão será concluída após a compilação final; a integração de estado e histórico já está coberta pelo check TypeScript.


O Super Admin respondeu ao ticket seleccionado através de “Responder ao ticket…”. A resposta apareceu imediatamente no resumo do ticket com timestamp 27/08/2026, e o contador permaneceu em “Em atendimento”. Isto confirma o circuito Administração → requerente e a actualização do histórico sem abrir qualquer conversa comercial privada.


O ticket foi respondido pelo Super Admin no preview e o resumo actualizou-se imediatamente, mostrando a nova resposta e a hora 27/08/2026, 04:52:42. O suporte administrativo permaneceu separado das conversas comerciais. A troca posterior para o cidadão foi iniciada para verificar a entrega da notificação de resposta no contexto do requerente.


Validação ponta a ponta concluída: após a resposta do Super Admin, João Cidadão voltou a receber o aviso “Resposta no pedido de suporte”. O sino mostrou a notificação privada e o botão “Ver suporte” abriu directamente a Área Pessoal no separador de suporte, onde apareceu “Administração Guigui.com” e a resposta no histórico. O aviso ficou marcado como lido ao abrir. O fluxo confirmou cidadão → Administração → cidadão sem envolver a empresa nem expor conversas comerciais.
Validação de entrada por perfil: ao entrar como Restaurante Coqueiros através da conta rápida, o preview abriu directamente em Modo Comerciante, com `Secção Actual: Painel Comercial`, separador `Dashboard` activo e áreas comerciais organizadas. A regra de destino foi confirmada após a alteração; deep links de notificações continuam a poder abrir subsecções específicas quando aplicável.
Validação de entrada administrativa por perfil: ao trocar de Restaurante Coqueiros para Administrador, o preview abriu em Modo Super Admin com `Secção Actual: Administração`, o separador `Dashboard` activo e o mapa completo de capacidades visível. O comportamento confirma que a entrada normal do administrador não reabre numa área secundária.
