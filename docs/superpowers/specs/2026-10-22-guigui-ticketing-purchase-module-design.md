# Especificação: extração da compra de bilhetes para `ticketing`

**Estado:** proposta para revisão do utilizador
**Data:** 2026-10-22
**Escopo:** extrair o fluxo de compra de bilhetes existente para um módulo
**Compatibilidade:** preservar contratos HTTP, regras de compra e persistência

## Objetivo

Extrair o fluxo de compra de bilhetes para uma fronteira explícita
`server/modules/ticketing`, reduzindo a lógica de negócio e a composição
específica da compra em `server.ts`, sem reescrever o processo nem alterar o
comportamento observado pelos clientes.

Esta é uma migração evolutiva do monólito. Não introduz microserviços, uma nova
API pública, alteração de schema ou novos fornecedores de pagamento e entrega.

## Contexto observado

- `server.ts` contém o endpoint `POST /api/tickets/purchase`, a validação da
  requisição e da conta, a verificação de sessão, o lock/cache de idempotência,
  a auditoria, o mapeamento de respostas HTTP e a composição inline de
  dependências.
- `server/ticketPurchaseDomain.ts` calcula a cotação e verifica quantidade,
  vendas abertas e inventário disponível.
- `server/ticketPurchaseUseCase.ts` coordena consulta de oferta, reserva,
  intenção de pagamento, transação, emissão de bilhetes, confirmação da reserva
  e entrega, por meio de portas.
- `server/ticketPurchasePorts.ts`, `server/ticketCatalogService.ts`,
  `server/ticketInventoryService.ts`, `server/postgresTicketService.ts` e
  `server/ticketPurchaseDeliveryService.ts` já fornecem contratos ou
  implementações reutilizáveis.
- A compra usa os adaptadores de pagamento de
  `server/integrations/ports.ts`. Os mesmos contratos e provedores são também
  usados por APIs gerais de pagamento; essa propriedade não será transferida
  para `ticketing`.
- A política atual de taxas é calculada por
  `src/data/monetizationCatalog.ts`. A cotação de bilhetes depende atualmente
  desse módulo, apesar de ele também servir a dados da interface.
- Os testes unitários existentes cobrem domínio, caso de uso, catálogo e
  entrega. O teste Playwright `tests/ticket-purchase-modal.spec.ts` cobre parte
  do fluxo pela interface.
- O estado e as alterações locais do projeto exigem que esta extração seja
  feita em branch/worktree isolado, sem copiar segredos nem alterar a checkout
  original.

## Fronteira do módulo

Adicionar `server/modules/ticketing/` com camadas somente onde necessárias:

```text
server/modules/ticketing/
  domain/                 # regras puras de cotação e disponibilidade
  application/            # compra e contratos de dependências
  adapters/
    http/                 # endpoint e mapeamento de transporte
    ...                   # composição de catálogo, inventário e entrega
```

Os nomes e a distribuição finais podem seguir os padrões existentes; evitar
camadas ou diretórios vazios. `server.ts` continua como composition root e liga
as implementações existentes às portas do módulo.

### Responsabilidades incluídas

- Regras de cotação, quantidade e disponibilidade específicas da compra.
- Caso de uso de compra e os seus resultados tipados: confirmado, pendente ou
  rejeitado.
- Contratos necessários para catálogo, inventário, repositório de bilhetes,
  idempotência, pagamento, transações, política de taxas e entrega.
- Adaptador HTTP para `POST /api/tickets/purchase`, incluindo o mapeamento dos
  resultados para o contrato atual.
- Composição das dependências próprias da compra, reutilizando adaptadores e
  serviços existentes.

### Responsabilidades fora do escopo

- APIs gerais de pagamentos, webhooks, reconciliação, confirmação e reembolso.
- Cadastro e gestão de eventos/tipos de bilhete.
- Consulta de bilhetes próprios, reenvio de SMS, lookup, scanner, validação de
  entrada e ciclo de vida dos bilhetes.
- Login, gestão de sessão, gestão de conta e regras gerais de autenticação.
- Alterações à experiência de checkout, ao frontend ou a outras rotas.
- Migrações de dados, tabelas, schema, formato de identificadores ou fornecedor
  de persistência.

## Dependências e propriedade

- `ticketing` consome pagamentos por uma porta de intenção de pagamento; os
  adaptadores e contratos gerais de pagamentos continuam pertencentes à
  integração/contexto atual de pagamentos.
- `ticketing` consome a política de taxas por uma porta pequena e tipada. O
  adaptador de composição continua a usar `normaliseMonetizationCatalog` e
  `calculateTicketFees` da fonte atual. A extração não recalcula, altera ou
  duplica a política; elimina a dependência direta do domínio em módulos da
  interface.
- Catálogo, inventário, persistência de transações e bilhetes, idempotência e
  entrega são fornecidos por adaptadores através dos contratos do módulo.
- Continuam suportados os adaptadores PostgreSQL e JSON local existentes. Não
  alterar seleção, transações, consultas, estados ou estrutura de dados.
- `identity-access` continua responsável pela resolução da sessão. O adaptador
  HTTP da compra recebe identidade autenticada sem passar a ser proprietário de
  sessões ou autorização geral.
- Auditoria continua a usar os contratos atuais de `recordAudit`; a extração não
  cria outro sistema de auditoria.

