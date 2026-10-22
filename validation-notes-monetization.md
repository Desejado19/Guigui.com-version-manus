# Notas de validação — Módulo de Monetização

Data: 2026-08-28

## Preview

O portal carregou visualmente em `https://3000-iku7lz1w9ir0xw5zfd6o1-b3e65758.us3.manus.computer/` sem erro de página. A sessão persistida no browser era a empresa demo Restaurante Coqueiros Bissau; foram visíveis o cabeçalho, Feed Bissau, Directório, Descontos, Eventos, Mensagens e Notificações.

## Backend

`GET /api/health` devolveu `status: ok`.

`GET /api/monetization/catalog` devolveu HTTP 200.

`POST /api/monetization/requests` criou correctamente um pedido de orçamento de fotografia profissional para `biz-1`, devolvendo HTTP 201 e estado `requested`; `GET /api/monetization/requests` devolveu o pedido persistido.

Uma tentativa de pagamento de pacote +5 posts com valor incorrecto foi rejeitada com HTTP 409 e código `PRODUCT_PRICE_MISMATCH`, com valor esperado de 8.000 XOF.

Uma compra de dois bilhetes de 5.000 XOF foi confirmada em sandbox. O backend devolveu o detalhamento de 1.000 XOF de comissão + 400 XOF de taxa fixa, receita Guigui de 1.400 XOF, total do comprador de 10.000 XOF e um bilhete QR assinado. O movimento `TICKET_FEE` entrou no ledger.

## Observação

A validação visual específica do separador `Administração > Preços > Motor de Monetização` ainda deve ser feita numa sessão de administrador limpa. A validação funcional dos endpoints e a compilação do novo módulo foram concluídas.

## Validação visual adicional

A sessão empresarial persistida abriu correctamente. O menu de sessão mostrou `Área da Minha Empresa`, `Trocar de Conta / Perfil` e `Sair da Conta`; o cabeçalho manteve Mensagens, Notificações, Descontos e Eventos. A área principal não apresentou scroll horizontal obrigatório. A troca para Admin ainda não foi executada nesta sequência.

O fluxo de troca de conta abriu o modal de acesso da plataforma correctamente. A opção `Entrar na Conta` ficou disponível e o modal tem botão `Fechar janela de autenticação`; a sessão empresarial permaneceu carregada em fundo. O browser ainda está no primeiro passo do login e não foi afirmado teste visual do painel administrativo.

A conta demo `admin@guigui.com` entrou correctamente como `Modo Super Admin`. O painel administrativo mostrou os separadores existentes, incluindo `Matriz de Preços XOF`, `Pagamentos & Reconciliação`, `Relatórios & Exportação`, `Logs de Auditoria` e `Agenda & Bilheteira`. O dashboard carregou visualmente sem erro e a navegação continua organizada em grelha. A validação do submenu de Monetização será feita abrindo `Matriz de Preços XOF`.

No painel Super Admin, `Matriz de Preços XOF` abriu correctamente e mostrou a secção `Motor de Monetização & Receitas`. Visualmente ficaram disponíveis as abas `Produtos`, `Publicidade`, `Extras & Pacotes`, `Serviços`, `Bilhética`, `Ledger` e `Pedidos`, sem substituir a matriz de preços legada. A aba de produtos mostrou os códigos `POST_EXTRA`, `PROMOTION_EXTRA`, `HOMEPAGE_BANNER`, `WEEK_PROMOTION`, `PUSH_CAMPAIGN` e `TICKET_FEE`, com preço, modelo de venda e estado configuráveis.

O centro de Monetização foi visualmente confirmado com o Super Admin. Ao abrir o selector de sessão, `Trocar de Conta / Perfil` abriu novamente o modal de acesso existente, mantendo o painel e a opção de entrada empresarial disponíveis.


## Auditoria funcional adicional — 28/08/2026

A especificação de 1429 linhas foi relida integralmente e comparada com o projecto. A homepage carregou no preview com hero de pesquisa, atalhos, bairros, categorias, empresas em destaque, agenda e feed. O browser mostrou a sessão administrativa persistida como `Modo Super Admin` apesar do rótulo de portal público; não foi alterada nenhuma funcionalidade de sessão.

Foram acrescentadas campanhas publicitárias ao catálogo, com a campanha demo `campaign-welcome-bissau` disponível no endpoint e no estado partilhado. A página pública já lê a campanha activa do catálogo e mostra a marcação `Publicidade patrocinada`, título, descrição, imagem, prioridade e ligação configurável. Impressões e cliques incrementam a campanha no estado do preview.

A pesquisa passou a apresentar contadores de publicações, empresas, promoções e eventos. Promoções expiradas deixam de aparecer na listagem activa. A ficha e o cartão do Directório actualizam métricas de telefone, WhatsApp, direcções e website quando os respectivos destinos são accionados.

A compra pública de bilhetes aceita agora convidado sem conta; utilizadores autenticados continuam a ter o `buyerId` associado. A Agenda inclui consulta de bilhete por telemóvel + código/PIN, ligada a `POST /api/tickets/lookup`, com resposta genérica para falhas e rate limit dedicado.


## Validação adicional de bilhética — 29-08-2026

Depois da separação entre comprador e titular, foi executada a verificação TypeScript, build e o novo `npm run test:tickets`. O teste confirmou duas credenciais individuais por uma compra de quantidade 2, QR/código/PIN distintos, lookup pelo telefone do titular, idempotência e rejeição de titular incompleto.

O endpoint de reenvio de SMS simulado foi validado com resposta de sucesso e segunda tentativa bloqueada por HTTP 429 (`SMS_COOLDOWN`). O preview foi reiniciado e `GET /api/health` respondeu `status: ok`. A validação visual confirmou carregamento da homepage, agenda, mensagens, notificações e alerta fechável.

O build mantém apenas o aviso não bloqueante de chunk JavaScript superior a 500 kB. Não foram declaradas reservas/stock server-side, SMS real, credenciais comerciais Orange Money/Telecel, offline seguro, operadores individuais ou reembolso em massa como funcionalidades concluídas.
