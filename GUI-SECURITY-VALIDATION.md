# Guigui.com — Validação funcional, de segurança e responsividade

**Data da validação:** 27 de Agosto de 2026  
**Versão:** preview funcional React/TypeScript/Vite  
**Âmbito:** Área da Minha Empresa, bilhetes pessoais, QR/código, notificações, mensagens, suporte, permissões e listas de acções responsivas.

## Resultado executivo

A implementação foi validada com `npm run check` e `npm run build`, ambos concluídos com sucesso. O preview foi testado com as contas demo de cidadão e empresa. A compra de demonstração criou um bilhete associado à conta cidadã, com código alfanumérico, QR escaneável e opções de cópia/download. A mesma compra apareceu no contexto operacional da empresa organizadora, sem ser encaminhada para o Super Admin.

As conversas e pedidos de suporte foram testados nos dois lados. O cidadão iniciou uma conversa e abriu um pedido de suporte; a empresa recebeu ambos, respondeu à conversa e respondeu ao pedido, que passou de **Aberto** para **Em análise**. Os registos são filtrados por `userId`/`buyerId` e `businessId`, evitando a exposição de mensagens, compras ou dados de terceiros no contexto errado.

## Matriz de validação

| Área | Verificação realizada | Resultado |
|---|---|---|
| Área da Minha Empresa | Perfil empresarial abre a ficha própria através do menu de perfil e da grelha do painel | Aprovado |
| Dados empresariais | Campos de identidade, contactos, redes, horários, serviços, comodidades, logo, capa e galeria ligados a `onUpdateBusiness` persistente | Aprovado no código e build |
| Uploads | Rótulos normalizados para **Carregar**; ficheiro local/URL mantidos com limite de 25 MB na demo | Aprovado |
| Colaboradores | Adicionar/remover por empresa com persistência em chave local específica | Aprovado no preview |
| Password | Endpoint `/api/auth/change-password`; passwords armazenadas com scrypt e demo overrides hashados | Aprovado: validação 400, alteração/login/restauro 200 |
| Compra de bilhete | Checkout de demonstração confirmou a compra sem pagamento real | Aprovado |
| Titularidade | Pedido inclui `buyerId`, `eventId` e `ticketPin`; área cidadã recebe apenas `buyerId === currentUser.id` | Aprovado |
| Bilhete pessoal | Área pessoal separa Resumo, Meus bilhetes, Compras, Notificações e Mensagens e suporte | Aprovado no preview |
| QR/código | QR real escaneável; código alfanumérico copiável; QR em PNG e código em TXT | Aprovado no preview |
| Notificações | Sino com estado lido/não lido, detalhe, CTA e entidades de suporte, pagamento e bilhete; conversas comerciais ficam na caixa Mensagens | Aprovado |
| Deep links | Compra/pedido, evento, publicação, conversa e suporte recebem foco/rota concreta | Aprovado no código e build |
| Mensagens | Cidadão criou conversa; empresa viu o histórico e respondeu | Aprovado no preview |
| Suporte | Cidadão/empresa criou pedido dirigido à Administração; a resposta administrativa é apresentada ao requerente | Aprovado na arquitectura e no preview |
| Isolamento | Listas de cidadão filtradas por titular; listas empresariais filtradas por empresa; scanner continua empresarial | Aprovado no código |
| Super Admin | Operação de compra, comprador, QR, scanner e reembolso de bilhetes permanece fora do painel administrativo | Aprovado na arquitectura existente |
| Acções responsivas | Filtros e barras de acções principais convertidos para `flex-wrap`/grelha; wrappers de tabelas mantidos com scroll móvel | Aprovado por auditoria de fonte |
| Consola | Preview sem saída de erro na consola durante os testes | Aprovado |

## Medidas de segurança confirmadas

A navegação central mantém guards por papel. O cidadão não recebe scanner, painel empresarial ou Administração no rodapé e nos atalhos de perfil. A empresa recebe apenas o negócio associado ao seu `businessId` e os eventos/pedidos operacionais desse negócio. O Super Admin mantém responsabilidades de governação, tiers, permissões, auditoria, configuração e finanças da plataforma, sem acesso operacional a compradores, QR, scanner, vendas ou reembolsos de bilhetes.

O motor de notificações usa destinatários explícitos e metadados de entidade. Compras de bilhetes geram avisos ao cidadão comprador e à empresa organizadora; o aviso administrativo de compra de bilhete foi restringido. Mensagens e suporte geram avisos apenas para o participante destinatário. Notificações abertas são marcadas como lidas antes da navegação, e a caixa de detalhe possui fecho explícito.

