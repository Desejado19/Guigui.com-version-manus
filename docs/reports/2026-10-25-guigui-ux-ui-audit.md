# Auditoria UX/UI e funcional — Guigui.com

**Data de início:** 2026-10-25
**Commit base:** `91cccba` — `docs: plan Guigui UX audit execution`
**Branch:** `agents/faz-um-teste-completo-no-sistema-sobre-fluxo`
**Escopo:** inspeção somente de leitura; sem alterações de produto, migrations, seed, deploy ou acesso a base real.

## Resumo executivo

_A preencher após a auditoria das áreas e fluxos._

## Método e classificação de evidência

Cada capacidade será rastreada do ecrã/ação até rota, autorização, serviço e persistência/provedor. Evidência de interface ou teste unitário, isoladamente, não comprova funcionamento ponta a ponta.

| Classificação | Significado |
|---|---|
| `persistida` | Evidência mostra que a operação alcança o destino de persistência autoritativo. |
| `local/sincronizada` | O browser mantém estado local e existe caminho definido de sincronização por API. |
| `simulada` | O fluxo usa simulador, stub, fixture ou adaptador não produtivo. |
| `incompleta` | Falta uma ação ou caminho essencial esperado. |
| `inconsistente` | Camadas ou estados apresentados ao utilizador divergem. |
| `não verificada` | Inspeção e validação local segura não provaram o comportamento. |

Cada linha do inventário deve identificar perfil, ecrã/ação, fonte frontend, rota HTTP ou ação local, autorização no servidor, serviço/caso de uso, persistência/provedor, classificação, evidência e limitações.

## Baseline e limites de validação

- Estado inicial do worktree: limpo; nenhum ficheiro de produto foi alterado.
- O `vitest.config.ts` inclui testes em `tests/unit/**/*.test.ts` e `tests/unit/**/*.test.tsx`.
- `package.json` declara validações unitárias, TypeScript, build, i18n, Playwright, Newman, k6 e OWASP ZAP.
- O alvo da campanha QA existente é `http://127.0.0.1:4313` e a base sintética reservada `guigui_pg18_synthetic_target`. A provisão executa migrations; por isso `qa:full` e `qa:provision` não fazem parte desta auditoria.
- `scripts/qa/run-campaign.ps1` cria diretórios de resultados e um `empty.env` antes da fase de preflight e, depois, prepara ambiente próprio para ferramentas. Não foi executado para evitar artefactos laterais e qualquer sequência de provisão/seed.
- A suíte de operações PostgreSQL usa `PLATFORM_FOUNDATION_TEST_DATABASE_URL` com guardas de loopback, nome e versão; os testes de integração devem permanecer ignorados se a URL estiver vazia.
- A suíte legada lê `TEST_DATABASE_URL`; só poderá ser executada sem acesso ao banco se a URL estiver explicitamente vazia e os guards forem confirmados.
- Nenhum teste foi executado nesta tarefa de baseline.

## Público e cidadão

### Inventário de ecrãs e fluxos

