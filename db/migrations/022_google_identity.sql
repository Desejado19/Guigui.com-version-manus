-- Vínculo entre uma conta Guigui e a identidade Google (claim `sub` do ID token).
-- O índice único impede que a mesma identidade Google fique associada a mais
-- do que uma conta, sem afetar contas antigas criadas por e-mail/palavra-passe.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx
  ON users (google_sub)
  WHERE google_sub IS NOT NULL;