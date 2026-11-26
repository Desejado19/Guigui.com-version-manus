# Guigui.com — Implementação do sistema de notificações

**Estado:** funcional em pré-visualização de navegador único  
**Data:** 26 de Agosto de 2026  
**Âmbito:** cidadão, empresa, administração, eventos, bilhetes, pagamentos, moderação e preferências

## 1. Resumo executivo

O Guigui.com passou a utilizar um motor central de notificações baseado em eventos, substituindo os avisos mock espalhados pela interface por um fluxo unificado:

> **Acção → Evento do sistema → Motor de notificações → Identificação dos destinatários → Canais de entrega**

Cada notificação é criada com um destinatário e um papel explícitos. O cidadão só recebe avisos ligados à sua conta ou às suas actividades; a empresa só recebe avisos ligados ao seu negócio e à sua conta empresarial; o administrador recebe avisos operacionais da plataforma. O filtro do sino e dos centros internos volta a validar o contexto antes de apresentar qualquer aviso.

A implementação cobre os quatro níveis visuais definidos no briefing: **Informação**, **Sucesso**, **Atenção** e **Crítico**. A interface apresenta também o canal de entrega, o estado lido/não lido, filtros por importância e acções para marcar ou limpar avisos.

## 2. Modelo de dados

O contrato principal encontra-se em `src/types.ts`, enquanto a geração e filtragem vivem em `src/services/notificationService.ts`.

| Campo | Finalidade |
|---|---|
| `id` | Identificador único do aviso. |
| `recipientId` | Identificador exacto do cidadão, empresa ou administrador destinatário. |
| `recipientType` | Tipo do destinatário: `USER`, `BUSINESS` ou `ADMIN`. |
| `targetUserId` / `targetBusinessId` | Relação directa com o utilizador ou negócio afectado. |
| `targetRole` | Papel permitido no centro: `user`, `business` ou `admin`. |
| `eventType` | Evento de sistema que originou o aviso. |
| `entityType` / `entityId` | Entidade funcional relacionada, como empresa, evento, bilhete, pagamento, post ou avaliação. |
| `category` | Categoria usada para preferências e filtros. |
| `priority` | Prioridade visual: `info`, `success`, `attention`, `critical`, com compatibilidade para `normal`, `high`, `urgent` e `low`. |
| `channel` / `channels` | Canal principal e canais elegíveis: `in_app`, `push`, `email` e `sms`. |
| `createdAt` | Data de criação. |
| `expiresAt` | Data opcional de expiração; avisos expirados deixam de ser apresentados. |
| `read` | Estado lido/não lido. |
| `metadata` | Contexto técnico não sensível, por exemplo código de pedido ou valor agregado. |

O motor não usa o nome, telefone ou outros dados privados de um comprador para construir avisos destinados a outro utilizador. Quando um fluxo não possui um `userId` verificável, o sistema não tenta adivinhar o cidadão destinatário.

## 3. Mapa de eventos implementado

