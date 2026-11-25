-- Despublicação do site institucional.
--
-- A publicação continua a ser uma release imutável em `institutional_releases`.
-- Despublicar não apaga nem altera a release: marca-a como retirada, mantendo o
-- histórico e permitindo republicar mais tarde sem perder conteúdo.
ALTER TABLE institutional_releases
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_by TEXT;

-- A release activa é a mais recente não retirada; este índice serve essa leitura.
CREATE INDEX IF NOT EXISTS institutional_releases_active_idx
  ON institutional_releases (published_at DESC, id DESC)
  WHERE withdrawn_at IS NULL;

-- Uma publicação substitui a anterior: nunca ficam duas releases ativas.
-- Corrige estados antigos e é idempotente (com uma só ativa não altera nada).
UPDATE institutional_releases
   SET withdrawn_at = now(), withdrawn_by = COALESCE(withdrawn_by, 'migration-032')
 WHERE withdrawn_at IS NULL
   AND id <> (SELECT id FROM institutional_releases
               WHERE withdrawn_at IS NULL
               ORDER BY published_at DESC, id DESC LIMIT 1);
