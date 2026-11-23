-- Módulo institucional "Sobre Nós" (plataforma Guigui.com).
--
-- Substitui o blob JSON de `023_sobre_nos.sql` por conteúdo normalizado:
-- identidade, secções de apresentação, propósito, valores, linha temporal,
-- objetivos, equipa, áreas, parceiros, contactos, redes, galeria, FAQ,
-- documentos, SEO e um histórico de publicações imutáveis.
--
-- A tabela `sobre_nos` NÃO é alterada nem apagada: os dados existentes são
-- copiados uma única vez (só quando o destino ainda está vazio) e a tabela
-- antiga fica como arquivo. Tudo aqui é idempotente.

CREATE TABLE IF NOT EXISTS institutional_profiles (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  official_name TEXT NOT NULL DEFAULT '',
  trade_name TEXT NOT NULL DEFAULT '',
  slogan TEXT NOT NULL DEFAULT '',
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  platform_info TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  favicon_url TEXT NOT NULL DEFAULT '',
  share_image_url TEXT NOT NULL DEFAULT '',
  primary_color TEXT NOT NULL DEFAULT '#0B3B37',
  secondary_color TEXT NOT NULL DEFAULT '#10b981',
  founded_year TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_purpose (
  id INTEGER PRIMARY KEY,
  mission TEXT NOT NULL DEFAULT '',
  vision TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_about_sections (
  id BIGSERIAL PRIMARY KEY,
  section_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_values (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_timeline (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  period_label TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_objectives (
  id BIGSERIAL PRIMARY KEY,
  audience TEXT NOT NULL DEFAULT 'citizens',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT institutional_objectives_audience_check CHECK (
    audience IN ('citizens', 'businesses', 'organizers', 'partners', 'quality', 'accessibility', 'transparency', 'community')
  )
);

CREATE TABLE IF NOT EXISTS institutional_team (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_departments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  responsibility TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_partners (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_contacts (
  id BIGSERIAL PRIMARY KEY,
  purpose TEXT NOT NULL DEFAULT 'institutional'
    CHECK (purpose IN ('institutional', 'support', 'commercial', 'press')),
  label TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_social_links (
  id BIGSERIAL PRIMARY KEY,
  network TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_gallery (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_faq (
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_documents (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  document_date TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_seo (
  id INTEGER PRIMARY KEY,
  seo_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT 'sobre-nos',
  og_image_url TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  no_index BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institutional_releases (
  id BIGSERIAL PRIMARY KEY,
  snapshot JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by TEXT,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS institutional_audit (
  id BIGSERIAL PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT,
  action TEXT NOT NULL,
  changed_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_releases_published_idx
  ON institutional_releases (published_at DESC);
CREATE INDEX IF NOT EXISTS institutional_audit_created_idx
  ON institutional_audit (created_at DESC);

-- Linhas únicas -------------------------------------------------------------
INSERT INTO institutional_profiles (slug) VALUES ('guigui-com')
  ON CONFLICT (slug) DO NOTHING;
INSERT INTO institutional_purpose (id, mission, vision) VALUES (1, '', '')
  ON CONFLICT (id) DO NOTHING;
INSERT INTO institutional_seo (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO institutional_about_sections (section_key, title, position) VALUES
  ('quem_somos', 'Quem Somos', 1),
  ('origem', 'Origem do projeto', 2),
  ('contexto', 'Contexto de criação', 3),
  ('problema', 'Problema que procuramos resolver', 4),
  ('publico', 'Público a quem se destina', 5),
  ('papel', 'O nosso papel no ecossistema', 6)
ON CONFLICT (section_key) DO NOTHING;

-- Migração única do blob antigo (só preenche campos ainda vazios) -----------
UPDATE institutional_profiles p SET
  official_name = CASE WHEN p.official_name = '' THEN COALESCE(s.payload->>'nomeComercial', '') ELSE p.official_name END,
  short_description = CASE WHEN p.short_description = '' THEN COALESCE(s.payload->>'descricaoCurta', '') ELSE p.short_description END,
  long_description = CASE WHEN p.long_description = '' THEN COALESCE(s.payload->>'descricaoCompleta', '') ELSE p.long_description END,
  logo_url = CASE WHEN p.logo_url = '' THEN COALESCE(s.payload->>'logo', '') ELSE p.logo_url END,
  favicon_url = CASE WHEN p.favicon_url = '' THEN COALESCE(s.payload->>'favicon', '') ELSE p.favicon_url END,
  primary_color = CASE WHEN p.primary_color = '#0B3B37' AND COALESCE(s.payload->>'primaryColor', '') <> '' THEN s.payload->>'primaryColor' ELSE p.primary_color END,
  secondary_color = CASE WHEN p.secondary_color = '#10b981' AND COALESCE(s.payload->>'secondaryColor', '') <> '' THEN s.payload->>'secondaryColor' ELSE p.secondary_color END,
  founded_year = CASE WHEN p.founded_year = '' THEN COALESCE(s.payload->>'anoFundacao', '') ELSE p.founded_year END
FROM sobre_nos s
WHERE s.slug = 'guigui-com' AND p.slug = 'guigui-com';

UPDATE institutional_purpose pu SET
  mission = CASE WHEN pu.mission = '' THEN COALESCE(s.payload->>'missao', '') ELSE pu.mission END,
  vision = CASE WHEN pu.vision = '' THEN COALESCE(s.payload->>'visao', '') ELSE pu.vision END
FROM sobre_nos s
WHERE s.slug = 'guigui-com' AND pu.id = 1;

UPDATE institutional_about_sections a SET
  body = COALESCE(s.payload->>'historia', '')
FROM sobre_nos s
WHERE a.section_key = 'origem' AND s.slug = 'guigui-com'
  AND a.body = '' AND COALESCE(s.payload->>'historia', '') <> '';

INSERT INTO institutional_contacts (purpose, label, email, phone, whatsapp, address, city)
SELECT 'institutional', 'Contacto institucional',
       COALESCE(s.payload->>'emailInstitucional', ''),
       COALESCE(s.payload->>'telefone', ''),
       COALESCE(s.payload->>'whatsapp', ''),
       COALESCE(s.payload->>'morada', ''),
       COALESCE(s.payload->>'cidade', '')
FROM sobre_nos s
WHERE s.slug = 'guigui-com' AND NOT EXISTS (SELECT 1 FROM institutional_contacts);

INSERT INTO institutional_social_links (network, label, url, icon, position)
SELECT v.network, v.label, v.url, v.network, v.position
FROM (VALUES
  ('facebook', 'Facebook', COALESCE((SELECT payload->>'facebook' FROM sobre_nos WHERE slug = 'guigui-com'), ''), 1),
  ('instagram', 'Instagram', COALESCE((SELECT payload->>'instagram' FROM sobre_nos WHERE slug = 'guigui-com'), ''), 2),
  ('tiktok', 'TikTok', COALESCE((SELECT payload->>'tiktok' FROM sobre_nos WHERE slug = 'guigui-com'), ''), 3),
  ('youtube', 'YouTube', COALESCE((SELECT payload->>'youtube' FROM sobre_nos WHERE slug = 'guigui-com'), ''), 4),
  ('linkedin', 'LinkedIn', COALESCE((SELECT payload->>'linkedin' FROM sobre_nos WHERE slug = 'guigui-com'), ''), 5)
) AS v(network, label, url, position)
WHERE v.url <> '' AND NOT EXISTS (SELECT 1 FROM institutional_social_links);

INSERT INTO institutional_values (name, description, position)
SELECT 'Valores', s.payload->>'valores', 1
FROM sobre_nos s
WHERE s.slug = 'guigui-com' AND COALESCE(s.payload->>'valores', '') <> ''
  AND NOT EXISTS (SELECT 1 FROM institutional_values);