| Evento | Destinatários | Resultado funcional |
|---|---|---|
| `WELCOME` | Cidadão autenticado | Mensagem de boas-vindas dirigida ao `userId`. |
| `BUSINESS_CREATED` | Empresa criadora e administração | Registo pendente para a empresa e pedido de validação para admin. |
| `BUSINESS_APPROVED` / `BUSINESS_REJECTED` | Empresa afectada | Resultado da verificação empresarial. Rejeição usa prioridade elevada e email elegível. |
| `DOCUMENTS_REQUIRED` / `DOCUMENTS_SUBMITTED` | Empresa ou administração, conforme a acção | Pedido de documentação à empresa e aviso administrativo quando chegam documentos. |
| `POST_SUBMITTED` | Empresa autora e administração | Publicação pendente de moderação. |
| `POST_APPROVED` / `POST_REJECTED` / `POST_NEEDS_CHANGES` | Empresa autora | Resultado da moderação da publicação. |
| `NEW_REVIEW` | Empresa avaliada | Nova avaliação recebida, sem expor dados privados do autor. |
| `REVIEW_REPORTED` | Empresa afectada e administração | Denúncia de avaliação para revisão. |
| `EVENT_SUBMITTED` | Empresa organizadora e administração | Evento fica pendente e aparece para validação administrativa. |
| `EVENT_APPROVED` / `EVENT_REJECTED` | Empresa organizadora | Resultado da aprovação do evento. |
| `EVENT_REPORTED` | Empresa organizadora e administração | Denúncia relacionada com o evento. |
| `EVENT_CANCELLED` | Compradores verificáveis e empresa organizadora | Cancelamento urgente; a empresa é notificada mesmo quando não existe comprador identificável. |
| `EVENT_REMINDER` | Cidadão com lembrete ou bilhete relacionado | Lembrete in-app e push elegível. |
| `FOLLOWED_BUSINESS_POST` | Cidadãos explicitamente relacionados | Novidade de uma empresa seguida, sem público global. |
| `FAVORITE_PROMOTION` | Cidadãos explicitamente relacionados | Nova promoção dirigida apenas ao favorito elegível. |
| `FOLLOWED_BUSINESS_EVENT` | Cidadãos explicitamente relacionados | Evento de uma empresa seguida. |
| `TICKET_PURCHASED` | Comprador, empresa organizadora e administração | Bilhete disponível para o comprador, venda para a empresa e registo operacional para admin. |
| `PAYMENT_CONFIRMED` | Pagador verificável, empresa relacionada e administração | Confirmação do pagamento sem enviar dados do pagador a terceiros. |
| `PAYMENT_FAILED` | Pagador verificável, empresa relacionada e administração | Falha de pagamento com prioridade alta/crítica. |
| `PAYMENT_REFUNDED` | Pagador verificável e relação empresarial conhecida | Reembolso processado. Sem `userId`, não é criado um aviso cidadão por adivinhação. |
| `NEW_CONTACT` / `NEW_MESSAGE` / `SUPPORT_REPLY` | Relação directa do contacto ou suporte | Mensagens privadas ficam restritas aos participantes conhecidos. |
| `LOGIN_SUSPICIOUS` / `MULTIPLE_LOGIN_ATTEMPTS` | Utilizador afectado e administração | Alertas de segurança urgentes ou críticos. |
| `BACKUP_COMPLETED` / `BACKUP_FAILED` | Administração | Estado do backup, com falha obrigatória e elegível para email/SMS. |
| `API_ERRORS` / `SMS_UNAVAILABLE` / `ANOMALOUS_REFUNDS` | Administração | Alertas operacionais críticos. |
| `SUBSCRIPTION_RENEWED` / `SUBSCRIPTION_EXPIRING` | Empresa relacionada | Estado de subscrição e facturação empresarial. |
| `EVENT_VIEWS_MILESTONE` | Empresa organizadora | Marco de visualizações para estatísticas do evento. |
| `SYSTEM_FEATURE` | Apenas destinatários opt-in explícitos | O motor deixou de criar avisos globais indiscriminados; sem `userId`, `businessId` ou `notifyAdmins`, não cria qualquer aviso. |

## 4. Segmentação e privacidade

A função `filterNotificationsForContext` aplica, por ordem, a expiração, o papel, o `targetUserId`, o `targetBusinessId`, o tipo de destinatário e as preferências de categoria. O `NotificationBell` volta a filtrar o seu próprio contexto como camada defensiva, enquanto o App utiliza os mesmos critérios para marcar como lidos ou limpar apenas os avisos visíveis.

Esta regra evita três classes de erro que o briefing explicitamente proibiu:

1. Uma nova empresa não é enviada para todos os cidadãos.
2. Uma compra de bilhete não é enviada para uma empresa errada ou para outros cidadãos.
3. O nome, telefone, pedido ou pagamento de um utilizador não é exposto através de uma notificação destinada a outra pessoa.