| Perfil | Ecrã/ação | Frontend | Rota/autorização | Serviço e persistência observados | Classificação | Evidência e limite |
|---|---|---|---|---|---|---|
| Público/cidadão | Feed, pesquisa e diretório | `Navbar` atualiza a pesquisa; `App.tsx` filtra publicações, empresas, promoções e eventos. O diretório filtra categoria, bairro, horário de abertura e ordenação. | `GET /api/health`, `/api/categories`, `/api/businesses` e `/api/events` não exigem sessão nas rotas públicas observadas. | `useMarketplaceData` usa PostgreSQL quando `/api/health` indica base configurada. Sem base, categorias e eventos vêm do browser; empresas combinam `localStorage` com `GET /api/businesses`. Alterações locais são guardadas no browser e enviadas por `POST` aos recursos. | `local/sincronizada` | `src/hooks/useMarketplaceData.ts`; `src/App.tsx`; `server.ts:857-875,1460-1470`; `server/categoryRoutes.ts:17`. Não foi iniciado o sistema para confirmar dados reais ou comportamento visual. |
| Público/cidadão | Perfil público da empresa, contactos e avaliações | `BusinessDetailModal` apresenta informações, separadores, contacto e avaliação; seguir/ativar notificações chama estado local do `App.tsx`. | `GET /api/businesses/:id/reviews` é público; `POST` exige sessão. O contacto por mensagem passa pela API autenticada. | Avaliações são carregadas/submetidas por `reviewSync` e rotas PostgreSQL. Empresas seguidas e notificações silenciadas usam `usePersistentState`; essas chaves não estão na lista de sincronização remota. | `local/sincronizada` (mista) | `src/components/BusinessDetailModal.tsx`; `src/services/reviewSync.ts`; `src/App.tsx:1149-1180,1705-1737`; `server.ts:2314-2345`; `src/utils/persistentState.ts`. A entrega real de chamadas telefónicas/WhatsApp depende dos dados de contacto e do dispositivo, não foi testada. |
| Público/cidadão | Agenda e pesquisa de eventos | `EventsView` mostra data, hora, local, preços, pesquisa textual e filtro por categoria. | `GET /api/events` é público; o endpoint lê PostgreSQL quando configurado e snapshots em memória quando não configurado. | No modo local os eventos também são guardados em `localStorage`; lembretes usam `localStorage` (`guigui_event_reminders`) e não constam das chaves sincronizadas por `usePersistentState`. | `local/sincronizada`; filtro incompleto | `src/components/EventsView.tsx:427-441,554-650`; `src/App.tsx:453-474,891-925`; `server.ts:1460-1470`. Não há filtro estruturado por data/local nem ecrã próprio de detalhe do evento observados; local pode ser pesquisado por texto e o detalhe apresentado está no cartão/fluxo de compra. |
| Cidadão | Registo e início de sessão | `LoginModal` envia os formulários para a API e apresenta erros devolvidos pelo servidor. | `POST /api/auth/register` e `/api/auth/login`; login cria cookie de sessão e usa `identityAccess.authenticate`. | O backend delega a identidade no módulo `identity-access`; a composição/adaptador escolhido e a durabilidade por ambiente serão consolidados na Task 4. | `não verificada` | `src/components/LoginModal.tsx:214-240,327-405`; `server.ts:1665-1685,2025`; testes de serviço em `tests/unit/authService.test.ts`. Não há teste de navegador do fluxo completo neste trabalho. |
| Cidadão | Recuperação de palavra-passe | O formulário só mostra a etapa de redefinição quando recebe `resetToken`; ambos os passos chamam endpoints separados. | `POST /api/auth/request-password-reset` e `/api/auth/reset-password` são públicos. | A rota solicita token ao módulo de identidade; o token de uso único é guardado pelo adaptador JSON. A rota apenas devolve o token em ambiente não produtivo e não invoca entrega de e-mail/SMS. Em produção, a resposta genérica não disponibiliza o token necessário ao formulário. | `incompleta` em produção | `src/components/LoginModal.tsx:243-263,864-871`; `server.ts:1863-1880`; `server/modules/identity-access/infrastructure/jsonIdentityRepository.ts:248`. Testes unitários de tokens não comprovam entrega ao utilizador. |
| Cidadão | Perfil e preferências pessoais | O formulário “Guardar dados pessoais” e vários controlos chamam `onProfileChange`; o `App.tsx` apenas atualiza `currentUser`. | Não foi encontrado endpoint para atualizar perfil; a chave `guigui_current_user` não está entre as chaves sincronizadas. | O estado é guardado no `localStorage` pelo hook; os dados de perfil, privacidade e preferências não são enviados ao servidor pelo caminho observado, apesar do feedback “Dados guardados”. | `inconsistente` | `src/components/CitizenDashboard.tsx:165,212,575-576`; `src/App.tsx:253,2943-2946`; `src/utils/persistentState.ts:15-24,89-111`. A alteração não foi validada entre sessões/dispositivos. |
| Público/cidadão | Consultar/copiar promoções | `PromotionsView` filtra promoções ativas/não expiradas, apresenta `discountBadge`, código e contagem até `validUntil`. | A lista vem do estado `guigui_promotions`, que usa `/api/app-state/:key`; a aplicação não envia o código para um checkout neste fluxo. | A chave de promoções está na lista de dados sincronizáveis. O modelo suporta `startsAt`/`scheduledAt`, mas não tem preço original/promocional estruturado nem capacidade de resgate; o cartão não mostra início nem estado esgotado e filtra por `isActive`/`validUntil`. | `incompleta` para preço/validade comercial | `src/components/PromotionsView.tsx:86-100,133-155`; `src/types.ts:427-447`; `src/utils/persistentState.ts:15-24,35-45,97-103`; `server.ts:763-788`. A aplicação real do desconto no pagamento será aprofundada na Task 5. |
| Cidadão | Comprar bilhete e receber comprovativo | `EventsView` exige login na interface, valida o tipo/preço visível e envia chave de idempotência para `/api/tickets/purchase`; separa pagamento pendente de emissão confirmada. | A rota de compra e a respetiva autorização/provedor serão rastreados na Task 5; a execução ponta a ponta não foi feita. | O caso de uso de compra, reserva, pagamento, emissão e persistência tem testes unitários próprios, mas esses testes não provam a integração do browser, sessão, provedor ou base no ambiente alvo. | `não verificada` | `src/components/EventsView.tsx:230-354`; `server.ts:2639`; `tests/unit/ticketPurchaseUseCase.test.ts:121-250`. |
| Cidadão | Meus bilhetes, QR e recuperação por código/telefone | `MyTicketsPanel` lê a lista autenticada; a secção de bilhetes oferece fallback explicitamente identificado como demonstração. O cartão de resumo da conta, porém, usa `purchaseOrders` locais. | `GET /api/tickets/mine` exige sessão; consulta PostgreSQL quando configurado e o armazenamento em memória quando não configurado. Consulta de recuperação por código/telefone é pública e limitada por rate limit. | A fonte da secção de bilhetes é a API; `guigui_purchase_orders` não é chave sincronizada. A conta também sincroniza bilhetes reais para esse estado local, que inicia com encomendas de demonstração. | `inconsistente` entre resumo e secção de bilhetes | `src/components/MyTicketsPanel.tsx:54-79`; `src/components/CitizenDashboard.tsx:510-533`; `src/App.tsx:111-243,1042-1087,2158-2164`; `server.ts:2936-2967`. Não foi confirmada a apresentação com uma conta real. |
| Cidadão | Obter QR/voucher de promoção | `PromotionsView.handleClaimPromo` gera código, token QR e encomenda no browser, com valor zero e estado pendente; `handleAddPurchaseOrder` acrescenta à chave local `guigui_purchase_orders`. | Não foi encontrada rota de cidadão para reclamar/resgatar promoção; a rota de marketing encontrada é de criação pela empresa (`POST /api/marketing/promotions`). | O QR e a encomenda do voucher não são validados nem persistidos no servidor pelo fluxo observado; o scanner apresentado recebe `purchaseOrders` do estado local. | `simulada` / `incompleta` | `src/components/PromotionsView.tsx:34-66,249-270`; `src/App.tsx:1042,1091-1138,2770-2780`; `server.ts:589`. Não se deve apresentar o QR como voucher resgatável real até existir validação autoritativa. |
| Cidadão | Notificações | As notificações são sincronizadas da API; marcar como lida chama o endpoint individual. “Limpar” remove apenas os itens do estado local. | `GET /api/notifications` e `POST /api/notifications/:id/read` exigem sessão. Não foi encontrada operação de apagar/limpar no servidor. | A lista combina dados locais e remotos; uma sincronização posterior pode repor notificações que apenas foram removidas localmente. | `inconsistente` para “limpar” | `src/services/communicationSync.ts:11-34`; `src/App.tsx:603-621,635-663`; `server.ts:2011-2024`; `src/components/Navbar.tsx:783`. Não foi testado o comportamento após recarregar. |
| Cidadão | Mensagens e suporte | O `CommunicationHub` cria conversas, envia mensagens otimistas, mostra falha quando a gravação falha, abre suporte e acompanha respostas. | `/api/conversations`, `/:id/messages`, `/:id/read`, `/api/support/tickets`, `/mine` e replies exigem sessão; o servidor limita conversas comerciais a cidadão/empresa e verifica participação. | Rotas chamam serviços PostgreSQL; mensagens recebem atualização por polling/event stream. O suporte cria pedido no servidor antes de atualizar o estado local. | `persistida` (caminho de API observado; execução não verificada) | `src/App.tsx:726-858`; `src/services/communicationSync.ts:39-69`; `server.ts:1883-1996`; `tests/unit/communicationSync.test.ts`, `tests/unit/components/communicationHub.test.tsx`, `tests/unit/appCommunicationFlows.test.ts`. |
| Cidadão | Lembretes e seguir empresas | Os controlos adicionam/removem lembretes e seguem empresas no `App.tsx`. | Não foi observada rota de persistência para estas ações. | Lembretes, empresas seguidas e preferências de silenciamento persistem apenas no `localStorage` do navegador; não estão na lista de chaves sincronizáveis. | `incompleta` para sincronização entre dispositivos | `src/App.tsx:453-474,891-925,1149-1180`; `src/utils/persistentState.ts`. Não foi provado agendamento de notificações fora da sessão/instalação do browser. |

