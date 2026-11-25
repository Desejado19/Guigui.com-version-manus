-- Tokens de recuperação de palavra-passe.
--
-- O valor enviado ao utilizador nunca é guardado: apenas o hash scrypt. A
-- expiração e o consumo (`used_at`) são verificados na própria instrução que
-- altera a palavra-passe, pelo que um token expirado ou já usado não produz
-- qualquer efeito. Um novo pedido apaga os tokens anteriores do mesmo user.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx
  ON password_reset_tokens (expires_at);