O evento `SYSTEM_FEATURE` também foi restringido. Uma funcionalidade geral só pode ser enviada quando o chamador fornece destinatário explícito ou uma flag administrativa de público autorizado. O valor `targetRole: all` deixou de ser usado para criar avisos gerais privados.

## 5. Prioridades e canais

O centro visualiza os avisos por importância e distingue os quatro níveis pedidos:

| Nível | Uso | Exemplos |
|---|---|---|
| **Informação** | Novidade normal ou actividade relacionada | Publicação de empresa seguida; novo evento. |
| **Sucesso** | Acção concluída | Pagamento confirmado; evento aprovado; subscrição renovada. |
| **Atenção** | Acção que requer acompanhamento | Documentos adicionais; publicação precisa de alterações; subscrição a expirar. |
| **Crítico** | Segurança, pagamentos ou indisponibilidade séria | Falha de backup; múltiplas tentativas de login; aumento anormal de reembolsos. |

O canal `in_app` fica sempre disponível no centro. Push, email e SMS são elegíveis de acordo com `channels` e com as preferências do contexto. SMS é utilizado apenas em cancelamentos, segurança, pagamentos ou falhas críticas que o justifiquem. Eventos obrigatórios ignoram a desactivação da categoria ou do canal quando a segurança, a conta, o pagamento ou a continuidade do serviço exigem entrega.

A camada `isChannelEnabled` já centraliza esta decisão. O `smsService.ts` existente continua a ser um simulador local; a pré-visualização não afirma que existe envio real para operadores móveis.

## 6. Preferências por papel

O componente reutilizável `NotificationPreferencesPanel` está disponível no Dashboard do Cidadão, nas Configurações da Empresa e no novo separador **Notificações & Preferências** da Administração.

| Papel | Categorias apresentadas | Canais |
|---|---|---|
| **Cidadão** | Conta, eventos, lembretes, empresas que segue, promoções, pedidos/bilhetes, pagamentos, suporte, segurança e sistema. | Plataforma, push, email e SMS, com SMS desligado por defeito. |
| **Empresa** | Conta empresarial, aprovação, moderação/publicações, pedidos/bilhetes, pagamentos, eventos, avaliações, promoções, suporte, estatísticas, segurança e sistema. | Plataforma, push, email e SMS, com SMS desligado por defeito. |
| **Administração** | Aprovação, moderação, eventos, alertas operacionais, pagamentos, segurança e sistema. | Plataforma, push, email e SMS. |

Conta, pagamentos e segurança aparecem bloqueados no painel. Cancelamentos críticos, falhas graves, segurança e avisos legais devem permanecer obrigatórios no backend de produção, mesmo que a experiência visual de preferências permita granularidade adicional.

As preferências são armazenadas por `userId` para cidadãos e administradores autenticados, e por identidade empresarial quando disponível. A migração defensiva cria automaticamente os valores predefinidos para perfis antigos.

## 7. Fluxos ligados ao motor

No App, os seguintes fluxos já chamam `emitSystemEvent`:

- login e onboarding, incluindo criação de empresa;
- compra de bilhete e confirmação de pagamento;
- criação de avaliação e denúncia de avaliação;
- submissão, aprovação, rejeição e pedido de alterações de publicações;
- criação e cancelamento de eventos empresariais;
- lembrete de evento em modo real/teste;
- confirmação e reembolso administrativos de pagamentos;
- backup concluído ou falhado;
- decisões de moderação sobre publicações e perfis.

A criação de eventos empresariais deixou de marcar imediatamente o evento como público: o novo `EventItem` nasce como `draft`, é persistido no estado global e gera `EVENT_SUBMITTED`. O cancelamento actualiza a lista global e gera `EVENT_CANCELLED`.

## 8. Persistência actual e evolução para produção

A pré-visualização utiliza `localStorage` para manter sessão, empresas, posts, promoções, eventos, pedidos, notificações e preferências no navegador. Isto permite testar os três perfis no mesmo ambiente e recarregar a página sem perder o estado durante o desenvolvimento.

