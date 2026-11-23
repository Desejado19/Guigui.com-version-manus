-- Políticas e documentos legais: conteúdo versionado, estado e publicação.
-- Preserva os documentos existentes (ficheiro): recebem slug vazio, conteúdo
-- vazio, versão 1.0 e estado 'published' para não desaparecerem do site.

ALTER TABLE institutional_documents
  ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS published_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS institutional_document_versions (
  id BIGSERIAL PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES institutional_documents(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT '1.0',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_document_versions_document_idx
  ON institutional_document_versions (document_id, id DESC);
