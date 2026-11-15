-- Guigui.com — sistema centralizado de moderação e aprovações
-- Executar depois das migrações 001–009 numa base PostgreSQL real.

CREATE TABLE IF NOT EXISTS moderation_submissions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('event', 'business', 'business_profile', 'post', 'promotion', 'campaign', 'ticket', 'other')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  reference_id TEXT,
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'in_review', 'changes_requested', 'resubmitted', 'approved', 'rejected', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_reason TEXT NOT NULL DEFAULT '',
  reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_submission_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES moderation_submissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Impede duas submissões ativas para o mesmo registo de origem.
CREATE UNIQUE INDEX IF NOT EXISTS moderation_submissions_active_reference_idx
  ON moderation_submissions (type, reference_id)
  WHERE reference_id IS NOT NULL
    AND status IN ('pending', 'in_review', 'changes_requested', 'resubmitted');

CREATE INDEX IF NOT EXISTS moderation_submissions_status_idx
  ON moderation_submissions (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS moderation_submissions_company_idx
  ON moderation_submissions (company_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS moderation_submissions_submitter_idx
  ON moderation_submissions (submitted_by, submitted_at DESC);
CREATE INDEX IF NOT EXISTS moderation_submission_events_submission_idx
  ON moderation_submission_events (submission_id, created_at ASC);
