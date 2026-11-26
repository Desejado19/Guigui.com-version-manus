-- 018_location_catalog.sql
-- Catálogo central de localidades do Sector Autónomo de Bissau.
--
-- Os registos de empresas, eventos e utilizadores continuam a guardar o nome da
-- localidade em texto. Esta tabela passa a ser a fonte única dessa lista,
-- preservando as grafias antigas através de `aliases` (sem criar duplicados).
-- O seed é aplicado de forma idempotente pelo serviço da aplicação a partir de
-- `shared/bissauLocations.ts`, para que servidor e frontend partilhem a mesma
-- definição.

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  sector_order INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'bairro' CHECK (kind IN ('bairro', 'zona')),
  aliases TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Um nome canónico por localidade: impede duplicados por variação de grafia.
CREATE UNIQUE INDEX IF NOT EXISTS locations_name_unique_idx ON locations (LOWER(name));

CREATE INDEX IF NOT EXISTS locations_order_idx
  ON locations (is_active, sector_order, sort_order, name);
