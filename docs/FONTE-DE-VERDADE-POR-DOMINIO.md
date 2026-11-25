# Fonte de verdade por domínio

Este documento define, por domínio, qual é a fonte de verdade e que dados são
demonstração. Regra geral: o servidor (PostgreSQL e serviços de domínio) é
autoridade; o `localStorage`/estado React é cache de apresentação, nunca prova
de titularidade nem registo financeiro.

| Domínio | Fonte de verdade | Cache no cliente | Notas |
| --- | --- | --- | --- |
| Identidade, sessão e equipas | `server/identityAccess*` + tabelas `users`, `sessions`, `team_invitations` | cookie de sessão | O `businessId` autorizado vem sempre da sessão; IDs enviados pelo cliente só são aceites se coincidirem. |
| Empresas e perfil público | `server/postgresBusinessService.ts` (`companies`) | `guigui_businesses` em app-state | `guigui_businesses` é chave pública e é convertida em DTO público. |
| Eventos e bilhetes | PostgreSQL (`events`, `tickets`, `ticket_validations`); assinatura HMAC dos bilhetes | app-state só para leitura de catálogo | Manifesto offline e sincronização de scans são filtrados por `events.company_id` da sessão. |
| Pagamentos | `payment_transactions` (PostgreSQL) + adaptadores em `server/paymentService.ts` | nenhum | Com `providerMode: "simulated"` o pagamento é explicitamente simulado: não há liquidação real. As respostas incluem `simulated`/`settlement`. |
| Monetização (ledger e carteira) | `monetizationLedger`/`monetizationWallets` + tabelas `monetization_*` | app-state só para leitura da própria empresa | O wallet é lido por `businessId` da sessão. |
| Conversas, mensagens e suporte | PostgreSQL (`conversations`, `conversation_messages`, `support_tickets`) | `guigui_conversations`, `guigui_conversation_messages`, `guigui_support_requests` | Chaves privadas: exigem sessão e são filtradas por dono/empresa no servidor. |
| Encomendas | PostgreSQL (`orders`) | `guigui_purchase_orders` | Filtradas por `buyerId`/telefone ou `businessId` da sessão. |
| Marketing e agendamentos | `scheduled_items`, `campaigns`, `promotions` (PostgreSQL) | app-state por empresa (`guigui_marketing_*`) | Criação/atualização exige que o `businessId` pertença à sessão. |
| Moderação e auditoria | `moderation_items` + `audit_logs` (PostgreSQL) | lista de moderação no painel | A identidade do ator, o timestamp e o `requestId` são gerados no servidor. Recursos simulados ficam marcados como `[SIMULAÇÃO]`/`simulated: true`. |
| Saúde e diagnóstico | `/api/health` + observabilidade interna | nenhum | Resposta pública mínima (`status`, `app`, `timestamp`); detalhes só para administração autenticada. |

## Dados demonstrativos

Contas demo (`cidadao.teste@guigui.com`, `empresa.teste@guigui.com`,
`admin.teste@guigui.com`) e os dados semeados (`docs/manual/DADOS-SEED-DEMO.md`,
`ensureDemoScheduledItems`) existem apenas para demonstração e não devem ser
apresentados como operação real. Pagamentos em modo `simulated`, envios de
e-mail/SMS simulados e o scanner de portaria em modo de desenvolvimento são
identificados como tal na interface e nas respostas da API.

Dados sintéticos não devem ser somados a métricas financeiras reais. Ao
acrescentar relatórios ou exports, excluir registos com `providerMode ===
"simulated"` ou `metadata.simulated === true` das somas de receita.
