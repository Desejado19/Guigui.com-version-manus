# Validação do Directório, cabeçalho e mensagens — 28 de Agosto de 2026

O preview abriu correctamente após o reinício. No cabeçalho foram observados os quatro ícones centrais actualizados e o badge **Eventos** na Agenda Cultural & Bilhetes. O antigo ícone de tema foi substituído por um botão com hint **Abrir caixa de mensagens**; o sino de notificações permanece separado.

Ao abrir o **Guia de Empresas e Serviços em Bissau**, cada cartão apresentou um botão de seguimento, um botão **Enviar mensagem interna para [empresa]** e uma ligação `tel:` para **Ligar para Telefone**. O Directório carregou os seis negócios activos em modo horizontal sem erro visual.

A primeira validação visual ainda revelou um título no cartão da página inicial que continuava como **Agenda & Bilheteira SMS**; esse texto foi corrigido no código para **Agenda & Eventos** e será revalidado no próximo carregamento.


Durante a validação manual, o menu da sessão abriu correctamente e apresentou “Trocar de Conta / Perfil”. O modal de autenticação abriu com as opções “Entrar na Conta” e “Criar Nova Conta”; o cartão de entrada aparece como elemento visual não semântico no extractor, pelo que a validação prosseguirá através do controlo navegável do próprio modal. Não foi considerado um erro funcional do fluxo neste ponto.


Foi validado o acesso rápido como **João Cidadão**. No cabeçalho, o botão **Abrir caixa de mensagens** apresentou um contador independente de conversas não lidas (`1`), enquanto o sino de notificações manteve o contador próprio (`7`). Isto confirma visualmente a separação entre caixa de mensagens e centro de notificações.


Como cidadão, clicar no cabeçalho **Abrir caixa de mensagens** abriu directamente a Área Pessoal na secção **Mensagens e suporte**, sem abrir o sino. Ao voltar ao Directório, o Restaurante Coqueiros mostrou separadamente **Deixar de seguir**, **Desactivar notificações** e **Enviar mensagem interna**, confirmando que o sino não está ligado ao acto de seguir/desseguir.


Após recarregar o preview, a página inicial passou a apresentar **Agenda & Eventos**, e o botão de navegação superior manteve o badge **Eventos**. A sessão de cidadão e os contadores separados de mensagens/notificações persistiram correctamente.


No perfil cidadão, o cabeçalho mostra **Abrir caixa de mensagens** com contador separado e o botão de sessão permite trocar de perfil. O ecrã inicial carregado após essa troca confirmou **Agenda & Eventos** na secção de eventos.


Foi validada a entrada rápida como **Restaurante Coqueiros**. O perfil abriu directamente no **Painel Comercial / Dashboard**, sem cair no mapa de capacidades. O Dashboard apresentou os novos indicadores: **Seguidores: 1**, **Alcance dos anúncios: 2.095**, **Visualizações: 1.840**, além de WhatsApp Leads, Chamadas e Mapa. A caixa de mensagens aparece como uma acção própria do painel.
