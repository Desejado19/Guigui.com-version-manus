-- Controlo de acesso por módulos e acções (RBAC) para empresas e administração.
--
-- users.access_status      estado de acesso independente do estado da conta
-- users.job_title          cargo/função do colaborador
-- users.access_permissions acesso por módulo de um membro da equipa admin (JSONB)
-- company_members.*        vínculo do colaborador à empresa: função, estado,
--                          permissões legadas e acesso granular por módulo.
--
-- As colunas são aditivas e todas opcionais: contas existentes continuam a
-- funcionar como titulares (acesso total) até serem explicitamente restringidas.

ALTER TABLE users ADD COLUMN IF NOT EXISTS access_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_permissions JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_preset TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_access_status_check;
ALTER TABLE users ADD CONSTRAINT users_access_status_check
  CHECK (access_status IS NULL OR access_status IN ('active', 'pending', 'suspended', 'disabled'));

ALTER TABLE company_members ADD COLUMN IF NOT EXISTS permissions JSONB;
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS access JSONB;
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS invited_by TEXT;
ALTER TABLE company_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_member_role_check;
ALTER TABLE company_members ADD CONSTRAINT company_members_member_role_check
  CHECK (member_role IN ('owner', 'manager', 'editor', 'finance', 'support', 'custom'));

ALTER TABLE company_members DROP CONSTRAINT IF EXISTS company_members_status_check;
ALTER TABLE company_members ADD CONSTRAINT company_members_status_check
  CHECK (status IN ('invited', 'pending', 'active', 'suspended', 'disabled'));

CREATE INDEX IF NOT EXISTS company_members_company_status_idx
  ON company_members (company_id, status);

-- Rastreio dedicado das alterações de acesso (para além da trilha geral em
-- audit_logs), com o responsável pela alteração e o antes/depois.
CREATE TABLE IF NOT EXISTS access_changes (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  company_id TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('business', 'admin')),
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS access_changes_company_idx
  ON access_changes (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS access_changes_target_idx
  ON access_changes (target_user_id, created_at DESC);
