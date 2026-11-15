-- 013 — RLS para `app_state` e `sessions`.
--
-- Fase 2 do RLS: a migração 012 cobriu as tabelas relacionais do produto;
-- faltavam duas tabelas transversais essencialmente diferentes:
--
-- 1. `sessions` — tokens de sessão guardados como HMAC. Todos os acessos a esta
--    tabela acontecem pelo repositório de sessões:
--      * login/registo (bootstrap): correm com identidade de sistema
--        (`system: true` em server/ts), ou seja, como `postgres` — o
--        superuser passa por cima do RLS e nada muda para esses fluxos;
--      * `sessionContext` dentro dos handlers: corre já com a identidade
--        resolvida, portanto a linha devolvida é sempre a do próprio
--        utilizador (que é também o que a política `sessions_own` permite);
--      * logout (`revokeSession`) e troca de password
--        (`revokeAllUserSessions`): revogam as sessões do próprio utilizador;
--      * desactivar/apagar conta: administração revoga as de qualquer conta.
--    Sem RLS, qualquer compromisso do papel de aplicação enumerava
--    `token_hash` de todas as sessões; com estas políticas só o próprio
--    utilizador (ou a administração) vê as linhas de sessão.
--
-- 2. `app_state` — key/value de estado da plataforma onde convivem chaves
--    públicas, de administração, por utilizador, por empresa e colecções
--    partilhadas com filtragem em código. As políticas espelham as classes de
--    `server/platformWriteAccess.ts` (a fonte de verdade do jogo de
--    permissões), aplicando-as a nível de linha:
--      * chaves públicas: legíveis por todos, incluindo anónimo;
--      * chaves de administração exclusiva: só administração;
--      * `user_language_<userId>`: só o dono (sufixo da chave = utilizador);
--      * chaves de empresa (`guigui_payout_requests_<empresa>` etc.): só a
--        empresa dona (sufixo = app_business_id());
--      * chaves de conta (`guigui_followed_businesses`, preferências...):
--        qualquer utilizador autenticado — o conteúdo de cada utilizador
--        continua a ser filtrado pela camada Express já validada na fase 1;
--      * colecções com sessão obrigatória (conversas, encomendas, suporte...):
--        leitura só para utilizadores autenticados; a filtragem fina por
--        registo já vive na camada Express;
--    e linhas de escrita por papel que espelham `resolveAppStateWrite`:
--      * administração: tudo;
--      * empresa (com businessId): plataformas não proibidas + chaves de
--        empresa + o catálogo editável que a matriz de preços do painel da
--        empresa grava;
--      * cidadão: chaves de conta + `guigui_user_posts`/`guigui_stories`;
--      * anónimo: nada.
--
-- Nota sobre o upsert e a visibilidade: `setAppState` faz
-- `INSERT ... ON CONFLICT (key) DO UPDATE`, e sob RLS o conflito exige que a
-- linha satisfaça também a política de SELECT (o mesmo problema que motivou
-- a escrita de auditoria como sistema na fase 1). Por isso as chaves de
-- administração que a empresa edita (matriz de preços do painel da empresa,
-- `guigui_admin_category_groups` e companhia) ganham uma política de leitura
-- restrita ao papel `business` para a sua própria visibilidade de escrita —
-- a regra de produto (cidadão e anónimo nunca leem) continua a ser imposta
-- pela camada Express e pelas políticas acima.
-- `guigui_admin_business_model_config` NÃO faz parte dessa excepção: está em
-- `BUSINESS_FORBIDDEN_VALUE_KEYS` e permanece apenas administração em
-- leitura e escrita.
--
-- Sem políticas para `DELETE` de `app_state`: nenhuma rotina da aplicação
-- apaga linhas desta tabela, por isso a eliminação fica reservada à
-- administração.
--
-- LIMITAÇÃO CONHECIDA (e desenho alternativo futuro): as chaves de mapa por
-- utilizador (`guigui_followed_businesses`, `guigui_notification_preferences`,
-- `user_language_<id>`) guardam leituras de vários utilizadores na mesma linha
-- JSONB. RLS não pode separar registos dentro de um JSONB; para isso seria
-- preciso o desenho alternativo de uma tabela `user_state(user_id, key, value)`
-- com RLS `user_id = app_user_id()`. Na fase 2, as políticas garantem a
-- fronteira pública vs. autenticado vs. dono da chave (para `user_language_`
-- e chaves de empresa, que codificam o dono no próprio nome), mas o filtro
-- por utilizador dentro de mapas partilhados continua a ser feito na camada
-- Express já validada na fase 1.

