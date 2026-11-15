-- 014 — RLS para todas as restantes tabelas (fase 3).
--
-- Inventário completo: após as fases 1 (012, 18 tabelas relacionais) e 2
-- (013, `app_state` + `sessions`), a base tinha 52 tabelas e 32 sem RLS.
-- Esta migração fecha o inventário. As políticas repetem os padrões já
-- validados:
--
-- 1. Utilizador/empresa dono: `user_id/business_id/company_id = app_*`
--    (tickets, support, reviews, moderation, marketing, subscriptions...),
--    com administração sempre a ver/escrever tudo.
-- 2. Catálogo: leitura pública, escrita apenas administração (como
--    `categories` na fase 1).
-- 3. Ingestão sem sessão (telemetria analítica): escrita livre de INSERT
--    (o endpoint é aberto por desenho), leitura apenas admin — como
--    `notifications_insert` na fase 1.
-- 4. Infraestrutura interna: escrita de sistema (mencionado abaixo) e
--    leitura só admin — proibindo a enumeração do papel de aplicação.
-- 5. RBAC/catálogo administrativo: apenas administração.
--
-- Escritas de infraestrutura que correm como SISTEMA (sem identidade do
-- pedido), no padrão `persistPostgresAudit` da fase 1, porque as capacidades
-- envolvidas (upsert com visibilidade de conflito, verificação de hash por
-- telemóvel pre-sessão, etc.) não são deriváveis de `app_user_id`:
--   * `review_antiabuse` (SELECT + INSERT) e a mutação de denúncia em
--     `reviews` (`flagPostgresReview`, flagging é um relato de moderação —
--     o INSERT do audit já segue este padrão);
--   * `rate_limit_buckets`, `request_metrics`, `async_jobs` (infra de
--     platform-foundation / worker: writes+claims);
--   * `payment_events` / `product_events` (ingestão: webhook/custom endpoint
--     sem sessão) — mantém-se o endpoint aberto, mas a leitura fica de
--     administração exclusiva.
-- Como o acesso corre como `postgres` (superuser), o RLS (incl. FORCE) não
-- lhe é aplicável; as políticas protegem quem corra como `guigui_app`.
--
-- Conhecido, tal como nas fases anteriores: dentro de `payload`/JSONB ou de
-- textos livres, a filtragem fina por registo continua a ser feita na camada
-- Express; aqui garante-se a fronteira dono/empresa/leitura pública.

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════
-- 1. Utilizador próprio + administração
-- ╚═══════════════════════════════════════════════════════════════

-- 1.1 MFA: factor e desafio pertencem ao utilizador
ALTER TABLE mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_factors FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mfa_factors_admin ON mfa_factors;
CREATE POLICY mfa_factors_admin ON mfa_factors FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS mfa_factors_own ON mfa_factors;
CREATE POLICY mfa_factors_own ON mfa_factors FOR ALL TO guigui_app
  USING (user_id = app_user_id() AND app_user_id() <> '')
  WITH CHECK (user_id = app_user_id() AND app_user_id() <> '');

ALTER TABLE mfa_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mfa_challenges_admin ON mfa_challenges;
CREATE POLICY mfa_challenges_admin ON mfa_challenges FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS mfa_challenges_own ON mfa_challenges;
CREATE POLICY mfa_challenges_own ON mfa_challenges FOR ALL TO guigui_app
  USING (user_id = app_user_id() AND app_user_id() <> '')
  WITH CHECK (user_id = app_user_id() AND app_user_id() <> '');

-- 1.2 user_roles: leitura própria; escrita apenas administração
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_admin ON user_roles;
CREATE POLICY user_roles_admin ON user_roles FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS user_roles_own_read ON user_roles;
CREATE POLICY user_roles_own_read ON user_roles FOR SELECT TO guigui_app
  USING (user_id = app_user_id() AND app_user_id() <> '');

-- 1.3 conversation_settings: cada utilizador as suas, e administração
ALTER TABLE conversation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_settings_admin ON conversation_settings;
CREATE POLICY conversation_settings_admin ON conversation_settings FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS conversation_settings_own ON conversation_settings;
CREATE POLICY conversation_settings_own ON conversation_settings FOR ALL TO guigui_app
  USING (user_id = app_user_id() AND app_user_id() <> '')
  WITH CHECK (user_id = app_user_id() AND app_user_id() <> '');

-- ╔═══════════════════════════════════════════════════════════════
-- 2. Empresa própria + administração
-- ╚═══════════════════════════════════════════════════════════════

