# Módulos Segurança, Relatórios e Exportação — reestruturação

Documento técnico da reestruturação dos três módulos do painel empresarial.
Descreve o diagnóstico, as alterações, as APIs, os testes e o que ficou pendente.

## 1. Diagnóstico do estado anterior

| Módulo | Estado encontrado | Problema |
| --- | --- | --- |
| Segurança | Item de navegação "Segurança" abria a tab `settings`, que renderiza `ClientSettingsHub`. As sub-tabs "Segurança e Privacidade" e "Configurações" eram placeholders; havia estados de palavra-passe declarados, mas nenhum formulário funcional. | Nenhuma listagem de sessões, nenhum histórico de segurança, nenhuma acção real de protecção da conta. |
| Relatórios | Não existia tab própria. A tab `analytics` mostrava gráficos com séries fixas (`dailySalesData` em `BusinessDashboard.tsx`). | Indicadores simulados, sem filtros de data, sem origem identificada nem exportação. |
| Exportação | `ClientExportHub` (≈1545 linhas) já gerava CSV/XLSX/PDF por conjunto de dados com `utils/exportHelpers`. | Sem histórico de operações, sem integração com relatórios, sem indicação de responsável. |

Backend: `sessions` já tinha `ip_address`, `user_agent`, `created_at`, `expires_at`, `revoked_at`;
`revoke-all` e `change-password` já existiam; `audit_logs` já registava as operações sensíveis
(`persistPostgresAudit`). Faltava apenas expor as sessões e a trilha de auditoria da própria conta.

## 2. Alterações por módulo

### 2.1 Segurança — `src/components/client/ClientSecurityHub.tsx` (novo)

Tab `security`, item de navegação "Segurança". Quatro secções (submodule navbar):

1. **Proteção da conta** — formulário real de alteração de palavra-passe (`POST /api/auth/change-password`),
   indicação do fluxo de recuperação existente (`request-password-reset` / `reset-password`),
   checklist de verificação derivada de dados reais (sessões, auditoria) e explicação honesta de que
   o 2FA só existe para contas de administração — não há interruptor inactivo a sugerir protecção falsa.
2. **Sessões e dispositivos** — lista de sessões activas com navegador/sistema inferidos do user-agent,
   data de início, último acesso, IP quando registado, selo "Sessão actual", encerramento individual
   (`DELETE /api/auth/sessions/:id`) e encerramento de todas (`POST /api/auth/sessions/revoke-all`).
3. **Histórico de segurança** — `GET /api/security/events` (tabela `audit_logs`, filtrada por
   `actor_user_id` da sessão), com rótulos legíveis, resultado sucesso/falha, pesquisa e paginação 20.
4. **Alertas** — derivados de dados reais: tentativas falhadas, mais de uma sessão activa, dispositivo
   novo nas últimas 24h, existência ou não de alteração de palavra-passe registada, e recomendações.

A gestão de funções dos funcionários não foi duplicada: continua em `Equipa e permissões`.

### 2.2 Relatórios — `src/components/client/ClientReportsHub.tsx` (novo)

Tab `reports`, item "Relatórios". Sete categorias: comercial, financeiro, clientes, eventos e bilhetes,
marketing, operações, equipa. Para cada uma há indicadores, tabela detalhada, pesquisa e exportação.

Fontes reais: `purchaseOrders` da empresa (já carregadas pelo painel), `/api/tickets/sold`,
`/api/payments/transactions?businessId=…`, eventos, publicações, campanhas e `teamAudit`.
As interacções de marketing vêm do `PostEngagementProvider` (curtidas, comentários e partilhas reais);
o alcance **não** é apresentado porque o sistema não mede impressões.

Funcionalidades: presets de período (7/30/90 dias, ano, tudo, intervalo personalizado), comparação com
o período anterior (variação %), actualização manual, tabelas com paginação 20, origem do indicador
visível em cada tabela, e exportação directa em CSV/XLSX/PDF. Cada exportação entra no histórico
partilhado do módulo de Exportação. A tab `analytics` antiga com dados fixos ficou intacta mas deixou de
ser o caminho para relatórios.

### 2.3 Exportação — `src/components/client/ClientExportHub.tsx` (alterado)