Esta é uma decisão deliberada para a demo funcional actual, não uma substituição de uma arquitectura multiutilizador. Em produção, a evolução recomendada é:

| Área | Evolução recomendada |
|---|---|
| Armazenamento | Tabela `notifications` com `recipient_id`, `recipient_type`, `event_type`, `priority`, `channel`, `is_read`, `created_at` e `expires_at`. |
| Geração | Publicação de eventos no backend após transacções confirmadas, com idempotência por `event_id` e `entity_id`. |
| Leitura | Endpoints autenticados para listar, marcar como lido, marcar tudo como lido e limpar apenas o próprio contexto. |
| Entrega | Workers para email, push e SMS, respeitando preferências e limites de custo. |
| Segurança | Autorização server-side por papel e destinatário; o frontend nunca deve ser a única barreira. |
| Observabilidade | Logs de entrega, falhas, retries e auditoria sem conteúdo privado desnecessário. |

Portanto, o comportamento segmentado e a interface estão funcionais na pré-visualização, mas a sincronização entre navegadores e a entrega externa de canais ainda requerem a camada de produção acima.

## 9. Anúncios administrativos segmentados

O Super Admin dispõe do evento `ADMIN_ANNOUNCEMENT`, emitido pelo separador **Notificações & Preferências**. O emissor exige um público explícito: `admin`, `user` com `targetUserId`, `business` com `targetBusinessId` ou `all` para um anúncio geral. O payload guarda título, mensagem, prioridade, canais adicionais e `expiresAt`; o motor força `in_app` como canal base e rejeita destinos específicos sem identificador.

Anúncios de sistema não devem conter nomes, telefones ou outros dados privados de pessoas que não sejam o destinatário directo. Os seeds empresariais foram revistos para usar descrições genéricas em compras e avaliações.

## 10. Validação executada

Foram executados os comandos abaixo na raiz do projecto:

```bash
npm run check
npm run build
```

A verificação TypeScript passou e a compilação Vite/ESBuild de produção passou. A compilação apresentou apenas o aviso habitual de bundle JavaScript superior a 500 kB; não houve erro de build.

Também foram verificados no navegador os contextos de cidadão, empresa e administração. O cidadão demo recebeu apenas avisos destinados a `usr-1`; a empresa demo recebeu apenas avisos de `biz-1`; e o administrador recebeu o separador próprio e o painel de preferências. O sino inclui X explícito e acessível, filtros de não lidas/importantes, prioridade visível, leitura individual, leitura colectiva e limpeza contextual.

## 11. Ficheiros principais

| Ficheiro | Responsabilidade |
|---|---|
| `src/types.ts` | Tipos de papéis, destinatários, eventos, categorias, canais e preferências. |
| `src/services/notificationService.ts` | Defaults, criação de payloads, segmentação, expiração e regras obrigatórias. |
| `src/components/NotificationBell.tsx` | Sino, filtros, prioridades, leitura, limpeza e navegação. |
| `src/components/NotificationPreferencesPanel.tsx` | Preferências por papel e canais. |
| `src/components/client/ClientNotificationsHub.tsx` | Centro empresarial completo com filtros e acções. |
| `src/App.tsx` | Estado persistente e emissão de eventos nos fluxos globais. |
| `src/components/client/ClientEventsManagement.tsx` | Criação/cancelamento de eventos com callbacks para o App. |
| `src/components/AdminDashboard.tsx` | Emissão de avisos de pagamentos, backup e decisões de moderação. |
| `src/data/notificationsData.ts` | Seeds de demonstração já segmentadas por cidadão, empresa e admin. |

## 12. Conclusão

O sistema já apresenta um comportamento de Notification Center profissional e coerente com a especificação: cada aviso nasce de uma acção identificável, é dirigido ao contexto correcto, respeita prioridade e preferências, expira quando aplicável e mantém estado de leitura. A limitação conhecida está documentada: a pré-visualização é single-browser e os canais externos são simulados, devendo a futura versão de produção mover a geração e autorização para o backend.