-- 2.1 marketing_campaigns / marketing_promotions: da empresa
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS marketing_promotions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_campaigns_admin ON marketing_campaigns;
CREATE POLICY marketing_campaigns_admin ON marketing_campaigns FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS marketing_campaigns_business ON marketing_campaigns;
CREATE POLICY marketing_campaigns_business ON marketing_campaigns FOR ALL TO guigui_app
  USING (business_id = app_business_id() AND app_business_id() <> '')
  WITH CHECK (business_id = app_business_id() AND app_business_id() <> '');

ALTER TABLE marketing_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_promotions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_promotions_admin ON marketing_promotions;
CREATE POLICY marketing_promotions_admin ON marketing_promotions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS marketing_promotions_business ON marketing_promotions;
CREATE POLICY marketing_promotions_business ON marketing_promotions FOR ALL TO guigui_app
  USING (business_id = app_business_id() AND app_business_id() <> '')
  WITH CHECK (business_id = app_business_id() AND app_business_id() <> '');

-- 2.2 marketing_scheduled_items: publicado é público; empresa gere os seus;
-- o autor do agendamento também pode actualizar o que registou.
ALTER TABLE marketing_scheduled_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_scheduled_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_scheduled_items_admin ON marketing_scheduled_items;
CREATE POLICY marketing_scheduled_items_admin ON marketing_scheduled_items FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS marketing_scheduled_items_public_read ON marketing_scheduled_items;
CREATE POLICY marketing_scheduled_items_public_read ON marketing_scheduled_items FOR SELECT TO guigui_app
  USING (status IN ('published', 'expired'));

DROP POLICY IF EXISTS marketing_scheduled_items_business ON marketing_scheduled_items;
CREATE POLICY marketing_scheduled_items_business ON marketing_scheduled_items FOR ALL TO guigui_app
  USING (
    app_business_id() <> '' AND (
      business_id = app_business_id() OR owner_user_id = app_user_id()
    )
  )
  WITH CHECK (
    app_business_id() <> '' AND (
      business_id = app_business_id() OR owner_user_id = app_user_id()
    )
  );

-- 2.3 subscriptions: empresa + administração
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_admin ON subscriptions;
CREATE POLICY subscriptions_admin ON subscriptions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS subscriptions_business ON subscriptions;
CREATE POLICY subscriptions_business ON subscriptions FOR ALL TO guigui_app
  USING (company_id = app_business_id() AND app_business_id() <> '')
  WITH CHECK (company_id = app_business_id() AND app_business_id() <> '');

-- ╔═══════════════════════════════════════════════════════════════
-- 3. Bilhética: derivações por evento (como ticket_types na fase 1)
-- ╚═══════════════════════════════════════════════════════════════

