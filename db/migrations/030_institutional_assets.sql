-- Identidade visual e media: referências e metadados dos ativos institucionais.
-- Os ficheiros continuam no armazenamento de uploads existente
-- (/uploads/institutional/); esta tabela guarda apenas referências e metadados.

CREATE TABLE IF NOT EXISTS institutional_assets (
  id BIGSERIAL PRIMARY KEY,
  asset_kind TEXT NOT NULL DEFAULT 'other',
  label TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_assets_kind_idx
  ON institutional_assets (asset_kind, position, id);