O endpoint de password verifica a password actual antes de gerar um novo hash. Contas criadas são persistidas no backend com scrypt; contas demo usam overrides hashados opcionais e regressam ao fallback `123456` quando não existe override. **Antes de produção, a aplicação deverá acrescentar sessão autenticada no servidor, protecção CSRF, limitação específica da rota e auditoria de alterações**, pois o preview actual ainda é uma demonstração de navegador único.

## Persistência e limites da demonstração

O preview guarda empresas, pedidos, bilhetes, notificações, conversas, suporte e preferências no `localStorage`, enquanto o servidor mantém dados de autenticação e operações JSON na pasta `data/`. Esta persistência permite recarregar o mesmo navegador e continuar o teste, mas não substitui uma base de dados multiutilizador. Ficheiros locais são convertidos em Data URLs; numa instalação real devem usar object storage, URLs assinados, antivírus, limites por utilizador e políticas de retenção.

## Registos de teste

A evidência detalhada da sessão browser encontra-se em `validation-notes-step-2.md`. Os testes finais foram executados com:

```text
npm run check   -> sucesso
npm run build   -> sucesso
POST /api/auth/change-password com dados incompletos -> 400
POST alteração demo temporária -> 200
POST login com nova password -> 200
POST reposição para 123456 -> 200
GET /api/health -> 200
```

O aviso do Vite sobre chunks superiores a 500 kB é apenas uma recomendação de optimização de code-splitting; não impediu o build nem a execução do preview.

## Validação complementar: preços, relatórios e suporte (27/08/2026)

O Super Admin dispõe agora de campos numéricos editáveis para desconto anual antecipado, post extra, promoção extra, banner semanal, comissão de bilheteira e taxa fixa por emissão, além da matriz de preços por grupo de categoria e escalão. O teste controlado 15% → 20% recalculou os totais anuais e mostrou confirmação de gravação; o valor foi restaurado para **15%** antes da entrega. A persistência usa as chaves `guigui_admin_business_model_config` e `guigui_admin_category_groups`, e a Área da Empresa e a Agenda de Bilhetes reutilizam o mesmo modelo persistente.

O Centro de Relatórios do Super Admin aplica período, categoria e âmbito empresa/evento aos dados de pagamentos e eventos disponíveis, apresenta o contexto activo no resumo e mantém fora da área administrativa as operações de compra, comprador, QR, scanner, vendas e reembolsos de bilhetes. A Área da Empresa tem selector visível de 30 dias, 90 dias, ano corrente e todo o período, resumo por período/volume/empresa e exportadores CSV, Excel compatível e PDF / Imprimir. O PDF / Imprimir abre uma folha profissional no diálogo do navegador para impressão ou “Guardar como PDF”, sem simular um ficheiro PDF binário gerado pelo servidor.

A caixa Mensagens e suporte foi mantida como fluxo bidireccional entre cidadão e empresa. O isolamento é aplicado por `userId`, `requesterId` e `businessId`: uma empresa só responde aos pedidos da sua empresa associada e um cidadão só vê os seus próprios registos. A abertura de notificações marca-as como lidas e encaminha o participante para a conversa ou pedido correspondente.

Os seguidores são guardados por utilizador em `guigui_followed_businesses`. O controlo de seguir exige uma conta cidadã; cada novo post aprovado, promoção activa ou evento activo gera uma notificação com destinatário explícito para cada seguidor da empresa. A filtragem global de notificações mantém esses avisos privados, sem os entregar a outros cidadãos, empresas ou ao Super Admin. A Área Pessoal apresenta as empresas seguidas e explica que elas enviam avisos de novas publicações.

`npm run check` e `npm run build` concluíram com sucesso após as alterações. O Vite emite apenas o aviso não bloqueante de chunk JavaScript superior a 500 kB.


## Auditoria global complementar — 27/08/2026

A auditoria comparou o documento de Arquitectura & Segurança com os módulos existentes, sem duplicar áreas já implementadas. Foram corrigidos três problemas no seguimento: a Área Pessoal podia listar empresas que não eram seguidas, a grelha do Directório não recebia as acções de seguimento e as notificações procuravam seguidores com a orientação errada do mapa persistente. A resolução actual aceita o formato por utilizador e mantém compatibilidade defensiva com instalações antigas.