-- 3.1 ticket_reservations: reserva criada no checkout de um evento
-- publicado; lê-se para disponibilidade no evento público e na empresa.
ALTER TABLE ticket_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_reservations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_reservations_admin ON ticket_reservations;
CREATE POLICY ticket_reservations_admin ON ticket_reservations FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS ticket_reservations_event_scope ON ticket_reservations;
CREATE POLICY ticket_reservations_event_scope ON ticket_reservations FOR ALL TO guigui_app
  USING (EXISTS (
    SELECT 1 FROM events e WHERE e.id = ticket_reservations.event_id
      AND (e.status = 'published' OR e.company_id = app_business_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM events e WHERE e.id = ticket_reservations.event_id
      AND (e.status = 'published' OR e.company_id = app_business_id())
  ));

-- 3.2 ticket_validations: apenas empresa organizadora, operador ou admin.
ALTER TABLE ticket_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_validations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_validations_admin ON ticket_validations;
CREATE POLICY ticket_validations_admin ON ticket_validations FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS ticket_validations_scope ON ticket_validations;
CREATE POLICY ticket_validations_scope ON ticket_validations FOR ALL TO guigui_app
  USING (
    (company_id = app_business_id() AND app_business_id() <> '')
    OR (operator_user_id = app_user_id() AND app_user_id() <> '')
    -- Validação registada pelo scanner offline (sem empresa preenchida).
    OR (company_id IS NULL AND operator_user_id IS NULL)
  )
  WITH CHECK (
    (company_id = app_business_id() AND app_business_id() <> '')
    OR (company_id IS NULL)
  );

-- 3.3 ticket_refunds: empresa ou requerente + administração
ALTER TABLE ticket_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_refunds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_refunds_admin ON ticket_refunds;
CREATE POLICY ticket_refunds_admin ON ticket_refunds FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS ticket_refunds_scope ON ticket_refunds;
CREATE POLICY ticket_refunds_scope ON ticket_refunds FOR ALL TO guigui_app
  USING (
    (company_id = app_business_id() AND app_business_id() <> '')
    OR (requested_by = app_user_id() AND app_user_id() <> '')
  )
  WITH CHECK (
    (company_id = app_business_id() AND app_business_id() <> '')
    OR (requested_by = app_user_id() AND app_user_id() <> '')
  );

-- 3.4 refunds + commissions: deriva a posse do pedido (como
-- payment_transactions na fase 1) via transaction_id.
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refunds_admin ON refunds;
CREATE POLICY refunds_admin ON refunds FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS refunds_scope ON refunds;
CREATE POLICY refunds_scope ON refunds FOR ALL TO guigui_app
  USING (transaction_id IN (
    SELECT pt.id FROM payment_transactions pt
    WHERE pt.order_id IN (
      SELECT o.id FROM orders o
      WHERE o.buyer_user_id = app_user_id()
         OR o.event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
    )
  ))
  WITH CHECK (transaction_id IN (
    SELECT pt.id FROM payment_transactions pt
    WHERE pt.order_id IN (
      SELECT o.id FROM orders o
      WHERE o.buyer_user_id = app_user_id()
         OR o.event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
    )
  ));

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commissions_admin ON commissions;
CREATE POLICY commissions_admin ON commissions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS commissions_scope ON commissions;
CREATE POLICY commissions_scope ON commissions FOR ALL TO guigui_app
  USING (transaction_id IN (
    SELECT pt.id FROM payment_transactions pt
    WHERE pt.order_id IN (
      SELECT o.id FROM orders o
      WHERE o.buyer_user_id = app_user_id()
         OR o.event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
    )
  ))
  WITH CHECK (transaction_id IN (
    SELECT pt.id FROM payment_transactions pt
    WHERE pt.order_id IN (
      SELECT o.id FROM orders o
      WHERE o.buyer_user_id = app_user_id()
         OR o.event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
    )
  ));

-- ╔═══════════════════════════════════════════════════════════════
-- 4. Comunicação e moderação (herança de posse)
-- ╚═══════════════════════════════════════════════════════════════

-- 4.1 message_reactions: participantes da conversa
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_reactions_admin ON message_reactions;
CREATE POLICY message_reactions_admin ON message_reactions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS message_reactions_participant ON message_reactions;
CREATE POLICY message_reactions_participant ON message_reactions FOR ALL TO guigui_app
  USING (EXISTS (
    SELECT 1 FROM conversation_messages cm JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.id = message_reactions.message_id
      AND (c.user_id = app_user_id() OR c.business_id = app_business_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversation_messages cm JOIN conversations c ON c.id = cm.conversation_id
    WHERE cm.id = message_reactions.message_id
      AND (c.user_id = app_user_id() OR c.business_id = app_business_id())
  ));

-- 4.2 moderation_submissions: submissor ou empresa + administração
ALTER TABLE moderation_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_submissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_submissions_admin ON moderation_submissions;
CREATE POLICY moderation_submissions_admin ON moderation_submissions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS moderation_submissions_own ON moderation_submissions;
CREATE POLICY moderation_submissions_own ON moderation_submissions FOR ALL TO guigui_app
  USING (
    (submitted_by = app_user_id() AND app_user_id() <> '')
    OR (company_id = app_business_id() AND app_business_id() <> '')
  )
  WITH CHECK (
    (submitted_by = app_user_id() AND app_user_id() <> '')
    OR (company_id = app_business_id() AND app_business_id() <> '')
  );

-- 4.3 moderation_submission_events: herança da submissão-mãe
ALTER TABLE moderation_submission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_submission_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_submission_events_admin ON moderation_submission_events;
CREATE POLICY moderation_submission_events_admin ON moderation_submission_events FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS moderation_submission_events_own ON moderation_submission_events;
CREATE POLICY moderation_submission_events_own ON moderation_submission_events FOR ALL TO guigui_app
  USING (EXISTS (
    SELECT 1 FROM moderation_submissions ms WHERE ms.id = moderation_submission_events.submission_id
      AND (
        (ms.submitted_by = app_user_id() AND app_user_id() <> '')
        OR (ms.company_id = app_business_id() AND app_business_id() <> '')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM moderation_submissions ms WHERE ms.id = moderation_submission_events.submission_id
      AND (
        (ms.submitted_by = app_user_id() AND app_user_id() <> '')
        OR (ms.company_id = app_business_id() AND app_business_id() <> '')
      )
  ));

-- 4.4 reviews: público (aprovadas), autor, empresa proprietária, admin.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_admin ON reviews;
CREATE POLICY reviews_admin ON reviews FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS reviews_public_read ON reviews;
CREATE POLICY reviews_public_read ON reviews FOR SELECT TO guigui_app
  USING (status = 'approved');

DROP POLICY IF EXISTS reviews_own ON reviews;
CREATE POLICY reviews_own ON reviews FOR ALL TO guigui_app
  USING (
    (author_user_id = app_user_id() AND app_user_id() <> '')
    OR (business_id = app_business_id() AND app_business_id() <> '')
  )
  WITH CHECK (
    (author_user_id = app_user_id() AND app_user_id() <> '')
    OR (business_id = app_business_id() AND app_business_id() <> '')
  );

-- ╔═══════════════════════════════════════════════════════════════
-- 5. Catálogo público + administração (como `categories` na fase 1)
-- ╚═══════════════════════════════════════════════════════════════

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_admin ON plans;
CREATE POLICY plans_admin ON plans FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS plans_public_read ON plans;
CREATE POLICY plans_public_read ON plans FOR SELECT TO guigui_app
  USING (true);

ALTER TABLE monetization_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_catalog FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monetization_catalog_admin ON monetization_catalog;
CREATE POLICY monetization_catalog_admin ON monetization_catalog FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS monetization_catalog_public_read ON monetization_catalog;
CREATE POLICY monetization_catalog_public_read ON monetization_catalog FOR SELECT TO guigui_app
  USING (true);

-- ╔═══════════════════════════════════════════════════════════════
-- 6. RBAC administrativo e auditoria de qualidade (apenas administração)
-- ╚═══════════════════════════════════════════════════════════════

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_admin ON roles;
CREATE POLICY roles_admin ON roles FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS permissions_admin ON permissions;
CREATE POLICY permissions_admin ON permissions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS role_permissions_admin ON role_permissions;
CREATE POLICY role_permissions_admin ON role_permissions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

ALTER TABLE quality_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_audit_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quality_audit_runs_admin ON quality_audit_runs;
CREATE POLICY quality_audit_runs_admin ON quality_audit_runs FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

ALTER TABLE quality_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_audit_findings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quality_audit_findings_admin ON quality_audit_findings;
CREATE POLICY quality_audit_findings_admin ON quality_audit_findings FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- ╔═══════════════════════════════════════════════════════════════
-- 7. Infraestrutura de plataforma (leitura só admin; escrita de sistema)
-- ╚═══════════════════════════════════════════════════════════════
-- As escritas correm como sistema (sem identidade), no padrão
-- `persistPostgresAudit` da fase 1: são trilhas de movimento, não dados de
-- qualquer utilizador, e o upsert nelas (`ON CONFLICT DO UPDATE`) exige que
-- o processo de escrita veja a linha — como se viu nas auditorias.

-- 7.1 rate_limit_buckets
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_buckets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limit_buckets_admin ON rate_limit_buckets;
CREATE POLICY rate_limit_buckets_admin ON rate_limit_buckets FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- 7.2 request_metrics
ALTER TABLE request_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_metrics FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS request_metrics_admin ON request_metrics;
CREATE POLICY request_metrics_admin ON request_metrics FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- 7.3 async_jobs (fila de background; reclamada por scripts/worker.ts)
ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS async_jobs_admin ON async_jobs;
CREATE POLICY async_jobs_admin ON async_jobs FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- 7.4 review_antiabuse (balde por hash de telemóvel; escrita de sistema)
ALTER TABLE review_antiabuse ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_antiabuse FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS review_antiabuse_admin ON review_antiabuse;
CREATE POLICY review_antiabuse_admin ON review_antiabuse FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- 7.5 payment_events / product_events: telemetria/ingestão sem sessão
-- (webhook de pagamentos, analytics anónimo). Escritas correm como sistema
-- (paridade com o audit_logs da fase 1) e leitura é apenas admin.
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_events_admin ON payment_events;
CREATE POLICY payment_events_admin ON payment_events FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_events_admin ON product_events;
CREATE POLICY product_events_admin ON product_events FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- 7.6 Metadados de migração: invisíveis para o papel de aplicação
-- (o migrador continua como `postgres`, que passa por cima do RLS).
ALTER TABLE guigui_schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guigui_schema_migrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guigui_schema_migrations_admin ON guigui_schema_migrations;
CREATE POLICY guigui_schema_migrations_admin ON guigui_schema_migrations FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schema_migrations_admin ON schema_migrations;
CREATE POLICY schema_migrations_admin ON schema_migrations FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

COMMIT;
