-- Módulo Planos & Assinaturas: catálogo comercial versionado em PostgreSQL.
-- Os valores iniciais representam a configuração actual da plataforma.

CREATE TABLE IF NOT EXISTS subscription_features (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'custom',
  value_type TEXT NOT NULL DEFAULT 'flag' CHECK (value_type IN ('quota', 'flag', 'text', 'number')),
  unit TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE plans ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS benefits JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS annual_price_xof INTEGER;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS badge TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS annual_contract BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique ON plans(code) WHERE code IS NOT NULL;

CREATE TABLE IF NOT EXISTS plan_feature_configs (
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  feature_id TEXT NOT NULL REFERENCES subscription_features(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  limit_kind TEXT NOT NULL DEFAULT 'flag' CHECK (limit_kind IN ('number', 'unlimited', 'negotiated', 'flag', 'text')),
  numeric_value INTEGER,
  text_value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (plan_id, feature_id)
);

CREATE TABLE IF NOT EXISTS plan_versions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  catalog_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, version)
);

CREATE TABLE IF NOT EXISTS commercial_price_groups (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_price_matrix (
  group_id TEXT NOT NULL REFERENCES commercial_price_groups(id) ON DELETE RESTRICT,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  monthly_xof INTEGER NOT NULL CHECK (monthly_xof >= 0),
  annual_xof INTEGER NOT NULL CHECK (annual_xof >= 0),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, plan_id)
);