BEGIN;

-- 1. Sessões: só a administração além do próprio utilizador.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sessions_admin ON sessions;
CREATE POLICY sessions_admin ON sessions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS sessions_own ON sessions;
CREATE POLICY sessions_own ON sessions FOR ALL TO guigui_app
  USING (user_id = app_user_id() AND app_user_id() <> '')
  WITH CHECK (user_id = app_user_id() AND app_user_id() <> '');

-- 2. app_state: leitura por classe de chave.
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state FORCE ROW LEVEL SECURITY;

-- Administração vê e escreve tudo.
DROP POLICY IF EXISTS app_state_admin ON app_state;
CREATE POLICY app_state_admin ON app_state FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- Chaves públicas: leitura por qualquer papel, incluindo anónimo.
DROP POLICY IF EXISTS app_state_public_read ON app_state;
CREATE POLICY app_state_public_read ON app_state FOR SELECT TO guigui_app
  USING (key IN (
    'guigui_businesses', 'guigui_events', 'guigui_promotions', 'guigui_stories',
    'guigui_user_posts', 'guigui_subscription_plans', 'guigui_monetization_catalog',
    'guigui_plans_content', 'guigui_about_content', 'guigui_faq_content', 'guigui_terms_content'
  ));

-- Chaves de idioma codificam o dono no nome: só o próprio utilizador.
DROP POLICY IF EXISTS app_state_user_language_own ON app_state;
CREATE POLICY app_state_user_language_own ON app_state FOR ALL TO guigui_app
  USING (app_user_id() <> '' AND key = 'user_language_' || app_user_id())
  WITH CHECK (app_user_id() <> '' AND key = 'user_language_' || app_user_id());

-- Chaves de empresa codificam a empresa dona no sufixo da chave.
DROP POLICY IF EXISTS app_state_business_scoped_own ON app_state;
CREATE POLICY app_state_business_scoped_own ON app_state FOR ALL TO guigui_app
  USING (
    app_business_id() <> '' AND (
      key = 'guigui_payout_requests_' || app_business_id()
      OR key = 'guigui_marketing_campaigns_' || app_business_id()
      OR key = 'guigui_marketing_segments_' || app_business_id()
      OR key = 'guigui_business_team_' || app_business_id()
      OR key = 'guigui_business_team_audit_' || app_business_id()
    )
  )
  WITH CHECK (
    app_business_id() <> '' AND (
      key = 'guigui_payout_requests_' || app_business_id()
      OR key = 'guigui_marketing_campaigns_' || app_business_id()
      OR key = 'guigui_marketing_segments_' || app_business_id()
      OR key = 'guigui_business_team_' || app_business_id()
      OR key = 'guigui_business_team_audit_' || app_business_id()
    )
  );

-- Chaves de conta (mapas partilhados): leitura e escrita só para
-- autenticados; o conteúdo de cada utilizador é filtrado na camada Express.
DROP POLICY IF EXISTS app_state_user_account_authenticated ON app_state;
CREATE POLICY app_state_user_account_authenticated ON app_state FOR ALL TO guigui_app
  USING (
    app_user_id() <> '' AND key IN (
      'guigui_followed_businesses', 'guigui_followed_business_notifications_muted',
      'guigui_notification_preferences', 'guigui_system_notifications'
    )
  )
  WITH CHECK (
    app_user_id() <> '' AND key IN (
      'guigui_followed_businesses', 'guigui_followed_business_notifications_muted',
      'guigui_notification_preferences', 'guigui_system_notifications'
    )
  );

