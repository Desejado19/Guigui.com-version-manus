-- Convites de colaboradores (administração e empresas).
--
-- Um convite é a única forma de criar um colaborador: o responsável define
-- nome, e-mail, cargo e módulos; o colaborador recebe um link com token
-- individual e define a palavra-passe ao ativar a conta.
--
-- O token nunca é guardado em claro: `token_hash` é o SHA-256 do valor enviado
-- por e-mail. O convite pode ser reenviado (novo token, mesmo registo) e a
-- unicidade parcial garante no máximo um convite aberto por e-mail e âmbito.

CREATE TABLE IF NOT EXISTS team_invitations (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('admin', 'business')),
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  job_title TEXT,
  role TEXT NOT NULL,
  access JSONB NOT NULL DEFAULT '{}'::jsonb,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'expired', 'accepted', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  send_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT team_invitations_scope_company_check CHECK (
    (scope = 'admin' AND company_id IS NULL)
    OR (scope = 'business' AND company_id IS NOT NULL)
  )
);

-- Só pode existir um convite aberto por (âmbito, empresa, e-mail).
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_open_idx
  ON team_invitations (scope, COALESCE(company_id, ''), LOWER(email))
  WHERE status IN ('pending', 'sent');

CREATE INDEX IF NOT EXISTS team_invitations_company_idx
  ON team_invitations (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS team_invitations_email_idx
  ON team_invitations (LOWER(email), created_at DESC);