CREATE TABLE IF NOT EXISTS commercial_products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  product_type TEXT NOT NULL DEFAULT 'other',
  unit TEXT NOT NULL DEFAULT 'service',
  billing_model TEXT NOT NULL DEFAULT 'one_time',
  base_price_xof INTEGER NOT NULL DEFAULT 0 CHECK (base_price_xof >= 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  period_days INTEGER,
  quantity INTEGER NOT NULL DEFAULT 1,
  requires_quote BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_product_prices (
  product_id TEXT NOT NULL REFERENCES commercial_products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  duration_days INTEGER NOT NULL DEFAULT 0 CHECK (duration_days >= 0),
  price_xof INTEGER NOT NULL CHECK (price_xof >= 0),
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (product_id, quantity, duration_days)
);

CREATE TABLE IF NOT EXISTS commercial_packages (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_xof INTEGER NOT NULL CHECK (price_xof >= 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_package_items (
  package_id TEXT NOT NULL REFERENCES commercial_packages(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES commercial_products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  PRIMARY KEY (package_id, product_id)
);

CREATE TABLE IF NOT EXISTS ticket_fee_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  commission_percentage NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  fixed_fee_xof INTEGER NOT NULL DEFAULT 200 CHECK (fixed_fee_xof >= 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  fee_payer TEXT NOT NULL DEFAULT 'organizer' CHECK (fee_payer IN ('buyer', 'organizer', 'split')),
  billing_model TEXT NOT NULL DEFAULT 'percentage_plus_fixed' CHECK (billing_model IN ('percentage_plus_fixed', 'percentage_only', 'fixed_only')),
  conditions TEXT NOT NULL DEFAULT 'Aplicável por bilhete emitido.',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_fee_history (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  old_values JSONB,
  new_values JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version)
);

CREATE TABLE IF NOT EXISTS commercial_rules (
  id TEXT PRIMARY KEY DEFAULT 'default',
  annual_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 15 CHECK (annual_discount_percent >= 0 AND annual_discount_percent <= 100),
  grace_period_days INTEGER NOT NULL DEFAULT 3 CHECK (grace_period_days >= 0),
  renewal_notice_days INTEGER NOT NULL DEFAULT 7 CHECK (renewal_notice_days >= 0),
  auto_suspend_after_expiry BOOLEAN NOT NULL DEFAULT TRUE,
  auto_renewal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  allow_plan_change BOOLEAN NOT NULL DEFAULT TRUE,
  allow_extra_publications BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_post_rule INTEGER NOT NULL DEFAULT 3 CHECK (monthly_post_rule >= 0),
  terms TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_catalog_versions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT NOT NULL DEFAULT '',
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  catalog_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS commercial_audit_entity_idx ON commercial_audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_audit_created_idx ON commercial_audit_log(created_at DESC);

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'pending', 'suspended'));
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS business_id TEXT;
CREATE INDEX IF NOT EXISTS payment_transactions_business_idx ON payment_transactions(business_id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS category_group_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS contracted_price_xof INTEGER;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_type TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS catalog_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS feature_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS limits_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS contract_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS subscriptions_company_idx ON subscriptions(company_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);

INSERT INTO subscription_features (id, code, name, description, category, value_type, unit, is_active) VALUES
  ('feature-posts', 'posts', 'Publicações mensais', 'Publicações empresariais incluídas por mês.', 'conteudo', 'quota', 'publicações/mês', TRUE),
  ('feature-promotions', 'promotions', 'Promoções', 'Promoções incluídas por mês.', 'conteudo', 'quota', 'promoções/mês', TRUE),
  ('feature-categories', 'categories', 'Categorias', 'Categorias que a empresa pode associar ao perfil.', 'perfil', 'quota', 'categorias', TRUE),
  ('feature-profile-type', 'profile_type', 'Tipo de ficha empresarial', 'Ficha padrão ou expandida.', 'perfil', 'text', NULL, TRUE),
  ('feature-statistics', 'statistics', 'Estatísticas', 'Nível de estatísticas disponíveis.', 'analytics', 'text', NULL, TRUE),
  ('feature-verified-badge', 'verified_badge', 'Badge verificado', 'Selo de verificação no perfil.', 'perfil', 'flag', NULL, TRUE),
  ('feature-homepage-rotation', 'homepage_rotation', 'Rotação na homepage', 'Participação na rotação de destaques.', 'marketing', 'flag', NULL, TRUE),
  ('feature-search-priority', 'search_priority', 'Prioridade na pesquisa', 'Nível de prioridade nos resultados.', 'marketing', 'number', 'nível', TRUE),
  ('feature-reports', 'reports', 'Relatórios', 'Relatórios comerciais disponíveis.', 'analytics', 'text', NULL, TRUE),
  ('feature-additional', 'additional_features', 'Funcionalidades adicionais', 'Banner exclusivo, branding e acompanhamento dedicado.', 'comercial', 'flag', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plans (id, name, price_xof, billing_period, is_active, code, description, benefits, annual_price_xof, badge, sort_order, is_public, annual_contract, version) VALUES
  ('plan-basic', 'Básico', 5000, 'monthly', TRUE, 'basic', 'Presença essencial no directório.', '["Ficha padrão","3 publicações mensais","Estatísticas simples"]', 51000, 'Básico', 1, TRUE, FALSE, 1),
  ('plan-professional', 'Profissional', 10000, 'monthly', TRUE, 'professional', 'Ficha expandida para negócios em crescimento.', '["Ficha expandida","3 publicações mensais","1 promoção mensal","Badge verificado"]', 102000, 'Verificado', 2, TRUE, FALSE, 1),
  ('plan-premium', 'Premium', 20000, 'monthly', TRUE, 'premium', 'Maior visibilidade e acompanhamento comercial.', '["Rotação na homepage","Prioridade na pesquisa","Relatórios mensais","4 promoções mensais"]', 204000, 'Premium', 3, TRUE, FALSE, 1),
  ('plan-enterprise', 'Enterprise', 0, 'monthly', TRUE, 'enterprise', 'Condições empresariais negociadas e contrato anual.', '["Limites ilimitados","Banner exclusivo","Gestor de conta","Branding próprio"]', NULL, 'Enterprise', 4, TRUE, TRUE, 1)
ON CONFLICT (id) DO NOTHING;

UPDATE plans SET code = 'basic' WHERE id = 'plan-basic' AND code IS NULL;
UPDATE plans SET code = 'professional' WHERE id = 'plan-professional' AND code IS NULL;
UPDATE plans SET code = 'premium' WHERE id = 'plan-premium' AND code IS NULL;
UPDATE plans SET code = 'enterprise' WHERE id = 'plan-enterprise' AND code IS NULL;

INSERT INTO plan_feature_configs (plan_id, feature_id, enabled, limit_kind, numeric_value, text_value) VALUES
  ('plan-basic', 'feature-posts', TRUE, 'number', 3, NULL),
  ('plan-basic', 'feature-promotions', TRUE, 'number', 0, NULL),
  ('plan-basic', 'feature-categories', TRUE, 'number', 1, NULL),
  ('plan-basic', 'feature-profile-type', TRUE, 'text', NULL, 'standard'),
  ('plan-basic', 'feature-statistics', TRUE, 'text', NULL, 'basic'),
  ('plan-basic', 'feature-verified-badge', FALSE, 'flag', NULL, NULL),
  ('plan-basic', 'feature-homepage-rotation', FALSE, 'flag', NULL, NULL),
  ('plan-basic', 'feature-search-priority', TRUE, 'number', 0, NULL),
  ('plan-basic', 'feature-reports', TRUE, 'text', NULL, 'none'),
  ('plan-basic', 'feature-additional', FALSE, 'flag', NULL, NULL),
  ('plan-professional', 'feature-posts', TRUE, 'number', 3, NULL),
  ('plan-professional', 'feature-promotions', TRUE, 'number', 1, NULL),
  ('plan-professional', 'feature-categories', TRUE, 'number', 2, NULL),
  ('plan-professional', 'feature-profile-type', TRUE, 'text', NULL, 'expanded'),
  ('plan-professional', 'feature-statistics', TRUE, 'text', NULL, 'advanced'),
  ('plan-professional', 'feature-verified-badge', TRUE, 'flag', NULL, NULL),
  ('plan-professional', 'feature-homepage-rotation', FALSE, 'flag', NULL, NULL),
  ('plan-professional', 'feature-search-priority', TRUE, 'number', 0, NULL),
  ('plan-professional', 'feature-reports', TRUE, 'text', NULL, 'monthly'),
  ('plan-professional', 'feature-additional', FALSE, 'flag', NULL, NULL),
  ('plan-premium', 'feature-posts', TRUE, 'number', 3, NULL),
  ('plan-premium', 'feature-promotions', TRUE, 'number', 4, NULL),
  ('plan-premium', 'feature-categories', TRUE, 'number', 5, NULL),
  ('plan-premium', 'feature-profile-type', TRUE, 'text', NULL, 'expanded'),
  ('plan-premium', 'feature-statistics', TRUE, 'text', NULL, 'advanced'),
  ('plan-premium', 'feature-verified-badge', TRUE, 'flag', NULL, NULL),
  ('plan-premium', 'feature-homepage-rotation', TRUE, 'flag', NULL, NULL),
  ('plan-premium', 'feature-search-priority', TRUE, 'number', 2, NULL),
  ('plan-premium', 'feature-reports', TRUE, 'text', NULL, 'advanced'),
  ('plan-premium', 'feature-additional', TRUE, 'flag', NULL, NULL),
  ('plan-enterprise', 'feature-posts', TRUE, 'unlimited', NULL, NULL),
  ('plan-enterprise', 'feature-promotions', TRUE, 'unlimited', NULL, NULL),
  ('plan-enterprise', 'feature-categories', TRUE, 'unlimited', NULL, NULL),
  ('plan-enterprise', 'feature-profile-type', TRUE, 'text', NULL, 'expanded'),
  ('plan-enterprise', 'feature-statistics', TRUE, 'text', NULL, 'advanced'),
  ('plan-enterprise', 'feature-verified-badge', TRUE, 'flag', NULL, NULL),
  ('plan-enterprise', 'feature-homepage-rotation', TRUE, 'flag', NULL, NULL),
  ('plan-enterprise', 'feature-search-priority', TRUE, 'number', 3, NULL),
  ('plan-enterprise', 'feature-reports', TRUE, 'text', NULL, 'advanced'),
  ('plan-enterprise', 'feature-additional', TRUE, 'flag', NULL, NULL)
ON CONFLICT (plan_id, feature_id) DO NOTHING;

INSERT INTO commercial_price_groups (id, code, name, description, is_active, sort_order) VALUES
  ('restauracao', 'restauracao', 'Restauração, Cafés e Pequeno Comércio', 'Restaurantes, bares, lanchonetes, padarias e pequenas lojas.', TRUE, 1),
  ('hotelaria_saude_educacao', 'hotelaria_saude_educacao', 'Hotelaria, Clínicas, Escolas e Comércio Médio', 'Hotéis, clínicas, escolas e supermercados.', TRUE, 2),
  ('corporativo_financeiro', 'corporativo_financeiro', 'Bancos, Seguradoras, Telecoms e Construção', 'Instituições financeiras, telecomunicações e construção.', TRUE, 3),
  ('ongs_artesaos', 'ongs_artesaos', 'ONGs, Associações e Artesãos Locais', 'Organizações comunitárias, artesãos e cooperativas.', TRUE, 4),
  ('servicos_profissionais', 'servicos_profissionais', 'Serviços Profissionais e Consultoria', 'Advocacia, contabilidade, oficinas e consultoria.', TRUE, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial_price_matrix (group_id, plan_id, monthly_xof, annual_xof, discount_percent, is_active, version)
SELECT v.group_id, v.plan_id, v.monthly_xof, ROUND(v.monthly_xof * 12 * 0.85)::int, 15, TRUE, 1
FROM (VALUES
  ('restauracao','plan-basic',10000), ('restauracao','plan-professional',25000), ('restauracao','plan-premium',45000), ('restauracao','plan-enterprise',85000),
  ('hotelaria_saude_educacao','plan-basic',15000), ('hotelaria_saude_educacao','plan-professional',35000), ('hotelaria_saude_educacao','plan-premium',65000), ('hotelaria_saude_educacao','plan-enterprise',120000),
  ('corporativo_financeiro','plan-basic',35000), ('corporativo_financeiro','plan-professional',75000), ('corporativo_financeiro','plan-premium',150000), ('corporativo_financeiro','plan-enterprise',300000),
  ('ongs_artesaos','plan-basic',5000), ('ongs_artesaos','plan-professional',12000), ('ongs_artesaos','plan-premium',25000), ('ongs_artesaos','plan-enterprise',50000),
  ('servicos_profissionais','plan-basic',12000), ('servicos_profissionais','plan-professional',28000), ('servicos_profissionais','plan-premium',50000), ('servicos_profissionais','plan-enterprise',95000)
) AS v(group_id, plan_id, monthly_xof)
ON CONFLICT (group_id, plan_id) DO NOTHING;

INSERT INTO commercial_products (id, code, name, description, product_type, unit, billing_model, base_price_xof, currency, period_days, quantity, requires_quote, is_active, is_public, version) VALUES
  ('product-post-extra', 'POST_EXTRA', 'Post Extra', 'Publicação adicional acima da quota do plano.', 'extra_posts', 'post', 'one_time', 5000, 'XOF', NULL, 1, FALSE, TRUE, TRUE, 1),
  ('product-promotion-extra', 'PROMOTION_EXTRA', 'Promoção Extra', 'Promoção adicional acima da quota do plano.', 'extra_promotions', 'promotion', 'one_time', 10000, 'XOF', NULL, 1, FALSE, TRUE, TRUE, 1),
  ('product-homepage-banner', 'HOMEPAGE_BANNER', 'Banner Rotativo na Homepage', 'Exibição premium numa posição publicitária da homepage.', 'advertising', 'week', 'per_day', 50000, 'XOF', 7, 1, FALSE, TRUE, TRUE, 1),
  ('product-week-promotion', 'WEEK_PROMOTION', 'Promoção da Semana', 'Destaque comercial de duração limitada.', 'advertising', 'week', 'per_week', 30000, 'XOF', 7, 1, FALSE, TRUE, TRUE, 1),
  ('product-push-campaign', 'PUSH_CAMPAIGN', 'Campanha de Notificações Push', 'Campanha segmentada sujeita a consentimento.', 'push_campaign', 'campaign', 'quote', 50000, 'XOF', 3, 1, TRUE, TRUE, TRUE, 1),
  ('product-ticket-fee', 'TICKET_FEE', 'Taxa de Bilheteira', 'Comissão e taxa fixa por bilhete emitido.', 'ticket_fee', 'ticket', 'percentage_plus_fixed', 0, 'XOF', NULL, 1, FALSE, TRUE, FALSE, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial_product_prices (product_id, quantity, duration_days, price_xof, label) VALUES
  ('product-post-extra', 1, 0, 5000, '+1 post'),
  ('product-post-extra', 5, 0, 8000, '+5 posts'),
  ('product-post-extra', 10, 0, 15000, '+10 posts'),
  ('product-post-extra', 25, 0, 30000, '+25 posts'),
  ('product-promotion-extra', 1, 0, 10000, '+1 promoção'),
  ('product-promotion-extra', 5, 0, 40000, '+5 promoções'),
  ('product-promotion-extra', 10, 0, 75000, '+10 promoções'),
  ('product-homepage-banner', 1, 7, 50000, '7 dias'),
  ('product-homepage-banner', 1, 30, 80000, '30 dias'),
  ('product-week-promotion', 1, 7, 30000, '7 dias'),
  ('product-push-campaign', 1, 3, 50000, 'Campanha de 3 dias')
ON CONFLICT (product_id, quantity, duration_days) DO NOTHING;

INSERT INTO ticket_fee_settings (id, commission_percentage, fixed_fee_xof, currency, fee_payer, billing_model, conditions, is_active, version)
VALUES ('default', 10, 200, 'XOF', 'organizer', 'percentage_plus_fixed', 'Aplicável por bilhete emitido via SMS ou gateway, retida na liquidação.', TRUE, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ticket_fee_history (id, version, old_values, new_values, changed_by, reason)
SELECT 'ticket-fee-v1', 1, NULL, to_jsonb(t), 'Sistema Guigui', 'Configuração inicial da taxa de bilheteira.'
FROM ticket_fee_settings t WHERE t.id = 'default'
ON CONFLICT (version) DO NOTHING;

INSERT INTO commercial_rules (id, annual_discount_percent, grace_period_days, renewal_notice_days, auto_suspend_after_expiry, auto_renewal_enabled, allow_plan_change, allow_extra_publications, monthly_post_rule, terms, version)
VALUES ('default', 15, 3, 7, TRUE, FALSE, TRUE, TRUE, 3, 'A renovação mantém a fotografia contratada até à confirmação do novo período. O desconto anual aplica-se a pagamentos antecipados.', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial_catalog_versions (id, version, reason, changed_by, snapshot)
SELECT 'catalog-v1', 1, 'Configuração inicial do catálogo comercial.', 'Sistema Guigui', jsonb_build_object('plans', (SELECT COUNT(*) FROM plans), 'features', (SELECT COUNT(*) FROM subscription_features), 'groups', (SELECT COUNT(*) FROM commercial_price_groups), 'products', (SELECT COUNT(*) FROM commercial_products))
ON CONFLICT (version) DO NOTHING;

INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
SELECT 'plan-basic-v1', id, version, to_jsonb(p), 'Sistema Guigui', 'Versão inicial do plano.', 1 FROM plans p WHERE id = 'plan-basic'
ON CONFLICT (plan_id, version) DO NOTHING;
INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
SELECT 'plan-professional-v1', id, version, to_jsonb(p), 'Sistema Guigui', 'Versão inicial do plano.', 1 FROM plans p WHERE id = 'plan-professional'
ON CONFLICT (plan_id, version) DO NOTHING;
INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
SELECT 'plan-premium-v1', id, version, to_jsonb(p), 'Sistema Guigui', 'Versão inicial do plano.', 1 FROM plans p WHERE id = 'plan-premium'
ON CONFLICT (plan_id, version) DO NOTHING;
INSERT INTO plan_versions (id, plan_id, version, snapshot, changed_by, reason, catalog_version)
SELECT 'plan-enterprise-v1', id, version, to_jsonb(p), 'Sistema Guigui', 'Versão inicial do plano.', 1 FROM plans p WHERE id = 'plan-enterprise'
ON CONFLICT (plan_id, version) DO NOTHING;