## Fluxo e comportamento preservados

O adaptador HTTP mantém a ordem observável atual:

1. Validar o corpo da requisição e produzir os mesmos erros de validação.
2. Resolver sessão e conta; exigir uma sessão de utilizador com conta disponível.
3. Recusar emissão em produção se o segredo de assinatura de bilhetes não
   estiver configurado.
4. Validar e adquirir o lock local da chave de idempotência; reutilizar uma
   resposta em cache quando aplicável.
5. Obter oferta e cotação do lado do servidor; validar nome/categoria, preço e
   total enviados pelo cliente contra os valores atuais.
6. Executar o caso de uso de compra com dependências fornecidas pelas portas.
7. Registar os eventos de auditoria existentes e mapear o resultado para a
   resposta HTTP.
8. Libertar o lock em todos os caminhos de saída.

O caso de uso preserva os estados:

- **Inventário indisponível:** não criar intenção de pagamento; devolver
  rejeição de inventário.
- **Pagamento pendente:** persistir transação e rascunho; manter a reserva até
  ao prazo; não emitir nem entregar bilhetes; responder como pendente.
- **Pagamento falhado:** persistir transação, libertar reserva e devolver
  rejeição de pagamento.
- **Pagamento confirmado:** persistir transação e contabilização, criar e
  persistir bilhetes, confirmar inventário, atualizar transação com os bilhetes
  e tentar entrega.
- **Falha de entrega após emissão:** manter compra e bilhetes confirmados;
  comunicar os estados de falha da entrega sem reverter a emissão.
- **Erro operacional:** manter o tratamento HTTP operacional atual e não
  converter falhas de persistência ou pagamento em sucesso.
- **Idempotência:** retries da mesma identidade/chave não repetem cobrança nem
  emissão. Preservar a semântica atual do cache e lock em memória; não prometer
  coordenação distribuída ou durabilidade adicional nesta etapa.

O adaptador preserva os status, mensagens, códigos, campos e estrutura atuais
para sucesso confirmado, pagamento pendente, rejeições, validação, sessão,
política, preço, total e erros operacionais. A auditoria mantém ações,
recursos, ator, request ID e metadados existentes.

## Testes e critérios de aceitação

1. Os testes de domínio mantêm cobertura para cotação, quantidade inválida,
   vendas fechadas, inventário esgotado/insuficiente e reservas ativas.
2. Os testes do caso de uso mantêm cobertura para a ordem da compra, reserva,
   pagamentos confirmado/pendente/falhado, inventário indisponível, entrega
   falhada e retries idempotentes.
3. Os testes de catálogo, adaptadores e entrega existentes continuam a passar,
   sem remover ou enfraquecer verificações.
4. Acrescentar testes do adaptador HTTP para:
   - sessão ausente ou conta indisponível;
   - validação e incompatibilidades de categoria, preço e total;
   - chave de idempotência inválida e repetição concorrente/cacheada;
   - mapeamento de resultados confirmado, pendente e rejeitado;
   - auditoria e libertação do lock também em erro.
5. O teste Playwright existente de compra continua a validar o contrato de
   integração relevante; ajustar apenas se a extração expuser uma regressão
   comprovada.
6. `npm run test:unit`, `npm run check` e `npm run build` passam no worktree da
   implementação.
7. Não há alteração de rotas públicas, contratos, dados, tabelas, frontend,
   credenciais ou configuração de fornecedores.
8. A composição final mantém `server.ts` como composition root e não deixa
   regras de compra específicas espalhadas pelo handler.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Divergência de mensagens, códigos ou status HTTP | Regressão de checkout | Testes do adaptador para cada resultado e validação |
| Alteração da ordem reserva/pagamento/emissão | Venda sem stock, cobrança sem bilhete ou emissão indevida | Preservar ordem e testes sequenciais do caso de uso |
| Falha de notificação reverter compra confirmada | Bilhete pago deixa de estar disponível | Testar que falha de entrega conserva estado confirmado |
| Domínio continuar acoplado a tipos da interface/política de monetização | Limite de contexto nominal, não efetivo | Porta de taxas tipada e adaptador para a fonte atual |
| Extração absorver APIs gerais de pagamentos ou bilhetes | Aumento de risco e escopo | Manter explicitamente esses endpoints e responsabilidades fora |
| Alterações pendentes da checkout contaminarem a branch | Perda de trabalho ou commit misto | Implementar apenas no worktree isolado e verificar paths staged |

## Estratégia de execução

1. Verificar baseline e presença dos ficheiros necessários na branch isolada.
2. Criar testes de contrato do adaptador HTTP antes da extração.
3. Mover e adaptar domínio, caso de uso e contratos para `ticketing`, usando
   testes existentes como proteção contra alteração de regras.
4. Ligar os adaptadores atuais por composição explícita e isolar a política de
   taxas atrás da porta definida.
5. Extrair o endpoint e o seu mapeamento HTTP para o adaptador do módulo,
   mantendo a rota e os contratos públicos.
6. Executar testes direcionados, suíte unitária, verificação TypeScript e build;
   rever o diff e confirmar que nenhuma responsabilidade fora do escopo foi
   movida.

Não corrigir problemas preexistentes não relacionados, não copiar arquivos de
ambientes de trabalho concorrentes e não integrar automaticamente a branch em
`main`.