### Achados desta área

1. **Alta — promoção não está ligada a preço ou resgate autoritativo.** O modelo e cartão não apresentam preço original/promocional estruturado nem estado de início/esgotamento; a ação “Obter QR Code” fabrica token e encomenda no cliente, com valor zero e estado `pending`, sem rota de resgate do cidadão. O utilizador é instruído a apresentar o QR como desconto, mas não há validação autoritativa no fluxo observado.
2. **Alta — recuperação de palavra-passe sem canal de entrega em produção.** A redefinição precisa do token, mas a rota só o devolve em desenvolvimento; não há envio de instruções por e-mail/SMS no caminho observado. A etapa de redefinição fica inacessível ao utilizador de produção.
3. **Média — fontes de bilhetes diferentes dentro da área pessoal.** O cartão de resumo lê encomendas do browser, com fallback inicial de dados demonstrativos, enquanto a secção dedicada consulta `/api/tickets/mine`. O fallback de demonstração está rotulado nessa secção, mas o resumo não apresenta essa distinção.
4. **Média — “limpar notificações” não é persistido no servidor.** A ação remove itens do estado local, embora a lista seja sincronizada da API; os itens podem reaparecer numa recarga ou nova sincronização.
5. **Média — agenda sem filtros estruturados de data/local e sem detalhe individual.** O código oferece pesquisa textual e categoria; data/local são apenas apresentados e local pode entrar na pesquisa textual. Não foi encontrada uma página ou modal autónomo de detalhe do evento.
6. **Média — perfil e preferências não são atualizados no servidor.** A área pessoal mostra confirmação de gravação, mas o callback atualiza apenas o utilizador guardado no browser; não foi encontrada rota de atualização de perfil.

