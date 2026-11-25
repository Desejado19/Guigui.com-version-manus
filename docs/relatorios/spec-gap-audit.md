# Auditoria de lacunas — Especificação funcional integrada

## Já coberto e a preservar

A área pública, autenticação demo, feed social, directório, promoções com contagem regressiva, eventos, compra de bilhetes com QR/PIN, pagamentos sandbox/manual, subscrições, limites configuráveis, seguimento de empresas, mensagens, notificações, suporte, scanner empresarial, exportações administrativas, moderação, RBAC visual, auditoria e Motor de Monetização já existem e devem continuar a usar as suas fontes actuais.

A decisão de idioma do produto mantém Português, Francês e Inglês, conforme requisito anterior do proprietário, apesar de a especificação genérica mencionar Crioulo. O modelo contém apenas `pt | fr | en`; não será reintroduzido Crioulo.

## Lacunas reais encontradas

| Área | Lacuna | Integração planeada |
|---|---|---|
| Homepage | `AdPlacement` e produtos existem, mas falta uma entidade de campanha activa com título, imagem, link, período, prioridade, público e contadores | Ad campaigns persistentes no catálogo/backend e banner renderizado pela homepage |
| Publicidade | O editor gere produtos/placements, mas não cria campanhas reais nem limita simultaneidade | CRUD administrativo de campanhas e resolução de banners activos |
| Pesquisa | A pesquisa actual privilegia posts e empresas; eventos/promos e sugestões/relevância podem ser reforçados | pesquisa unificada com grupos de resultados e sugestões |
| Negócio | Métricas de telefone/WhatsApp/direcções existem no modelo, mas não há camada canónica de eventos de clique | utilitário/endpoints de métricas e ligações dos botões |
| Buyer ticket | Compra sem conta e link de bilhete existem parcialmente, mas consulta segura por telefone + código, reenvio com limites e faturas não estão completas | endpoints rate-limited e recuperação controlada |
| Scanner | Validação online existe; offline seguro não existe e não deve ser prometido sem mecanismo de sincronização/conflict resolution | modo offline explícito como capacidade futura/experimental, sem bypass inseguro |
| Equipa de porta | Há código de porta, mas credenciais individuais/rotação por membro são limitadas | extensão de credenciais e trilho por operador |
| Eventos | Evento tem tipos de bilhete, mas gestão avançada de datas de venda/limites por tipo e métricas ao vivo pode ser reforçada | quotas, estado, vendas, entradas e exportações por organizador |
| Administração | Monetização, produtos, pedidos e ledger existem; campanhas, cupões e métricas de publicidade ainda não têm CRUD completo | tabs/estado persistente adicionais |
| Segurança | Demo tem hashing e isolamento de UI, mas sessão segura, 2FA, recovery, rate limiting global e RBAC backend integral continuam pendentes para produção | documentação + guardas de preview; não fingir garantia de produção |
| Dados | Alguns campos (coordenadas, horários ricos, website clicks, faturas) existem só parcialmente | completar tipos e fluxos sem duplicar entidades |

## Princípio de implementação

A extensão deve reutilizar `Business`, `EventItem`, `Promotion`, `PaymentTransaction`, `MonetizationCatalog`, `MonetizationLedgerEntry`, notificações e exportações. Nenhuma nova página isolada deve duplicar o checkout ou os dados do negócio. Os cálculos comerciais permanecem no backend e o frontend mostra apenas resultados derivados da configuração activa.


## Auditoria específica de bilhética — QR, SMS, pagamento e acesso

A revisão da especificação completa separou as capacidades em três níveis, para evitar que o preview apresente simulações como integrações comerciais concluídas.

| Capacidade | Estado no preview | Evidência ou decisão |
|---|---|---|
| QR opaco, código alfanumérico, PIN e assinatura HMAC | Implementado | O payload QR é versionado e não inclui dados pessoais; o backend verifica assinatura, expiração, estado e escopo. |
| Compra sem conta | Implementado | Checkout público usa nome e telefone; a recuperação é feita por telefone + código/PIN com resposta genérica em falha. |
| Comprador diferente do titular | Implementado | `holderName` e `holderPhone` são opcionais, mas obrigatoriamente emparelhados; o titular é usado como destino simulado de QR/link e PIN. |
| Quantidade superior a uma unidade | Implementado | Cada unidade confirmada gera ticket, QR, código e PIN distintos; a transacção guarda todos os IDs e a resposta mantém aliases legados para compatibilidade. |
| Idempotência da compra | Implementado no preview | A mesma `Idempotency-Key` devolve a mesma ordem, tickets e códigos durante o TTL configurado; em produção requer armazenamento partilhado/transaccional. |
| Taxa e monetização | Implementado | O backend recalcula a taxa com o catálogo configurável e regista `TICKET_FEE`; valores enviados pelo cliente não substituem a política activa. |
| Pagamentos Orange Money/Telecel/manual | Sandbox/manual | Os adaptadores e webhooks HMAC estão preparados; não existe ligação comercial activa sem contrato, credenciais e validação oficial da operadora. |
| Consulta e reenvio SMS | Simulado e controlado | Lookup tem limite de tentativas; reenvio tem cooldown de 60 segundos, máximo diário de 3 por telefone/bilhete e auditoria. Nenhuma mensagem real é alegada. |
| Scanner e dupla entrada | Implementado online | O backend exige autenticação/escopo, valida QR/código/PIN e bloqueia o estado `used`; o código de porta permanece compatibilidade demo. |
| Scanner offline | Bloqueado deliberadamente | Não foi criado bypass por cache local. Offline seguro requer tokens assinados por evento/dispositivo, cache cifrado, IDs idempotentes, fila e resolução de conflitos. |
| Stock, capacidade e janela de venda | Lacuna estrutural | O backend ainda não tem fonte canónica de eventos/tipos/stock; não se deve confiar nos valores do browser. Próxima evolução deve introduzir inventário transaccional, locks e limites server-side. |
| Reservas temporárias | Não activadas | Sem inventário canónico, um botão de reserva seria enganador. Deve existir estado `reserved`, expiração e limpeza backend persistente antes de ser activado. |
| Aprovação/suspensão avançada de eventos | Parcial | O frontend conserva estados básicos; faltam workflow canónico e enforcement backend de aprovação, suspensão e período de vendas. |
| Operadores individuais | Lacuna de produção | Scanner usa código de porta demo; a evolução correcta é operador por empresa/evento, permissões mínimas, rotação, expiração e `operatorId` na auditoria. |
| Cancelamento, reembolso em massa e payout hold | Preparação/documentação | Não foi criado botão falso. Requer máquina de estados financeira, lotes idempotentes, notificações a comprador/titular, reconciliação e política configurável. |

A alteração desta auditoria não remove os módulos existentes. Mantém a separação de papéis: o Super Admin governa catálogo, planos, políticas e auditoria da plataforma; operações de venda, scanner e reembolso operacional pertencem à empresa organizadora. A preparação para produção continua explicitamente distinta do comportamento demonstrável do preview.