Mantidos todos os conjuntos de dados, filtros e geradores existentes. Acrescentado:

* Secção **Histórico de exportações** (ficheiro, categoria, formato, registos, responsável, data, estado)
  alimentada por `src/utils/exportHistory.ts`, isolada por empresa (`guigui_export_history_<businessId>`)
  e limitada às 60 operações mais recentes.
* Registo automático em cada download individual e no livro Excel completo.
* Prop `currentUser` para identificar o responsável.
* Relatórios enviam pedidos de geração directamente para este histórico (integração módulo 4).

### 2.4 Integração e navegação

`src/config/businessModules.ts` ganhou os módulos `reports` e `security` (com submodules) e o módulo
`settings` passou a "Configurações da conta" (mantém preferências de notificação). `ModuleHeader`
recebeu os ícones. As traduções `businessNavReports`, `businessNavSecurity`,
`businessNavAccountSettings` (+ `…Help`) foram adicionadas em pt/en/fr/es.

## 3. APIs

| Método | Rota | Autenticação | Descrição |
| --- | --- | --- | --- |
| GET | `/api/auth/sessions` | sessão | Sessões activas do próprio utilizador; `current` marca a sessão do pedido. `no-store`. |
| DELETE | `/api/auth/sessions/:id` | sessão | Revoga apenas sessões do próprio utilizador (404 caso contrário) e registra `session_revoked` na auditoria. |
| GET | `/api/security/events?limit=40` | sessão | Últimos eventos de `audit_logs` do utilizador autenticado (`source: "audit_logs"`). |

Implementação: `listUserSessions` / `revokeUserSessionById` em
`server/modules/identity-access/infrastructure/sessionRepository.ts`, exportadas pelo módulo
`identity-access`. Não houve alteração de esquema: as tabelas `sessions` e `audit_logs` existentes
passaram a ser lidas. O isolamento é feito sempre por `context.userId` da sessão, nunca por parâmetro
do cliente.

## 4. Testes

`tests/business-security-reports.spec.ts` — 4 testes, todos verdes:

1. **API** — sessões exigem sessão (401); listagem devolve exactamente uma sessão actual; uma sessão
   inexistente responde 404; a conta empresarial **não** consegue revogar a sessão do administrador
   (404) e a sessão do administrador continua válida; histórico exige sessão; alteração de
   palavra-passe com password actual errada é recusada pelo servidor.
2. **UI Segurança** — cabeçalho do módulo, sub-tabs, selo "Sessão actual", botão de encerrar todas,
   histórico com origem `audit_logs`, alertas e recomendações.
3. **UI Relatórios** — indicadores calculados a partir dos dados reais, mudança de período,
   download CSV real do relatório e registo no histórico de exportações; download CSV de um conjunto
   de dados e nova linha no histórico.
4. **Navegação** — Relatórios → "Abrir Exportação", Segurança e Configurações da conta.

Verificações adicionais executadas: `npx tsc --noEmit` limpo em `src/` (só permanece o erro
pré-existente do ficheiro `tests/client-settings-hub.spec.ts`, que não foi alterado) e `npm run build`
com sucesso.

## 5. Funcionalidades ainda pendentes

* **2FA para contas empresariais** — só existe para administração; implementar exigiria novo fluxo
  de segredo/TOTP e endpoints próprios. Não foi simulado na interface.
* **Histórico de exportações no servidor** — actualmente é local por empresa/dispositivo. Um histórico
  multi-dispositivo exige tabela própria e endpoints com paginação e política de retenção.
* **Ficheiros exportados disponibilizados para descarregamento posterior** — os ficheiros são gerados no
  browser; guardar cópias exigiria armazenamento de objectos e URLs assinados.
* **Localização aproximada das sessões** — o sistema guarda IP mas não faz geolocalização; a coluna
  permanece ausente em vez de inventada.
* **Limites de frequência nas exportações** — a exportação é local; para um limite real é necessário
  mover a geração para o servidor. O módulo já identifica o responsável e mantém histórico auditável.
* **`analytics` antiga** com séries fixas (`dailySalesData`) continua a existir; substituí-la por dados
  reais ou removê-la é um passo separado, para não alterar navegação existente sem validação.
