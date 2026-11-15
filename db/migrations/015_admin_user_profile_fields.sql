-- Campos administrativos do perfil de cidadão (aditivos; não alteram dados existentes).
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_role_created_at_idx ON users (role, created_at DESC);
CREATE INDEX IF NOT EXISTS users_account_status_idx ON users (account_status, created_at DESC);
