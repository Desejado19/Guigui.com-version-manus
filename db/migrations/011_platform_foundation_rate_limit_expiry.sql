ALTER TABLE rate_limit_buckets
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE rate_limit_buckets
SET expires_at = NOW()
WHERE expires_at IS NULL;

ALTER TABLE rate_limit_buckets
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS rate_limit_buckets_expiry_idx
  ON rate_limit_buckets (expires_at);
