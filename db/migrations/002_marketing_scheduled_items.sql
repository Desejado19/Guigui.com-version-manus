CREATE TABLE IF NOT EXISTS marketing_scheduled_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  owner_user_id TEXT,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  label TEXT,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Africa/Bissau',
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  moderation_status TEXT,
  payment_status TEXT,
  campaign_id TEXT,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS marketing_scheduled_due_idx
  ON marketing_scheduled_items (status, scheduled_at);

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS marketing_promotions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
