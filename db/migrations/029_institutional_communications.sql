-- Comunicação institucional: comunicados, novidades, anúncios e avisos.
-- Separada do sistema de notificações operacionais: publicar aqui não envia
-- notificações em massa.

CREATE TABLE IF NOT EXISTS institutional_communications (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'comunicado',
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'draft',
  publish_at TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_communications_status_idx
  ON institutional_communications (status, publish_at DESC, id DESC);
