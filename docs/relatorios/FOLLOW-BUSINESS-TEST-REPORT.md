# Relatório de testes — Seguimento de empresas e notificações

**Projecto:** Guigui.com  
**Data:** 27/08/2026  
**Autor:** Manus AI  
**Estado:** Concluído com aprovação do conjunto automatizado

## 1. Objectivo e âmbito

Este relatório documenta a validação da funcionalidade que permite a um cidadão seguir empresas, consultar a relação na Área Pessoal e receber notificações privadas quando uma empresa seguida publica conteúdo. O âmbito inclui posts aprovados, promoções activas, eventos publicados, persistência da relação, filtros de destinatário, preferências de notificações e a separação entre mensagens directas, suporte e facturação.

A auditoria também aplicou o padrão da nova competência `payment-flow-audit` ao módulo de notificações directas. Foi identificado que `NEW_MESSAGE` usava a categoria `support`, fazendo com que a preferência de suporte controlasse indevidamente as mensagens comerciais. A categoria global `messages` foi adicionada e passou a ser usada exclusivamente por mensagens directas; `support` ficou reservado para tickets administrativos.

## 2. Alterações cobertas pelos testes

| Área | Alteração validada |
|---|---|
| Relação de seguimento | Extração da lógica para `src/utils/followers.ts`, com `toggleFollowedBusiness` e `getFollowerIdsForBusiness`. |
| Compatibilidade | O resolvedor suporta a estrutura canónica `userId → businessIds` e lê a estrutura antiga `businessId → userIds` durante a migração. |
| Notificações de empresas seguidas | Posts, promoções e eventos usam os IDs de seguidores derivados por empresa e geram destinatários privados. |
| Preferências | A categoria `messages` foi separada de `support`; o cidadão pode desligar mensagens directas sem ocultar respostas de suporte. |
| UI de notificações | A campainha e o centro empresarial apresentam mensagens directas com ícone próprio; suporte e facturação mantêm identidade independente. |
| Pagamentos | Avisos `PAYMENT_CONFIRMED` continuam na categoria `billing` e não são confundidos com mensagens. |
| Comando de testes | Foi acrescentado `npm run test:follow`, executado com `tsx`. |

## 3. Testes unitários

Os testes unitários estão em `scripts/audit-follow-notifications.ts`. São verificações determinísticas de funções puras e do construtor de notificações, sem pagamentos reais e sem chamadas a gateways externos.

| ID | Caso | Resultado esperado | Resultado |
|---|---|---|---|
| U01 | Resolver seguidores de `biz-1` no mapa canónico | Devolver `usr-1` e `usr-3` | **Passou** |
| U02 | Resolver seguidores de `biz-2` | Devolver `usr-2` e `usr-3` | **Passou** |
| U03 | Empresa inexistente | Devolver lista vazia | **Passou** |
| U04 | Adicionar novo seguimento | Preservar o seguimento existente e adicionar o novo | **Passou** |
| U05 | Remover seguimento existente | Remover apenas a empresa seleccionada | **Passou** |
| U06 | Lista com ID repetido | Deduplicar a lista depois do toggle | **Passou** |
| U07 | Estrutura legada `businessId → userIds` | Resolver utilizadores antigos sem perder compatibilidade | **Passou** |
| U08 | Post seguido para `usr-1` e `usr-3` | Criar exactamente dois avisos privados | **Passou** |
| U09 | Categoria de post seguido | Usar `followed_business` | **Passou** |
| U10 | ID do conteúdo seguido | Preservar `post-1` no aviso e no deep link | **Passou** |
| U11 | Cidadão não seguidor | Não ver o aviso de outro cidadão | **Passou** |
| U12 | Cidadão seguidor | Ver exactamente o próprio aviso | **Passou** |
| U13 | Nova mensagem directa | Usar a categoria `messages` | **Passou** |
| U14 | Mensagem directa para a empresa correcta | Ser visível para `biz-1` | **Passou** |
| U15 | Mensagem directa para outra empresa | Não ser visível para `biz-2` | **Passou** |
| U16 | Resposta de suporte | Usar a categoria `support` | **Passou** |
| U17 | Suporte com mensagens desligadas | Continuar visível ao requerente | **Passou** |
| U18 | Mensagem com preferência `messages=false` | Ficar filtrada sem apagar o histórico | **Passou** |
| U19 | Confirmação de pagamento | Permanecer em `billing` | **Passou** |
| U20 | Destinatários da confirmação | Manter avisos para payer/empresa conforme o evento | **Passou** |
| U21 | Separação semântica | Nenhum aviso de pagamento ou suporte ser categorizado como mensagem | **Passou** |

**Resultado unitário:** 21 asserções aprovadas.

## 4. Testes de integração

Os testes de integração combinam o mapa persistente de seguimentos, a resolução de seguidores, o construtor central de notificações e o filtro de visibilidade por contexto. Assim, verificam o percurso lógico completo sem depender do DOM ou de um provider de pagamento externo.

### 4.1 Publicação de empresa seguida

