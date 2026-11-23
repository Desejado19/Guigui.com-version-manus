-- Identidade institucional: campos de plataforma + catálogo de serviços.
-- Aditivo e idempotente: não altera nem remove dados existentes.

ALTER TABLE institutional_profiles
  ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_language TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supported_languages TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS launch_date TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS institutional_services (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  detailed_description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutional_services_position_idx
  ON institutional_services (position, id);
