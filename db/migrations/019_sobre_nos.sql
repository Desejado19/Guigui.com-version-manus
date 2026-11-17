-- Sobre Nós (página institucional do Guigui.com)
-- Um único registo por slug, com rascunho (payload) e versão publicada (published_payload).

CREATE TABLE IF NOT EXISTS sobre_nos (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_payload JSONB,
  is_draft BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sobre_nos_history (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  payload JSONB NOT NULL,
  action TEXT NOT NULL,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sobre_nos_history_slug_created ON sobre_nos_history (slug, created_at DESC);
