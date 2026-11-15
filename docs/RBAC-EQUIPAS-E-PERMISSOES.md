# Equipas, acessos e permissões (RBAC)

Documentação técnica da gestão de utilizadores, acessos e permissões por módulos
no Guigui.com, para empresas e para a equipa administrativa da plataforma.

## 1. Diagnóstico anterior

| Área | Estado encontrado |
| --- | --- |
| Contas de colaboradores | Existia convite (`/api/business/team/invitations`) com cinco permissões booleanas (`profile`, `content`, `events`, `tickets`, `billing`). A lista de equipa vivia em `localStorage` (`guigui_business_team_<biz>`), sem vínculo real na base de dados. |
| Autorização backend | As rotas empresariais só validavam `requireRole('business')`. Não havia verificação de módulo nem de permissão: um colaborador autenticado podia chamar qualquer API da empresa. |
| Suspensão | O estado "suspenso" era apenas visual no painel; não impedia login nem encerrava sessões. |
| Persistência | `company_members` existia (com `member_role`, `permissions`), mas `postgresIdentityRepository` não lia função nem permissões; após login o utilizador perdia o contexto de colaborador. `users` não tinha estado de acesso nem cargo. |
| Administração | `AdminStaffManagement` e a matriz de permissões usavam `initialAdminStaff` (dados estáticos). Nenhuma conta administrativa secundária era real. |

## 2. Modelo implementado

**Catálogo único** — `src/config/teamAccess.ts` (importado pelo frontend e pelo servidor):

* Módulos empresariais (18) e administrativos (17), cada um com as acções que suporta.
* Acções granulares: `view`, `create`, `edit`, `delete`, `approve`, `reject`, `publish`, `export`, `manage`.
* Funções predefinidas (modelos):
  * Empresa: Gestor, Financeiro, Marketing, Gestor de eventos, Atendimento ao cliente, Personalizado.
  * Administração: Administrador geral, Gestor de operações, Moderador, Gestor financeiro, Gestor de suporte, Analista, Colaborador administrativo.
* Funções de normalização (`normalizeTeamAccess`), verificação (`hasModuleAccess`, `canPerformAction`) e compatibilidade com as cinco permissões legadas (`accessFromLegacyPermissions`, `legacyPermissionsFromAccess`).

**Representação** — mapa `{ [moduleId]: TeamAction[] }` guardado em JSON:

* `company_members.access` (empresa) com `permissions` legado derivado;
* `users.access_permissions` (equipa administrativa);
* `users.access_status` e `company_members.status`: `active`, `pending`, `suspended`, `disabled`.

**Titular vs colaborador**: a conta titular (`companies.owner_user_id`, ou vínculo sem permissões explícitas) mantém acesso total. Só contas com acesso explícito (novo mapa ou permissões legadas preenchidas) são restringidas — as contas antigas não perderam acesso.

## 3. Base de dados

Migração `db/migrations/020_team_access_control.sql` (aditiva e idempotente):

* `users`: `access_status`, `job_title`, `access_permissions`, `access_preset` + CHECK de estado.
* `company_members`: `permissions`, `access`, `status`, `job_title`, `invited_by`, `updated_at`; `member_role` passa a aceitar `owner`/`custom`.
* Tabela `access_changes` (actor, alvo, empresa, âmbito, acção, antes/depois, data) para auditoria dedicada de acessos.

Aplicada com `npm run db:migrate`.

## 4. APIs

| Método | Rota | Quem | Descrição |
| --- | --- | --- | --- |
| GET | `/api/business/team/members` | empresa | Colaboradores com função, cargo, estado e acesso granular. |
| POST | `/api/business/team/members` | titular ou `team.manage` | Cria conta real (password com hash), vínculo e permissões. 409 em e-mail duplicado. |
| PATCH | `/api/business/team/members/:userId` | titular ou `team.manage` | Altera função, cargo, acesso, estado e palavra-passe. Suspender/desactivar revoga todas as sessões. Titular protegido (`OWNER_PROTECTED`). |
| DELETE | `/api/business/team/members/:userId` | titular ou `team.manage` | Remove o vínculo e desactiva a conta; revoga sessões. |
| GET | `/api/business/team/activity` | empresa | Histórico de alterações de acesso (`access_changes`). |
| GET | `/api/me/access` | sessão | Acesso efectivo (empresa ou admin), usado pelo painel para navegação. |
| GET/POST/PATCH/DELETE | `/api/admin/team/members[/:userId]` | admin | Contas administrativas reais com módulos; administrador principal protegido. |

