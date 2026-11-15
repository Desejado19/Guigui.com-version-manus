-- 019 — Stories: conteúdo, edição, interações, arquivo, destaques e moderação.
-- Migração aditiva. Os registos antigos em `guigui_stories` continuam intactos;
-- a nova API é a fonte de verdade para os fluxos completos e o cliente mantém
-- compatibilidade de leitura com o formato anterior.

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_role TEXT NOT NULL CHECK (owner_role IN ('business', 'admin')),
  business_id TEXT,
  business_name TEXT NOT NULL,
  business_logo TEXT,
  story_type TEXT NOT NULL CHECK (story_type IN ('image', 'video', 'text')),
  media_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 5000 CHECK (duration_ms BETWEEN 1000 AND 60000),
  background_color TEXT NOT NULL DEFAULT '#0f172a',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'limited')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'expired', 'removed', 'suspended')),
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  moderation_reason TEXT,
  moderated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
  location_name TEXT,
  action_label TEXT,
  action_url TEXT,
  share_token TEXT NOT NULL UNIQUE,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stories_public_idx
  ON stories (status, moderation_status, expires_at DESC, published_at DESC);
CREATE INDEX IF NOT EXISTS stories_owner_idx
  ON stories (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_business_idx
  ON stories (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_share_token_idx ON stories (share_token);

CREATE TABLE IF NOT EXISTS story_elements (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  element_type TEXT NOT NULL CHECK (element_type IN (
    'text', 'emoji', 'sticker', 'poll', 'question', 'quiz', 'countdown',
    'link', 'mention', 'hashtag', 'location', 'music', 'cta'
  )),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_x DOUBLE PRECISION NOT NULL DEFAULT 50,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 50,
  scale DOUBLE PRECISION NOT NULL DEFAULT 1,
  rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_elements_story_idx ON story_elements (story_id, z_index);

CREATE TABLE IF NOT EXISTS story_views (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS story_views_story_idx ON story_views (story_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS story_likes (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS story_reactions (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS story_replies (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  conversation_id TEXT,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_replies_story_idx ON story_replies (story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_poll_votes (
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL REFERENCES story_elements(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL CHECK (option_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (story_id, user_id, element_id)
);

CREATE TABLE IF NOT EXISTS story_question_responses (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  element_id TEXT NOT NULL REFERENCES story_elements(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_question_responses_story_idx
  ON story_question_responses (story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_reports (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'improper', 'false_information', 'fraud', 'spam', 'harassment', 'rights', 'other'
  )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_reports_status_idx ON story_reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS story_audit (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_audit_story_idx ON story_audit (story_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_highlights (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT,
  title TEXT NOT NULL,
  cover_story_id TEXT REFERENCES stories(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_highlights_business_idx
  ON story_highlights (business_id, position, created_at);

CREATE TABLE IF NOT EXISTS story_highlight_items (
  highlight_id TEXT NOT NULL REFERENCES story_highlights(id) ON DELETE CASCADE,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (highlight_id, story_id)
);

CREATE INDEX IF NOT EXISTS story_highlight_items_order_idx
  ON story_highlight_items (highlight_id, position);

-- Permissões granulares de moderação de Stories. O Super Admin recebe-as todas;
-- os restantes administradores só as obtêm se lhes forem atribuídas.
INSERT INTO permissions (id, name, description) VALUES
  ('perm-story-moderation', 'story_moderation', 'Consultar e moderar Stories'),
  ('perm-story-statistics', 'story_statistics_global', 'Consultar estatísticas globais de Stories')
ON CONFLICT (id) DO NOTHING;

INSERT INTO roles (id, name, description) VALUES
  ('role-super-admin', 'super_admin', 'Acesso administrativo global'),
  ('role-story-moderator', 'story_moderator', 'Moderação de Stories')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('role-super-admin', 'perm-story-moderation'),
  ('role-super-admin', 'perm-story-statistics'),
  ('role-story-moderator', 'perm-story-moderation'),
  ('role-story-moderator', 'perm-story-statistics')
ON CONFLICT DO NOTHING;

-- Atribuição inicial apenas ao administrador de demonstração; outros
-- administradores precisam de receber explicitamente o papel de moderador.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, 'role-super-admin'
FROM users u
WHERE LOWER(u.email) = 'admin.teste@guigui.com'
ON CONFLICT DO NOTHING;