### Evidência de testes existentes

- `tests/unit/useMarketplaceData.test.tsx`: cobre seleção entre base configurada e estado local, normalização, escrita de alterações e erros de sincronização; unidade do hook, não teste de navegador ou persistência externa.
- `tests/unit/components/BusinessDetailModal.test.tsx`: cobre fallbacks de imagem, detalhes e ações de seguir/mensagem/contacto com callbacks; não prova chamadas/API persistidas.
- `tests/unit/authService.test.ts`: cobre hashing, autenticação, tokens de recuperação e adaptador de identidade; não cobre o percurso de e-mail de recuperação nem o modal completo.
- `tests/unit/components/LoginModal.test.tsx`: cobre registo de empresa; não contém fluxo de login/recuperação de cidadão.
- `tests/unit/ticketPurchaseUseCase.test.ts`: cobre o caso de uso de compra, reserva, confirmação, emissão, entrega e idempotência em unidade; não comprova frontend→HTTP→provedor→base.
- `tests/unit/communicationSync.test.ts`, `tests/unit/components/communicationHub.test.tsx` e `tests/unit/appCommunicationFlows.test.ts`: cobrem mapeamento/sincronização, interação do hub e estado otimista; não constituem ensaio em navegador com API/base reais.
- A inspeção não encontrou testes dedicados para `EventsView` ou `PromotionsView`. Nenhum teste foi executado nesta tarefa; a execução segura está reservada à Task 6.

## Empresas e organizadores

_Pendente — Task 3._

## Administração e permissões

_Pendente — Task 3._

## Rotas, autorização e persistência

_Pendente — Task 4._

## Promoções, pagamentos e bilhetes

_Pendente — Task 5._

## UX, acessibilidade, responsividade e idiomas

_Pendente — Task 6._

## Validação

| Comando/ferramenta | Resultado | Limitação |
|---|---|---|
| `npm run lint` | Não executado | Pendente da verificação segura em Task 6. |
| `npm run test:unit` | Não executado | Pendente; URLs de banco devem ser explicitamente vazias no processo. |
| `npm run test:integration -- --maxWorkers=1 --no-file-parallelism` | Não executado | Só executar se as guardas ignorarem os testes DB antes de criar pool com URLs vazias. |
| `npm run build` | Não executado | Pendente da verificação segura em Task 6. |
| `npm run test:i18n` / `npm run audit:i18n` | Não executados | Pendente de Task 6. |
| Playwright | Não executado | Requer runtime local seguro; não iniciar se puder ler dados de utilizador existentes ou `.env`. |
| Newman / k6 / OWASP ZAP passivo | Não executados | Pendente de verificar alvo local seguro; sem provisionamento, seed, acesso externo ou instalação de ferramentas. |

## Achados priorizados

_Pendente — consolidar após Tasks 2–6. Não listar hipótese como achado confirmado._

## Decisões de negócio e bloqueios

_Pendente — registar políticas, integração ou evidência autoritativa ausentes._

## Projetos de implementação propostos

_Pendente — dependências e prioridade serão definidas após a evidência da auditoria. Nenhum projeto está concluído por este relatório._