Foi também corrigido o fluxo de moderação empresarial: conteúdos classificados como **Amarelo** deixam de ser marcados como aprovados e passam para `pending_moderation`, enquanto apenas conteúdos classificados como **Verde** são publicados imediatamente. O validador de bilhetes passou a rejeitar explicitamente o estado `expired`, datas de validade inválidas e datas já ultrapassadas. O histórico de backups manuais e consentimentos passou a ser persistido no backend, e cada backup manual gera registo de auditoria.

O teste automatizado `scripts/audit-ticket-validation.ts` confirmou a rejeição de bilhetes expirados, datas inválidas, estado expirado e reutilização. `npm run check`, `npm run build` e a consola do preview terminaram sem erros. O aviso de chunk grande do Vite permanece apenas como optimização futura.

Permanece uma limitação deliberadamente identificada: o preview usa autenticação demo sem sessão JWT/CSRF completa e vários dados de demonstração são locais. Antes de produção, as rotas administrativas e financeiras deverão exigir sessão de servidor, autorização RBAC no backend, CSRF, limites específicos por rota e armazenamento multiutilizador; os dados pessoais e ficheiros deverão migrar para base de dados e object storage com URLs assinados.


## Separação Mensagens / Suporte — 27/08/2026

A comunicação foi separada em dois contextos. **Mensagens** continua restrita ao cidadão e à empresa participante, servindo dúvidas comerciais e de serviço. **Suporte** passou a ser um ticket dirigido à Administração: o cidadão e a empresa podem abrir casos sobre conta, pagamento, bilhete, subscrição, verificação ou funcionamento da plataforma.

O `AdminSupportHub` é um centro administrativo independente com filtros por estado, contadores, histórico, resposta, resolução e reabertura. O Super Admin não recebe nem lista conversas privadas comerciais por rotina. A abertura de um ticket gera um aviso administrativo; uma resposta gera apenas o aviso ao requerente correspondente. O deep link do aviso abre o ticket e não uma caixa de conversa.

A validação browser confirmou o fluxo cidadão → ticket → Administração → resposta → cidadão. O cidadão recebeu “Resposta no pedido de suporte”, abriu “Ver suporte” e viu a resposta da Administração no histórico. O painel administrativo mostrou o ticket sem expor o chat comercial.


## Política de subscrições empresariais — validação final

A confirmação de um plano pago inicia o período mensal ou anual e regista a próxima data de pagamento. O Super Admin não pode alterar o escalão de uma empresa que tenha `subscriptionPaymentId` ou `subscriptionStartedAt`; a tentativa é bloqueada e gera log de segurança. A Administração pode suspender a empresa em caso de quebra contratual, mas a renovação não remove uma suspensão manual.

Os alertas de renovação são deduplicados por empresa e período nos marcos de 15 dias, 10 dias, 5 dias e 24 horas. Depois do prazo, o painel empresarial mantém acesso de consulta e bloqueia mutações comerciais, incluindo edição da ficha, publicações, promoções, eventos, extras e operações de bilheteira. O Super Admin pode ligar ou desligar a opção **Suspensão automática após expiração**; desligá-la evita o estado `suspended`, mas não remove o modo de consulta nem o bloqueio do plano expirado.

A auditoria reproduzível está em `scripts/audit-subscription-flow.ts` e é executada com `npm run test:subscriptions`.


## Política de subscrições empresariais — validação final

A confirmação de um plano pago inicia o período mensal ou anual e regista a próxima data de pagamento. O Super Admin não pode alterar o escalão de uma empresa que tenha `subscriptionPaymentId` ou `subscriptionStartedAt`; a tentativa é bloqueada e gera log de segurança. A Administração pode suspender a empresa em caso de quebra contratual, mas a renovação não remove uma suspensão manual.

Os alertas de renovação são deduplicados por empresa e período nos marcos de 15 dias, 10 dias, 5 dias e 24 horas. Depois do prazo, o painel empresarial mantém acesso de consulta e bloqueia mutações comerciais, incluindo edição da ficha, publicações, promoções, eventos, extras e operações de bilheteira. O Super Admin pode ligar ou desligar a opção **Suspensão automática após expiração**; desligá-la evita o estado `suspended`, mas não remove o modo de consulta nem o bloqueio do plano expirado.

A auditoria reproduzível está em `scripts/audit-subscription-flow.ts` e é executada com `npm run test:subscriptions`.