**Autorização central** — middleware `app.use('/api', …)` com duas tabelas de regras
(`BUSINESS_API_RULES`, `ADMIN_API_RULES`): prefixo → módulo → acção por método HTTP.
Aplica-se apenas a contas restringidas; responde `403 { code: 'MODULE_FORBIDDEN', module }`
e registra `authorization_denied` na auditoria. Cobre marketing, perfil, bilhetes,
transacções financeiras, monetização, equipa, segurança/sessões, exportação e os
prefixos administrativos (utilizadores, empresas, auditoria, moderação, financeiro,
categorias, plano/preços, equipa).

**Autenticação** — login recusa contas `suspended` (`ACCESS_SUSPENDED`) e `disabled`
(`ACCESS_DISABLED`); o utilizador devolvido inclui `teamAccess`, `adminAccess`,
`jobTitle` e `accessStatus`.

## 5. Interface

* **Equipa e permissões** (`TeamAccessHub`): criar/editar colaborador com nome, e-mail,
  palavra-passe inicial, cargo, função predefinida e matriz de módulos × acções;
  pesquisa, filtro por estado, paginação 20, badges de estado, chips de módulos,
  suspender/reactivar, remover e histórico de alterações. Substitui a lista em
  `localStorage`.
* **Navegação empresarial**: só aparecem os módulos autorizados (sidebar e barra
  inferior móvel). `activeTab` é calculado a partir de `/api/me/access`; um acesso
  directo a um módulo bloqueado mostra o painel "Acesso não autorizado" e conteúdo
  oculto, em vez de renderizar dados.
* **Administração**: a área "Equipa" abre `AdminTeamHub` (contas reais, matriz de
  módulos, suspender/revogar). A lista usada pela matriz de permissões e pelos
  resumos passou a vir de `/api/admin/team/members`; as edições da matriz são
  persistidas via API. A navegação administrativa filtra os módulos quando a conta
  tem `adminAccess` restrito.

## 6. Segurança

* Passwords com `hashPassword` (scrypt) no servidor; nunca devolvidas.
* Isolamento por empresa: `businessId` vem sempre do utilizador da sessão, nunca do corpo.
* Colaborador não pode alterar/remover o titular nem revogar sessões de outra conta.
* Suspensão/remoção encerra sessões activas (`revokeAllSessions`).
* Cada alteração de acesso fica em `access_changes` e `audit_logs` (actor, alvo, antes/depois).
* O servidor valida tudo: o cliente só oculta; a API responde 403 em chamadas directas.

## 7. Testes

`tests/team-access.spec.ts` — 3 testes verdes:

1. **API**: criação real, duplicação recusada, login do colaborador, acesso granular,
   403 em bilhetes/financeiro/equipa, alteração de permissões com efeito imediato,
   proibição de revogar sessão do titular, suspensão (login 403 + sessão 401),
   reactivação, remoção e titular protegido.
2. **UI criação**: criar colaborador pela interface, verificar módulos reais na API,
   pesquisa e filtro por estado funcionais.
3. **UI navegação**: colaborador vê apenas Marketing/Stories, não vê Bilhetes,
   Clientes, Equipa, Relatórios, Exportação nem Segurança; abre Marketing; API
   financeira devolve 403 `MODULE_FORBIDDEN`.

Verificações complementares executadas: `npx tsc --noEmit` limpo em `src/` (mantém-se
apenas o erro pré-existente em `tests/client-settings-hub.spec.ts`), `npm run build`
com sucesso e regressão de `tests/business-security-reports.spec.ts` +
`tests/business-profile.spec.ts` (10 verdes). Um script de fumo API correu 29
verificações do RBAC com sucesso antes de ser removido.

## 8. Pendentes

* **Convite por e-mail**: o fluxo antigo de convite mantém as cinco permissões; migrá-lo
  para o mapa de módulos e e-mail transaccional exige um serviço de e-mail.
* **Interface administrativa de permissões antiga**: a matriz (`AdminPermissionsMatrix`)
  continua a mapear oito booleanos para módulos; os módulos reais são geridos em
  "Equipa". Unificar a matriz elimina a duplicação conceptual.
* **Sessões ao alterar permissões**: hoje a API aplica no pedido seguinte; para forçar
  re-login após alterações de módulos, basta revogar sessões (decisão de produto).
* **Histórico de acessos administrativo** por empresa ainda não tem ecrã próprio na
  administração (os dados existem em `access_changes`).
* **Limite de tentativas de autenticação** continua a cargo do mecanismo existente,
  não foi alterado nesta iteração.
