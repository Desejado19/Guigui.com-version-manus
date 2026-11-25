-- Exceções comerciais por assinatura (preço, periodicidade, limites e funcionalidades).
-- Ficam fora dos snapshots contratuais para não reescrever o histórico das renovações.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS commercial_exceptions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS subscriptions_ends_at_idx ON subscriptions(ends_at);