Foi simulado um post aprovado da empresa `biz-1`. O mapa continha `usr-1 → biz-1`, `usr-2 → biz-2` e `usr-3 → biz-1/biz-2`. O sistema criou avisos apenas para `usr-1` e `usr-3`, com `targetUserId`, `entityType=post`, `entityId=post-1` e categoria `followed_business`. O filtro rejeitou correctamente o acesso de `usr-2` e manteve o acesso de `usr-1`.

### 4.2 Mensagem directa versus suporte

Foi gerada uma mensagem directa destinada à empresa `biz-1`. O aviso recebeu categoria `messages` e ficou visível à empresa correcta, mas não a `biz-2`. Depois, a preferência de `usr-1` foi definida como `messages=false`. A mensagem foi filtrada e o ticket de suporte continuou visível, demonstrando que as duas preferências não estão acopladas.

### 4.3 Pagamento versus mensagens

Foi gerado um evento `PAYMENT_CONFIRMED` para `usr-1` e `biz-1`. Os avisos produzidos permaneceram na categoria `billing`; nenhum foi classificado como `messages` ou `support`. Esta verificação aplica o princípio de que o módulo de mensagens pode ser auditado com os mesmos controlos de destinatário, estado e semântica usados no fluxo financeiro.

## 5. Evidência funcional no browser

A validação funcional anteriormente registada no preview confirmou o seguinte percurso: João Cidadão abriu o Directório, seguiu o Restaurante Coqueiros, viu o estado mudar para “Deixar de seguir”, recarregou e confirmou “A seguir” na ficha/modal e na Área Pessoal. A publicação empresarial aprovada aumentou a lista de posts e activou a emissão destinada aos seguidores.

Também foram validados o sino de notificações, os deep links, a marcação como lida e o separador de Preferências de notificações. A separação Mensagens/Suporte foi validada no browser com formulário comercial para empresa e formulário de ticket para a Administração.

Estas evidências browser são manuais e complementam, mas não substituem, os testes automatizados. A persistência usada no preview é local/demo; não representa ainda uma entrega multiutilizador de produção.

## 6. Auditoria de regressões

| Área | Verificação | Resultado |
|---|---|---|
| TypeScript | Tipos de categorias, preferências, notificações e utilitários | **Passou** |
| Build | Bundle React/Vite e servidor Express | **Passou** |
| Persistência | Estrutura canónica e migração defensiva | **Passou nos testes de função** |
| Isolamento de cidadão | Avisos de empresa seguida não aparecem a outro cidadão | **Passou** |
| Isolamento de empresa | Mensagem directa não aparece a outra empresa | **Passou** |
| Preferências | `messages=false` não esconde suporte nem facturação | **Passou** |
| Deep link | Mensagens continuam a abrir a conversa; suporte abre o ticket | **Passou na validação funcional** |
| Pagamentos | Confirmação continua em `billing` | **Passou** |
| API | Health check do servidor | **HTTP 200 na última validação completa** |
| Consola | Erros de execução durante a validação browser | **Nenhum erro registado** |

O build apresenta apenas o aviso não bloqueante habitual do Vite sobre um chunk superior a 500 kB. Não foi introduzida qualquer dependência de gateway ou pagamento real.

## 7. Comandos executados

```text
npm run check
npm run test:follow
npm run build
GET /api/health
```

Resultado do conjunto automatizado:

```text
PASS follow-notifications: 21 assertions unitárias/integração concluídas
```

## 8. Limitações e próximos passos

O projecto não possuía anteriormente um runner Jest/Vitest nem uma suite automatizada de follows. Por isso foi criado um runner determinístico com `tsx`, adequado para funções puras e integração do construtor de notificações. Os testes não substituem uma suite de browser automatizada nem testes de base de dados concorrente.

Antes de produção, migrar `localStorage` para tabelas backend com unicidade `(user_id, business_id)`, autorização no servidor, idempotência de eventos, outbox para entrega, sessões seguras, auditoria append-only e canais reais de push/email/SMS. Adicionar testes de concorrência e de webhooks de pagamento quando existir um provider real.

## 9. Ficheiros relevantes

| Ficheiro | Função |
|---|---|
| `src/utils/followers.ts` | Regras puras de seguimento e resolução de seguidores. |
| `src/services/notificationService.ts` | Construção, destinatários, categorias e visibilidade dos avisos. |
| `src/types.ts` | Tipos globais, incluindo a categoria `messages`. |
| `src/components/NotificationPreferencesPanel.tsx` | Preferências separadas de mensagens e suporte. |
| `src/components/NotificationBell.tsx` | Ícone e apresentação de mensagens directas no sino. |
| `src/components/client/ClientNotificationsHub.tsx` | Apresentação de mensagens directas na área empresarial. |
| `scripts/audit-follow-notifications.ts` | 21 asserções unitárias e de integração. |
| `package.json` | Comando `test:follow`. |
| `/home/ubuntu/skills/payment-flow-audit/SKILL.md` | Competência reutilizável criada e validada para auditoria de pagamentos. |