-- Colecções com sessão obrigatória: leitura só para utilizadores
-- autenticados; a filtragem fina (conversa própria, compra própria,
-- apoio próprio) vive sempre na camada Express (`readAppStateForSession`).
DROP POLICY IF EXISTS app_state_session_required_read ON app_state;
CREATE POLICY app_state_session_required_read ON app_state FOR SELECT TO guigui_app
  USING (
    app_user_id() <> '' AND key IN (
      'guigui_conversations', 'guigui_conversation_messages',
      'guigui_support_requests', 'guigui_purchase_orders'
    )
  );

-- Visibilidade mínima para o upsert de escrita da empresa no catálogo
-- editável (política de escrita `app_state_business_platform_write` abaixo):
-- o `ON CONFLICT DO UPDATE` exige que a linha seja visível a quem escreve.
-- Não cobre `guigui_admin_business_model_config`.
DROP POLICY IF EXISTS app_state_business_config_visible ON app_state;
CREATE POLICY app_state_business_config_visible ON app_state FOR SELECT TO guigui_app
  USING (
    app_role() = 'business' AND app_business_id() <> '' AND key IN (
      'guigui_admin_category_groups', 'guigui_subscription_features',
      'guigui_feature_catalog', 'guigui_monetization_ledger', 'guigui_admin_price_audit_logs'
    )
  );

-- 3. app_state: escrita por papel (espelha `resolveAppStateWrite`).
-- Posts e histórias: qualquer utilizador autenticado (a camada Express
-- restringe a cidadãos e empresas) — são também chaves públicas em leitura.
DROP POLICY IF EXISTS app_state_user_content_write ON app_state;
CREATE POLICY app_state_user_content_write ON app_state FOR INSERT TO guigui_app
  WITH CHECK (
    app_user_id() <> '' AND key IN ('guigui_user_posts', 'guigui_stories')
  );

DROP POLICY IF EXISTS app_state_user_content_update ON app_state;
CREATE POLICY app_state_user_content_update ON app_state FOR UPDATE TO guigui_app
  USING (
    app_user_id() <> '' AND key IN ('guigui_user_posts', 'guigui_stories')
  )
  WITH CHECK (
    app_user_id() <> '' AND key IN ('guigui_user_posts', 'guigui_stories')
  );

-- Empresa: plataformas não proibidas (+ o catálogo editável que a matriz de
-- preços do painel da empresa grava). As chaves proibidas para empresa
-- (`guigui_monetization_catalog`, `guigui_subscription_plans`,
-- `guigui_admin_business_model_config`, conversas, mensagens, apoio) ficam
-- de fora — a administração escreve-as. Anónimo e cidadão não escrevem
-- aqui (fora do seu conjunto em `resolveAppStateWrite`).
DROP POLICY IF EXISTS app_state_business_platform_write ON app_state;
CREATE POLICY app_state_business_platform_write ON app_state FOR INSERT TO guigui_app
  WITH CHECK (
    app_role() = 'business' AND app_business_id() <> '' AND key IN (
      'guigui_businesses', 'guigui_events', 'guigui_promotions', 'guigui_purchase_orders',
      'guigui_admin_category_groups', 'guigui_subscription_features',
      'guigui_feature_catalog', 'guigui_monetization_ledger', 'guigui_admin_price_audit_logs'
    )
  );

DROP POLICY IF EXISTS app_state_business_platform_update ON app_state;
CREATE POLICY app_state_business_platform_update ON app_state FOR UPDATE TO guigui_app
  USING (
    app_role() = 'business' AND app_business_id() <> '' AND key IN (
      'guigui_businesses', 'guigui_events', 'guigui_promotions', 'guigui_purchase_orders',
      'guigui_admin_category_groups', 'guigui_subscription_features',
      'guigui_feature_catalog', 'guigui_monetization_ledger', 'guigui_admin_price_audit_logs'
    )
  )
  WITH CHECK (
    app_role() = 'business' AND app_business_id() <> '' AND key IN (
      'guigui_businesses', 'guigui_events', 'guigui_promotions', 'guigui_purchase_orders',
      'guigui_admin_category_groups', 'guigui_subscription_features',
      'guigui_feature_catalog', 'guigui_monetization_ledger', 'guigui_admin_price_audit_logs'
    )
  );

COMMIT;
